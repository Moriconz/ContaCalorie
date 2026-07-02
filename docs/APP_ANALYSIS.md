# Analisi completa dell'app — Conta Calorie

Documento generato analizzando l'intero codebase, sezione per sezione, per ogni file/funzione/flusso: **cosa fa** e **a cosa serve**. Include una sezione "Problemi / note" per ciascun dominio, con i punti da verificare e correggere.

## Indice

1. [Dati e persistenza](#1-dati-e-persistenza) — IndexedDB, storage.js, backup/export
2. [Engine scientifici](#2-engine-scientifici) — calcoli nutrizionali, TDEE, frigo, stime
3. [App shell e flussi](#3-app-shell-e-flussi) — router, app.js, flussi pasto/ricetta
4. [Viste e componenti UI](#4-viste-e-componenti-ui) — js/ui/*, modali, form
5. [Design system e PWA](#5-design-system-e-pwa) — theme.css, tema, service worker

---

## 1. Dati e persistenza

# Livello Dati & Persistenza — ContaCalorie

Analisi di: `js/storage.js`, `js/models.js`, `js/sync/backupService.js`, `js/storage/persistence.js`.

## Panoramica

ContaCalorie è una PWA vanilla JS senza backend: tutta la persistenza è locale, nel browser.

- **Database:** IndexedDB, nome `ContaCalorieDB` (`js/storage.js:6`), versione corrente **8** (`js/storage.js:7`, commento: "v8: store `fridge`").
- **Object store:** 13 store, tutti con `keyPath: 'id'`, elencati in `STORE_NAMES` (`js/storage.js:8`): `userProfile`, `userFoods`, `mealEntries`, `remoteFoods`, `weightsSessions` (legacy), `cardioSessions`, `dailyWeights`, `bodyCompBaselines`, `recipes`, `dailySteps`, `activityPreferences`, `strengthSessions`, `fridge`.
- **Store con indice `data`:** un sottoinsieme, `DATE_INDEXED_STORES` (`js/storage.js:10`) — `mealEntries`, `cardioSessions`, `strengthSessions`, `dailySteps`, `dailyWeights` — ha un indice secondario `data` (non-unique) creato in `onupgradeneeded`, per query per intervallo di date senza full scan.
- **Connessione cacheata:** `_dbPromise` (`js/storage.js:14`) tiene in memoria la Promise della connessione già aperta, così le operazioni successive non riaprono IndexedDB ogni volta (prima si apriva una nuova connessione ad ogni chiamata, decine per render).
- **Fallback `localStorage`:** quasi ogni funzione esportata avvolge la chiamata a IndexedDB in un `try/catch`; se fallisce, scrive/legge da `localStorage` sotto chiave `ContaCalorie_{storeName}` (vedi `fallbackStorageKey`, `js/storage.js:93-95`). È un fallback **per-operazione**, non una modalità globale: non c'è un flag che dice "sto usando localStorage", quindi IndexedDB e localStorage possono divergere silenziosamente (vedi sezione Problemi).

---

## `js/storage.js`

### Costanti di modulo

- **Cosa fa:** `DB_NAME`, `DB_VERSION`, `STORE_NAMES`, `DATE_INDEXED_STORES`, `_dbPromise` (righe 6-14) definiscono identità del DB, elenco store da creare in `onupgradeneeded`, elenco store che ricevono l'indice `data`, e la cache della connessione.
- **A cosa serve:** unico punto di verità per schema e versione del DB; ogni bump di `DB_VERSION` innesca `onupgradeneeded` per applicare le migrazioni incrementali.

### `openDB()` (righe 16-68)

- **Cosa fa:** Ritorna la Promise cacheata `_dbPromise` se già presente (evita richieste concorrenti multiple). Altrimenti verifica che `window.indexedDB` esista (altrimenti rigetta con `'IndexedDB non supportato'` e azzera la cache), poi chiama `indexedDB.open(DB_NAME, DB_VERSION)`.
  - `onupgradeneeded`: per ogni nome in `STORE_NAMES`, crea lo store con `keyPath: 'id'` se non esiste già (`db.createObjectStore(name, { keyPath: 'id' })`, riga 30) — quindi la creazione degli store è **idempotente e incrementale**: ad ogni bump di versione, solo gli store nuovi vengono effettivamente creati.
  - Poi, per ogni store in `DATE_INDEXED_STORES`, esegue la migrazione v7 (righe 34-53): apre un cursore (`store.openCursor()`) su **tutti** i record esistenti dello store e per ciascuno normalizza i campi data: `const d = rec.data ?? rec.date;` — se `d` è definito e uno dei due campi non coincide con `d`, riscrive il record con `rec.data = d; rec.date = d;` tramite `cursor.update(rec)`. Solo dopo aver innescato l'iterazione crea l'indice (`store.createIndex('data', 'data', { unique: false })`) se non esiste già.
  - `onsuccess`: risolve la Promise con l'istanza `db`; imposta anche `db.onclose` e `db.onversionchange` per **invalidare** `_dbPromise` (settandola a `null`) se la connessione si chiude o se un'altra tab richiede un upgrade di versione — così la prossima chiamata a `openDB()` riapre una connessione pulita invece di restare bloccata su un handle morto.
  - `onerror`: azzera `_dbPromise` e rigetta con `request.error`.
- **A cosa serve:** è il punto di ingresso unico per ottenere una connessione al DB, con cache per performance e auto-guarigione se la connessione cade. La migrazione dentro `onupgradeneeded` garantisce che, dopo l'aggiornamento a v7+, tutti i record vecchi (salvati magari con solo `date` o solo `data`) abbiano entrambi i campi popolati, così l'indice `data` (che punta al campo `data`) li copre tutti — senza questa normalizzazione, i record scritti prima solo con `date` sarebbero invisibili alle query per intervallo basate sull'indice.

### `withStore(storeName, mode, callback)` (righe 70-91)

- **Cosa fa:** Apre il DB (`await openDB()`), crea una transazione (`db.transaction(storeName, mode)`) e uno store handle, poi invoca `callback(store)` sincronamente dentro un `try`. Gestisce tre forme di ritorno del callback:
  1. `IDBRequest` (es. `store.get(...)`, `store.getAll()`) → risolve/rigetta la Promise wrapper sugli eventi `onsuccess`/`onerror` della request.
  2. `Promise` → si aggancia con `.then/.catch`.
  3. Valore sincrono qualsiasi (es. `undefined` da `store.put(...)` chiamato senza restituire la request) → risolve quando la transazione intera completa (`tx.oncomplete`).
  Gestisce anche `tx.onerror` e `tx.onabort` come ulteriori vie di rigetto, e cattura eccezioni sincrone lanciate dal callback.
- **A cosa serve:** è l'helper centrale che astrae il boilerplate di IndexedDB (apertura transazione, gestione eventi) in un'unica funzione async/await-friendly; **ogni** funzione di lettura/scrittura del modulo passa da qui (eccetto i punti dove si usa `localStorage` come fallback).

### `fallbackStorageKey(name)` (righe 93-95)

- **Cosa fa:** Ritorna la stringa `ContaCalorie_{name}`, il prefisso di chiave usato in `localStorage`.
- **A cosa serve:** convenzione di naming unica per non collidere con altre chiavi in `localStorage` e per rendere prevedibile dove trovare il fallback di un dato store.

### `_normalizeDateFields(rec)` (righe 97-111)

- **Cosa fa:** Funzione interna (non esportata). Per un singolo record, calcola `d = rec.date ?? rec.data` e, se definito, forza `rec.date = d` e `rec.data = d`, mutando l'oggetto in place e restituendolo. Se `rec` non è un oggetto (es. `null`/`undefined`), lo ritorna invariato.
- **A cosa serve:** alcuni store storicamente usano il campo `date` (es. `strengthSessions`, `dailySteps`), altri `data` (es. `cardioSessions`, `dailyWeights`, `mealEntries` via `models.js`). Questa funzione garantisce che, **a runtime, in memoria**, ogni record letto esponga sempre entrambi i campi con lo stesso valore, così i consumer possono leggere indifferentemente `entry.date` o `entry.data`. È esplicitamente **non distruttiva su disco** — nessuna riscrittura nel DB, solo sull'oggetto restituito al chiamante (a differenza della migrazione v7 in `onupgradeneeded`, che invece scrive su disco).

### `_normalizeList(list)` (riga 113-115)

- **Cosa fa:** Se `list` è un array, applica `_normalizeDateFields` a ogni elemento via `.map`; altrimenti ritorna `list` così com'è.
- **A cosa serve:** helper di comodo per normalizzare in un colpo solo i risultati di query che restituiscono array (usato da quasi tutte le funzioni `loadAll*` / `load*ByDateRange`).

### `getAllByDate(storeName, startDate, endDate)` (righe 117-134)

- **Cosa fa:** Funzione interna async. Dentro `withStore(storeName, 'readonly', ...)`, controlla se lo store ha l'indice `data` (`store.indexNames.contains('data')`). Se sì, costruisce un `IDBKeyRange`: `IDBKeyRange.bound(startDate, endDate)` se `endDate` è fornito, altrimenti `IDBKeyRange.only(startDate)` (match esatto su un solo giorno), e interroga `store.index('data').getAll(range)`. Se l'indice **non** esiste ancora (DB non migrato, caso limite), fa fallback a `store.getAll()` — restituendo **tutti** i record dello store, non filtrati.
- **A cosa serve:** query efficiente per data/intervallo sfruttando l'indice IndexedDB invece di uno scan completo con filtro applicativo. Nota: quando fa fallback a `getAll()` senza indice, il filtro per data va comunque applicato dal chiamante (ed è infatti quello che fanno le funzioni `load*ByDate*` più sotto, che ri-filtrano sempre il risultato in JS anche quando l'indice è presente, per sicurezza/coerenza).

### `safeJsonParse(value)` (righe 136-142)

- **Cosa fa:** Wrapper di `JSON.parse` con `try/catch` che ritorna `null` in caso di errore invece di lanciare eccezione.
- **A cosa serve:** usato ovunque si legga da `localStorage` (fallback) per evitare crash su JSON corrotto o mancante.

### `_migrateMealEntry(entry)` (righe 149-190, **esportata**)

- **Cosa fa:** Prende una `entry` (voce pasto) e restituisce una nuova copia arricchita con campi mancanti, senza mutare l'originale (usa spread `{...entry, ...}`):
  - Se `entry` è falsy, ritorna `null` subito.
  - Deduce `sourceType` da `entry.sourceType` se già presente, altrimenti da euristica su `entry.origin` / `entry.foodRef?.source`: `'manual_search'` o `foodRef.source === 'USER_CUSTOM'` → `'B_PERSONALIZZATO'`; `'estimated'`/`'estimate'` → `'D_STIMA_RAPIDA'`; `'recent'` → `'E_RECENTI'`; default → `'A_DATABASE'`.
  - Deduce `confidenceLevel` (se `undefined`) in base a `sourceType`: 50 per `D_STIMA_RAPIDA`, 80 per `B_PERSONALIZZATO`, 65 per `C_PASTO_COMPOSTO`, 85 per gli altri (`A_DATABASE`, `E_RECENTI`).
  - Imposta default per: `id` (**vedi nota critica sotto**), `sourceType`, `confidenceLevel`, `isEstimated` (derivato da `sourceType`), `foodState` (default `'prepared'`), `unitaSelezionata` (default `'grammi'`), `estimatedComponents` (default `[]`), `createdAt`/`updatedAt` (default `new Date().toISOString()` se assenti).
- **A cosa serve — perché `id: entry.id || crypto.randomUUID()` è critico:** questa riga (`js/storage.js:180`) è un fix di un bug reale, documentato nel commento sopra di essa. Lo store `mealEntries` ha `keyPath: 'id'` (creato così in `openupgradeneeded`, riga 30): questo significa che **IndexedDB richiede** che ogni record salvato con `store.put(...)` abbia un campo `id` valorizzato, perché è la chiave primaria dello store. Alcuni flussi applicativi (quick-add, wizard di stima) potevano costruire una entry pasto **senza** `id`. Prima del fix, `store.put(entryFallita)` falliva con un errore IndexedDB (violazione del keyPath), il `catch` di `saveMealEntries` (righe 264-281) intercettava l'errore e faceva fallback silenzioso a `localStorage` — quindi il pasto **veniva comunque "salvato"**, ma solo in `localStorage`, non nel DB reale. Poiché tutte le letture (`loadMealsByDate`, `loadAllMeals`) provano prima IndexedDB e vanno su `localStorage` solo se **quella specifica chiamata di lettura** fallisce (non se IndexedDB è raggiungibile ma "vuoto" per quel dato), un'app che nel frattempo continua a leggere con successo da IndexedDB **non vedrà mai** quel pasto: è invisibile, sembra perso, anche se tecnicamente esiste in `localStorage`. Generare un `id` con `crypto.randomUUID()` quando manca garantisce che `store.put` non fallisca mai per questo motivo, eliminando la causa radice della perdita dati silenziosa. `_migrateMealEntry` è **esportata specificamente per un test di regressione** su questo invariante (commento riga 147-148: "Esportata per il test di regressione sull'id (invariante anti-perdita dati)").

### `_deleteMealsBySource(sourceToDelete)` (righe 196-215)

- **Cosa fa:** Funzione interna async. Dentro una transazione `readwrite` su `mealEntries`, recupera tutti i record (`store.getAll()`), e nel callback `onsuccess` itera su ognuno: se `entry.foodRef?.source === sourceToDelete`, chiama `store.delete(entry.id)`. Se l'intera operazione IndexedDB fallisce, fa fallback su `localStorage`: legge l'array (con `safeJsonParse`), filtra via gli elementi con quel `source`, riscrive l'array filtrato.
- **A cosa serve:** usata per la migrazione applicativa che rimuove le vecchie entry `TYPICAL_ESTIMATE` (vedi `loadAllMeals` sotto) — un tipo di sorgente dati dismesso che va ripulito automaticamente quando incontrato.

### CRUD `userProfile`

- **`saveUserProfile(profile)`** (righe 217-227): scrive `{...profile, id: 'current'}` (chiave fissa, singolo record) nello store `userProfile` via `store.put`, poi **sempre** duplica anche su `localStorage` (indipendentemente dal successo IndexedDB) come backup addizionale sincrono; se IndexedDB fallisce, il `catch` scrive comunque su `localStorage` (di fatto ridondante col passo precedente, ma è l'unico modo per garantire che il dato sopravviva anche se IndexedDB non è disponibile) e stampa un warning. **A cosa serve:** persiste l'unico profilo utente dell'app (single-tenant locale); il record ha sempre `id: 'current'` quindi ogni salvataggio sovrascrive il precedente.
- **`loadUserProfile()`** (righe 229-236): legge il record con `id: 'current'` da `userProfile`; se IndexedDB fallisce, legge e fa il parse di `localStorage`. **A cosa serve:** recupero del profilo utente all'avvio dell'app e ovunque servano i target nutrizionali/dati anagrafici.

### CRUD `userFoods`

- **`saveUserFoods(userFoods)`** (righe 238-249): dentro una singola transazione `readwrite`, prima `store.clear()` (svuota **tutto** lo store) poi `userFoods.forEach(food => store.put(food))` — è quindi un **replace totale**, non un merge incrementale. Duplica sempre anche su `localStorage`. **A cosa serve:** salva l'intero elenco di alimenti personalizzati creati dall'utente in un colpo solo (l'app tiene la lista in memoria e la persiste per intero ad ogni modifica).
- **`loadUserFoods()`** (righe 251-262): `store.getAll()` su `userFoods`; fallback a `localStorage` (default `[]` se assente/corrotto). **A cosa serve:** carica tutti gli alimenti custom dell'utente, usati nella ricerca/aggiunta pasto.

### CRUD `mealEntries`

- **`saveMealEntries(entries)`** (righe 264-281): per ciascuna entry in `entries`, applica `_normalizeDateFields(_migrateMealEntry(entry))` (garantisce sia l'id sia i campi data/date coerenti), imposta `updatedAt` a "ora", e fa `store.put(migratedEntry)` — quindi è un **upsert per singolo id**, non un replace totale come `saveUserFoods`. Se IndexedDB fallisce: legge l'array esistente da `localStorage`, migra le nuove entries, fa il merge escludendo dall'esistente quelli con lo stesso `id` delle nuove (`existing.filter(item => !migratedEntries.some(e => e.id === item.id))`) e concatenando le nuove — quindi anche il fallback locale evita duplicati per id. **A cosa serve:** punto di scrittura principale per i pasti registrati (aggiunta o modifica).
- **`loadMealsByDate(date)`** (righe 283-295): usa `getAllByDate('mealEntries', date)` (via indice `data` se disponibile), poi **ri-filtra** esplicitamente `entry.data === date` (ridondante quando l'indice è preciso, ma protegge dal caso di fallback a `getAll()` non filtrato), e applica `_migrateMealEntry` a ogni risultato (assicura che anche vecchi record letti abbiano tutti i campi). Fallback: stessa logica su array `localStorage`. **A cosa serve:** query più usata dalla UI — recupera i pasti di un singolo giorno per il diario/riepilogo giornaliero. **Nota:** filtra solo su `entry.data`, non su `entry.date` — se un record avesse per qualche motivo solo `date` valorizzato e non `data` (scenario teoricamente prevenuto dalla migrazione v7 e da `_normalizeDateFields` in scrittura, ma non garantito per dati scritti da percorsi che bypassano `saveMealEntries`), non verrebbe trovato da questo filtro.
- **`deleteMealEntry(id)`** (righe 297-309): `store.delete(id)` su `mealEntries`; fallback: filtra via l'elemento con quell'`id` dall'array in `localStorage` e riscrive. Commento nel codice spiega un fix precedente: prima l'eliminazione aggiornava solo lo stato in memoria (dato che `saveMealEntries` fa solo upsert, mai remove), quindi il pasto "eliminato" ricompariva dopo un reload perché restava nel DB. **A cosa serve:** cancellazione effettiva e persistente di un singolo pasto.
- **`loadAllMeals()`** (righe 311-333): `store.getAll()` su tutto `mealEntries`, poi filtra via le entry con `entry.foodRef?.source === 'TYPICAL_ESTIMATE'` e applica `_migrateMealEntry` alle rimanenti. Se il numero di elementi filtrati è diverso dal totale originale (cioè ne ha trovate e rimosse alcune), chiama `_deleteMealsBySource('TYPICAL_ESTIMATE')` per **persistere** la pulizia nel DB (side effect di scrittura dentro una funzione che si chiama "load"). Fallback equivalente su `localStorage` (ma qui **senza** la chiamata di persistenza della pulizia, dato che opera già direttamente sull'array locale... in realtà nel ramo fallback non c'è nessuna riscrittura esplicita del `localStorage` ripulito — vedi Problemi). **A cosa serve:** carica lo storico completo di tutti i pasti (usato da grafici, statistiche, export) e contestualmente rimuove dati legacy obsoleti (`TYPICAL_ESTIMATE`, un tipo di sorgente dismesso).

### Cache alimenti remoti (`remoteFoods`)

- **`cacheRemoteFood(foodItem)`** (righe 335-341): `store.put(foodItem)` su `remoteFoods`; se fallisce, solo `console.warn`, **nessun fallback a `localStorage`**. **A cosa serve:** cache locale di elementi alimentari ottenuti da fonte remota (es. API esterna di ricerca alimenti), per evitare richieste ripetute; usata da `js/nutritionDataProvider.js`.
- **`loadRemoteFoodCache(id)`** (righe 343-349): `store.get(id)`; se fallisce ritorna `null`. **A cosa serve:** lettura della cache per un singolo alimento remoto per `id`.

### `syncToCloud()` (righe 351-353)

- **Cosa fa:** Ritorna `Promise.resolve({ message: 'Sync non implementato. Stub pronta per estensione futura.' })` — nessuna logica reale.
- **A cosa serve:** placeholder/stub per una futura funzionalità di sincronizzazione cloud, attualmente non collegata a nessun backend (coerente con l'assenza di backend nell'app).

### `initStorage()` (righe 356-362, **esportata**)

- **Cosa fa:** `await openDB()` (apre/verifica la connessione reale) poi `await _migrateWeightsToStrength()` (esegue la migrazione una-tantum, vedi sotto), infine ritorna `true`.
- **A cosa serve:** funzione di warmup chiamata una sola volta all'avvio dell'app (in `js/appBootstrap.js:36`) per garantire che il DB sia pronto e le migrazioni una-tantum siano state applicate prima che il resto dell'app inizi a leggere/scrivere.

### `_migrateWeightsToStrength()` (righe 369-384)

- **Cosa fa:** Migrazione applicativa una-tantum (diversa dalla migrazione di schema in `onupgradeneeded`). Controlla un flag in `localStorage` (`weightsMigratedToStrength === '1'`); se già presente, esce subito (no-op). Altrimenti legge tutti i record dal vecchio store `weightsSessions` (store legacy della v2, ancora presente in `STORE_NAMES` ma non più scritto direttamente da nessuna funzione esportata) e per ognuno chiama `saveStrengthSession({...rec, date: rec.date || rec.data})` per ricrearlo nel nuovo store `strengthSessions`. Dopo aver migrato tutti i record, svuota lo store legacy (`withStore('weightsSessions', 'readwrite', store => store.clear())`) e logga quanti record ha migrato. Alla fine (o se non c'erano record da migrare) imposta il flag `localStorage.setItem('weightsMigratedToStrength', '1')`. Se qualcosa fallisce, cattura l'errore e stampa un warning, **senza** impostare il flag (quindi ritenterà al prossimo avvio).
- **A cosa serve:** consolidare i dati storici salvati nel vecchio modello `weightsSessions` (DB v2) nel nuovo modello più ricco `strengthSessions` (DB v5), così l'app può smettere di leggere dal vecchio store pur preservando i dati storici dell'utente.

### `getDbStats()` (righe 387-398, **esportata**)

- **Cosa fa:** Per ogni nome in `STORE_NAMES`, prova a leggere `store.getAll()` e conta gli elementi (`Array.isArray(all) ? all.length : 0`); in caso di errore per quello store, registra `0`. Ritorna un oggetto `{ storeName: count, ... }`.
- **A cosa serve:** diagnostica/debug — dare una fotografia rapida di quanti record ci sono in ciascuno store del DB reale (es. per una pagina impostazioni/debug).

### `clearStore(storeName)` (righe 401-407, **esportata**)

- **Cosa fa:** `withStore(storeName, 'readwrite', store => store.clear())`; in caso di errore, solo `console.warn` (nessun fallback, nessuna propagazione dell'errore al chiamante).
- **A cosa serve:** helper generico per svuotare completamente un singolo store; usato da `importAllUserData` in modalità `'replace'` prima di ripopolare i dati da un backup.

### `loadAllStrengthSessions()` / `loadAllDailySteps()` (righe 410-425, **esportate**)

- **Cosa fa:** Entrambe fanno `store.getAll()` sul rispettivo store (`strengthSessions` / `dailySteps`) e applicano `_normalizeList` al risultato; fallback a `[]` in caso di errore (nessun fallback `localStorage` per questi due).
- **A cosa serve:** recupero completo, senza filtro data, di tutte le sessioni forza / di tutti i record passi — usato tipicamente per export/statistiche aggregate su tutto lo storico.

### CRUD `cardioSessions`

- **`saveCardioSession(session)`** (righe 431-444): costruisce `toSave` con `_normalizeDateFields`, `id` generato se assente, `createdAt`/`updatedAt` gestiti; `store.put(toSave)`; ritorna il record salvato (utile al chiamante per conoscere l'`id` generato). Nessun fallback `localStorage` esplicito (solo `console.warn`). **A cosa serve:** registrare una sessione cardio.
- **`loadCardioSessions(date)`** (righe 446-453): `getAllByDate` + filtro `(s.data ?? s.date) === date` + `_normalizeList`. **A cosa serve:** sessioni cardio di un giorno specifico.
- **`loadAllCardioSessions()`** (righe 455-461): `store.getAll()` + `_normalizeList`. **A cosa serve:** tutto lo storico cardio (usato anche da `backupService.exportAllUserData`).
- **`deleteCardioSession(id)`** (righe 463-469): `store.delete(id)`. **A cosa serve:** rimozione di una sessione cardio.

### CRUD `dailyWeights`

- **`saveDailyWeight(entry)`** (righe 473-482): usa **la data come `id`** se `entry.id` è assente (`entry.id || entry.data || entry.date`) — quindi questo store è di fatto indicizzato per data tramite la chiave primaria stessa (un record per giorno, l'upsert su una nuova pesata dello stesso giorno sovrascrive quella precedente). **A cosa serve:** registrare il peso corporeo giornaliero.
- **`loadDailyWeights()`** (righe 484-491): `getAll()`, poi ordina per data crescente (`new Date(a.data) - new Date(b.data)`), poi `_normalizeList`. **Nota:** ordina usando `a.data`/`b.data` **prima** di normalizzare — se un vecchio record avesse solo `date` e non `data`, `new Date(undefined)` produce `Invalid Date` (comparazione instabile, non un crash, ma un ordinamento potenzialmente scorretto per quel record). **A cosa serve:** serie temporale completa del peso per grafici di andamento.
- **`loadDailyWeightByDate(date)`** (righe 493-499): `store.get(date)` (lookup diretto per chiave primaria, dato che l'id è la data) + `_normalizeDateFields`. **A cosa serve:** lookup puntuale del peso di un giorno specifico.

### CRUD `bodyCompBaselines`

- **`saveBodyCompBaseline(baseline)`** (righe 503-509): `store.put(baseline)` diretto, **nessuna normalizzazione o generazione id** — si presume che il chiamante fornisca già un oggetto completo con `id` proprio (probabilmente una data, dato `deleteBodyCompBaseline(dateBaseline)`). **A cosa serve:** salvare un punto di riferimento (baseline) di composizione corporea.
- **`loadBodyCompBaselines()`** (righe 511-517): `getAll()` puro, nessuna normalizzazione data. **A cosa serve:** recuperare tutte le baseline salvate.
- **`deleteBodyCompBaseline(dateBaseline)`** (righe 519-525): `store.delete(dateBaseline)` — il parametro si chiama `dateBaseline`, coerente con l'ipotesi che l'`id` di questo store sia la data stessa. **A cosa serve:** rimuovere una baseline.

### CRUD `recipes`

- **`saveRecipe(recipe)`** (righe 529-543): genera `id` se assente, gestisce `createdAt`/`updatedAt`; a differenza della maggior parte delle altre funzioni, **rilancia l'errore** (`throw error`) invece di limitarsi a loggarlo — quindi il chiamante deve gestire il fallimento esplicitamente (nessun fallback silenzioso). **A cosa serve:** creare/salvare una ricetta.
- **`loadRecipes()`** (righe 545-555): `getAll()`; fallback a `[]`. **A cosa serve:** elenco di tutte le ricette salvate.
- **`loadRecipeById(id)`** (righe 557-563): `store.get(id)`; fallback `null`. **A cosa serve:** dettaglio di una singola ricetta.
- **`updateRecipe(id, updates)`** (righe 565-582): legge il record esistente, lancia errore esplicito se non trovato (`Ricetta ${id} non trovata`), fa merge (`{...existing, ...updates, id, updatedAt: now}`) e `put`. Rilancia l'errore in caso di fallimento. **A cosa serve:** aggiornamento parziale di una ricetta esistente preservando i campi non modificati.
- **`deleteRecipe(id)`** (righe 584-591): `store.delete(id)`, rilancia l'errore in caso di fallimento. **A cosa serve:** cancellazione di una ricetta.

### CRUD `strengthSessions`

- **`saveStrengthSession(session)`** (righe 595-607): come `saveCardioSession`, genera `id`/timestamp e normalizza i campi data; **non** ritorna il record salvato (a differenza di `saveCardioSession`) — solo `console.warn` in caso di errore (nessun `throw`, nessun return value). **A cosa serve:** registrare una sessione di allenamento con i pesi/forza.
- **`loadStrengthSessionsByDateRange(startDate, endDate)`** (righe 609-616): `getAllByDate` + filtro esplicito sull'intervallo (ridondante se l'indice ha già filtrato, ma protegge dal fallback senza indice) + `_normalizeList`. **A cosa serve:** query per intervallo di date, usata per statistiche/grafici periodici.
- **`updateStrengthSession(id, updates)`** (righe 618-627): legge esistente, lancia errore se non trovato, merge e `put`; **qui l'errore viene solo loggato**, non rilanciato (incoerenza rispetto a `updateRecipe`, vedi Problemi). **A cosa serve:** modifica parziale di una sessione forza.
- **`deleteStrengthSession(id)`** (righe 629-635): `store.delete(id)`. **A cosa serve:** cancellazione di una sessione forza.

### CRUD `dailySteps`

- **`saveDailySteps(stepsRecord)`** (righe 639-650): usa la data come `id` se assente (`stepsRecord.id || stepsRecord.date || stepsRecord.data`), normalizza i campi data, aggiorna `updatedAt`. **A cosa serve:** salvare il conteggio passi di un giorno (un record per giorno, come `dailyWeights`).
- **`loadDailyStepsByDate(date)`** (righe 652-658): `store.get(date)` + normalizzazione. **A cosa serve:** lookup passi per un giorno specifico.
- **`loadDailyStepsByDateRange(startDate, endDate)`** (righe 660-667): `getAllByDate` + filtro range + sort crescente per data + normalizzazione. **A cosa serve:** serie storica passi per grafici.
- **`deleteDailySteps(date)`** (righe 669-675): `store.delete(date)`. **A cosa serve:** rimuovere il record passi di un giorno (es. correzione dati).

### `activityPreferences`

- **`saveActivityPreferences(prefs)`** (righe 679-690): chiave fissa `id: 'current'` (record singolo, come `userProfile`), aggiorna `updatedAt`. **A cosa serve:** persistere le preferenze dell'utente relative al tracking attività (es. sorgente passi, unità).
- **`loadActivityPreferences()`** (righe 692-698): `store.get('current')`; fallback `null`. **A cosa serve:** lettura delle preferenze salvate.

### `loadCardioSessionsByDateRange` / `updateCardioSession` (righe 700-720)

- **`loadCardioSessionsByDateRange(startDate, endDate)`** (righe 702-709): stessa pattern di `loadStrengthSessionsByDateRange` ma su `cardioSessions`, con sort crescente aggiuntivo. **A cosa serve:** serie storica cardio per intervallo, per grafici periodici.
- **`updateCardioSession(id, updates)`** (righe 711-720): legge esistente, lancia se non trovato, merge e `put`; errore solo loggato (non rilanciato, come `updateStrengthSession`). **A cosa serve:** modifica parziale di una sessione cardio esistente.

### CRUD `fridge` (DB v8 — "Il Tuo Frigo")

Schema documentato in commento (righe 723-724): `{ id, foodId, source, nome, quantity, unit('g'|'ml'|'pz'), expiresAt(ts ms|null), per100g:{kcal,proteine,carboidrati,grassi,...} }`.

- **`loadFridgeItems()`** (righe 726-736): `store.getAll()` su `fridge`; fallback `[]`. **A cosa serve:** elenco di tutti gli alimenti attualmente in "frigo" (inventario dell'utente).
- **`saveFridgeItem(item)`** (righe 738-750): genera `id` se assente, imposta `updatedAt`; **a differenza di quasi tutte le altre `save*`, qui l'oggetto `toSave` viene costruito e ritornato SEMPRE (anche se il `try` di `withStore` fallisce)** — il `return toSave` è fuori dal blocco `try/catch`, quindi la funzione ritorna comunque l'oggetto con l'id generato anche quando la persistenza reale è fallita silenziosamente (loggando solo un warning). **A cosa serve:** aggiungere/aggiornare un elemento nell'inventario frigo.
- **`deleteFridgeItem(id)`** (righe 752-758): `store.delete(id)`. **A cosa serve:** rimuovere un elemento dal frigo (es. consumato o scaduto).

**Nota:** lo store `fridge` **non ha alcun fallback a `localStorage`** in nessuna delle tre funzioni (solo `console.warn`), a differenza di `userProfile`, `userFoods`, `mealEntries` — se IndexedDB non è disponibile, i dati del frigo semplicemente non vengono salvati/letti, senza avviso visibile all'utente oltre alla console.

---

## `js/models.js`

Non contiene persistenza diretta: definisce enum e factory function con valori di default, usate dai chiamanti prima di passare i dati a `storage.js`.

- **Enum esportati** (righe 6-10, 87-89): `UserSex`, `ActivityLevels`, `Goals`, `MealMoments`, `Origins`, `WeightsSplitTypes`, `CardioTypes`, `IntensityLevels` — liste di valori ammessi per i rispettivi campi, usate presumibilmente per validazione/select UI. **A cosa serve:** documentare/vincolare i valori validi lato applicativo (nessuna validazione è imposta a livello di storage.js, che accetta qualunque oggetto).
- **`emptyUserProfile`** (righe 12-24): oggetto profilo con valori di default (es. `altezzaCm: 170`, `pesoKg: 70`, `attività: 'sedentario'`). **A cosa serve:** stato iniziale per un nuovo utente, prima che compili il proprio profilo.
- **`emptyNutritionTargets`** (righe 26-33): target nutrizionali di default (`calorie: 2000`, ecc). **A cosa serve:** fallback quando l'utente non ha ancora target personalizzati.
- **`createFoodItem(fields = {})`** (righe 35-55): factory che ritorna un oggetto alimento con `id` generato via `crypto.randomUUID()` se non fornito, `source` default `'USER_CUSTOM'`, e un sotto-oggetto `per100g` con tutti i valori nutrizionali di default a `0` se non forniti (merge shallow campo per campo, non spread dell'intero `per100g`). **A cosa serve:** costruire un nuovo alimento (personalizzato) con una struttura dati coerente e completa, pronta per `saveUserFoods`.
- **`createMealEntry(fields = {})`** (righe 57-69): factory per una voce pasto; **importante:** il campo data è `data: fields.data || new Date().toISOString().slice(0, 10)` (formato `YYYY-MM-DD`) — coerente con la convenzione "campo `data`" usata da `mealEntries` in `storage.js`. Genera `id` via `crypto.randomUUID()` se assente **qui**, quindi in teoria le entry create tramite questa factory hanno già un `id` prima ancora di arrivare a `_migrateMealEntry` (che fa comunque da rete di sicurezza per gli altri percorsi che non usano questa factory, il vero scenario del bug fixato). **A cosa serve:** punto di creazione standard di una voce pasto con struttura completa (`foodRef`, `grammi`, `macroCalcolate`, `origin`, ecc.).
- **`createDailySummary(fields = {})`** (righe 71-83): factory per un riepilogo giornaliero aggregato (totali calorie/macro + confronto con target). **A cosa serve:** struttura dati per la UI di riepilogo giorno; non risulta persistita direttamente da nessuna funzione di `storage.js` (è probabilmente calcolata al volo dai `mealEntries`, non salvata come store a sé).
- **Commenti di documentazione shape** (righe 91-121): blocchi di commento (non codice eseguito) che documentano la forma attesa di `WeightsSession`, `CardioSession`, `DailyWeight` — utili come riferimento ma non imposti a runtime.

---

## `js/sync/backupService.js`

Nota di modulo importante (righe 1-7): in precedenza questo modulo operava su un DB diverso (`conta-calorie-db` via un `indexedDbClient` non più presente in questi 4 file), che l'app non popolava mai, producendo backup vuoti. È stato corretto per usare direttamente le funzioni di `storage.js`, la stessa fonte dati usata dall'app — quindi ora `exportAllUserData`/`importAllUserData` sono garantiti allineati a ciò che l'app effettivamente legge/scrive.

### `EXPORT_VERSION = 2` (riga 24)

- **Cosa fa:** Costante di versione del formato di export.
- **A cosa serve:** taggare ogni file di backup con la versione del formato, per permettere a `validateExportData`/`importAllUserData` di gestire retrocompatibilità con formati precedenti (v1).

### `exportAllUserData()` (righe 29-69, **esportata**)

- **Cosa fa:** Lancia in parallelo (`Promise.all`) 11 letture: `loadUserProfile`, `loadUserFoods`, `loadAllMeals`, `loadAllCardioSessions`, `loadAllStrengthSessions`, `loadDailyWeights`, `loadAllDailySteps`, `loadBodyCompBaselines`, `loadRecipes`, `loadActivityPreferences`, `loadFridgeItems`. Costruisce e ritorna un oggetto con: `version` (=`EXPORT_VERSION`), `exportedAt` (ISO timestamp corrente), `appVersion` (stringa hardcoded `'0.2.0'`), e tutti i dati caricati, con default (`|| null` o `|| []`) per ogni campo se la lettura corrispondente è risultata vuota/fallita. In caso di eccezione, logga e rilancia un nuovo `Error` con messaggio `Errore durante export: {message}`.
- **A cosa serve:** produce lo snapshot completo e serializzabile di **tutti** i dati utente presenti nel DB reale, usato sia per il download manuale sia come base per l'oggetto validato/importato altrove. **Nota:** lo store `fridge` **è incluso** nell'export (riga 34, 46, 63) — confermato secondo la richiesta di verifica.
- **Store esclusi dall'export:** `remoteFoods` (cache, per definizione non è "dato utente" da preservare) e `weightsSessions` legacy (già migrato in `strengthSessions` da `_migrateWeightsToStrength`, quindi non dovrebbe più contenere dati al momento dell'export in condizioni normali).

### `downloadBackupFile()` (righe 74-97, **esportata**)

- **Cosa fa:** Chiama `exportAllUserData()`, serializza in JSON pretty-printed (`JSON.stringify(exportData, null, 2)`), crea un `Blob`, genera un nome file `conta-calorie-backup-{YYYY-MM-DD}.json`, crea dinamicamente un elemento `<a>` con `download` attribute, lo clicca programmaticamente per innescare il download del browser, poi lo rimuove e rilascia l'URL oggetto (`URL.revokeObjectURL`). Logga successo o rilancia l'errore.
- **A cosa serve:** unico punto della UI per scaricare un file di backup completo sul filesystem locale dell'utente (dato che non c'è backend/cloud sync reale).

### `validateExportData(data)` (righe 102-122, **esportata**)

- **Cosa fa:** Validazione difensiva prima di importare un file: verifica che `data` sia un oggetto non-null; che `data.version` sia un `number`; che `data.exportedAt` esista; se `data.userProfile` è presente, verifica che abbia un campo `nome` (altrimenti considera il profilo incompleto e rigetta l'intero file); infine, per un elenco di chiavi note (`meals`, `userFoods`, `weightsSessions`, `cardioSessions`, `strengthSessions`, `dailyWeights`, `dailySteps`, `bodyCompBaselines`, `recipes`), se il campo è presente deve essere un array altrimenti fallisce. Ritorna `{ valid: true }` o `{ valid: false, error: '...' }`.
- **A cosa serve:** guardia di integrità minima prima di procedere con un import distruttivo (soprattutto in modalità `'replace'`), per evitare di corrompere lo stato con un file malformato. **Nota:** questo elenco di chiavi validate **non include `fridge`** né `activityPreferences` — se presenti e non-array (per `fridge`) non verrebbero rilevati come errore qui (vedi Problemi).

### `importAllUserData(data, mode = 'replace')` (righe 129-172, **esportata**)

- **Cosa fa:** Prima chiama `validateExportData(data)` e lancia se non valido. Poi, se `mode === 'replace'`, esegue in parallelo `clearStore` su 9 store: `mealEntries`, `userFoods`, `cardioSessions`, `strengthSessions`, `dailyWeights`, `dailySteps`, `bodyCompBaselines`, `recipes`, `fridge` (nota: **non** svuota `userProfile`, `remoteFoods`, `activityPreferences`, `weightsSessions` — l'import di questi campi in modalità replace si sovrappone senza pulizia preventiva, ma per `userProfile`/`activityPreferences` va bene perché sono record a chiave fissa `'current'` che vengono comunque sovrascritti dal `put` successivo). Poi, indipendentemente dal `mode`:
  - Se `data.userProfile` esiste, `saveUserProfile(data.userProfile)`.
  - Se `data.userFoods` è un array non vuoto, `saveUserFoods(...)` (replace totale, come già visto).
  - Se `data.meals` è un array non vuoto, `saveMealEntries(...)` (upsert).
  - **Back-compat weightsSessions:** per ogni elemento in `data.weightsSessions || []`, chiama `saveStrengthSession({...s, date: s.date || s.data})` — quindi un vecchio backup v1 che conteneva sessioni pesi nel formato legacy viene comunque importato correttamente nel nuovo store `strengthSessions`, assicurando il campo `date`.
  - Poi, ciclo sequenziale (`for...of` con `await`, non parallelo) su `cardioSessions`, `strengthSessions`, `dailyWeights`, `dailySteps`, `bodyCompBaselines`, `recipes`, `fridge`: per ognuno chiama la rispettiva `save*` funzione elemento per elemento.
  - Infine, se `data.activityPreferences` esiste, `saveActivityPreferences(...)`.
  - Logga successo o cattura e rilancia l'errore con messaggio `Errore durante import: {message}`.
- **A cosa serve:** ripristinare un backup precedentemente esportato con `exportAllUserData`/`downloadBackupFile`, in due modalità: `'replace'` (svuota prima gli store elencati, poi ripopola — utile per un ripristino pulito su un dispositivo nuovo o dopo un reset) o `'merge'` (nessuno svuotamento, solo upsert — utile per unire dati da due dispositivi/backup diversi). Conferma esplicitamente che `fridge` è incluso sia nello svuotamento (`clearStore('fridge')`) sia nel ripristino (`for (const f of data.fridge || []) await saveFridgeItem(f)`).

---

## `js/storage/persistence.js`

Modulo separato e indipendente da `storage.js`: non tocca IndexedDB/localStorage, ma l'API browser `navigator.storage` per gestione quota e persistenza "hard" dello storage del browser (protezione da eviction automatica).

### `ensurePersistentStorage()` (righe 14-33, **esportata**)

- **Cosa fa:** Feature detection: se `navigator.storage`/`navigator.storage.persist` non esistono, logga un'informazione e ritorna `false` subito. Altrimenti chiama `await navigator.storage.persist()`, logga se concesso o rifiutato, e ritorna il booleano risultante. In caso di eccezione, la cattura, logga un warning e ritorna `false`.
- **A cosa serve:** richiede esplicitamente al browser la modalità "persistent storage", che su browser moderni riduce/elimina il rischio che il browser cancelli automaticamente i dati IndexedDB/localStorage dell'app quando lo spazio disco scarseggia (comportamento di eviction "best-effort" altrimenti applicabile a origin non "persistite"). Non garantisce che l'utente/browser conceda il permesso.

### `getStorageInfo()` (righe 38-71, **esportata**)

- **Cosa fa:** Feature detection su `navigator.storage.estimate`; se assente, ritorna un oggetto con tutti i campi `null`/`false`. Altrimenti chiama `await navigator.storage.estimate()` (ritorna `{quota, usage}` in byte), calcola `percentUsed` (arrotondato, `0` se `quota` è `0` o assente), e verifica lo stato di persistenza corrente con `navigator.storage.persisted?.()` (optional chaining, con fallback `false` se il metodo non esiste). Ritorna `{ quota, usage, percentUsed, persisted }`. Cattura eccezioni e ritorna l'oggetto "vuoto" in caso di errore.
- **A cosa serve:** fornisce dati di quota/utilizzo storage per una eventuale UI diagnostica (es. una barra "hai usato X MB su Y MB") e per sapere se lo storage è già persistito.

### `logStorageInfo()` (righe 76-89, **esportata**)

- **Cosa fa:** Chiama `getStorageInfo()`; se `info.quota` è falsy, logga che l'estimate non è disponibile e ritorna. Altrimenti calcola MB usati/quota con due decimali, uno stato testuale con emoji (`🔒 Persistente` / `⏳ Non persistente`), e stampa un log riassuntivo formattato in console.
- **A cosa serve:** utility di debug rapido da console (probabilmente chiamata all'avvio o su richiesta) per ispezionare lo stato dello storage senza dover aprire manualmente gli strumenti sviluppatore su Application > Storage.

### `isPersistenceSupported()` / `isEstimateSupported()` (righe 94-103, **esportate**)

- **Cosa fa:** Due funzioni sincrone di pura feature-detection: verificano rispettivamente l'esistenza di `navigator.storage.persist` e `navigator.storage.estimate` tramite doppia negazione (`!!(...)`).
- **A cosa serve:** permettono al resto dell'app (es. UI impostazioni) di decidere se mostrare/abilitare controlli legati a queste funzionalità senza dover richiamare le funzioni async corrispondenti solo per un check di supporto.

---

## Problemi / note

- **Fallback `localStorage` incoerente tra funzioni.** Non tutte le funzioni hanno un fallback a `localStorage`: `userProfile`, `userFoods`, `mealEntries` ce l'hanno; `cardioSessions`, `strengthSessions`, `dailyWeights`, `dailySteps`, `bodyCompBaselines`, `recipes`, `activityPreferences`, `fridge`, `remoteFoods` no (solo `console.warn`, dato perso silenziosamente se IndexedDB non è disponibile in quel momento). Questo significa che il livello di robustezza contro un fallimento di IndexedDB varia molto a seconda del tipo di dato, senza una policy dichiarata.
- **Il fallback `localStorage` è invisibile alle letture successive da IndexedDB.** È il meccanismo alla base del bug storico già fixato per `mealEntries` (id mancante → `put` falliva → fallback locale → dato invisibile alle letture IndexedDB che invece hanno successo). Lo stesso pattern strutturale esiste ancora per **qualunque altra funzione** che abbia sia un percorso di scrittura IndexedDB sia un fallback `localStorage`: se una singola operazione fallisce per un motivo diverso e transitorio (es. quota superata, tab in stato di lock), il dato finisce nel fallback e resta lì finché non viene esplicitamente migrato — non esiste alcun meccanismo di "riconciliazione" che sposti dati da `localStorage` a IndexedDB una volta che quest'ultimo torna disponibile (a differenza della migrazione `weightsSessions → strengthSessions`, che invece è un caso esplicito e mirato).
- **`saveUserFoods` fa un replace totale (`clear()` + reinsert), non un merge.** Se la chiamata viene fatta con una lista parziale per errore applicativo, si perde silenziosamente tutto il resto — non c'è validazione a livello storage che la lista passata sia "completa".
- **`loadAllMeals()` in fallback `localStorage` non persiste la pulizia di `TYPICAL_ESTIMATE`.** Nel ramo IndexedDB, se trova entry `TYPICAL_ESTIMATE` le filtra e poi chiama `_deleteMealsBySource` per cancellarle davvero dal DB. Nel ramo `catch` (fallback), filtra l'array letto da `localStorage` solo per il valore di ritorno, ma **non riscrive** `localStorage` con l'array ripulito — quindi la prossima lettura da fallback ritroverà di nuovo le stesse entry obsolete (comportamento non simmetrico rispetto al ramo principale, anche se innocuo perché rifiltrato ogni volta).
- **`updateStrengthSession` e `updateCardioSession` non rilanciano l'errore**, mentre `updateRecipe` sì. Un chiamante che si aspetta di poter fare `try/catch` attorno a `updateStrengthSession`/`updateCardioSession` per sapere se l'update è fallito non riceverà mai un'eccezione — l'errore viene solo loggato in console. Incoerenza tra funzioni molto simili nello stesso file.
- **Store senza indice `data`/`date`:** `bodyCompBaselines`, `recipes`, `userFoods`, `userProfile`, `remoteFoods`, `activityPreferences`, `fridge`, `weightsSessions` non hanno alcun indice secondario — ogni query diversa dal lookup per `id` primario (es. filtrare `recipes` per categoria, o `fridge` per `expiresAt`) richiede necessariamente un full scan (`getAll()` + filtro JS). Per `fridge` in particolare, un campo `expiresAt` pensato per "scadenza" senza indice implica che qualunque futura vista "in scadenza a breve" dovrà scansionare tutto lo store.
- **`fridge` non ha fallback `localStorage` né normalizzazione data**, a differenza degli altri store più vecchi — coerente con essere lo store più recente (v8), ma significa che è anche il meno resiliente a un fallimento transitorio di IndexedDB.
- **`validateExportData` non valida `fridge` e `activityPreferences`.** L'elenco di chiavi controllate come array (riga 116 di `backupService.js`) non include `fridge` (che dovrebbe essere un array) né altri campi introdotti più di recente — un backup con `fridge` malformato (es. oggetto invece di array) supererebbe la validazione e fallirebbe più avanti, dentro il `for (const f of data.fridge || [])` di `importAllUserData`, con un errore meno chiaro (o silenzioso, se `data.fridge` fosse un oggetto iterabile per errore).
- **`saveFridgeItem` ritorna sempre il record "costruito" anche se la scrittura reale è fallita.** Il `return toSave` è fuori dal `try/catch` (righe 738-750 di `storage.js`): un chiamante che usa il valore di ritorno per aggiornare lo stato UI penserà che il salvataggio sia riuscito anche quando in realtà `withStore` ha fallito e solo un `console.warn` è stato stampato — nessuna propagazione dell'errore, nessun modo per il chiamante di distinguere "salvato" da "fallito silenziosamente". Le altre `save*` con generazione automatica di id (`saveCardioSession`, `saveStrengthSession`) hanno lo stesso pattern di `return`/assenza di `throw`, ma **solo dentro** il blocco `try`, quindi in caso di errore ritornano `undefined` (comportamento comunque ambiguo, ma almeno non restituiscono un falso "successo" con dati completi).
- **Store legacy `weightsSessions` resta nello schema (`STORE_NAMES`) e nel DB anche dopo la migrazione.** `_migrateWeightsToStrength` lo svuota (`clear()`) ma non lo rimuove dallo schema — IndexedDB non permette la rimozione di uno store se non dentro un nuovo `onupgradeneeded` con `db.deleteObjectStore`, che qui non viene mai invocato. Lo store resta quindi presente ma vuoto indefinitamente, e continua a comparire (con conteggio 0) in `getDbStats()`.
- **`getAllByDate` con fallback a `getAll()` senza indice restituisce l'intero store**, non filtrato: se un chiamante si dimenticasse di ri-filtrare il risultato per data (la maggior parte delle funzioni lo fa correttamente, ma è un contratto implicito e non imposto dal tipo di ritorno), otterrebbe silenziosamente dati di tutte le date invece che del solo intervallo richiesto. Questo scenario si verifica solo se l'indice `data` non esiste ancora, cioè teoricamente solo prima che `onupgradeneeded` sia stato eseguito per la v7 — nella pratica un caso limite raro ma non impossibile (es. errore durante la migrazione stessa).
- **`loadDailyWeights()` ordina prima di normalizzare i campi data**, usando `new Date(a.data)`/`new Date(b.data)`: per record che storicamente avessero solo `date` valorizzato (non `data`), il confronto userebbe `Invalid Date`, con ordinamento non garantito per quei record specifici (non causa un crash, ma un comportamento silenzioso e difficile da diagnosticare).
- **`appVersion: '0.2.0'` è hardcoded** in `exportAllUserData` (riga 52 di `backupService.js`), non letto da `package.json` o altra fonte di verità — rischio che diventi disallineato dalla versione reale dell'app nel tempo.
- **Nessuna validazione di schema sui singoli elementi in import** (`data.meals`, `data.cardioSessions`, ecc.): `validateExportData` controlla solo che i campi siano array, non che ogni elemento al loro interno abbia una forma valida — un elemento malformato in mezzo a un array altrimenti valido passerebbe la validazione e fallirebbe (o produrrebbe dati corrotti silenziosamente) solo più avanti, dentro le singole `save*`.

---

## 2. Engine scientifici

# 02 — Motori scientifici e di calcolo

Analisi puntuale (file:line) di tutti i moduli di calcolo nutrizionale, energetico, di composizione corporea e del modulo "Il Tuo Frigo". Tutte le funzioni elencate sono pure (nessun I/O) salvo dove esplicitamente indicato.

---

## `js/nutritionEngine.js`

Calcoli puri per macro, target energetici e riepiloghi giornalieri (`js/nutritionEngine.js:1-4`).

### Costanti

- **`ACTIVITY_FACTORS`** (`js/nutritionEngine.js:6-11`): fattori moltiplicativi TDEE = BMR × fattore, stile Harris-Benedict/Mifflin classico: `sedentario 1.2`, `leggero 1.375`, `moderato 1.55`, `intenso 1.725`. A cosa serve: usati in `calculateEnergyTargets` per convertire BMR in TDEE.
- **`CALORIE_ADJUSTMENT`** (`js/nutritionEngine.js:13-17`): percentuale di aggiustamento del TDEE per obiettivo: `dimagrire -0.15` (−15%), `mantenere 0`, `massa +0.1` (+10%). A cosa serve: deficit/surplus calorico target.
- **`PROTEIN_G_PER_KG`** (`js/nutritionEngine.js:19-23`): grammi proteine per kg di peso corporeo per obiettivo: `dimagrire 1.8`, `mantenere 1.4`, `massa 2.0`. A cosa serve: target proteico giornaliero.
- **`FAT_RATIO`** (`js/nutritionEngine.js:25`) = `0.25`: quota di calorie giornaliere da grassi (25%).
- **`DEFAULT_FIBER_TARGET`** (`js/nutritionEngine.js:26`) = `28` g/giorno.
- **`DEFAULT_SUGAR_THRESHOLD`** (`js/nutritionEngine.js:27`) = `40` g/giorno (soglia zuccheri semplici, non un target da raggiungere ma un tetto).
- **`SODIUM_THRESHOLD`** (`js/nutritionEngine.js:28`) = `2300` mg/giorno (soglia OMS/linee guida ipertensione).
- **`SATURATED_FAT_THRESHOLD`** (`js/nutritionEngine.js:29`) = `18` g/giorno (soglia per condizione colesterolo alto).

### `calculateMacrosForAmount(foodItem, grams)` — `js/nutritionEngine.js:31-44`

**Cosa fa:** calcola i macro assoluti per una porzione data. `ratio = grams/100`. Legge i valori "per 100g" da `foodItem.per100g` (o direttamente da `foodItem` se non annidato, fallback `|| {}`). Ritorna un oggetto con `kcal` (arrotondato a intero, `toFixed(0)`), `proteine`, `carboidrati`, `zuccheri`, `grassi` (1 decimale), `grassi_saturi` e `fibra` (1 decimale, con fallback a `0` se assenti nella fonte), `sodioMg` (intero, fallback `0`).
**Nota tipo:** `Number(x.toFixed(n))` restituisce comunque un `number`, non una stringa — pattern corretto per arrotondare mantenendo il tipo numerico.
**A cosa serve:** funzione base riusata ovunque nell'app per convertire dati "per 100g" in macro di una porzione reale: usata da `estimationEngine.js:318,362`, `composedMealWizard.js:313,329`, `js/ui/fridgeView.js` (indirettamente via `aggregateDailySummary`).

### `calculateEnergyTargets(profile)` — `js/nutritionEngine.js:46-77`

**Cosa fa:** calcola i target energetici e macro giornalieri di un profilo utente.
- **Età**: se `profile.dataNascita` esiste, `age = max(16, floor((now - dataNascita) / 31557600000))` (31557600000 ms = 365.25 giorni, cioè un anno "giuliano" medio); altrimenti default `30`. Il clamp minimo è `16` anni.
- **Peso/altezza**: `profile.pesoKg || 70`, `profile.altezzaCm || 170` (default se assenti o falsy — **attenzione**: `0` viene trattato come assente).
- **BMR — formula Mifflin-St Jeor** (`js/nutritionEngine.js:52-56`):
  - F: `10×peso + 6.25×altezza − 5×età − 161`
  - M: `10×peso + 6.25×altezza − 5×età + 5`
  - altro/non specificato: `10×peso + 6.25×altezza − 5×età` (nessun termine di aggiustamento sesso, cioè una via di mezzo tra M e F, scostata di −5/+5 rispetto ai due casi tipici)
- **TDEE**: `round(BMR × ACTIVITY_FACTORS[profile.attività])`, fallback a `moderato` se il valore non è tra le chiavi note.
- **Calorie target**: `adjustment = CALORIE_ADJUSTMENT[obiettivo] ?? 0`; `calorie = max(1100, round(TDEE × (1+adjustment)))`. Il floor a `1100` kcal è una soglia di sicurezza contro deficit eccessivi.
- **Proteine**: `max(50, round(peso × PROTEIN_G_PER_KG[obiettivo] || 1.5))`. Floor a 50g.
- **Grassi**: `max(45, round(calorie × FAT_RATIO / 9))` (9 kcal/g grasso). Floor a 45g.
- **Carboidrati**: calcolati per differenza: `max(100, round((calorie − proteine×4 − grassi×9) / 4))` (4 kcal/g proteine e carbo). Floor a 100g.
- **Override**: se `profile.customTargets` è presente, viene fatto uno spread `{...targets, ...profile.customTargets}` — l'utente può sovrascrivere qualunque singolo campo.
**A cosa serve:** è il cuore del sistema di targeting nutrizionale: genera `{ calorie, proteine, carboidrati, grassi, fibra, zuccheri }` usato in tutta l'app come target di riferimento (dashboard, gap frigo, coaching).

### `aggregateDailySummary(mealEntriesForDay, nutritionTargets)` — `js/nutritionEngine.js:79-122`

**Cosa fa:** somma i macro di tutti i pasti di un giorno (`reduce` su `macroCalcolate`, con fallback `|| 0` per ogni campo) producendo i totali: `totaleCalorie, totaleProteine, totaleCarbo, totaleGrassi, totaleFibra, totaleZuccheri, totaleSodioMg, totaleGrassiSaturi`. Poi costruisce `confrontoConTarget` con un helper interno `compare(name, value)` che per ciascuna voce (`calorie, proteine, carboidrati, grassi, fibra, zuccheri`) calcola `{ target, actual, difference (actual-target, 1 decimale), percent (actual/target×100, 1 decimale, 0 se target falsy) }`.
**Nota naming:** il totale carboidrati è chiamato `totaleCarbo` (non `totaleCarboidrati`) — vedi sezione Problemi.
**A cosa serve:** funzione centrale di riepilogo, riusata da `statisticsEngine.js:20,56`, `js/ui/fridgeView.js:40` (per i gap del frigo), dashboard.

### `buildNutritionWarning(profile, dailySummary)` — `js/nutritionEngine.js:124-137`

**Cosa fa:** genera avvisi testuali condizionati dalle `profile.condizioni` (array, es. `['ipertensione', 'prediabete', 'colesterolo alto']`) confrontate con soglie fisse:
- `ipertensione` + `totaleSodioMg > SODIUM_THRESHOLD (2300)` → avviso sodio
- `prediabete` + `totaleZuccheri > DEFAULT_SUGAR_THRESHOLD (40)` → avviso zuccheri
- `colesterolo alto` + `totaleGrassiSaturi > SATURATED_FAT_THRESHOLD (18)` → avviso grassi saturi
Ritorna un array di stringhe (vuoto se nessuna condizione soddisfatta).
**A cosa serve:** avvisi di sicurezza/salute mostrati nella UI, condizionati al profilo medico dichiarato dall'utente.

### Allenamento — costanti e funzioni legacy

- **`MET_WEIGHTS`** (`js/nutritionEngine.js:140-145`, locale, non esportata): MET per split di allenamento pesi: `push 3.5, pull 3.0, leg 4.0, total_body 5.0`. **Nota:** questa costante ha lo stesso nome esportato da `activityEnergyEngine.js` ma con chiavi e valori completamente diversi (vedi Problemi).
- **`calculateCardioCalories(weightKg, minutes, speedKmh, inclinationPct=0)`** (`js/nutritionEngine.js:147-158`): stima calorie cardio da MET a soglie di velocità: `<4 km/h → 2.5 MET`, `<6 → 3.5`, `<8 → 7.0`, `<10 → 9.0`, `≥10 → 11.5`. Bonus inclinazione: `+0.07×incl%` se `speed<6`, altrimenti `+0.05×incl%`. Calorie = `round(MET × pesoKg × minuti/60)` (formula MET standard: kcal/h = MET×kg, quindi kcal = MET×kg×ore).
- **`calculateWeightsCalories(weightKg, minutes, trainingType)`** (`js/nutritionEngine.js:160-163`): stessa formula MET×peso×ore usando `MET_WEIGHTS[trainingType] || 3.5`.
- **`estimateWeightChange(deficitKcalPerDay)`** (`js/nutritionEngine.js:165-174`): proietta perdita peso a 7/30/90 giorni usando `7700 kcal = 1 kg`: `weekly = deficit×7/7700`, `monthly = deficit×30/7700`, `threeMonths = deficit×90/7700`, tutti a 2 decimali.
**A cosa servono (blocco allenamento):** queste tre funzioni sembrano essere una versione precedente/legacy del modulo attività, sostituita nell'app corrente da `activityEnergyEngine.js` (che ha MET, formule ACSM per treadmill e gestione sessioni molto più ricche). Non risultano importate da nessun altro file del progetto (vedi Problemi — codice morto).

---

## `js/nutritionDataProvider.js`

Accesso al database alimentare italiano (`data/italian_foods_full.json`, 583 alimenti) (`js/nutritionDataProvider.js:1-6`).

### `loadFoodDatabase()` — `js/nutritionDataProvider.js:13-27` (privata, non esportata)

**Cosa fa:** fetch lazy e cache in-memory (`foodDatabase` module-level) di `/data/italian_foods_full.json`. Ritorna `data.foods || []`. In caso di errore HTTP o rete, logga e ritorna array vuoto.
**A cosa serve:** singola fonte di verità del DB alimenti caricata una sola volta per sessione.

### `normalizeWord(w)` — `js/nutritionDataProvider.js:29-32` (privata)

**Cosa fa:** minuscole + normalizzazione Unicode NFD + rimozione diacritici (`̀-ͯ`, la regex `[̀-ͯ]` è l'intervallo dei combining marks) + trim. Es. "Mele" → "mele", "pomodoro" resta invariato.

### `_wordVariants(word)` — `js/nutritionDataProvider.js:40-57` (esportata solo per i test)

**Cosa fa:** stemming leggero italiano singolare/plurale. Se la parola normalizzata ha lunghezza `<4`, ritorna solo se stessa (nessuna variante). Altrimenti applica regole a cascata (solo la prima che matcha, `else if`):
- `-che → -ca` (banche→banca), `-ghe → -ga` (alghe→alga)
- `-chi → -co` (fichi→fico), `-ghi → -go` (funghi→fungo)
- `-e → -a` (mele→mela)
- `-i → -o` E `-i → -e` (pomodori→pomodoro, noci→noce) — **unico caso che aggiunge 2 varianti**
- `-a → -e` (mela→mele)
- `-o → -i` (pomodoro→pomodori)
Ritorna un `Set` (include sempre la parola originale).
**A cosa serve:** usata sia in indicizzazione (`buildFoodIndex`) sia in ricerca (`searchFoods`), così "mela" trova "Mele" e viceversa senza dover duplicare voci nel DB.

### `indexFoodUnder(key, food)` / `buildFoodIndex()` — `js/nutritionDataProvider.js:59-91` (private)

**Cosa fa:** costruisce (una sola volta, cache module-level `foodIndexByName`) un indice `parola normalizzata → [foods]`, deduplicato per `food.id` (`indexFoodUnder` controlla `.some(f => f.id === food.id)` prima di pushare). Per ogni alimento indicizza: il nome completo normalizzato e ogni singola parola del nome con tutte le sue varianti singolare/plurale.
**A cosa serve:** struttura dati per ricerca O(1) per parola invece di scan lineare del DB.

### `normalizeFoodItem(food)` — `js/nutritionDataProvider.js:94-113` (esportata)

**Cosa fa:** mappa la forma "grezza" del DB (`{id, name_it, kcal_100g, protein_100g, carb_100g, fat_100g, fiber_100g, source}`) alla forma usata dall'app (`{id, source, nome, porzioneBase:'100 g', per100g:{kcal, proteine, carboidrati, zuccheri, grassi, grassi_saturi, fibra, sodioMg}, tags:[], createdByUserId:null}`).
**Nota importante:** `zuccheri`, `grassi_saturi` e `sodioMg` sono **hardcoded a `0`** — il DB CREA sorgente non fornisce questi tre valori nutrizionali (solo `fiber_100g` viene mappato, con fallback `|| 0`).
**A cosa serve:** adattatore usato da `searchFoods`, `getFoodDetails`, `getRandomCreeFoods`, `getCreaFoodsByCategory`. È **esportata e riusata anche da `app.js`** per la shopping list del frigo (come confermato dal commento del task), quindi il consumatore finale del formato `per100g` deve sempre assumere `zuccheri/grassi_saturi/sodioMg = 0` per alimenti provenienti da questo provider.

### `searchFoods(query)` — `js/nutritionDataProvider.js:116-173` (esportata, async)

**Cosa fa:** ricerca con scoring a più livelli:
1. **Match esatto** sul nome intero normalizzato → score `100` per ogni food trovato.
2. **Match parziale per parola** (con varianti singolare/plurale via `_wordVariants`): per ogni parola della query, per ogni sua variante presente nell'indice, assegna punteggio: `baseScore = 50` se la forma è esatta (`variant === word`), `40` se stemmata; se un food matcha già (da un'altra parola della query), il punteggio **si somma** (`existing.score + 10`), altrimenti si usa il `baseScore`.
3. **Fallback substring**: solo se `matches.size < 15`, scansiona l'intero DB cercando `food.name_it.toLowerCase().includes(normalizedQuery)`, assegnando score `30` (solo se il food non è già in `matches`).
Ordina per score decrescente, prende i primi 15, mappa con `normalizeFoodItem`.
**Complessità:** step 3 è O(n) sull'intero DB ad ogni chiamata se i primi due step non bastano a raggiungere 15 risultati.
**A cosa serve:** funzione di ricerca principale usata da UI di ricerca alimenti, composedMealWizard, fridgeView (aggiunta al frigo).

### `getFoodDetails(foodId)` — `js/nutritionDataProvider.js:176-195` (esportata, async)

**Cosa fa:** cerca per `id` esatto; se non trovato, fallback a match per nome (case-insensitive, uguaglianza esatta). Ritorna `normalizeFoodItem(food)` o `null` con warning in console.
**A cosa serve:** usata da `estimationEngine.js:252` per risolvere l'alimento scelto nella gerarchia CREA.

### `getRandomCreeFoods(count=5)` — `js/nutritionDataProvider.js:198-213` (esportata, async)

**Cosa fa:** estrae `count` alimenti casuali (con possibili duplicati, dato che il campionamento è `Math.random()` indipendente ad ogni iterazione, non uno shuffle-senza-reinserimento). A cosa serve: suggerimenti random (non nella lista dei file richiesti in dettaglio, citata per completezza).

### `getCreaFoodsByCategory(category)` — `js/nutritionDataProvider.js:216-226` (esportata, async)

**Cosa fa:** filtra il DB per `f.category?.includes(category)`. A cosa serve: idem, funzione ausiliaria di completamento.

### `getAllFoods()` — `js/nutritionDataProvider.js:232-234` (esportata, async)

**Cosa fa:** ritorna l'intero DB grezzo (non normalizzato) via `loadFoodDatabase()`.
**A cosa serve:** usata dall'engine micronutrienti per aggregazione (ha bisogno dei campi grezzi `micros`, `kcal_100g`, `portion_g` che `normalizeFoodItem` non espone) e da `js/ui/fridgeView.js` (`computeShoppingList`, passato come `allFoods` — ma **attenzione**: quella funzione si aspetta oggetti con `per100g` già normalizzato, vedi Problemi).

### `getMicrosIndex()` — `js/nutritionDataProvider.js:239-246` (esportata, async)

**Cosa fa:** costruisce un indice `id → {micros, kcal_100g}` filtrando solo gli alimenti che hanno il campo `micros` popolato.
**A cosa serve:** passato a `micronutrientEngine.aggregateDailyMicros` come `microsById`.

**Nota import inutilizzato:** `cacheRemoteFood, loadRemoteFoodCache` sono importati da `./storage.js` (`js/nutritionDataProvider.js:8`) ma non risultano usati in nessuna funzione del file — vedi Problemi.

---

## `js/micronutrientEngine.js`

Engine puro per micronutrienti, basato su valori LARN/SINU IV revisione (`js/micronutrientEngine.js:1-11`).

### `MICRO_META` — `js/micronutrientEngine.js:14-30`

**Cosa fa:** tabella statica di 15 micronutrienti (`calcio, ferro, potassio, magnesio, fosforo, zinco, vitamina_c, vitamina_a, vitamina_e, b1, b2, b3, b12, folati, vitamina_d`) con `label`, `unit` (mg o µg) e `rda` differenziato per sesso M/F (es. ferro M:10mg vs F:18mg per compensare le perdite mestruali; zinco M:12 vs F:9; vitamina C M:105 vs F:85; vitamina A M:700µg vs F:600µg).
**A cosa serve:** fonte di verità per etichette, unità e RDA usata da `getRda` e `analyzeMicronutrients`.

### `COVERAGE_THRESHOLD = 0.4` — `js/micronutrientEngine.js:34`

**Cosa fa:** soglia minima di copertura dati (40% delle kcal giornaliere da alimenti con quel dato micro) sotto la quale non si dichiara una carenza, per evitare falsi allarmi quando il DB CREA non copre il micro per la maggior parte dei pasti loggati.

### `getRda(key, sex)` — `js/micronutrientEngine.js:36-40`

**Cosa fa:** ritorna `MICRO_META[key].rda.F` se `sex==='F'`, altrimenti `.rda.M` (quindi qualunque valore diverso da `'F'`, incluso `undefined`, viene trattato come M). Ritorna `null` se la chiave non esiste.

### `aggregateDailyMicros(meals, microsById)` — `js/micronutrientEngine.js:49-70`

**Cosa fa:** per ogni pasto del giorno, se `microsById[meal.foodRef.id]` esiste ed ha `.micros`, calcola `ratio = grammi/100` e somma ogni micro `entry.micros[k] × ratio` in `totals[k]`. Traccia parallelamente `microCoveredKcal[k]` = somma delle kcal dei pasti che hanno effettivamente contribuito dati per quel micro specifico (non tutte le kcal del pasto sono necessariamente "coperte" per ogni micro — la copertura è per singola chiave). Ritorna anche `coveredKcal` (kcal totali di pasti con almeno un dato micro) e `totalKcal` (kcal totali del giorno, inclusi pasti senza dati).
**A cosa serve:** input per `analyzeMicronutrients`.

### `analyzeMicronutrients(dailyMicros, profile)` — `js/micronutrientEngine.js:78-108`

**Cosa fa:** per ciascuno dei 15 micro in `MICRO_META`, calcola `pct = (actual/rda)×100` e `coverage = microCoveredKcal[key]/totalKcal`. Stato:
- `totalKcal===0` o `coverage < 0.4` → `'unknown'` (dati insufficienti, non si afferma nulla)
- altrimenti: `pct<50 → 'low'`, `pct<80 → 'medium'`, altrimenti `'ok'`
Ordina il risultato: prima `low`/`medium` (carenze reali) per `pct` crescente, poi `ok`, poi `unknown` in fondo (rank `{low:0, medium:1, ok:2, unknown:3}`, poi per `pct` asc).
**A cosa serve:** vista micronutrienti nella dashboard, elenco ordinato per priorità di attenzione.

### `suggestFoodsForMicro(microKey, foods, remainingKcal, needed)` — `js/micronutrientEngine.js:119-164`

**Cosa fa:** trova i migliori alimenti CREA per colmare una carenza di un micro specifico, rispettando il budget calorico rimanente.
- `budget = remainingKcal>0 ? remainingKcal : 400` (fallback ragionevole se non c'è più budget).
- Per ogni food con `micros[microKey] > 0` e `kcal_100g` valido: porzione di partenza = `f.portion_g` (se >0) o `100`, cappata a `min(_, 300)` g.
- Se la porzione standard sfora il budget, la riduce proporzionalmente: `grams = max(20, round(budget/kcal_100g × 100))` (mai sotto 20g).
- Scarta se anche dopo la riduzione `kcal > budget`.
- Calcola `amount = per100 × grams/100` (quanto micro fornisce la porzione) ed `efficiency = amount / max(1, kcal)` (micro per kcal, per preferire alimenti densi di nutriente e leggeri in calorie).
- Ordina per `amount` decrescente poi `efficiency` decrescente; deduplica per nome-base (`name.split(',')[0]`, es. "Pollo, petto" e "Pollo, coscia" contano come stesso base "Pollo" e solo il primo viene tenuto); ritorna i primi 3.
**A cosa serve:** suggerimenti azionabili nella scheda micronutrienti carenti ("mangia questo per coprire il ferro mancante").

---

## `js/activityEnergyEngine.js`

Calcolo calorie da attività fisica (pesi + cardio + passi), basato su MET del Compendium of Physical Activities 2022 ed equazioni ACSM per treadmill (`js/activityEnergyEngine.js:1-10`). Tutte le funzioni sono pure.

### Costanti MET

- **`MET_WEIGHTS`** (`js/activityEnergyEngine.js:13-17`): `leggero 3.0, moderato 4.5, intenso 6.0` (resistance training MET dal Compendium). **Diverso** dall'omonima costante in `nutritionEngine.js` (vedi Problemi).
- **`SPLIT_BONUS_MET`** (`js/activityEnergyEngine.js:20-27`): bonus MET legacy per split allenamento: `push 0, pull 0, legs 0.5, lower 0.5, upper 0, full_body 1.0` (gambe/full body coinvolgono più massa muscolare → più dispendio).
- **`MET_CARDIO`** (`js/activityEnergyEngine.js:29-36`) — legacy (3 livelli lento/moderato/intenso): `treadmill: null` (calcolato via ACSM), `corsa_outdoor {7.0, 9.5, 12.0}`, `camminata {2.5, 3.5, 4.5}`, `bike {4.0, 6.8, 9.0}`, `ellittica {4.0, 6.0, 8.0}`, `altro {4.0, 6.0, 8.0}`.
- **`MET_CARDIO_V5`** (`js/activityEnergyEngine.js:39-51`) — schema DB v5 (3 livelli low/medium/high): aggiunge `running, walking, cycling, rowing {4.0,7.0,10.0}, hiit {7.0,9.0,12.0}, swimming {5.0,7.0,9.0}, hiking {4.0,5.3,7.0}, treadmill: null, elliptical, stair_climber {6.0,8.0,10.0}, other`.
- **`MUSCLE_GROUP_BONUS`** (`js/activityEnergyEngine.js:54-60`): bonus MET per gruppo muscolare (array, DB v5): `legs 0.5, glutes 0.5, hamstrings 0.3, calves 0.2, core 0.1`. Sommati tutti i gruppi selezionati (non un singolo bonus).
- **`FOOT_BASED_CARDIO`** (`js/activityEnergyEngine.js:324`): lista di cardio "a piedi" (`walking, running, hiking, treadmill, camminata, corsa_outdoor`) usata per l'anti-doppio-conteggio coi passi.

### `metToKcalPerMin(met, pesoKg)` — `js/activityEnergyEngine.js:64-66` (privata)

**Cosa fa:** `kcal/min = MET × 3.5 × pesoKg / 200` — formula standard di conversione MET→kcal (Roza & Shizgal 1978; 3.5 ml O2/kg/min = 1 MET, 5 kcal per litro O2, /1000 per convertire ml→L, ×1/min→/min: la costante composita è `3.5/200 = 0.0175`).

### Helper di compatibilità legacy/v5 (private)

- **`getDuration(session)`** (`js/activityEnergyEngine.js:71-73`): `session.durationMin ?? session.durataMin ?? 0` — legge la durata sia in schema v5 che legacy.
- **`getWeightIntensityKey(session)`** (`js/activityEnergyEngine.js:77-85`): converte `intensityRpe` (0-10, v5) in chiave MET: `≤4 → leggero`, `≤7 → moderato`, `>7 → intenso`; se non numerico usa `session.intensita` (stringa legacy) direttamente, fallback `'moderato'`.
- **`getLegacyIntensityKey(session)`** (`js/activityEnergyEngine.js:88-96`): stessa logica ma per chiavi cardio legacy (`lento/moderato/intenso`), soglie identiche (`≤4/≤7`).
- **`getV5IntensityKey(session)`** (`js/activityEnergyEngine.js:100-109`): preferisce `session.intensityLevel` (stringa diretta); altrimenti converte `intensityRpe` in `low/medium/high` con le stesse soglie `≤4/≤7`; default `'medium'`.

### `estimateWeightsCalories(session, userProfile)` — `js/activityEnergyEngine.js:121-141`

**Cosa fa:** `duration = getDuration(session)`; se `≤0` ritorna `0`. `pesoKg = userProfile.pesoKg || 70`. `baseMet = MET_WEIGHTS[intensityKey] || MET_WEIGHTS.moderato`. Bonus: se `session.muscleGroups` è un array (v5), somma `MUSCLE_GROUP_BONUS[g]` per ciascun gruppo; altrimenti (legacy) usa `SPLIT_BONUS_MET[session.tipoSplit] || 0` (bonus singolo, non sommato). `met = baseMet + bonus`; ritorna `round(metToKcalPerMin(met, pesoKg) × duration)`.
**A cosa serve:** stima calorie di una sessione pesi, usata da `aggregateDailyExercise` e come fallback in `computeDayActivityKcal`.

### `calculateVO2_Treadmill(speedMPerMin, gradeDecimal)` — `js/activityEnergyEngine.js:151-162` (privata)

**Cosa fa:** equazioni ACSM per treadmill. Soglia camminata/corsa a `100 m/min` (≈6 km/h).
- Walking (`speed ≤ 100`): `VO2 = 0.1×speed + 1.8×speed×grade + 3.5`
- Running (`speed > 100`): `VO2 = 0.2×speed + 0.9×speed×grade + 3.5`
(VO2 in ml/kg/min; `3.5` è il VO2 a riposo/1 MET.)

### `vo2ToKcalPerMin(vo2, pesoKg)` — `js/activityEnergyEngine.js:171-173` (privata)

**Cosa fa:** `kcal/min = (VO2 × pesoKg / 1000) × 5` (5 kcal per litro di O2 consumato; /1000 converte ml→L).

### `estimateCardioCalories(session, userProfile)` — `js/activityEnergyEngine.js:185-224`

**Cosa fa:** `duration = getDuration(session)`, se `≤0` → `0`.
1. Se `session.caloriesBurnedManual > 0`, usa **quel valore direttamente** (priorità assoluta sull'utente sui MET calcolati).
2. `activityType = session.cardioType ?? session.tipo`.
3. Se `treadmill`: converte `velocitaKmh × 16.67` in m/min, `inclinazioneGrade/100` in decimale, calcola VO2 con ACSM e converte in kcal via `vo2ToKcalPerMin`.
4. Altrimenti cerca prima in `MET_CARDIO_V5[activityType]`: usa `getV5IntensityKey`, fallback a `.medium` se la chiave intensità non matcha.
5. Fallback finale su `MET_CARDIO` legacy con `getLegacyIntensityKey`, fallback `.moderato`; se `activityType` non è in nessuna delle due tabelle, ritorna `0`.
**A cosa serve:** stima calorie cardio robusta a più generazioni di schema dati (retrocompatibilità).

### `estimateStepsCalories(stepsRecord, userProfile, prefs={})` — `js/activityEnergyEngine.js:236-260`

**Cosa fa:** cascata di 3 metodi in ordine di preferenza:
1. Se `activeMinutes > 0`: usa MET fisso `3.5` (walking moderato) × minuti attivi.
2. Altrimenti se `distanceKm > 0`: `kcalPerKm = 0.85 × (peso/70) × 60`, poi `× distanceKm` (base ~51 kcal/km per 70kg, scalato linearmente per peso).
3. Fallback: `kcalPerStep = 0.04 × (peso/70)`, poi `× steps` (~0.04 kcal/passo per 70kg).
Ritorna `0` se `steps ≤ 0`.
**A cosa serve:** stima calorie da contapassi/health provider quando non c'è una sessione cardio esplicita.

### `shouldExcludeStepsCalories(stepsRecord, cardioSessions=[], prefs={})` — `js/activityEnergyEngine.js:275-290`

**Cosa fa:** ritorna `true` solo se **tutte** queste condizioni sono vere: `prefs.avoidDoubleCountingWalking` è `true`, esiste un `stepsRecord.steps`, i passi **non** sono `source==='manual'`, ed esiste almeno una sessione cardio del giorno di tipo `walking/hiking/camminata`.
**A cosa serve:** evita di sommare due volte le calorie di una camminata sia come sessione cardio sia come passi da wearable (approccio "A": esclusione totale, usato in `aggregateDailyExercise`, alternativo all'approccio "B" di netting).

### `applyEatBackCalories(totalActivityKcal, prefs={})` — `js/activityEnergyEngine.js:302-318`

**Cosa fa:** `eatBackMode` default `'partial'`, `eatBackRatio` default `0.3`. `none→0`; `full→round(totalActivityKcal)`; `partial→round(totalActivityKcal × clamp(eatBackRatio,0,1))`; default (chiave non riconosciuta)`→0`. Ritorna `0` se `totalActivityKcal ≤ 0`.
**A cosa serve:** calcola quante calorie "restituire" al budget alimentare dopo l'attività fisica (pattern comune nei tracker: mangiare parte di ciò che si è bruciato in più).

### `estimateCardioSteps(session)` — `js/activityEnergyEngine.js:339-347`

**Cosa fa:** stima quanti passi ha generato una sessione cardio "a piedi" (`isFootBased` check contro `FOOT_BASED_CARDIO`). Se c'è `distanceKm`: `round(dist × STEPS_PER_KM[type] || 1300)`. Altrimenti se c'è durata: `round(duration × CADENCE_SPM[type] || 120)`. `STEPS_PER_KM` (`js/activityEnergyEngine.js:329`): walking/camminata 1400, hiking 1450, running/corsa_outdoor 1100 (falcata più lunga in corsa), treadmill 1250. `CADENCE_SPM` (`js/activityEnergyEngine.js:327`): walking/camminata 110, hiking 105, running/corsa_outdoor 160, treadmill 130.

### `netStepsRecordForCardio(stepsRecord, cardioSessions=[])` — `js/activityEnergyEngine.js:355-371`

**Cosa fa:** approccio "B" alternativo all'esclusione totale: sottrae dal record passi del giorno la quota **stimata** attribuibile alle sessioni cardio a piedi (somma di `estimateCardioSteps` per ogni sessione foot-based, più `distanceKm` e `activeMinutes` sottratti analogamente), tutto clampato a `max(0, ...)`. Marca il risultato con `_nettedForCardio: true`. Se non ci sono sessioni foot-based, ritorna il record originale invariato.
**A cosa serve:** evita doppio conteggio più granulare del semplice "escludi tutto", sottraendo solo la parte spiegata dal cardio invece di azzerare tutti i passi del giorno.

### `computeDayActivityKcal(dayStrength=[], dayCardio=[], daySteps=null, userProfile={}, prefs={})` — `js/activityEnergyEngine.js:388-405`

**Cosa fa:** helper centralizzato (dichiarato per "centralizzare la logica prima duplicata in 4 viste"). Somma `strengthKcal` (usa `s.estimatedKcal` se già presente, altrimenti ricalcola con `estimateWeightsCalories`) e `cardioKcal` (idem con `estimateCardioCalories`). Applica il **netting approccio B** di default (`prefs.avoidDoubleCountingWalking !== false`, quindi attivo anche se `prefs` è vuoto), disattivabile esplicitamente con `false`. `stepsExcluded` è `true` se c'erano passi >0 ma dopo il netting sono spariti del tutto. Ritorna `{strengthKcal, cardioKcal, stepsKcal, stepsExcluded, activityKcal}` (somma totale).
**A cosa serve:** usato da dashboard/vista fisica/settimana per centralizzare calcolo giornaliero.

### `aggregateDailyExercise(weightsSessions=[], cardioSessions=[], userProfile, stepsRecord=null, prefs={})` — `js/activityEnergyEngine.js:419-484`

**Cosa fa:** aggrega **con dettaglio per sessione** (a differenza di `computeDayActivityKcal` che è solo totali). Per ogni sessione pesi/cardio calcola kcal e crea un oggetto `{type, id, durataMin, calories, label}` per la UI (es. label treadmill mostra velocità). Usa l'**approccio "A" (esclusione totale)** via `shouldExcludeStepsCalories`, **diverso** dall'approccio "B" (netting) usato in `computeDayActivityKcal` — vedi Problemi. Calcola `totalExerciseCalories` (solo pesi+cardio), `totalActivityKcal` (+passi), `eatenBackCalories` via `applyEatBackCalories`.
**A cosa serve:** usata da `bodyCompTracker.js:184`, `trendProjection.js:90` e presumibilmente dalla vista giornaliera con elenco sessioni.

---

## `js/weightLossEstimator.js`

TDEE teorico/adattivo, deficit, proiezioni (`js/weightLossEstimator.js:1-9`). Fonti citate: Mifflin et al. 1990 (BMR), Hall et al. 2012 Lancet (7700 kcal/kg), Peters et al. 2016 (modelli metabolici adattivi).

### `KCAL_PER_KG_FAT = 7700` — `js/weightLossEstimator.js:12`

**Cosa fa:** costante di conversione kcal↔kg di grasso, usata in tutto il modulo e ripetuta (valore letterale, non importato) in `statisticsEngine.js`, `bodyCompositionModel.js`, `bodyCompTracker.js` (`CONFIG.kcalPerKgFat`), `trendProjection.js` (`CONFIG.kcalPerKgFat`).

### `ACTIVITY_MULTIPLIERS` — `js/weightLossEstimator.js:14-19`

**Cosa fa:** stessi valori di `ACTIVITY_FACTORS` in `nutritionEngine.js` (`sedentario 1.2, leggero 1.375, moderato 1.55, intenso 1.725`) ma duplicati con nome diverso — vedi Problemi.

### `getTheoreticalTDEE(userProfile)` — `js/weightLossEstimator.js:29-51`

**Cosa fa:** ricalcola BMR Mifflin-St Jeor **con logica leggermente diversa** da `nutritionEngine.calculateEnergyTargets`:
- Età: `new Date().getFullYear() - new Date(dataNascita).getFullYear()` (differenza di anno solare, **non** età esatta — può sovrastimare l'età fino a quasi 1 anno se il compleanno non è ancora passato quest'anno). **Nessun clamp minimo** a 16 anni (a differenza di `nutritionEngine.js`).
- Default: `pesoKg=70, altezzaCm=170, sesso='non specificato', attività='moderato'`.
- BMR: stessa formula (F: `-161`, M: `+5`, altro: nessun termine), ma il branch "altro" qui è esplicitamente `sesso === 'non specificato'` scritto come commento, stessa formula matematica di `nutritionEngine.js`.
- `TDEE = round(BMR × ACTIVITY_MULTIPLIERS[attività] || .moderato)`.
**A cosa serve:** TDEE "teorico" (da formula) usato come baseline in `bodyCompTracker.js` e `trendProjection.js`, alternativo/complementare al TDEE adattivo.

### `getDailyEnergyBalance(intakeKcal, exerciseData={}, tdee)` — `js/weightLossEstimator.js:62-74`

**Cosa fa:** `totalExpenditure = tdee + exerciseData.totalExerciseCalories`; `netDeficitOrSurplus = intakeKcal - totalExpenditure` (negativo = deficit). Ritorna l'oggetto con tutti i componenti.
**A cosa serve:** bilancio energetico di un singolo giorno, building block per medie e TDEE adattivo.

### `getEnergyBalanceSummary(dailyBalances=[])` — `js/weightLossEstimator.js:83-100`

**Cosa fa:** medie semplici (non pesate) di `intakeKcal`, `totalExpenditure`, `netDeficitOrSurplus` su un array di risultati di `getDailyEnergyBalance`. Ritorna `{avgIntake:0, avgExpenditure:0, avgNet:0, days:0}` se l'array è vuoto.

### `estimateLinearWeightChange(avgDeficitPerDay, days)` — `js/weightLossEstimator.js:110-119`

**Cosa fa:** modello lineare puro: `kgChange = (avgDeficitPerDay × days) / 7700`. Deficit positivo → **valore atteso negativo** solo se il chiamante passa un deficit già col segno giusto: qui `avgDeficitPerDay` positivo produce `kgChange` positivo (nel commento si dice "deficit positivo → perdita" ma matematicamente un valore positivo qui produce un `kgChange` **positivo**, cioè un aumento — il segno dipende dalla convenzione di chi chiama, vedi Problemi). Ritorna anche `grams = round(kgChange×1000)`.

### `estimateAdaptiveTDEE(weightHistory=[], dailyBalances=[])` — `js/weightLossEstimator.js:131-172`

**Cosa fa:** stima il TDEE "reale" dai dati osservati (non dalla formula). Richiede **almeno 7 giorni** sia di pesate che di bilanci giornalieri, altrimenti ritorna `{adaptiveTDEE:null, reliability:'insufficient', daysUsed:min(...), vsTheoretical:null}`.
- Ordina `weightHistory` per data, calcola peso medio dei **primi 3** e **ultimi 3** giorni (smoothing per ridurre rumore bilancia) → `deltaKg = pesoFinale - pesoIniziale`.
- `deltaKcalPerDay = deltaKg × 7700 / daysUsed` (variazione energetica giornaliera implicita dal peso osservato).
- `avgIntake`, `avgExercise` = medie semplici sui `dailyBalances`.
- **Formula inversa**: dato che per definizione `deltaKcalPerDay = avgIntake - TDEE - avgExercise`, risolve per TDEE: `tdeeAdaptive = round(avgIntake - avgExercise - deltaKcalPerDay)`.
- `reliability`: `daysUsed≥28 → 'high'`, `≥14 → 'medium'`, altrimenti `'low'`.
**A cosa serve:** TDEE più accurato basato sui dati reali dell'utente, alternativa a `getTheoreticalTDEE`. **Nota:** risulta importata ma **mai chiamata** in `bodyCompTracker.js` e `trendProjection.js` (vedi Problemi — probabile funzionalità incompleta/non ancora collegata).

### `estimateTimeToGoal(currentWeightKg, goalWeightKg, avgIntakePlanned, avgExercisePlanned, tdee)` — `js/weightLossEstimator.js:185-227`

**Cosa fa:** `deltaKg = currentWeight - goalWeight` (positivo = da perdere). Se `≤0` ritorna subito con `weeks:0, warning:'Peso attuale >= peso obiettivo'`. `predictedDeficit = (tdee + avgExercisePlanned) - avgIntakePlanned`. Se `≤0` ritorna `weeks: Infinity, days: Infinity, warning:'Intake >= spesa: non perderai peso'`. Altrimenti: `days = round(deltaKg×7700 / predictedDeficit)`, `weeks = (days/7).toFixed(1)`, `kgPerWeek = (predictedDeficit×7/7700).toFixed(2)`. Se `predictedDeficit > 500`, aggiunge warning "deficit aggressivo, max consigliato ~500 kcal/giorno".
**A cosa serve:** proiezione "quando raggiungerò il mio peso obiettivo" mostrata nella UI.

---

## `js/bodyCompositionModel.js`

Modello euristico (non clinico, dichiarato esplicitamente `js/bodyCompositionModel.js:5-6`) per ripartire il cambio di peso tra massa grassa (FM) e massa magra (FFM). Fonti: Helms 2014, Garthe 2011, Phillips & Van Loon 2011.

### Configurazioni (costanti locali, non esportate)

- **`DEFICIT_SCORE_CONFIG`** (`js/bodyCompositionModel.js:19-25`): soglie `10%`/`20%` TDEE per deficit lieve/moderato/aggressivo, score `0.2/0.5/0.9`.
- **`TRAINING_SCORE_CONFIG`** (`js/bodyCompositionModel.js:28-33`): `targetSessionsPerWeek 3`, `scorePerSession 0.25`, `rpeBoost 0.2`.
- **`PROTEIN_SCORE_CONFIG`** (`js/bodyCompositionModel.js:36-45`): soglie g/kg `1.2/1.6/2.2` (basso/medio/alto), score `0.2/0.5/0.8/1.0`.
- **`LEAN_RETENTION_CONFIG`** (`js/bodyCompositionModel.js:48-51`): pesi `trainingBoost 0.35`, `proteinBoost 0.35` (sommano a 0.70, il restante 0.30 viene da `1 - deficitScore`).
- **`DEFICIT_SPLIT_CONFIG`** (`js/bodyCompositionModel.js:54-57`): `baseLeanFraction 0.30` (30% del peso perso è FFM in condizioni medie), `minLeanFraction 0.05` (5% minimo, condizioni ottimali).
- **`SURPLUS_SPLIT_CONFIG`** (`js/bodyCompositionModel.js:60-63`): `minLeanFraction 0.05`, `maxLeanFraction 0.40`.

### `getDeficitScore(avgDeficitPercentTDEE)` — `js/bodyCompositionModel.js:82-95`

**Cosa fa:** `absPercent = |avgDeficitPercentTDEE|`. Se `≤10%` → `0.2`. Se `≤20%` → interpolazione lineare tra `0.2` e `0.5` in base a `t = (percent-0.10)/(0.20-0.10)`. Se `>20%` → `0.9` (aggressivo).

### `getResistanceTrainingScore(weightsSessionsPerWeek=0, avgRPE=5)` — `js/bodyCompositionModel.js:103-118`

**Cosa fa:** `0` se zero sessioni. Altrimenti `baseScore = min(sessioni × 0.25, 1.0)` (4+ sessioni = punteggio massimo 1.0). Bonus `+0.2` se `avgRPE ≥ 7`. Clampato `[0,1]`.

### `getProteinScore(proteinPerKg)` — `js/bodyCompositionModel.js:125-141`

**Cosa fa:** interpolazione lineare a tratti tra le soglie `1.2/1.6/2.2` g/kg, score `0.2 → 0.5 → 0.8 → 1.0`.

### `getLeanMassRetentionIndex(deficitScore, resistanceTrainingScore, proteinScore)` — `js/bodyCompositionModel.js:154-164`

**Cosa fa:** `retention = (1 - deficitScore) + 0.35×trainingScore + 0.35×proteinScore`, clampato `[0,1]`. Più deficit aggressivo → meno base retention; training e proteine alte la recuperano.

### `splitWeightChangeDeficit(linearKgChange, leanRetentionIndex)` — `js/bodyCompositionModel.js:176-205`

**Cosa fa:** `leanLossFraction = clamp(0.30 - retention×(0.30-0.05), 0.05, 0.30)` — più alto è `retention`, minore è la frazione persa come massa magra (fino al minimo 5%). `leanKgLost = |change| × frazione`; `fatKgLost = |change| - leanKgLost`. Ritorna con segni negativi (perdita): `{fatKgChange, leanKgChange, fatPercent, leanPercent}`, tutti arrotondati.

### `splitWeightChangeSurplus(linearKgChange, resistanceTrainingScore, proteinScore)` — `js/bodyCompositionModel.js:218-250`

**Cosa fa:** `leanGainIndex = clamp(0.5×trainingScore + 0.5×proteinScore, 0, 1)`. `leanGainFraction = 0.05 + leanGainIndex×(0.40-0.05)`. Ritorna con segni positivi (guadagno).

### `estimateBodyCompositionChange(avgDeficitPerDay, days, tdee, trainingStats={}, nutritionStats={})` — `js/bodyCompositionModel.js:265-314`

**Cosa fa:** funzione "facciata" che orchestra tutte le precedenti.
1. `linearKgChange = (avgDeficitPerDay × days) / 7700`.
2. `deficitScore = getDeficitScore(avgDeficitPerDay / tdee)`.
3. `resistanceTrainingScore`, `proteinScore` dai default (`weightsSessionsPerWeek: 0`, `avgRPE: 5`, `proteinPerKg: 1.0` se non forniti).
4. `leanRetentionIndex` dai tre score sopra.
5. Se `linearKgChange < 0` → `splitWeightChangeDeficit`; altrimenti → `splitWeightChangeSurplus`.
Ritorna tutto: `{linearKgChange, deficitScore, resistanceTrainingScore, proteinScore, leanRetentionIndex, fatKgChange, leanKgChange, fatPercent, leanPercent}`.
**A cosa serve:** funzione centrale del modello di composizione corporea, chiamata da `bodyCompTracker.js` e `trendProjection.js`.

---

## `js/bodyCompTracker.js`

Tracker di composizione corporea: baseline, ricalibrazioni, delta fat/lean nel tempo (dichiarato non-clinico, `js/bodyCompTracker.js:5-7`).

### `CONFIG` — `js/bodyCompTracker.js:17-22`

`windowDaysForDelta: 7` (finestra di calcolo), `maxDriftKg: 1.5` (scarto massimo accettato tra peso stimato dal modello e peso misurato), `minDaysForBaseline: 7`, `kcalPerKgFat: 7700`.

### `createBodyCompBaseline(dateBaseline, weightBaselineKg, bodyFatPercentBaseline)` — `js/bodyCompTracker.js:35-47`

**Cosa fa:** clamp BF% a `[5,95]`. `fatKgBaseline = peso × bf%/100`; `leanKgBaseline = peso - fatKg`. Ritorna baseline con tutti i valori arrotondati (2/1 decimali).

### `getCurrentBaseline(baselines, referenceDate)` — `js/bodyCompTracker.js:59-73`

**Cosa fa:** filtra i baseline con `dateBaseline ≤ referenceDate`, ordina per data decrescente, ritorna il più recente. `null` se nessuno valido.

### `computeBodyCompDeltasSinceBaseline(baseline, todayDate, allMeals, allWeightsSessions, allCardioSessions, dailyWeights, userProfile)` — `js/bodyCompTracker.js:90-226`

**Cosa fa:** calcola i delta fat/lean accumulati dal baseline alla data target, processando i dati **a finestre di 7 giorni** (`CONFIG.windowDaysForDelta`) invece che come media unica sull'intero periodo — questo permette a `estimateBodyCompositionChange` di essere richiamata più volte con condizioni (deficit, training, proteine) specifiche di ciascuna settimana, e i risultati per-finestra si sommano.
- Ritorna zero/warning se `!baseline` o `endDate < startDate`.
- Filtra pasti/sessioni/pesate nel range `[startDate, endDate]`.
- Cicla a passi di 7 giorni: per ogni finestra, se non ci sono pasti la salta (senza processarla).
- Per finestra: `avgIntakePerDay`, `avgProteinPerKg` (proteine totali finestra / giorni / peso utente), esercizio aggregato per-giorno via `aggregateDailyExercise`, RPE medio (mappa fissa `{leggero:3, moderato:6, intenso:9}` se `intensita` non è numerico).
- `tdee = getTheoreticalTDEE(userProfile)` (**sempre teorico**, mai adattivo, "per stabilità" come da commento).
- `avgDeficitPerDay = avgIntakePerDay - (tdee + avgExercisePerDay)`.
- Chiama `estimateBodyCompositionChange` per la finestra e **accumula** `fatKgChange`/`leanKgChange` nei totali.
**A cosa serve:** calcolo storico di quanto grasso/muscolo si è effettivamente guadagnato/perso dal baseline, tenendo conto delle variazioni di comportamento settimana per settimana (più accurato di una singola media sull'intero periodo).

### `estimateCompositionToday(baseline, weightTodayKg, deltas)` — `js/bodyCompTracker.js:239-263`

**Cosa fa:** `fatKgToday = baseline.fatKgBaseline + deltas.totalFatDelta`; stesso per lean. `weightEstimated = fatKgToday + leanKgToday` (peso "previsto dal modello"). `bfPercentToday = fatKgToday/weightTodayKg × 100`, clampato `[2,98]`. `drift = |weightEstimated - weightTodayKg|`; `driftWarning = drift > 1.5kg` (da `CONFIG.maxDriftKg`).
**A cosa serve:** confronta la stima del modello col peso realmente misurato oggi, segnalando se il modello si è "scostato" troppo (utile per triggare una ricalibrazione).

### `computeDeltasInRange(startDate, endDate, allMeals, allWeightsSessions, allCardioSessions, userProfile)` — `js/bodyCompTracker.js:280-310`

**Cosa fa:** wrapper che crea un "fake baseline" con `fatKgBaseline: 0, leanKgBaseline: 0` e chiama `computeBodyCompDeltasSinceBaseline` (passando `[]` come `dailyWeights`, dato che non serve nella modalità "solo delta"). Ritorna `{deltaFatKg, deltaLeanKg, daysAnalyzed}`.
**A cosa serve:** modalità "senza baseline assoluto" — utile per mostrare "quanto grasso hai perso nell'ultimo mese" senza richiedere una misurazione BF% iniziale.

---

## `js/trendProjection.js`

Proiezione automatica del peso/composizione basata sul trend reale degli ultimi N giorni (dichiarato non tenere conto di variazioni ormonali/idriche/stress, `js/trendProjection.js:5-8`).

### `CONFIG` — `js/trendProjection.js:18-23`

`minDaysForProjection: 14`, `defaultWindowDays: 30`, `kcalPerKgFat: 7700`, `minWeightsForTrend: 2`.

### `getTrendWindowData(windowDays=30, allMeals, allWeightsSessions, allCardioSessions, dailyWeights, userProfile)` — `js/trendProjection.js:39-132`

**Cosa fa:** raccoglie e riassume i dati di una finestra temporale per alimentare la proiezione.
- Filtra tutto per `data ≥ now - windowDays`.
- **Guardrail dati insufficienti**: se `weightsWindow_days.length < 2` → `{insufficientData:true, reason:'Servono almeno 2 misurazioni di peso.'}`. Se `mealsWindow.length < 14` (**nota**: confronta il **numero di pasti**, non di giorni distinti, con la soglia "giorni" — vedi Problemi) → insufficiente, con `daysAvailable` stimato come `ceil(mealsWindow.length/3)` (assume ~3 pasti/giorno).
- Calcola `avgIntakeKcal`, `avgProteinPerKg` sui **giorni unici loggati** (`daysLogged`, corretto qui a differenza del controllo sopra).
- Esercizio: itera sui giorni unici, aggrega via `aggregateDailyExercise`, calcola RPE medio pesato sul numero di sessioni pesi (diverso da `bodyCompTracker.js` che pesa sul numero di sessioni totali della finestra, qui `rpeCount` è incrementato per ogni sessione pesi in ogni giorno).
- `weightsSessionsPerWeek = weightsWindow.length / (windowDays/7)` (basato sulla finestra totale, non sui giorni loggati).
- `currentWeight` = media delle ultime (fino a) 7 pesate più recenti nella finestra.
**A cosa serve:** input aggregato per `projectWeightAndComposition`.

### `projectWeightAndComposition(daysAhead, trendData, userProfile, tdee, usedAdaptiveTDEE=false)` — `js/trendProjection.js:147-203`

**Cosa fa:** proietta peso futuro assumendo che le medie osservate (`avgIntakeKcal`, `avgExerciseKcal`, `avgProteinPerKg`, `weightsSessionsPerWeek`, `avgRPE`) restino costanti per `daysAhead` giorni.
- `predictedDeficitPerDay = avgIntakeKcal - (tdee + avgExerciseKcal)`.
- Chiama `estimateBodyCompositionChange(predictedDeficitPerDay, daysAhead, tdee, {...}, {...})`.
- `futureWeight = currentWeight + fatKgChange + leanKgChange`.
Ritorna un oggetto ricco con tutti gli score intermedi e il contesto (`avgIntakeKcal`, `adaptiveTDEEUsed`, ecc.) per la UI.
**A cosa serve:** singola proiezione a N giorni.

### `calculateAllProjections(trendData, userProfile, tdee, usedAdaptiveTDEE)` — `js/trendProjection.js:217-239`

**Cosa fa:** wrapper che chiama `projectWeightAndComposition` per `30`, `60`, `90` giorni con lo stesso `trendData`/`tdee`, più un `trendSummary` compatto.
**A cosa serve:** endpoint unico per popolare la UI "dove sarai tra 30/60/90 giorni".

---

## `js/statisticsEngine.js`

Statistiche e analisi sui dati registrati: riepiloghi settimanali/mensili, trend peso, categorizzazione deficit.

### `getWeeklyStats(meals, nutritionTargets, endDate=new Date())` — `js/statisticsEngine.js:8-36`

**Cosa fa:** costruisce un array di 7 giorni (da `endDate-6` a `endDate`), per ciascuno filtra i pasti del giorno e chiama `aggregateDailySummary`. Per ogni giorno: `data`, `label` (giorno della settimana abbreviato in italiano, prima lettera maiuscola), `totaleCalorie`, `proteine`/`carboidrati`/`grassi` arrotondati, `deficitCalorie = tdee - totaleCalorie`, `status` (`'ok'` se `%calorie` tra 90 e 110, `'basso'` se `<90`, `'alto'` se `>110`).
**Bug:** legge `summary.totaleCarboidrati` (`js/statisticsEngine.js:28`) ma `aggregateDailySummary` espone il campo come `totaleCarbo` — vedi Problemi.
**A cosa serve:** dati per grafico/tabella settimanale nella dashboard, e usata da `coachingRules.js` per le regole di coaching.

### `getMonthlyStats(meals, nutritionTargets, year, month)` — `js/statisticsEngine.js:38-82`

**Cosa fa:** analogo a `getWeeklyStats` ma per un intero mese di calendario (`new Date(year, month+1, 0)` trucco standard per ottenere l'ultimo giorno del mese). Stesso bug `totaleCarboidrati`. Calcola anche `mediaGiornaliera` (media kcal sui soli giorni con `totaleCalorie > 0`) e `totaleDaysTracked`.

### `getWeightTrend(weightEntries, days=30)` — `js/statisticsEngine.js:84-122`

**Cosa fa:** filtra le pesate negli ultimi `days` giorni, ordina per data. Se `<2` pesate → `'insufficient-data'`. Altrimenti: `deltaKg = ultimoPeso - primoPeso`; `weeksElapsed = max(giorniTraPrimaEUltima/7, 1)`; `velocita = deltaKg/weeksElapsed` (kg/settimana). `trend`: `'stable'` se `|deltaKg| ≤ 0.5`, altrimenti `'up'`/`'down'`.
**Nota:** `weeksElapsed` è calcolato sulla distanza temporale tra **prima e ultima pesata effettiva** nella finestra, non sulla dimensione della finestra richiesta (`days`) — se le pesate sono concentrate in pochi giorni dentro una finestra di 30, la velocità riflette comunque solo il periodo realmente misurato.

### `categorizeDailyDeficit(dailyCalorie, tdee, userWeight=70)` — `js/statisticsEngine.js:124-160`

**Cosa fa:** categorizza il deficit/surplus in 6 fasce basate su soglie assolute (non percentuali del TDEE): `<-1000 → molto-aggressivo`, `<-750 → aggressivo`, `<-500 → moderato`, `≤+100 → mantenimento`, `≤+250 → surplus-lieve`, `>+250 → surplus-importante` (dove il segno è `dailyCalorie - tdee`, scritto qui come confronto diretto `dailyCalorie < tdee - 1000` ecc.). `rateKgPerWeek = deficit×7/7700`; `estimatedMonthLoss = rateKgPerWeek × 4.3` (4.3 settimane/mese medio), arrotondato a 1 decimale.
**Nota:** `userWeight` è un parametro dichiarato ma **mai usato** nel corpo della funzione (vedi Problemi).

### `getProteinAdequacy(totalProteine, userWeightKg)` — `js/statisticsEngine.js:162-184`

**Cosa fa:** range target `1.6-2.2 g/kg` (nota: valori diversi dai target di `nutritionEngine.PROTEIN_G_PER_KG`, che vanno da 1.4 a 2.0 — vedi Problemi). `status`: `insufficiente` se sotto il minimo, `eccesso` se sopra il massimo, `adeguato` altrimenti.

### `getFibreAdequacy(totalFibre)` — `js/statisticsEngine.js:186-207`

**Cosa fa:** range `25-35 g/giorno` (diverso da `DEFAULT_FIBER_TARGET=28` in `nutritionEngine.js` — valore singolo vs range, non necessariamente in contraddizione ma non derivato dalla stessa costante). `eccesso` se `> 35×1.2 = 42g`.

---

## `js/estimationEngine.js`

Wizard UI (non puro: manipola DOM tramite `showModal`/`closeModal`) per la "stima" di un alimento CREA in 3 step: cerca → naviga gerarchia → quantità. Incluso qui perché è nel perimetro richiesto e contiene punti di contatto con l'engine di calcolo.

### Dati statici

- **`ESTIMATION_CATEGORIES`** (`js/estimationEngine.js:23-90`): 11 macro-categorie (cereali, carni rosse, pollame, pesce, uova, latticini, verdure, frutta, legumi, dolci, condimenti) con icona/label/descrizione. **Non risulta usata** all'interno del file (nessun riferimento a `ESTIMATION_CATEGORIES` oltre alla dichiarazione) — vedi Problemi.
- **`CONDIMENTI_EXTRAS`** (`js/estimationEngine.js:96-105`): valori nutrizionali fissi per condimenti comuni (olio, burro, formaggio, salsa pomodoro, maionese, panna, miele, sale) per porzioni standard (1 cucchiaio ≈10-15g). **Anche questa non risulta referenziata** nel resto del file — vedi Problemi.

### `openEstimationWizard(moment, onComplete)` — `js/estimationEngine.js:111-114`

**Cosa fa:** entry point del wizard: inizializza `state = {moment, food:null, quantity:null, extras:[]}` e avvia `creaStep1_searchFood`.
**A cosa serve:** chiamata da `composedMealWizard.js:202` (come opzione "Stima" per un componente di piatto composto) e presumibilmente dal flusso principale di aggiunta pasto in `app.js`.

### `creaStep1_searchFood(state, onComplete)` — `js/estimationEngine.js:120-178`

**Cosa fa:** mostra un modale con input di ricerca; su ogni digitazione (`query.length ≥ 2`) chiama `searchBases(query)` da `creaHierarchy.js` (nota: **non** `searchFoods` da `nutritionDataProvider.js` — la ricerca qui è sulla gerarchia CREA, con "basi" alimento come pasta/pollo/mela, non su singoli alimenti finali). Usa un token di ricerca (`searchToken`) per scartare risultati obsoleti da richieste concorrenti (classico pattern anti-race-condition per input debounced/async).

### `creaStep2_navigate(state, base, node, path, onComplete)` — `js/estimationEngine.js:184-249`

**Cosa fa:** naviga l'albero gerarchico CREA (taglio → variante → cottura). Se il nodo è foglia (`isLeaf`), salta direttamente alla quantità. Altrimenti mostra le opzioni del nodo (`getOptions`) più, se il nodo stesso ha un alimento associato (`node.f`), un pulsante "Usa X" per fermarsi a quel livello invece di scendere oltre.

### `_resolveAndGoToQuantity(state, foodId, path, onComplete, goBack)` — `js/estimationEngine.js:251-265` (privata)

**Cosa fa:** risolve l'ID alimento a dati nutrizionali via `getFoodDetails` (da `nutritionDataProvider.js`); se non trovato mostra un errore, altrimenti salva `state.food = {id, nome, per100g}` e procede allo step 3.

### `creaStep3_selectQuantity(state, onComplete, goBack)` — `js/estimationEngine.js:271-352`

**Cosa fa:** input grammi (default 100, min 1, max 2000) con anteprima live che chiama `calculateMacrosForAmount(foodData, quantity)` (da `nutritionEngine.js`) ad ogni digitazione. Alla conferma, chiama `_creaCreaEstimation` e passa il risultato a `onComplete`.

### `_creaCreaEstimation(state, foodData)` — `js/estimationEngine.js:361-385` (privata)

**Cosa fa:** costruisce l'oggetto "meal entry" finale: `macroCalcolate = calculateMacrosForAmount(foodData, state.quantity)`, `foodRef: {id, source:'CREA', name}`, `sourceType: 'A_DATABASE'`, `confidenceLevel: 100` (dato 100% da fonte verificata, come da commento in testa al file), `isEstimated: true`.
**A cosa serve:** questo è il punto in cui il wizard converte l'interazione utente in un vero meal entry con macro calcolati, pronto per essere salvato.

---

## `js/coachingRules.js`

Sistema di coaching deterministico basato su regole fisse (dichiarato esplicitamente "NIENTE AI" `js/coachingRules.js:1-5`).

### `generateCoachingInsights(meals, dailyWeights, nutritionTargets, userProfile)` — `js/coachingRules.js:9-106`

**Cosa fa:** genera fino a 3 insight (`slice(0,3)`) applicando 4 regole indipendenti sugli ultimi 7 giorni (`getWeeklyStats`):
1. **Proteine**: `avgProteine` (media dei 7 giorni) valutata con `getProteinAdequacy` → insight `high` priority se insufficiente, `low` se adeguato (nessun insight se in eccesso).
2. **Deficit calorico**: `avgCalorie` valutata con `categorizeDailyDeficit` → insight per `molto-aggressivo` (high), `moderato` (medium), `mantenimento` (low), `surplus-importante` (medium); nessun insight per `aggressivo` o `surplus-lieve` (categorie "intermedie" non generano messaggi).
3. **Coerenza tracking**: conta giorni con `totaleCalorie > 0`; `<5/7` → warning high priority, `=7/7` → congratulazioni low priority (6/7 non genera nulla).
4. **Fibre**: media fibre sui 7 giorni (ricalcolata scansionando `meals` filtrati per data, non riusa `getFibreAdequacy` risultati precedenti) → insight medium priority se insufficiente.
**Nota ordine:** le regole sono valutate in ordine fisso (proteine, deficit, tracking, fibre) e solo le prime 3 che producono un insight vengono mostrate — la regola fibre rischia di non comparire mai se le prime 3 regole generano sempre un insight.
**A cosa serve:** genera il pannello "coaching" della dashboard con suggerimenti azionabili.

### `evaluateRule(ruleName, meals, dailyWeights, nutritionTargets, userProfile)` — `js/coachingRules.js:108-182`

**Cosa fa:** valuta una singola regola nominata e ritorna `{passed, message, metric}`. Regole disponibili:
- `protein-adequacy`: `passed` se `status==='adeguato'`.
- `deficit-moderate`: `passed` se `500 ≤ deficit ≤ 750` (soglie assolute diverse dalla categorizzazione a 6 fasce di `categorizeDailyDeficit`, usa un controllo diretto invece di riusarla).
- `consistency-tracking`: `passed` se `≥6/7` giorni tracciati.
- `fibre-adequacy`: `passed` se `status==='adeguato'`.
- `weight-loss-pace`: richiede `≥7` pesate; prende le ultime 7 ordinate, `deltaKg = ultima - prima`; `passed` se `-1.5 < deltaKg < 0` (calo tra 0 e 1.5kg in 7 giorni).
- default: regola non riconosciuta, `passed:false`.
**A cosa serve:** probabilmente usata per un test/check puntuale di una singola regola (es. badge/achievement), distinto dal digest generale di `generateCoachingInsights`.

---

## `js/recentFoodsTracker.js`

Tracker localStorage (non IndexedDB, per velocità) di alimenti recenti/preferiti.

### Costanti — `js/recentFoodsTracker.js:6-8`

`MAX_RECENTS = 15`, chiavi storage `'recentFoods'`, `'favoriteFoods'`.

### `trackFoodUsage(foodRef, grammi)` — `js/recentFoodsTracker.js:10-38`

**Cosa fa:** registra l'uso di un alimento. Chiave univoca `${source}:${id}`. Se l'alimento è già nei recenti lo rimuove (per poi re-inserirlo in testa), incrementa `count` (bug: legge `recents[idx]?.count` **dopo** aver già fatto `splice` che rimuove l'elemento a `idx` — vedi Problemi), tronca l'array a `MAX_RECENTS` con `.splice(MAX_RECENTS)`.
**A cosa serve:** popola la sezione "usati di recente" nella UI di ricerca alimenti.

### `getRecents()` — `js/recentFoodsTracker.js:40-47`

**Cosa fa:** legge e fa `JSON.parse` di `localStorage['recentFoods']`, `[]` di default o in caso di errore (try/catch silenzioso).

### `toggleFavorite(foodRef)` — `js/recentFoodsTracker.js:49-67`

**Cosa fa:** se l'alimento è già nei preferiti lo rimuove, altrimenti lo aggiunge in testa con `addedAt`. Ritorna `true` se aggiunto, `false` se rimosso.

### `getFavorites()` / `isFavorite(foodRef)` — `js/recentFoodsTracker.js:69-82`

**Cosa fanno:** lettura preferiti e check di appartenenza (via chiave `source:id`).

### `suggestMealMomentByTime()` — `js/recentFoodsTracker.js:84-94`

**Cosa fa:** mappa l'ora corrente a un momento pasto: `6-11 → colazione`, `11-15 → pranzo`, `15-17 → merenda`, `17-21 → cena`, altrimenti `spuntino` (notte/primissima mattina).

### `getLastMealMoment(meals)` — `js/recentFoodsTracker.js:96-107`

**Cosa fa:** ordina i pasti per `createdAt || data` decrescente, ritorna il `momento` del più recente, fallback a `suggestMealMomentByTime()` se non c'è storico.
**A cosa serve (entrambe):** pre-seleziona il momento pasto più probabile quando l'utente apre il flusso di aggiunta, riducendo l'attrito.

---

## `js/dataPackLoader.js`

Ricerca fuzzy nel database CREA (`italian_foods_full.json`), modulo alternativo/complementare a `nutritionDataProvider.js`.

### `loadItalianFoodsFull()` — `js/dataPackLoader.js:8-21` (privata)

**Cosa fa:** fetch lazy + cache module-level (`_italianFoodsFull`), stessa fonte dati (`/data/italian_foods_full.json`) di `nutritionDataProvider.loadFoodDatabase()` ma **cache separata e indipendente** (due `fetch` distinti se entrambi i moduli vengono usati nella stessa sessione) — vedi Problemi.

### `normalizeName(str)` — `js/dataPackLoader.js:23-32`

**Cosa fa:** minuscole + NFD + rimozione diacritici + **anche rimozione di punteggiatura** (`replace(/[^\w\s]/g, ' ')`) + collasso spazi multipli + trim. Più aggressiva della `normalizeWord` di `nutritionDataProvider.js` (che non rimuove punteggiatura).

### `levenshtein(a, b)` — `js/dataPackLoader.js:34-53`

**Cosa fa:** distanza di Levenshtein classica (programmazione dinamica, matrice `(b.length+1) × (a.length+1)`). Guardia di performance: se `max(a.length,b.length) > 50` ritorna direttamente `maxLen` (evita costo quadratico su stringhe lunghe, sacrificando l'accuratezza per input anomali).

### `strictMatch(query, candidate)` — `js/dataPackLoader.js:55-69`

**Cosa fa:** normalizza entrambe le stringhe; match esatto immediato se uguali; altrimenti tokenizza la query (parole `>1` carattere) e richiede che **tutti** i token compaiano come substring nel candidato (AND logico, non OR).

### `fuzzyMatch(query, candidate)` — `js/dataPackLoader.js:71-84`

**Cosa fa:** prova prima `strictMatch`; se fallisce, controlla substring diretta (`candidate.includes(query) || query.includes(candidate)`); infine calcola Levenshtein e accetta se `distanza ≤ ceil(maxLen × 0.3)` (tolleranza 30% di edit distance relativa alla lunghezza).

### `searchInDataPacks(foodName, grams)` — `js/dataPackLoader.js:86-111` (async)

**Cosa fa:** itera **linearmente** l'intero DB (nessun indice, a differenza di `nutritionDataProvider.js`) e ritorna il **primo** alimento che soddisfa `fuzzyMatch` (non il migliore, il primo in ordine di file). Se trovato, calcola macro per la porzione richiesta direttamente qui (non riusa `calculateMacrosForAmount`), con arrotondamenti inline (`Math.round(x*grams/100)` per kcal, `*10)/10` per gli altri). Se nessun campo sorgente è presente (es. `fiber_100g` assente), il campo risultato è `null` (non `0` come in `normalizeFoodItem`).
**A cosa serve:** sembra un percorso di ricerca alternativo/legacy, probabilmente usato da un flusso diverso da quello di ricerca principale (`searchFoods`). Non risulta chiamata da nessuno dei file letti in questo audit (vedi Problemi — verificare se ancora in uso).

---

## `js/creaHierarchy.js`

Navigazione dell'albero gerarchico CREA (base alimento → taglio → variante → cottura → foglia), generato da `data/crea_hierarchy.json`. Struttura nodo: `{c: {figli}, f: idAlimento|null}`.

### `SEARCH_ALIASES` — `js/creaHierarchy.js:11-17`

**Cosa fa:** mappa sinonimi comuni → termini anatomici usati dal CREA: `coscia/cosce → [fuso, sovracoscia, coscio]`, `ala/ali → [ala]`, `fusello → [fuso]`.

### `loadHierarchy()` — `js/creaHierarchy.js:19-27` (esportata, async)

**Cosa fa:** fetch lazy + cache (`_tree`) di `/data/crea_hierarchy.json`, estrae `data.tree || {}`.

### `norm(s)` — `js/creaHierarchy.js:29-31` (privata)

**Cosa fa:** minuscole + NFD + rimozione diacritici + trim (identica a `normalizeWord` di `nutritionDataProvider.js`, ma duplicata come funzione separata).

### `STOPWORDS` — `js/creaHierarchy.js:34`

**Cosa fa:** set di connettivi italiani da ignorare nella query (`di, del, della, dei, ..., e, ed, la, il, ...`).

### `wordMatch(token, words)` — `js/creaHierarchy.js:37-43` (privata)

**Cosa fa:** un token matcha una parola se `token===word` oppure (solo se `token.length≥3`) `word` inizia per `token` (prefix match, evita match troppo permissivi su token di 1-2 lettere).

### `searchBases(query)` — `js/creaHierarchy.js:49-70` (esportata, async)

**Cosa fa:** tokenizza la query normalizzata (esclude stopword e token `≤1` carattere). Per ogni base dell'albero, costruisce l'insieme di "parole cercabili" = nome base + tutte le label dei nodi interni (`collectLabels`, ricorsivo). Un match richiede che **ogni** token della query soddisfi `wordMatch` diretto **o** che uno dei suoi alias (`SEARCH_ALIASES`) lo soddisfi. Ordina alfabeticamente per nome base.
**Complessità:** O(basi × nodi_per_base) ad ogni chiamata (nessuna cache dei risultati di `collectLabels`, ricalcolati ogni ricerca).

### `collectLabels(node, acc=[])` — `js/creaHierarchy.js:72-78` (privata, ricorsiva)

**Cosa fa:** raccoglie ricorsivamente tutte le chiavi (`label`) di tutti i nodi discendenti in un array piatto.

### `countLeaves(node)` — `js/creaHierarchy.js:80-84` (privata, ricorsiva)

**Cosa fa:** conta i nodi foglia (con `f` valorizzato) nel sottoalbero, usato per `variantCount` nei risultati di ricerca.

### `getOptions(node)` — `js/creaHierarchy.js:91-110` (esportata)

**Cosa fa:** per ogni figlio diretto del nodo, **collassa le catene lineari**: se un nodo intermedio non ha cibo proprio (`!cur.f`) e ha esattamente un figlio, si concatena la sua label a quella corrente (`label += ', ' + k`) e si scende, ripetendo finché non si trova un nodo con cibo o con ≥2 figli o senza figli. Es. "cotto" → figlio unico "al forno" → opzione mostrata come "cotto, al forno" invece di due click separati.
**A cosa serve:** riduce il numero di tap necessari nella UI quando la gerarchia ha rami "stretti" senza scelte reali.

### `isLeaf(node)` — `js/creaHierarchy.js:112-114` (esportata)

**Cosa fa:** `true` se il nodo ha un `f` valorizzato **e** nessun figlio (`Object.keys(node.c||{}).length === 0`). Un nodo con sia `f` che figli (alimento valido con ulteriori varianti sotto) **non** è considerato foglia — coerente con `estimationEngine.js` che offre "Usa X" come opzione separata dai figli in quel caso.

---

## `js/ui/fridgeView.js`

Vista "Il Tuo Frigo": inventario, gap nutrizionali del giorno, suggerimenti, score giornaliero, ricette cucinabili, lista della spesa. Si integra senza dipendenze circolari verso `app.js` (dichiarato `js/ui/fridgeView.js:1-15`).

### Costanti — `js/ui/fridgeView.js:23-25`

- `SOON_MS = 72×60×60×1000` (72 ore, soglia "in scadenza").
- `MACROS = ['proteine','carboidrati','grassi']` (kcal gestita separatamente nei gap).
- `DEFAULT_PORTION_G = 150` (porzione ragionevole di default per il calcolo di copertura, non necessariamente la quantità reale nel frigo).

### `computeGaps(meals, targets)` — `js/ui/fridgeView.js:38-51` (pura)

**Cosa fa:** ritorna `null` se `!targets` (obiettivi non impostati). Altrimenti chiama `aggregateDailySummary(meals, targets).confrontoConTarget` (riuso diretto dell'engine nutrizionale, "così la logica resta una sola in tutta l'app" come da commento) e per ognuna delle 4 voci (`kcal, proteine, carboidrati, grassi`) applica l'helper interno `gap(cmp, target)`:
- `remaining = max(0, -(cmp.difference ?? -target))`. Dato che `difference = actual - target`, `-(difference) = target - actual`; se `cmp` è `undefined` il fallback `?? -target` fa sì che `-(-target) = target` (cioè: nessun dato consumato ancora → manca tutto il target). Clampato a `≥0` (non segnala mai un "surplus negativo" come rimanente).
- `pct = target ? min(1, actual/target) : 0` (percentuale di completamento, cappata a 100%).
**A cosa serve:** input principale sia per la UI dei gap (`gapsHtml`) sia per lo scoring dei suggerimenti (`computeFridgeSuggestions`).

### `expiryUrgency(expiresAt, now)` — `js/ui/fridgeView.js:78-85` (privata, pura)

**Cosa fa:** `0` se nessuna scadenza. `left = expiresAt - now`. Se `left ≤ 24h` → urgenza `1` (scaduto o in scadenza entro 24h, stesso trattamento). Se `left ≥ 72h (SOON_MS)` → `0` (nessuna urgenza). Tra 24h e 72h: rampa lineare `0.5 + 0.5×(SOON_MS-left)/(SOON_MS-24h)` — a `left=72h` dà `0.5`, a `left=24h` dà `1.0`.

### `computeFridgeSuggestions(gaps, fridgeItems, now=Date.now())` — `js/ui/fridgeView.js:94-141` (pura, documentata con pseudocodice inline alle righe 54-76)

**Cosa fa:** implementa esattamente lo pseudocodice descritto nei commenti.
1. Se `fridgeItems` vuoto → `[]`.
2. **Priorità macro**: dai `gaps` (se presenti), filtra i 3 macro (`proteine, carboidrati, grassi`) con `remaining > 0`, ordinati per `remaining` decrescente, primi 3 (**in pratica sono al massimo 3, quindi "primi 3" prende sempre tutti quelli con remaining>0**). Se `gaps` è `null`, `priority = []`.
3. Per ogni item del frigo: skip se `quantity ≤ 0`. `hasMacros = (kcal||proteine||carboidrati||grassi) > 0` (almeno un valore per100g non-zero). `portionG = 0` se `unit==='pz'` o `!hasMacros`, altrimenti `min(quantity, 150)` (non suggerisce mai più di quanto è realmente disponibile).
4. **Copertura**: se `portionG > 0` e ci sono macro prioritari, per ciascun macro prioritario calcola `amount = per100g[m] × portionG/100`, poi `min(amount/gaps[m].remaining, 1)` (contributo cappato al 100% del gap) e fa la **media** su tutti i macro prioritari considerati (non solo quelli coperti). Se `portionG===0` o `priority` vuoto, `coverage = 0`.
5. **Score finale**: `coverage×0.6 + urgency×0.4`. Scarta (`continue`) se `score ≤ 0` (non copre nulla e non scade).
6. Ordina per `score` decrescente, **top 5**.
**Complessità:** dichiarata O(n), <50ms per 100 item (nessun sort annidato, un solo passaggio sugli item più un sort finale O(n log n)).
**A cosa serve:** cuore della funzionalità "cosa mangiare dal frigo per coprire le carenze di oggi", bilanciando nutrizione mancante e urgenza di scadenza.

### `computeDailyScore(gaps, meals, fridgeItems, now=Date.now())` — `js/ui/fridgeView.js:151-168` (pura)

**Cosa fa:** score 0-100 combinando 3 componenti pesate: `completezza×0.5 + varietà×0.3 + utilizzo×0.2`.
- **Completezza**: media di `[gaps.kcal.pct, gaps.proteine.pct, gaps.carboidrati.pct, gaps.grassi.pct]` (già cappati a 1 da `computeGaps`); se `gaps` è `null`, usa `[0]` (completezza forzata a 0).
- **Varietà**: numero di alimenti distinti loggati oggi (chiave `foodRef.id || foodRef.name || note`, quindi anche pasti "senza id" contano se hanno una nota distinta), saturato a `5` (`min(distinct/5, 1)`).
- **Utilizzo scadenze**: `soon = expiringSoon(...)`; se nessun item in scadenza → `1` (punteggio pieno); altrimenti `max(0, 1 - scaduti/inScadenza)` (penalizza in proporzione a quanti degli item "a rischio" sono già effettivamente scaduti, non solo vicini alla scadenza). Il commento (`js/ui/fridgeView.js:160-163`) segnala esplicitamente che questa è una euristica proxy, non una vera misura di "spreco storico" (richiederebbe uno storico di item eliminati/scaduti che l'app non tiene).

### `expiringSoon(fridgeItems, now=Date.now())` — `js/ui/fridgeView.js:171-173` (pura)

**Cosa fa:** filtra item con `expiresAt` impostato, `(expiresAt-now) < 72h` **inclusi già scaduti** (differenza negativa è comunque `< SOON_MS`), e `quantity > 0`.
**A cosa serve:** riusata da `computeDailyScore`, `maybeNotifyExpiring`, e per l'evidenziazione visiva "in scadenza" nell'inventario (`inventoryItemHtml`).

### `notificationsState()` — `js/ui/fridgeView.js:180-183`

**Cosa fa:** `'unsupported'` se l'API `Notification` non esiste nel browser, altrimenti ritorna `Notification.permission` (`'default'|'granted'|'denied'`).

### `requestExpiryNotifications()` — `js/ui/fridgeView.js:185-190` (async)

**Cosa fa:** short-circuit se già `'granted'` o `'denied'` (non richiede di nuovo), altrimenti chiama `Notification.requestPermission()` con try/catch (ritorna `'denied'` su eccezione).

### `maybeNotifyExpiring(fridgeItems, now=Date.now())` — `js/ui/fridgeView.js:196-209`

**Cosa fa:** notifica gli item in scadenza **al massimo una volta al giorno**, tracciato via `localStorage['fridgeExpiryNotified'] = today (YYYY-MM-DD)`. No-op se permesso non `'granted'`, se già notificato oggi, o se nessun item in scadenza. Costruisce il testo con i primi 3 nomi + contatore extra (`+N`). Ritorna `true` solo se la notifica è stata effettivamente creata (try/catch attorno a `new Notification(...)`).
**A cosa serve:** promemoria push per non sprecare cibo in scadenza (richiede PWA installata su iOS 16.4+, come da nota in testa al file).

### `weakestMacro(last7Summaries)` — `js/ui/fridgeView.js:222-228` (pura)

**Cosa fa:** richiede **almeno 7** elementi in `last7Summaries` (altrimenti `null`, dati insufficienti). Per ciascun macro, media il `pct` sui 7 giorni (fallback `1` per un giorno senza dato — cioè un giorno mancante **non penalizza** la media, viene trattato come "100% raggiunto" quel giorno). Trova il macro con media minima (`reduce` con `<=`, quindi in caso di pareggio esatto vince il primo esaminato nell'ordine di `MACROS` = proteine). Ritorna `null` se anche il più carente ha una media `≥0.9` (90%) — soglia per non segnalare "carenze" quando in realtà si è quasi sempre in target.

### `computeWeeklyInsight(last7Summaries, fridgeItems)` — `js/ui/fridgeView.js:230-240` (pura)

**Cosa fa:** chiama `weakestMacro`; se `null` ritorna `null` (nessun insight). Altrimenti cerca nel frigo l'item con più alto contenuto di quel macro per100g (tra quelli con `quantity>0`); se trovato, messaggio con suggerimento specifico, altrimenti messaggio generico "tienine conto nella spesa".
**A cosa serve:** messaggio testuale mostrato in cima alla vista frigo (`insight` in `renderFridgeView`).

### `computeShoppingList(weak, allFoods, fridgeItems, limit=5)` — `js/ui/fridgeView.js:252-267` (pura)

**Cosa fa:** se `!weak` o `allFoods` vuoto → `[]`. Costruisce due set di "già posseduti": `haveIds` (per `foodId`) e `haveNames` (nomi normalizzati via `normName`, solo lowercase+trim, **non** la stessa normalizzazione Unicode/accenti usata altrove nel progetto — vedi Problemi) per item con `quantity>0`. Filtra `allFoods` per: avere il macro carente `>0` per100g, **non** essere già posseduto (né per id né per nome), ordina per valore del macro decrescente, primi `limit` (default 5).
**A cosa serve:** lista della spesa "inversa al frigo" — suggerisce cosa comprare per il macro cronicamente carente, escludendo ciò che già si ha.

### `normName(s)` — `js/ui/fridgeView.js:271` (privata, pura)

**Cosa fa:** `(s||'').toLowerCase().trim()` — normalizzazione minimale, **senza** rimozione accenti/diacritici (diversa da `normalizeWord`/`norm` usate in `nutritionDataProvider.js`/`creaHierarchy.js`).

### `computeCookableRecipes(recipes, fridgeItems)` — `js/ui/fridgeView.js:281-310` (pura)

**Cosa fa:** per ogni ricetta con ingredienti, calcola quanti ingredienti sono presenti nel frigo (match per `foodRef.id` **o**, in fallback, per nome normalizzato — necessario perché "il form ricette salva alcuni ingredienti col solo `name`, senza id" come da commento) e quanti sono presenti in **quantità sufficiente** (`need = grammi_ricetta × porzioniBase`; per unità `pz` si considera sempre sufficiente, senza verificare il conteggio pezzi). `ratio = have/total` (ingredienti trovati, indipendentemente dalla quantità sufficiente); include la ricetta solo se `ratio ≥ 0.5` (almeno metà ingredienti presenti). Ordina per `ratio` decrescente poi `enough` decrescente, **top 3**.
**Nota:** `ratio` è basato su presenza, non su sufficienza di quantità — una ricetta con tutti gli ingredienti presenti ma in quantità insufficiente ha comunque `ratio=1` (mostrata come "cucinabile" anche se in realtà mancano grammi).

### `applyMealToFridge(foodRef, grams)` — `js/ui/fridgeView.js:321-329` (async, con side-effect I/O)

**Cosa fa:** quando un pasto viene loggato, scala l'inventario frigo corrispondente. Cerca un item con `foodId === foodRef.id` **e** `unit` in `{g, ml}` (gli item `pz` non vengono mai decrementati automaticamente dal logging pasto). Se trovato, `next = max(0, quantity - grams)`; se `next ≤ 0` elimina l'item (`deleteFridgeItem`), altrimenti lo aggiorna con `Math.round(next)`.
**A cosa serve:** chiude il loop "logghi un pasto → il frigo si aggiorna da solo", chiamata da `app.js` dopo ogni `saveMealEntries`.

### `planRecipeDecrements(ingredients, portions, fridgeItems)` — `js/ui/fridgeView.js:338-353` (pura)

**Cosa fa:** stesso matching (`byId`/`byName`) di `computeCookableRecipes`. Per ogni ingrediente con item corrispondente e unità `g`/`ml` (gli `pz` sono **ignorati**, coerente col fatto che non sono confrontabili in grammi), accumula `grammi_ricetta × portions` in una `Map<fridgeItemId, grammiTotali>` — se più ingredienti della ricetta mappano allo stesso item del frigo, i grammi si sommano correttamente.
**A cosa serve:** funzione pura separata da `applyRecipeToFridge` per poter testare/prevedere il piano di decremento senza effetti collaterali.

### `applyRecipeToFridge(ingredients, portions=1)` — `js/ui/fridgeView.js:356-368` (async, con side-effect I/O)

**Cosa fa:** carica gli item frigo correnti, calcola il piano con `planRecipeDecrements`, poi per ciascuna voce del piano applica lo stesso pattern di `applyMealToFridge` (decremento, elimina se `≤0`).
**A cosa serve:** chiamata da `app.js` quando l'utente conferma di aver cucinato una ricetta.

### Funzioni di rendering (non pure, generano HTML)

- **`macroBarColor(pct)`** (`js/ui/fridgeView.js:372-376`): verde (`--success`) se `pct≥1`, arancio (`--accent-orange`) se `≥0.7`, altrimenti colore primario.
- **`fmtExpiry(expiresAt, now)`** (`js/ui/fridgeView.js:378-385`): testo umano per la scadenza (`scaduto`, `scade oggi`, `scade domani`, `scade tra Ng`) basato su `Math.ceil` dei giorni.
- **`gapsHtml`, `suggestionCardHtml`, `macroLabel`, `shoppingItemHtml`, `recipeCardHtml`, `inventoryItemHtml`**: generano markup per le rispettive sezioni, riusando i dati calcolati dalle funzioni pure sopra. Non contengono logica di calcolo propria (solo formattazione/interpolazione stringhe con `escapeHtml` per prevenire XSS sui nomi alimenti user-generated).

### `renderFridgeView(data)` — `js/ui/fridgeView.js:465-532`

**Cosa fa:** funzione di rendering principale. Richiama tutte le funzioni pure (`computeFridgeSuggestions`, `computeCookableRecipes`, `computeShoppingList`) sui dati passati da `app.js`, poi assembla l'HTML delle sezioni: header con score, carenze, suggerimenti (con 3 varianti: nessun target, ci sono suggerimenti, giornata completa), ricette cucinabili (solo se presenti), lista spesa (solo se presente), inventario.
**A cosa serve:** entry point di rendering chiamato da `app.js` per la pagina "Il Tuo Frigo".

### `bindFridgeViewEvents(container, callbacks, data)` — `js/ui/fridgeView.js:550-618`

**Cosa fa:** cabla tutti gli event listener della vista (ricalcolando internamente `suggestions`/`shopping` dagli stessi `data`, quindi **deve** ricevere lo stesso `data` passato a `renderFridgeView` altrimenti gli indici array usati come `data-sug`/`data-buy` non corrisponderebbero — vedi Problemi). Gestisce: click su suggerimento → apre modale pasto pre-compilato; click su ricetta cucinabile → callback `onCookRecipe`; click "compra" nella lista spesa → aggiunge al frigo (default `500g`); click notifica → richiede permesso e notifica subito se serve; click "+ Aggiungi" → apre modale ricerca; click +/−/elimina su un item → step `±50` (o `±1` per `pz`), elimina se la quantità scende a `≤0`.

### `animateScore(el)` — `js/ui/fridgeView.js:620-639` (privata)

**Cosa fa:** imposta subito il valore finale come testo (fallback sicuro), poi se non `prefers-reduced-motion` e la pagina è visibile (`!document.hidden`) e il target non è `0`, anima un count-up 0→target in 800ms con easing `ease-out cubic` (`1-(1-k)^3`) via `requestAnimationFrame`.
**A cosa serve:** micro-interazione estetica sul punteggio frigo, con fallback esplicito per accessibilità (reduced motion) e per tab in background (dove `requestAnimationFrame` è in pausa e l'animazione non partirebbe mai, lasciando lo score a "0" se non ci fosse il fallback iniziale).

### `openAddToFridgeModal(onChanged)` — `js/ui/fridgeView.js:642-709` (privata, con side-effect I/O)

**Cosa fa:** modale di ricerca (debounce 200ms, min 2 caratteri, `searchFoods` da `nutritionDataProvider.js`, primi 8 risultati) → selezione → form quantità/unità/scadenza → `saveFridgeItem`.

---

## Problemi / note

1. **Bug — campo inesistente `totaleCarboidrati`**: `statisticsEngine.js:28,68` legge `summary.totaleCarboidrati`, ma `aggregateDailySummary` (`nutritionEngine.js:83,93,116`) espone il totale come `totaleCarbo`. Il risultato è `Math.round(undefined) = NaN` per il campo `carboidrati` in ogni giorno restituito da `getWeeklyStats` e `getMonthlyStats`. Questo `NaN` si propaga a `coachingRules.js` (che legge `day.proteine`/`day.totaleCalorie`, non direttamente `carboidrati`, quindi l'impatto lì è limitato) ma inquina qualunque consumatore diretto di `getWeeklyStats`/`getMonthlyStats` che usi il campo `carboidrati` (es. grafici settimanali/mensili).

2. **Formule BMR duplicate con logica età leggermente diversa**: `nutritionEngine.calculateEnergyTargets` (`nutritionEngine.js:47`) calcola l'età come `floor((now - dataNascita)/31557600000)` (anni pieni, con clamp minimo `16`), mentre `weightLossEstimator.getTheoreticalTDEE` (`weightLossEstimator.js:35`) usa `now.getFullYear() - dataNascita.getFullYear()` (differenza di anno solare, **senza** tener conto se il compleanno è già passato quest'anno, e **senza** clamp minimo). Per una persona che compie gli anni a dicembre, in gennaio le due formule possono differire di quasi 1 anno intero, con impatto diretto sul BMR (±5 kcal per anno di differenza nella formula Mifflin-St Jeor). Le due funzioni sono usate in punti diversi dell'app (target giornalieri vs. proiezioni/tracker composizione corporea), quindi un utente potrebbe vedere TDEE leggermente diversi tra la dashboard principale e le proiezioni.

3. **Costanti duplicate con nomi diversi ma stesso significato**: `ACTIVITY_FACTORS` (`nutritionEngine.js:6-11`) e `ACTIVITY_MULTIPLIERS` (`weightLossEstimator.js:14-19`) contengono **esattamente gli stessi valori** (`1.2/1.375/1.55/1.725`) sotto nomi diversi, definiti in due file diversi invece di un'unica fonte di verità importata. Rischio: se in futuro uno dei due viene aggiornato (es. per tarare meglio il modello) e l'altro no, i target giornalieri e le proiezioni di peso useranno silenziosamente fattori di attività diversi.

4. **`MET_WEIGHTS` — stesso nome esportato, valori e chiavi incompatibili**: `nutritionEngine.js:141-145` esporta `MET_WEIGHTS = {push:3.5, pull:3.0, leg:4.0, total_body:5.0}` mentre `activityEnergyEngine.js:13-17` esporta anch'esso `MET_WEIGHTS = {leggero:3.0, moderato:4.5, intenso:6.0}` — chiavi e semantica completamente diverse (split allenamento vs. livello intensità). Se mai import diretti da entrambi i moduli finissero nello stesso file senza alias, ci sarebbe collisione di nome. Le funzioni `calculateWeightsCalories`/`calculateCardioCalories` in `nutritionEngine.js` sembrano codice legacy non più chiamato da nessun altro file esaminato (vedi punto 6) — probabile relitto pre-refactor verso `activityEnergyEngine.js`.

5. **`KCAL_PER_KG_FAT` ripetuto come costante locale in 4 file**: `weightLossEstimator.js:12` (esportata), `bodyCompositionModel.js:274` (literal `7700` inline), `bodyCompTracker.js:21` (`CONFIG.kcalPerKgFat`), `trendProjection.js:21` (`CONFIG.kcalPerKgFat`), `statisticsEngine.js:130` (literal `7700` inline), `estimationEngine`/`nutritionEngine.estimateWeightChange` (literal `7700`). Nessun modulo importa la costante esportata da `weightLossEstimator.js`; ognuno ridefinisce lo stesso valore. Innocuo finché il valore resta invariato, ma è un punto di manutenzione singolo mancato.

6. **Codice probabilmente morto in `nutritionEngine.js`**: `MET_WEIGHTS` (locale), `calculateCardioCalories`, `calculateWeightsCalories`, `estimateWeightChange` (righe 140-174) non risultano importati da nessuno degli altri file analizzati in questo audit (che invece usano sistematicamente `activityEnergyEngine.js` per gli stessi scopi, con formule più sofisticate — ACSM per treadmill, retrocompatibilità v5/legacy). Andrebbe verificato con una ricerca globale su tutto il repo (inclusi eventuali file non coperti da questo audit) prima di rimuoverle.

7. **Import inutilizzato — `estimateAdaptiveTDEE`**: sia `bodyCompTracker.js:10` che `trendProjection.js:11` importano `estimateAdaptiveTDEE` da `weightLossEstimator.js` ma non lo chiamano mai nel corpo del file (entrambi usano sempre `getTheoreticalTDEE`). La funzione esiste ed è implementata correttamente in `weightLossEstimator.js:131-172`, ma il "TDEE adattivo dai dati reali" — presumibilmente una feature pensata per essere più accurata del TDEE teorico — non risulta collegato a nessun consumatore reale nei file esaminati. Il campo `vsTheoretical` che dovrebbe fare da confronto è peraltro hardcoded a `null` nella funzione stessa (`weightLossEstimator.js:170`, mai calcolato).

8. **Import inutilizzato — `cacheRemoteFood`/`loadRemoteFoodCache`**: `nutritionDataProvider.js:8` importa queste due funzioni da `storage.js` ma non le usa in nessuna funzione del file. Probabile residuo di refactor.

9. **Due database CREA caricati e cachati separatamente**: `nutritionDataProvider.js` (`foodDatabase`) e `dataPackLoader.js` (`_italianFoodsFull`) fanno **entrambi** `fetch('/data/italian_foods_full.json')` con cache module-level indipendente. Se entrambi i moduli vengono usati nella stessa sessione, il file viene scaricato due volte (spreco di banda/tempo, seppur minore) e si mantengono due copie identiche in memoria. Andrebbe verificato se `dataPackLoader.searchInDataPacks` sia ancora effettivamente chiamato da qualche parte dell'app (non risulta importato da nessuno dei file analizzati in questo audit) — se è codice morto, l'intero file (incluse `levenshtein`, `fuzzyMatch`) potrebbe essere rimosso; se invece è un percorso di ricerca ancora attivo (es. da `photoNutrition.js`, fuori dal perimetro di questo audit), la duplicazione andrebbe consolidata su un'unica cache condivisa.

10. **`searchInDataPacks` ritorna il primo match, non il migliore**: a differenza di `searchFoods` in `nutritionDataProvider.js` (che accumula punteggi e ordina), `searchInDataPacks` (`dataPackLoader.js:90-107`) ritorna il **primo** alimento del DB che soddisfa `fuzzyMatch`, nell'ordine in cui compare nel file JSON. Con soglia di tolleranza Levenshtein al 30% questo può produrre match non ottimali se un alimento più simile compare più avanti nell'array.

11. **`estimateLinearWeightChange` — convenzione di segno ambigua nel commento**: il commento a `weightLossEstimator.js:110-119` dice "deficit positivo → perdita (negativo in termini di peso)" ma il codice fa semplicemente `kgChange = (avgDeficitPerDay × days) / 7700` senza inversione di segno: se il chiamante passa un deficit *positivo* (es. "500 kcal di deficit"), la funzione produce un `kgChange` **positivo** (aumento), non negativo. La convenzione corretta usata altrove nel codebase (es. `getDailyEnergyBalance.netDeficitOrSurplus`) è che un valore **negativo** rappresenta il deficit (`intake - expenditure`, minore di zero quando si mangia meno di quanto si spende). Chi chiama `estimateLinearWeightChange` deve quindi passare esplicitamente un valore già col segno "energetico" (negativo = deficit calorico) e non un "deficit" inteso colloquialmente come numero positivo, altrimenti il risultato ha il segno invertito rispetto alle aspettative suggerite dal commento. Non è stato individuato, nel perimetro di questo audit, alcun chiamante di questa funzione specifica per verificare quale convenzione venga effettivamente rispettata a runtime.

12. **`categorizeDailyDeficit` — parametro `userWeight` non usato**: `statisticsEngine.js:124` accetta `userWeight=70` ma non lo usa in nessun calcolo del corpo funzione (il tasso kg/settimana è calcolato solo da `deficit`, indipendente dal peso corporeo — il che è corretto fisiologicamente per il modello 7700kcal/kg, ma rende il parametro superfluo/fuorviante nella firma).

13. **Target proteine/fibre incoerenti tra moduli**: `nutritionEngine.PROTEIN_G_PER_KG` usa range `1.4–2.0` g/kg per obiettivo, mentre `statisticsEngine.getProteinAdequacy` (`statisticsEngine.js:167-168`) valuta l'adeguatezza con soglie fisse `1.6–2.2` g/kg indipendenti dall'obiettivo dell'utente — un utente con obiettivo "mantenere" (target 1.4 g/kg) può quindi ricevere dal target ufficiale un valore che `getProteinAdequacy`/`coachingRules` giudicherebbe "insufficiente". Analogamente `DEFAULT_FIBER_TARGET=28` in `nutritionEngine.js` non coincide col range `25–35` di `getFibreAdequacy` (qui non contraddittorio, 28 è dentro il range, ma sono comunque due fonti di verità scollegate).

14. **Anti-double-counting passi: due approcci diversi coesistono**: `activityEnergyEngine.aggregateDailyExercise` (righe 419-484, con dettaglio sessioni) usa l'**approccio A** (esclusione totale dei passi se c'è una sessione cardio "a piedi" lo stesso giorno, via `shouldExcludeStepsCalories`), mentre `computeDayActivityKcal` (righe 388-405, helper "centralizzato" più recente a giudicare dal commento "logica prima duplicata in 4 viste") usa l'**approccio B** (netting granulare via `netStepsRecordForCardio`, che sottrae solo la quota di passi spiegata dal cardio). Le due funzioni possono quindi produrre `stepsKcal` diversi per lo stesso giorno a seconda di quale venga chiamata dalla UI — non è chiaro dal solo codice se tutte le viste siano già migrate al nuovo approccio B o se `aggregateDailyExercise` (approccio A) sia ancora attivamente usato altrove con risultati potenzialmente incoerenti rispetto alle viste che usano B.

15. **`getTrendWindowData` — controllo "giorni insufficienti" basato su conteggio pasti, non giorni**: `trendProjection.js:60` verifica `mealsWindow.length < CONFIG.minDaysForProjection (14)`, cioè confronta un **numero di pasti** con una soglia pensata per **giorni**. Con una media realistica di 3+ pasti/giorno, questo controllo si soddisfa già dopo ~5 giorni di log invece dei 14 giorni dichiarati nel messaggio d'errore (`Servono almeno 14 giorni di log alimentari`), rendendo il guardrail meno restrittivo di quanto documentato. Il fallback `daysAvailable: Math.ceil(mealsWindow.length/3)` conferma che l'autore era consapevole della differenza pasti/giorni ma non l'ha applicata al confronto principale (che andrebbe fatto sul numero di `uniqueDays`, calcolato solo più sotto per le medie).

16. **`trackFoodUsage` — `count` letto dopo lo `splice` che rimuove l'elemento**: in `recentFoodsTracker.js:22-32`, `idx` viene calcolato, l'elemento a `idx` viene rimosso con `recents.splice(idx, 1)`, e **solo dopo** si legge `recents[idx]?.count` per calcolare il nuovo count — ma a quel punto l'array è già stato modificato dallo splice precedente, quindi `recents[idx]` punta a un elemento diverso (quello che era subito dopo l'originale, se esisteva) o è `undefined`. Il risultato pratico è che `count` non viene mai correttamente incrementato oltre `1` quando l'alimento era già presente nei recenti (il campo `count` finisce quasi sempre a `1` invece di riflettere il numero reale di utilizzi), a meno che l'implementazione intendesse leggere il valore prima dello splice.

17. **`normName` in `fridgeView.js` non allineata alla normalizzazione usata altrove**: `fridgeView.js:271` usa `(s||'').toLowerCase().trim()`, mentre `nutritionDataProvider.normalizeWord` e `creaHierarchy.norm` fanno anche `normalize('NFD')` + rimozione diacritici. Due alimenti che differiscono solo per accento (es. "perà" vs "pera", ipotetico) o che arrivano con capitalizzazioni/spazi diversi da fonti diverse potrebbero non essere riconosciuti come lo stesso alimento in `computeShoppingList`/`computeCookableRecipes`, mentre lo sarebbero nella ricerca principale del DB.

18. **`bindFridgeViewEvents` dipende dall'identità dei dati passati a `renderFridgeView`**: gli indici usati per `data-sug`/`data-buy` (`js/ui/fridgeView.js:412,427,562,580`) sono posizionali sull'array `suggestions`/`shopping` **ricalcolato indipendentemente** dentro `bindFridgeViewEvents` a partire dallo stesso `data` object. Se `app.js` passasse a `renderFridgeView` e `bindFridgeViewEvents` due oggetti `data` anche solo leggermente diversi (es. `fridgeItems` in ordine diverso, o `now`/`Date.now()` chiamato in momenti diversi che fa slittare `expiryUrgency` oltre una soglia), gli indici visualizzati e quelli usati per il click handler potrebbero disallinearsi silenziosamente. Non è stato verificato nel perimetro di questo audit se `app.js` garantisce di passare lo stesso oggetto `data` a entrambe le chiamate.

19. **`ESTIMATION_CATEGORIES` e `CONDIMENTI_EXTRAS` in `estimationEngine.js` non referenziate**: entrambe le strutture dati (righe 23-90 e 96-105) sono definite ed esportate implicitamente come costanti di modulo ma non risultano usate in nessuna funzione dello stesso file. Possibile funzionalità pianificata ma non ancora collegata al wizard (es. un futuro step di selezione categoria, o l'aggiunta di condimenti extra al piatto), oppure residuo di una versione precedente del wizard.

20. **Magic number non commentati**: `activityEnergyEngine.js:253` (`0.85` in `kcalPerKm = 0.85 × (peso/70) × 60`) e `:258` (`0.04` kcal/passo) non hanno una fonte citata a differenza del resto del file (che cita Compendium 2022/ACSM per le altre formule) — sono probabilmente stime empiriche ragionevoli ma senza riferimento bibliografico esplicito, a differenza dello standard del resto del modulo. Idem `DEFAULT_PORTION_G = 150` in `fridgeView.js:25` e `20g`/`300g` di clamp in `micronutrientEngine.suggestFoodsForMicro` (righe 129,134) — soglie ragionevoli ma arbitrarie, non derivate da una fonte.

21. **Disclaimer di non-clinicità presenti ma disomogenei**: `bodyCompositionModel.js`, `bodyCompTracker.js`, `trendProjection.js` e `micronutrientEngine.js` includono tutti un disclaimer esplicito "non è una misura clinica" in testa al file; `nutritionEngine.js`, `activityEnergyEngine.js`, `weightLossEstimator.js` e `statisticsEngine.js` no, pur contenendo anch'essi stime energetiche/nutrizionali con lo stesso livello di incertezza intrinseca (formule di popolazione, non misure dirette). Non un bug funzionale, ma un'incoerenza nella comunicazione dei limiti del modello all'utente finale (se il disclaimer è mostrato in UI a partire da questi commenti, o se è puramente per sviluppatori, andrebbe verificato fuori da questo perimetro).

---

## 3. App shell e flussi

# 03 — App Shell e Flussi Core

> Analisi di `js/app.js` (2442 righe), `js/appBootstrap.js` (293 righe) e `js/utils.js` (121 righe).
> PWA vanilla JS senza framework, router a `if/else` su `appState.currentView`, viste composte da `render*View()` (produce stringa HTML, iniettata via `innerHTML`) + `bind*Events(container, callbacks)`.

## 1. `js/appBootstrap.js`

### `bootstrapApp()` — sequenza di avvio

Funzione async esportata, chiamata da `init()` in `app.js`. Sequenza:

1. `await waitForDOM()` — se `document.readyState === 'loading'` attende `DOMContentLoaded`, altrimenti risolve subito.
2. **CRITICO**: `await initializeDatabase()` — chiama `initStorage()` da `storage.js` e aggiorna `bootstrapState.dbReady`. Logga anche `getDbStats()`. Se fallisce, cattura l'errore in `bootstrapState.error` e ritorna `false`.
   - Se `initializeDatabase()` fallisce:
     - se `typeof localStorage === 'undefined'` → `showBootstrapError(bootstrapState.error)` (schermata bloccante, sostituisce tutto `document.body`) e `bootstrapApp()` ritorna `false` (l'app non parte).
     - altrimenti (fallback localStorage disponibile) → `showStorageWarningBanner()` (banner ambra non bloccante, dismissabile) e l'esecuzione prosegue.
3. **Background (fire-and-forget, non awaited)**: `requestPersistentStorage()` — chiama `ensurePersistentStorage()` e `logStorageInfo()` da `storage/persistence.js`; eventuali errori sono solo `console.warn`, non bloccano l'app.
4. **Background**: `registerServiceWorker()` — se `'serviceWorker' in navigator`, registra `/sw.js` con `scope: '/'`; ascolta `updatefound` → quando il nuovo worker passa a `installed` e c'è già un `navigator.serviceWorker.controller` (cioè non è la prima installazione) chiama `notifyNewVersionAvailable()`. Imposta anche un `setInterval` di controllo aggiornamenti ogni ora (`registration.update()`).
5. `listenToServiceWorkerMessages()` — ascolta `message` da `navigator.serviceWorker`; se `event.data.type === 'SW_UPDATED'` chiama anch'essa `notifyNewVersionAvailable()`.
6. Ritorna `true` (a meno del caso di errore bloccante al punto 2).

`bootstrapApp()` ritorna `false` **solo** quando IndexedDB fallisce e non è disponibile nemmeno `localStorage` come fallback — è l'unico caso realmente bloccante. In `init()`, se `bootstrapOk` è falsy, l'app si ferma con un `console.error` e nessun ulteriore setup viene eseguito.

### Gestione errori/avvisi UI

- `showBootstrapError(error)` — sostituisce **tutto** `document.body` con una card di errore centrata (titolo, `error.message`, suggerimento browser moderno). Usata solo nel caso peggiore (nessuno storage disponibile).
- `showStorageWarningBanner()` — banner fisso in cima alla pagina, colore ambra (`#b45309`), dismissabile con una `×`, non bloccante. Comunica che l'app gira in modalità di salvataggio limitato (fallback localStorage, es. modalità privata) e che i dati potrebbero perdersi alla chiusura del browser.
- `notifyNewVersionAvailable()` — banner viola/gradiente fisso in cima con pulsante "Ricarica per gli aggiornamenti" → `window.location.reload()`.

### Stato bootstrap

```js
bootstrapState = { dbReady, swRegistered, persistenceGranted, error }
```

Esposto via `getBootstrapState()` (copia shallow) e loggabile con `logBootstrapState()`. Usato anche da `js/ui/settings.js` (sezione diagnostica) tramite `import('../appBootstrap.js')` dinamico.

---

## 2. `appState` (in `js/app.js`)

```js
const appState = {
  userProfile: null,
  nutritionTargets: null,
  currentDate: new Date().toISOString().slice(0, 10), // oggi, ISO YYYY-MM-DD
  meals: [],
  userFoods: [],
  searchResults: [],
  currentView: 'dashboard'
};
```

Campo aggiunto dinamicamente a runtime (non dichiarato inizialmente):
- `appState.dailyWeights` — assegnato in `renderDashboardView()`.

`mainContent`, `bottomNav`, `themeToggle` sono riferimenti DOM presi una sola volta a livello di modulo (`getElementById('mainContent')`, `getElementById('bottomNav')`, `getElementById('themeToggle')`). `themeToggle` non viene più referenziato altrove nel file (la gestione tema è delegata a `themeManager.js`, non incluso nello scope di questo documento).

`window.showModal`, `window.closeModal`, `window.appState` sono esposti globalmente per moduli che li richiamano fuori dal grafo import di ES module (`estimationEngine.js`, `composedMealWizard.js`).

---

## 3. Router e navigazione

### `renderCurrentView()` (async)

Punto centrale di rendering:

1. Se `!appState.userProfile` → chiama `renderOnboardingView()` e ritorna subito (nessun'altra vista è raggiungibile senza profilo).
2. Salva `previousScrollY = window.scrollY` e calcola `isSameView = _lastRenderedView === appState.currentView` (per decidere se mantenere lo scroll o tornare in cima).
3. Dispatch `if/else` su `appState.currentView`:

| `currentView` | Funzione chiamata |
|---|---|
| `'dashboard'` | `renderDashboardView()` |
| `'nutrition'` | `renderNutritionViewPage()` |
| `'physics'` | `renderPhysicsViewPage()` |
| `'week'` | `renderWeekViewPage()` |
| `'search'` | `renderSearchView()` |
| `'foods'` | `renderFoodsView()` |
| `'fridge'` | `renderFridgeViewPage()` |
| `'weight'` | `renderPhysicsViewPage()` (alias, stessa vista di `physics`) |
| `'activities'` | `renderPhysicsViewPage()` (alias, stessa vista di `physics`) |
| `'stats'` | `renderStatsViewPage()` |
| `'weightloss'` | `renderWeightLossView()` |
| `'settings'` | `renderSettingsView()` |
| *(default/else)* | `renderDashboardView()` |

Nota: `renderActivitiesViewPage()` esiste come funzione a sé (vista "attività" con più dettaglio) ma **non è raggiunta dal router** tramite `currentView === 'activities'` — quel branch punta a `renderPhysicsViewPage()`, non a `renderActivitiesViewPage()`. Vedi sezione "Problemi / note".

4. Dopo il render: `setActiveNav(appState.currentView)`.
5. `window.scrollTo({ top: isSameView ? previousScrollY : 0 })`.
6. `_lastRenderedView = appState.currentView`.

### `goToView(view)`

```js
function goToView(view) {
  appState.currentView = view;
  renderCurrentView();
}
```
Wrapper sincrono (non awaita `renderCurrentView`, che è async — fire-and-forget) usato da tutti i callback delle viste per navigare programmaticamente (es. `onManageRecipes: () => goToView('foods')`).

### `setActiveNav(view)`

```js
function setActiveNav(view) {
  appState.currentView = view;
  const navView = (view === 'weight' || view === 'activities' || view === 'weightloss') ? 'physics' : view;
  bottomNav.querySelectorAll('.nav-button').forEach(btn => {
    const isActive = btn.dataset.view === navView;
    btn.classList.toggle('active', isActive);
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}
```

Mappa "nav-group": le viste `weight`, `activities` e `weightloss` non hanno un proprio bottone nella bottom nav — vengono tutte raggruppate sotto l'evidenziazione del bottone `physics` (💪 "Attività"). Gestisce anche `aria-current="page"` per screen reader.

### `populateBottomNav()`

Genera l'array di 6 voci di navigazione e le inietta come HTML in `bottomNav.innerHTML`:

```js
const navButtons = [
  { view: 'dashboard', label: 'Home',     emoji: '🏠' },
  { view: 'nutrition', label: 'Pasti',    emoji: '🍽️' },
  { view: 'fridge',    label: 'Frigo',    emoji: '🧊' },
  { view: 'physics',   label: 'Attività', emoji: '💪' },
  { view: 'stats',     label: 'Trend',    emoji: '📈' },
  { view: 'settings',  label: 'Altro',    emoji: '⚙️' }
];
```

Ogni bottone ha `data-view`, `title`, `aria-label`, ed è composto da uno `<span class="nav-emoji">` + `<span class="nav-label">` (etichetta testuale sotto l'emoji, per scopribilità).

### `attachBottomNav()`

```js
function attachBottomNav() {
  bottomNav.addEventListener('click', event => {
    const button = event.target.closest('.nav-button');
    if (!button) return;
    const view = button.dataset.view;
    if (view) {
      appState.currentView = view;
      renderCurrentView();
    }
    // Swipe gesture support for tab navigation
    const mainContent = document.getElementById('mainContent');
    const navButtons = Array.from(document.querySelectorAll('.nav-button'));
    if (mainContent && navButtons.length > 0) {
      initSwipeNavigation(mainContent, navButtons, (view) => {
        appState.currentView = view;
        renderCurrentView();
      });
    }
  });
}
```

**Attenzione (bug reale, vedi sezione Problemi):** il blocco che inizializza `initSwipeNavigation` è annidato **dentro** il listener `click` di `bottomNav`, quindi viene rieseguito a ogni click su un bottone di navigazione invece che una sola volta all'avvio. Inoltre ridichiara una variabile locale `mainContent` che ombreggia la costante di modulo omonima (stesso nome, stesso elemento DOM — innocuo in pratica ma è code smell). Funzionalmente lo swipe finisce comunque per essere collegato (ri-collegato più volte, con listener duplicati accumulati a ogni tab-click), ma l'intento — un solo `initSwipeNavigation` a inizializzazione — non è quello implementato.

### `init()` (async, esportata)

```js
export async function init() {
  const bootstrapOk = await bootstrapApp();
  if (!bootstrapOk) {
    console.error('❌ Bootstrap fallito, app non può avviarsi');
    return;
  }
  populateBottomNav();
  attachBottomNav();
  attachInstallButton();
  await loadState();
  renderCurrentView();

  // Promemoria scadenze: solo se l'utente ha già concesso il permesso (max 1/giorno).
  if (notificationsState() === 'granted') {
    loadFridgeItems().then(maybeNotifyExpiring).catch(() => {});
  }
}
```

Sequenza:
1. `bootstrapApp()` — se fallisce, stop (vedi sopra).
2. `populateBottomNav()` + `attachBottomNav()` — costruzione e binding della bottom nav.
3. `attachInstallButton()` — collega il bottone `#installAppBtn` (se presente nel DOM) a `triggerInstallPrompt()` da `pwaHandler.js`.
4. `await loadState()` — carica profilo, alimenti utente, target nutrizionali e pasti del giorno corrente da storage.
5. `renderCurrentView()` — primo render (dispatch su `currentView` iniziale, `'dashboard'`, ma redirige a onboarding se `userProfile` è `null`).
6. **Controllo scadenze frigo all'avvio**: se `notificationsState() === 'granted'` (permesso `Notification` già concesso in precedenza), chiama `loadFridgeItems().then(maybeNotifyExpiring)` in modo fire-and-forget con `.catch(() => {})` silenzioso. `maybeNotifyExpiring` (da `fridgeView.js`) mostra al massimo una notifica `Notification` al giorno (flag `fridgeExpiryNotified` in localStorage) elencando fino a 3 alimenti con `expiresAt` entro 72h e `quantity > 0`, poi `+N` extra se ce ne sono di più.

`attachInstallButton()`:
```js
function attachInstallButton() {
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.addEventListener('click', () => {
      triggerInstallPrompt();
    });
  }
}
```

---

## 4. Toast, undo, caricamento stato, errori

### `showToast(message, optsOrDuration = {})`

Firma retro-compatibile: accetta un numero (durata in ms, comportamento storico) oppure un oggetto `{ duration, type, action }`.

- `type`: `'info'` (default), `'success'` (icona `✓`), `'error'` (icona `⚠️`) — controlla anche la classe CSS `toast-${type}`.
- **Stacking**: crea/riusa un container `#toastContainer` (`aria-live="polite"`); mantiene al massimo 3 toast visibili — se ce ne sono già 3, rimuove il più vecchio (`container.firstChild.remove()`) prima di aggiungere il nuovo.
- **Azione (undo)**: se `action = { label, onClick }` è passato, aggiunge un bottone `.toast-action` che su click cancella il timer di auto-dismiss, chiude il toast e invoca `action.onClick()`.
- **Durata**: default 2500ms; se c'è un'azione, la durata minima è forzata a 5000ms (`Math.max(duration, 5000)`) per dare tempo di cliccare "Annulla".
- Dismiss animato: aggiunge classe `toast-out`, rimuove il nodo dopo 250ms.

### `deleteSessionWithUndo(kind, id, rerender)` (async)

Funzione condivisa per eliminare sessioni di allenamento (`kind: 'strength'`) o cardio (`kind: 'cardio'`) con possibilità di annullamento:

1. Carica **tutte** le sessioni del tipo richiesto (`loadAllStrengthSessions()` o `loadAllCardioSessions()`) e trova il record con quell'`id` — questo viene fatto **prima** di cancellare, per poter ripristinare un record identico (stesso `id`) in caso di undo.
2. Cancella il record (`deleteStrengthSession(id)` o `deleteCardioSession(id)`).
3. Chiama `rerender()` (callback passata dal chiamante, es. `renderPhysicsViewPage`).
4. Mostra un toast di successo con azione "Annulla" che, se cliccata, ri-salva il record originale (`saveStrengthSession`/`saveCardioSession`) e richiama `rerender()`.

Usata da `renderPhysicsViewPage`, `renderActivitiesViewPage` e `renderWeightLossView` per entrambi i tipi di sessione — logica di cancellazione centralizzata, non duplicata per vista.

### `loadState()` (async)

```js
async function loadState() {
  appState.userProfile = await loadUserProfile();
  appState.userFoods = await loadUserFoods();
  appState.nutritionTargets = appState.userProfile ? calculateEnergyTargets(appState.userProfile) : null;
  appState.meals = appState.userProfile ? await loadMealsByDate(appState.currentDate) : [];
}
```
Chiamata una sola volta, da `init()`, dopo il bootstrap. Se non c'è profilo, `nutritionTargets` e `meals` restano vuoti/null (l'app mostrerà onboarding).

### `reportError(message)`

```js
function reportError(message) {
  showToast(message, { duration: 4000, type: 'error' });
}
```
Wrapper sottile su `showToast` per errori utente-visibili, usato ovunque nei flussi di validazione form (es. "Inserisci un valore di grammi valido.").

---

## 5. Funzioni `render*View`

### `renderOnboardingView()`

```js
mainContent.innerHTML = renderOnboarding(appState.userProfile || {}, appState.nutritionTargets || {});
bindOnboardingEvents(mainContent, appState.userProfile || {}, async (profile) => { ... }, calculateEnergyTargets);
```
Sul completamento (`onComplete`): assegna `profile.id = profile.id || crypto.randomUUID()`, calcola i target nutrizionali, salva il profilo (`saveUserProfile`), ricarica i pasti del giorno, forza `currentView = 'dashboard'`, ri-renderizza e mostra toast "Profilo salvato. Benvenuto!".

### `renderDashboardView()` (async)

La vista più corposa. Compone:

1. `aggregateDailySummary(appState.meals, appState.nutritionTargets)` → `summary`.
2. `buildNutritionWarning(appState.userProfile, summary)` → `warnings`.
3. `getTheoreticalTDEE(appState.userProfile)` → `theoreticalTdee`.
4. **Dati attività di oggi**: carica in parallelo (`Promise.all`) sessioni forza, cardio, passi e preferenze attività per `appState.currentDate`; calcola `activityKcal` con `computeDayActivityKcal`. In caso di errore, `activityData` resta ai valori di default (`{ strengthCount: 0, cardioCount: 0, steps: 0, activityKcal: 0 }`) e l'errore viene solo loggato (`console.warn`) — non blocca il rendering.
5. **Trend settimanale (7 giorni)**: per ciascuna delle date da `buildLastNDates(appState.currentDate, 7)`, calcola il bilancio energetico giornaliero (intake − TDEE − attività) e ne fa la media (`avgDeficit`), stima `estimatedFatChange` (formula `|avgDeficit| / 7700 * 30`, cioè kg di grasso in 30 giorni assumendo 7700 kcal/kg) e `estimatedLeanChange` (stima grezza, 10% del cambio grasso, negativo). Salva tutto in `summary.weeklyTrend`. In caso di errore, fallback a zeri.
6. **Composizione corporea**: se esiste un `currentBaseline` (da `getCurrentBaseline(baselines, appState.currentDate)`), carica tutti i pasti/sessioni/pesi storici e chiama `computeBodyCompDeltasSinceBaseline` + `estimateCompositionToday` per stimare la composizione corporea odierna (`bodyCompData`). Molto verboso in `console.log` (debug residuo). In caso di errore, `bodyCompData = null` e l'errore è loggato con stack trace.
7. Salva `appState.dailyWeights = dailyWeights`, `summary.tdee`, `summary.activityKcal`.
8. **Micronutrienti**: carica `microsIndex` e `allFoods`, aggrega i micronutrienti dai pasti del giorno (`aggregateDailyMicros`), li analizza (`analyzeMicronutrients`) e per i primi 4 con stato `'low'` o `'medium'` calcola suggerimenti di alimenti (`suggestFoodsForMicro`) usando le calorie rimanenti come budget. Salvato in `microData`. In caso di errore, `microData` resta `null`.
9. Render: `renderDashboard(appState, summary, warnings, bodyCompData, activityData, microData)` → HTML, poi `lazyLoadImages()`.
10. `bindDashboardEvents` callback: `onAddMeal`/`onGoToNutrition` → `goToView('nutrition')`; `onAddActivity`/`onGoToActivities` → `goToView('physics')`; `onAddWeight`/`onUpdateWeight` → `showWeightUpdateModal()`; `onGoToWeight` → `goToView('physics')`; `onBodyComp` → `openBodyCompBaselineForm(baselines)`; `onMicroDetail` → apre modal con `renderMicroDetail(microData.analysis)`; `onGoToProjections` → `goToView('weightloss')`; `onChangeDate(newDate)` → aggiorna `currentDate`, ricarica `meals`, ri-renderizza.

### `renderNutritionViewPage()` (async)

1. `aggregateDailySummary` per il riepilogo del giorno.
2. Carica tutti i pasti, calcola la media di intake calorico degli ultimi 7 giorni (`summary.weeklyIntakeAvg`), con fallback silenzioso in caso di errore.
3. Render: `renderNutritionView(appState, summary)`, poi `lazyLoadImages()`.
4. `bindNutritionViewEvents` callback:
   - `onAddMealToMoment(moment)` → traduce l'etichetta italiana capitalizzata (`'Colazione'` ecc.) in chiave minuscola e chiama `openQuickAddWithMoment(...)`.
   - `onEditMeal(moment, index)` → `editMealModal(moment, index)`.
   - `onDeleteMeal(moment, index)` (async) → trova l'entry per momento/indice, la rimuove da `appState.meals`, chiama `deleteMealEntry(target.id)` (persistenza reale — commento nel codice nota che prima la cancellazione non era persistita), ri-renderizza, mostra toast con undo che ri-salva l'entry (`saveMealEntries([target])`) e ricarica lo stato.
   - `onCreateCustomFood` → `openCustomFoodForm()`.
   - `onEditCustomFood(foodId)` → `editCustomFoodModal(foodId)`.
   - `onDeleteCustomFood(foodId)` (async) → filtra da `appState.userFoods`, salva, ri-renderizza. **Nota**: qui il toast di errore usa la firma legacy `showToast('...', 3000)` invece di `{ duration: 3000, type: 'error' }` — funziona comunque per retro-compatibilità (vedi `showToast`), ma non passa `type: 'error'`, quindi non applica lo stile/icona di errore.
   - `onManageRecipes` → `goToView('foods')`.

### `renderPhysicsViewPage()` (async)

1. Carica sessioni forza/cardio/passi degli ultimi 7 giorni, pesi giornalieri e preferenze attività (default hardcoded se `prefs` è `null`: `energyModel: 'tdee_plus_extras'`, `avoidDoubleCountingWalking: true`, `eatBackMode: 'partial'`, `eatBackRatio: 0.3`, `includeStepsInTdee: true`, `stepGoal: 10000`, `includeStrengthInExpenditure: true`, `includeCardioInExpenditure: true` — questo blocco di default è duplicato identico in almeno 4 punti del file, vedi Problemi).
2. Costruisce `last7Days` (array di 7 oggetti giorno con conteggi/minuti/kcal).
3. Legge stato sync provider passi da `getConnectedProvider()` + `localStorage.getItem('lastActivitySyncDate')`.
4. Render `renderPhysicsView(physicsState)`, poi `lazyLoadImages()`.
5. `bindPhysicsViewEvents` collega: aggiunta/modifica/eliminazione sessioni forza e cardio (elimina via `deleteSessionWithUndo`), aggiunta passi, sync passi da provider esterno (flusso `showProviderSelectionModal` → `showFileImportModal` → import multi-record con conteggio importati/saltati e aggiornamento di `localStorage` per lo stato sync), disconnessione provider, aggiunta/eliminazione peso.
6. In caso di errore generale, sostituisce `mainContent.innerHTML` con un messaggio di errore statico.

### `renderFridgeViewPage()` (async)

1. Carica in parallelo `fridgeItems` (`loadFridgeItems`) e `recipes` (`loadRecipes`).
2. `computeGaps(appState.meals, targets)` → `gaps`.
3. `computeDailyScore(gaps, appState.meals, fridgeItems)` → `score`.
4. **Insight settimanale**: richiede ≥7 giorni di dati reali. Guarda indietro 10 giorni (`buildLastNDates(appState.currentDate, 10)`, commento nel codice: "10gg basta per trovarne 7; se servono finestre più lunghe, alza la costante"), carica i pasti di ciascun giorno, tiene solo i giorni con almeno un pasto loggato, calcola le percentuali di copertura macro (proteine/carboidrati/grassi, clampate a 1) rispetto ai target. Con questi `summaries`:
   - `computeWeeklyInsight(summaries, fridgeItems)` → `insight` (stringa o `null`).
   - `weakestMacro(summaries)` → `weak` (`{ macro, avg }` o `null`).
   - Se `targets` è `null` (nessun profilo/target), sia `insight` che `weak` restano `null`.
5. **Lista della spesa condizionale**: `const allFoods = weak ? (await getAllFoods()).map(normalizeFoodItem) : []` — il DB alimenti completo viene caricato e normalizzato (forma grezza → `{ nome, per100g, ... }`) **solo** se esiste una carenza cronica rilevata (`weak` non `null`); altrimenti resta un array vuoto, per evitare il costo di caricare l'intero DB alimenti quando non serve.
6. Render `renderFridgeView({ fridgeItems, gaps, meals: appState.meals, score, insight, recipes, allFoods, weak })`.
7. `bindFridgeViewEvents` callback: `onChanged` → `renderCurrentView()` (rerender generico); `onAddFoodToMeal(food, grams)` → `showFoodDetailModal(food, grams)` (passa `grams` come `defaultGrams`, pre-compilando la quantità suggerita dal frigo); `onCookRecipe(recipeId)` → `openAddRecipeAsMeal(recipeId)`.

### `renderSearchView()`

```js
mainContent.innerHTML = renderFoodSearch(appState, appState.searchResults, appState.userFoods);
bindFoodSearchEvents(mainContent, {
  onSearch: executeFoodSearch,
  onCustomFood: () => openCustomFoodForm(),
  onSelectFood: handleFoodSelection,
  onEstimatedFood: () => openEstimationWizard(null, async (mealEntry) => { ... })
});
```
`onEstimatedFood` apre il wizard di stima (senza momento pasto preselezionato — `null`); al completamento, l'entry viene pushata in `appState.meals`, salvata (`saveMealEntries`), tracciata (`trackFoodUsage`), il modal chiuso e la vista ri-renderizzata con toast "✓ Alimento da CREA aggiunto (dati verificati)".

### `renderFoodsView()` (async) — vista Ricette + Alimenti Personalizzati

```js
async function renderFoodsView() {
  const recipes = await loadRecipes();
  mainContent.innerHTML = renderUserFoods(appState.userFoods) + renderRecipesSection(recipes);
  bindUserFoodsEvents(mainContent, { onCreate, onEdit, onDelete });
  bindRecipesEvents(mainContent, { onCreate, onAdd, onEdit, onDelete });
}
```

**Verifica raggiungibilità (richiesta esplicitamente)**: la vista **è raggiungibile** dalla UI. Catena confermata leggendo il codice:
- `js/ui/nutritionView.js` riga 103 renderizza un bottone `<button id="manageRecipesBtn">Gestisci ricette →</button>` nella sezione ricette della vista Nutrizione.
- `js/ui/nutritionView.js` riga 349, dentro `bindNutritionViewEvents`, collega quel bottone: `container.querySelector('#manageRecipesBtn')?.addEventListener('click', () => onManageRecipes?.());`.
- `js/app.js` riga 487, dentro `bindNutritionViewEvents(mainContent, { ..., onManageRecipes: () => goToView('foods') })`.
- `goToView('foods')` imposta `appState.currentView = 'foods'` e chiama `renderCurrentView()`, che nel dispatch `if/else` instrada `currentView === 'foods'` a `renderFoodsView()`.

Il fix descritto (bottone "Gestisci ricette →" aggiunto a `nutritionView.js`, wired via `onManageRecipes`) **è presente e correttamente cablato end-to-end**. `renderFoodsView` non è più orfana.

### `renderWeightLossView()` (async)

Vista di proiezione perdita/composizione corporea. Carica in parallelo pasti, sessioni forza/cardio (di oggi e storiche), pesi giornalieri. Calcola: TDEE teorico, esercizio di oggi, bilanci energetici degli ultimi 7 giorni, TDEE adattivo (`estimateAdaptiveTDEE`), statistiche di allenamento (sessioni/settimana, RPE medio ultimi 7gg), statistiche proteine (g/kg medio ultimi 7gg), stima cambio composizione corporea a 30 giorni (`estimateBodyCompositionChange`), proiezioni di trend a 30 giorni (`getTrendWindowData` + `calculateAllProjections`, con gestione esplicita del caso `insufficientData`). Compone `renderData` e chiama `renderWeightLoss(renderData)`.

`bindWeightLossEvents` callback: `onSaveGoalWeight` (aggiorna `pesoObiettivoKg` nel profilo), `onSaveWeightsSession`/`onSaveCardioSession` (creano una sessione con `id: crypto.randomUUID()` e la data corrente, poi salvano nello store attivo — commento nel codice conferma coerenza con la lettura della vista), `onSaveDailyWeight` (usa `id: appState.currentDate` come chiave, non un UUID — coerente con la semantice "un peso al giorno"), `onDeleteSession(type, id)` → `deleteSessionWithUndo(type === 'weights' ? 'strength' : 'cardio', id, renderWeightLossView)`.

### `renderWeekViewPage()` (async)

Carica tutti i pasti e i dati attività degli ultimi 7 giorni. Calcola statistiche settimanali aggregate (`weeklyActivityStats`: kcal totali attività, conteggio sessioni forza/cardio, passi totali e media giornaliera). Costruisce `days` (7 oggetti: data, etichetta giorno breve in italiano, calorie totali, `status` = `'Ok'`/`'Basso'`/`'Alto'` in base allo scostamento percentuale dal target). Render `renderWeekView(days, weeklyActivityStats)`. `bindWeekViewEvents`: `onSelectDay(selectedDate)` → aggiorna `currentDate`, ricarica pasti, forza `currentView = 'dashboard'` e ri-renderizza (selezionare un giorno nella vista settimanale porta alla dashboard di quel giorno).

### `renderStatsViewPage()` (async)

```js
const [allMeals, dailyWeights] = await Promise.all([loadAllMeals(), loadDailyWeights()]);
mainContent.innerHTML = renderStatsView(allMeals, dailyWeights, appState.nutritionTargets, appState.userProfile);
bindStatsViewEvents(mainContent, {});
```
La più semplice delle viste dati: nessun callback passato (oggetto vuoto `{}`), quindi `renderStatsView`/`bindStatsViewEvents` gestiscono tutta la logica di visualizzazione trend internamente senza bisogno di azioni delegate ad `app.js`. In caso di errore, messaggio statico nel `mainContent`.

### `renderSettingsView()`

```js
function renderSettingsView() {
  mainContent.innerHTML = renderSettings();
  bindSettingsEvents(mainContent, {
    onEditProfile: async () => {
      appState.currentView = 'dashboard';
      renderOnboardingView();
    }
  });
}
```
Unico callback verso `app.js`: `onEditProfile`, che forza `currentView = 'dashboard'` (per coerenza di nav quando si torna indietro) e mostra direttamente il form di onboarding pre-compilato con il profilo esistente (`renderOnboardingView()` usa `appState.userProfile` se presente). Tutto il resto (export/import, diagnostica storage, preferenze attività) è gestito interamente dentro `js/ui/settings.js` — vedi sezione 7.

### `renderActivitiesViewPage()` (async)

Vista dettagliata attività (loading spinner iniziale, poi dati). Ricalcola in autonomia `last7Days` con logica di stima kcal via `estimateWeightsCalories`/`estimateCardioCalories`/`estimateStepsCalories` e `shouldExcludeStepsCalories` (anti-double-counting passi/cardio). Espone stato sync (`activitySyncStatus`) leggendo `PROVIDERS[connectedProviderId].name`, `activitySyncLastTime`, `activitySyncDaysCount` da `localStorage`. `bindActivitiesEvents` collega add/edit/delete per forza, cardio, passi (inclusa modifica passi esistenti via `onEditSteps`), sync/disconnessione provider — sostanzialmente lo stesso set di funzionalità di `renderPhysicsViewPage` ma con struttura dati (`last7Days` con proprietà `strength`/`cardio` invece di `strengthSessions`/`cardioSessions`) e presentazione diverse. **Come notato nella sezione Router, questa funzione non è raggiunta dal dispatch di `renderCurrentView()`** — vedi Problemi.

---

## 6. Flusso di aggiunta/modifica/eliminazione pasti

### `showFoodDetailModal(food, defaultGrams = 100)`

Modal di aggiunta pasto da ricerca/selezione diretta. Accetta il parametro opzionale `defaultGrams` (default `100`), usato dal frigo (`onAddFoodToMeal: (food, grams) => showFoodDetailModal(food, grams)`) per pre-compilare la quantità suggerita in base alla scorta disponibile. Suggerisce il momento pasto in base all'ora corrente (`suggestMealMoment()`). Aggiorna in tempo reale kcal/proteine/carbo/grassi al variare dei grammi (`calculateMacrosForAmount`). Alla conferma:
```js
const entry = {
  id: crypto.randomUUID(),
  userId: appState.userProfile.id,
  data: appState.currentDate,
  momento: moment,
  foodRef: { id: food.id, source: food.source, name: food.nome },
  grammi: grams,
  macroCalcolate,
  per100g: food.per100g, // riferimento stabile per modifiche successive (no drift)
  origin: 'manual_search',
  note: ''
};
appState.meals.push(entry);
await saveMealEntries([entry]);
trackFoodUsage(entry.foodRef, entry.grammi);
await applyMealToFridge(entry.foodRef, entry.grammi); // scala la scorta nel frigo se presente
closeModal();
renderCurrentView();
showToast('Alimento aggiunto.');
```
Valida `grams >= 1` prima di procedere (`reportError` altrimenti). Questo è l'unico punto tra i flussi di aggiunta pasto che genera già l'`id` con `crypto.randomUUID()` lato client **prima** di pushare in `appState.meals` — quindi qui `appState.meals` è sempre coerente con ciò che verrà persistito.

### `executeFoodSearch(query)` (async)

Valida che `query` non sia vuota (`reportError` altrimenti), mostra "Ricerca..." nel bottone, chiama `searchFoods(query)`, salva in `appState.searchResults`, ri-renderizza la vista di ricerca.

### `handleFoodSelection(id, source)` (async)

Se `source === 'USER_CUSTOM'`, cerca in `appState.userFoods`; altrimenti chiama `getFoodDetails(id)` (DB esterno/CREA). Se non trovato, `reportError`. Altrimenti apre `showFoodDetailModal(food)`.

### `editMealModal(moment, mealIndex)`

Mappa l'etichetta italiana capitalizzata al valore minuscolo interno, filtra `appState.meals` per momento, prende l'entry all'indice dato. Usa `getPer100gRef(meal)` — helper che ricava un riferimento per-100g **stabile**: se l'entry ha già `per100g` salvato lo riusa, altrimenti lo deriva **una volta** da `macroCalcolate`/`grammi` correnti (per evitare drift da arrotondamenti ripetuti a ogni modifica successiva). Alla conferma, ricalcola i macro con `calculateMacrosForAmount({ per100g: per100gRef }, grams)`, sostituisce l'entry in `appState.meals` per `id`, salva **l'intero array** `appState.meals` con `saveMealEntries(appState.meals)` (non solo l'entry modificata — coerente perché `saveMealEntries` fa `store.put` per ciascuna entry, operazione idempotente), chiude il modal, ri-renderizza `renderNutritionViewPage()` e mostra toast.

### Il flusso quick-add (`openQuickAddWithMoment` → `performQuickSearch` → `renderQuickSearchResults` → `addMealAndClose`)

`openQuickAddWithMoment(moment)` apre un modal a tab (Cerca / Composto / Personalizzato / Stima / Recenti) con il momento pasto già fissato nel titolo. Nel tab Cerca:
- L'input con debounce 300ms chiama `performQuickSearch(query)`, che combina i primi 5 risultati da `appState.userFoods` (priorità 2, filtrati per nome/brand) con i primi 7 da `searchFoods(query)` (priorità 1, DB esterno), senza deduplicazione esplicita tra le due fonti.
- `renderQuickSearchResults(results, container, moment)` renderizza i bottoni risultato (badge ⭐ per utente / 📦 per database) e collega ciascuno a `openQuickAddWithFoodAndMoment(food, 100, moment)`.

`openQuickAddWithFoodAndMoment(foodRef, suggestedGrams, moment)` mostra un secondo modal con solo l'input grammi (momento già fissato); alla conferma costruisce:
```js
const entry = {
  data: appState.currentDate,
  momento: moment,
  foodRef,
  grammi: grams,
  macroCalcolate: calculateMacrosForAmount(foodRef, grams)
};
await addMealAndClose(entry);
```
**Nota importante**: questo oggetto `entry` **non include `id`** al momento della creazione (a differenza di `showFoodDetailModal`).

`addMealAndClose(entry)` (async):
```js
async function addMealAndClose(entry) {
  appState.meals.push(entry);
  await saveMealEntries([entry]);
  if (entry.foodRef) trackFoodUsage(entry.foodRef, entry.grammi);
  closeModal();
  renderCurrentView();
  showToast('Pasto aggiunto!');
}
```

**Verifica id/grammi>0 (richiesta esplicitamente)**:
- Validazione `grammi > 0`: sì, presente — sia in `openQuickAddWithFoodAndMoment` (`if (!grams || grams < 1) { reportError(...); return; }`) sia in `openQuickAddWithFood` (stessa guardia). Un'entry con `grammi <= 0` o non numerico non arriva mai a `addMealAndClose`.
- Presenza di `id`: **non garantita al momento della creazione dell'oggetto `entry`** in `openQuickAddWithFoodAndMoment` — l'oggetto letterale non imposta `id`. Tuttavia `saveMealEntries(entries)` in `storage.js` applica **sempre** `_migrateMealEntry(entry)` prima di persistere (sia sul path IndexedDB principale sia sul fallback `localStorage`), e `_migrateMealEntry` contiene esplicitamente:
  ```js
  id: entry.id || crypto.randomUUID(),
  ```
  con un commento nel codice sorgente che conferma l'intento: *"Garantisce sempre la chiave primaria: alcuni flussi di aggiunta (quick-add, wizard) costruiscono l'entry senza id → store.put falliva (keyPath 'id') e il pasto finiva nel fallback localStorage, invisibile alle letture da IndexedDB."* Quindi **sì**, il dato persistito su IndexedDB ha sempre un `id`.
  - **Effetto collaterale locale**: siccome `appState.meals.push(entry)` avviene **prima** della migrazione (che vive dentro `saveMealEntries`, e l'oggetto migrato non viene riassegnato all'entry in `appState.meals`), l'oggetto in memoria in `appState.meals` per queste entry **resta senza `id`** finché non viene ricaricato da storage (prossimo `loadMealsByDate`/`renderCurrentView` con reload dei pasti, es. cambio data o refresh vista). Nella pratica questo è innocuo per il rendering del giorno corrente (le viste nutrizione filtrano per `momento`/indice posizionale, non per `id`), ma qualunque codice che facesse `appState.meals.find(m => m.id === ...)` su un'entry aggiunta in questa sessione e non ancora ricaricata da storage otterrebbe `undefined`. È lo stesso pattern (id assente finché non c'è un reload) usato anche da `showFoodDetailModal`? No — quella funzione genera l'`id` a mano lato client, quindi non ha questo problema; solo il ramo quick-add (`openQuickAddWithFoodAndMoment`) e il ramo "recenti/quick-add generico" (`openQuickAddWithFood`, che invece **genera** `id: crypto.randomUUID()` esplicitamente) sono da distinguere — vedi sotto.

  Riepilogo per funzione:
  | Funzione | Genera `id` lato client? | `grammi` validato `>0`? |
  |---|---|---|
  | `showFoodDetailModal` | Sì (`crypto.randomUUID()`) | Sì |
  | `editMealModal` (salvataggio) | Riusa `meal.id` esistente (spread `{...meal, ...}`) | Sì |
  | `openQuickAddWithFoodAndMoment` | **No** — affidato al safety net di `_migrateMealEntry` | Sì |
  | `openQuickAddWithFood` | Sì (`crypto.randomUUID()`) | Sì |
  | `openAddRecipeAsMeal` | Sì (`crypto.randomUUID()`) | N/A (usa porzioni, non grammi diretti; grammi totali calcolati e sempre >0 se la ricetta ha ingredienti) |
  | `renderSearchView` → `onEstimatedFood` | Dipende da `openEstimationWizard` (fuori scope di questo file) | Dipende dal wizard |

### `openQuickAddWithFood(foodRef, suggestedGrams = 100)`

Variante usata dal flusso "recenti" fuori dal wizard a tab (vedi `loadRecentFoodsWithMoment`... in realtà quella chiama `openQuickAddWithFoodAndMoment`; `openQuickAddWithFood` senza `AndMoment` è invocata da `onAddFoodToMeal`-style call altrove — nello specifico non risulta chiamata da nessun punto del router principale osservato in questo file, ma è esportata solo internamente e usata come utility generica con selezione del momento pasto inline (select `#mealMomentSelect`, pre-impostato a `suggestMealMoment()`). Include un blocco try/catch per recuperare i macro corretti (`USER_CUSTOM` → cerca in `appState.userFoods`; altrimenti `getFoodDetails(foodRef.id)`), con fallback a macro azzerati se il recupero fallisce. Genera `id: crypto.randomUUID()`, `origin: 'recent_quick_add'`, `note: 'Aggiunto da recenti'`.

### `openCustomFoodFormWithMoment(moment)`

Apre il form nuovo-alimento-personalizzato; al salvataggio valida `data.nome` obbligatorio, crea l'alimento (`id: crypto.randomUUID(), source: 'USER_CUSTOM', createdByUserId: appState.userProfile.id`), lo pusha/salva in `appState.userFoods`, chiude il modal e incatena **immediatamente** `openQuickAddWithFoodAndMoment(foodRef, 100, moment)` per far proseguire l'utente dritto all'inserimento grammi/quantità, senza dover ripetere la ricerca.

### Flusso ricetta-come-pasto (`openAddRecipeAsMeal`)

```js
async function openAddRecipeAsMeal(recipeId) {
  const recipe = await loadRecipeById(recipeId);
  if (!recipe) { reportError('Ricetta non trovata'); return; }
  // ... modal con select momento + input numero porzioni ...
}
```
Calcola macro totali sommando, per ciascun ingrediente, `per100g` (salvato nell'ingrediente per ricette nuove, con fallback a `appState.userFoods.find(f => f.id === ing.foodRef?.id)?.per100g` per ricette legacy) moltiplicato per `grammi * porzioni / 100`. Aggiorna live al variare del numero di porzioni.

Alla conferma:
```js
const entry = {
  id: crypto.randomUUID(),
  userId: appState.userProfile.id,
  data: appState.currentDate,
  momento: moment,
  foodRef: { id: recipe.id, source: 'RECIPE', name: recipe.nome },
  grammi: Math.round(recipe.ingredients.reduce((sum, ing) => sum + ing.grammi, 0) * portions),
  macroCalcolate: { kcal, proteine, carboidrati, grassi, zuccheri: 0, fibra: 0 },
  origin: 'recipe_saved',
  note: `Ricetta: ${recipe.nome} (${portions} porzioni)`
};
appState.meals.push(entry);
await saveMealEntries([entry]);
trackFoodUsage(entry.foodRef, entry.grammi);
await applyRecipeToFridge(recipe.ingredients, portions); // scala gli ingredienti dal frigo
closeModal();
renderCurrentView();
showToast('Ricetta aggiunta al giorno!');
```

**Verifica esplicitamente richiesta**: sì, `applyRecipeToFridge(recipe.ingredients, portions)` **viene chiamata dopo il salvataggio del pasto**, per decrementare la scorta del frigo di ciascun ingrediente della ricetta in proporzione al numero di porzioni cucinate — simmetrico a `applyMealToFridge` usato in `showFoodDetailModal` per singoli alimenti. Nota: `macroCalcolate.zuccheri` e `.fibra` sono hardcoded a `0` per le entry da ricetta (non sommati dagli ingredienti) — perdita di dettaglio rispetto a un'entry da alimento singolo.

### `openCustomFoodFormWithMoment`, `editCustomFoodModal`, `deleteUserFood`

- `editCustomFoodModal(foodId)` — trova l'alimento in `appState.userFoods`, apre `renderUserFoodForm(food)` precompilato; al salvataggio valida `data.nome`, fa merge (`{ ...food, ...data }`), sostituisce nell'array, salva, ri-renderizza `renderNutritionViewPage()`.
- `deleteUserFood(id)` (async) — chiede conferma con `showConfirm(..., { confirmLabel: 'Elimina', danger: true })`, rimuove dall'array, salva, ri-renderizza `renderFoodsView()`, toast con undo (ripristina l'elemento rimosso, ri-salva, ri-renderizza).

### `editRecipe` / `deleteRecipeConfirm` / `openRecipeForm`

- `openRecipeForm(existingRecipe = null)` — apre `renderRecipeForm(existingRecipe)`; al salvataggio, se `existingRecipe` esiste chiama `updateRecipe(id, data)`, altrimenti `saveRecipe(data)`; in entrambi i casi chiude il modal e ri-renderizza `renderFoodsView()`. Errori catturati con `reportError`.
- `editRecipe(id)` (async) — `loadRecipeById(id)`, se non trovata `reportError`, altrimenti `openRecipeForm(recipe)`.
- `deleteRecipeConfirm(id)` (async) — conferma con `showConfirm`, carica la ricetta prima di cancellarla (per l'undo), `deleteRecipe(id)`, ri-renderizza, toast con undo che ri-salva (`saveRecipe(removed)`).

---

## 7. Export/Import — wiring da Settings

`renderSettingsView()` in `app.js` **non** collega export/import: l'unico callback passato a `bindSettingsEvents` è `onEditProfile`. Tutta la logica di backup/ripristino vive interamente in `js/ui/settings.js`:
- `renderSettings()` genera i bottoni `#exportBtn` e `#importBtn`.
- `bindSettingsEvents(container, callbacks)` collega internamente questi bottoni a due funzioni locali del modulo (gestione export: disabilita/riabilita il bottone, cambia testo durante l'operazione, gestisce errori; gestione import: chiede conferma via `showConfirm` prima di sovrascrivere, poi chiama `backup.importAllUserData(data, 'replace')` da `js/sync/backupService.js`, e alla fine propone un reload della pagina).
- Il modulo usa anche `import()` dinamici per accedere a `storage/persistence.js` (diagnostica storage) e `appBootstrap.js` (stato bootstrap, `getBootstrapState()`) per una sezione diagnostica nelle impostazioni.

Quindi il collegamento tra `app.js` e la feature di export/import è **assente per design**: `app.js` non ha bisogno di conoscere i dettagli di backup/ripristino, che sono incapsulati interamente nella vista Settings e nel modulo `backupService.js`.

---

## 8. `js/utils.js`

Modulo di utility pure (nessun side-effect), pensato per centralizzare funzioni ripetute tra moduli.

- **`escapeHtml(value)`** — esegue l'escape di `&`, `<`, `>`, `"`, `'`. Gestisce `null`/`undefined` ritornando stringa vuota. Da usare su ogni stringa controllata dall'utente prima di inserirla in `innerHTML` (usata pervasivamente in `app.js` per nomi alimenti/ricette).
- **`emptyStateHtml(emoji, title, hint = '')`** — genera il markup standard per stati vuoti (`<div class="empty-state">` con emoji, titolo, hint opzionale).
- **`todayISO()`** — data odierna in formato `YYYY-MM-DD`, ora locale (`new Date().toISOString().slice(0, 10)` — nota: `toISOString()` normalizza a UTC, quindi vicino alla mezzanotte locale può differire dalla data locale percepita dall'utente in fusi orari non-UTC; comportamento condiviso con `appState.currentDate` inizializzato allo stesso modo in `app.js`).
- **`formatDateIT(iso, opts = {})`** — formatta una data ISO in italiano leggibile (es. "22 maggio 2026", o con `{ weekday: true }` → "giovedì 22 maggio 2026"). Ritorna stringa vuota per input falsy, ritorna l'input originale se il parsing produce `NaN`.
- **`formatDateShortIT(iso)`** — formato breve tipo "22 mag", per grafici/liste.
- **`capitalize(str)`** — prima lettera maiuscola; gestisce stringa vuota/falsy.
- **`buildLastNDates(endDateISO, n)`** — genera un array di `n` date ISO consecutive terminanti a `endDateISO` incluso, dalla più vecchia alla più recente. Usa `Date` in **UTC** esplicitamente (`'T00:00:00Z'`) "per coerenza con le date salvate dall'app (basate su `toISOString`)" (commento nel codice). Usata in `app.js` per costruire finestre di 7/10 giorni (trend dashboard, insight frigo).
- **`isSpeechRecognitionAvailable()`** — controlla se `window.SpeechRecognition` o `window.webkitSpeechRecognition` esistono.
- **`startVoiceRecognition({ lang = 'it-IT', onResult, onError, onEnd })`** — avvia un riconoscimento vocale singolo (non continuo, 1 sola alternativa), con callback per risultato/errore/fine. Ritorna l'istanza del recognizer (per poterla fermare con `.stop()`) o `null` se non supportato o se `.start()` lancia eccezione.

Tutte le funzioni sono pure o quasi-pure (le ultime due toccano `window`/API browser ma non hanno stato di modulo). `app.js` importa solo `escapeHtml`, `formatDateIT`, `buildLastNDates` dal set completo esportato da `utils.js` (le altre, es. `emptyStateHtml`, `capitalize`, `formatDateShortIT`, `todayISO`, le funzioni voce, sono usate da altri moduli UI non in scope qui).

---

## Problemi / note

- **`renderActivitiesViewPage()` non è raggiungibile dal router.** Il dispatch in `renderCurrentView()` per `currentView === 'activities'` chiama `renderPhysicsViewPage()`, non `renderActivitiesViewPage()`. Quest'ultima è una funzione completa, esportata solo implicitamente (funzione di modulo, non esportata da `app.js` verso l'esterno) e con logica quasi interamente duplicata rispetto a `renderPhysicsViewPage` (stesso caricamento dati, stesso set quasi identico di binding `onAddStrength`/`onEditStrength`/ecc., con differenze minori nella forma dei dati passati alla vista e uno stato di loading iniziale che `renderPhysicsViewPage` non ha). Nessun punto della UI (bottom nav, bottoni interni) sembra impostare `currentView = 'activities'` in un modo che la raggiunga: la bottom nav punta sempre a `'physics'`. È codice morto/duplicato — o va rimosso, o va collegato a un punto d'ingresso reale se la vista "Attività" dettagliata era pensata come schermata a sé.

- **`attachBottomNav()` inizializza lo swipe dentro il listener di click**, non a livello di setup. Il blocco `initSwipeNavigation(mainContent, navButtons, ...)` è annidato dentro `bottomNav.addEventListener('click', event => { ... })`, quindi:
  1. Ogni click su un bottone della bottom nav ri-registra un nuovo listener di swipe su `mainContent` (tramite `initSwipeNavigation`, non ispezionato in dettaglio qui ma il pattern è comunque sbagliato indipendentemente dalla sua idempotenza interna).
  2. Se `initSwipeNavigation` non fa già la sua pulizia interna dei listener precedenti, questo porta ad accumulo di handler duplicati nel tempo, con possibili effetti collaterali (callback dello swipe invocata N volte dopo N navigazioni via bottom nav).
  3. La variabile locale `const mainContent = document.getElementById('mainContent')` dentro il listener ombreggia la costante di modulo omonima — stesso elemento, quindi innocuo funzionalmente, ma confusionario e va tolto.
  
  Correzione naturale: spostare il blocco swipe fuori dal listener `click`, a livello di `attachBottomNav()` (eseguito una sola volta da `init()`).

- **`grammi` di default a `100`** in vari punti (`showFoodDetailModal`, `openQuickAddWithFoodAndMoment` chiamata da `renderQuickSearchResults`) — coerente e intenzionale, non un problema.

- **Entry senza `id` in `appState.meals` per il ramo quick-add** (`openQuickAddWithFoodAndMoment` → `addMealAndClose`). Non è un bug di persistenza (il safety net `_migrateMealEntry` in `storage.js` garantisce sempre un `id` sui dati effettivamente salvati, sia su IndexedDB sia sul fallback `localStorage`), ma è un'incoerenza locale: l'oggetto push-ato in `appState.meals` in memoria non ha `id` finché non arriva un reload da storage. Qualsiasi futura funzionalità che facesse `appState.meals.find(m => m.id === x)` su un'entry appena aggiunta per questa via, prima di un reload, fallirebbe silenziosamente. Rischio basso ma latente — sarebbe più robusto generare `id: crypto.randomUUID()` esplicitamente anche in questo ramo, come già fatto in `showFoodDetailModal`, `openQuickAddWithFood` e `openAddRecipeAsMeal`, invece di affidarsi al safety net di uno strato diverso (storage) per coprire uno strato diverso (stato UI).

- **Duplicazione del blocco di default `activityPrefs`** (`{ energyModel: 'tdee_plus_extras', avoidDoubleCountingWalking: true, eatBackMode: 'partial', eatBackRatio: 0.3, includeStepsInTdee: true, stepGoal: 10000, includeStrengthInExpenditure: true, includeCardioInExpenditure: true }`) ripetuto identico in almeno 4 punti: `renderDashboardView`, `renderPhysicsViewPage`, `renderActivitiesViewPage` (codice morto, vedi sopra), e implicitamente nel calcolo settimanale in `renderWeekViewPage` (che invece usa `prefs` senza fallback esplicito nello stesso modo — verificare coerenza se si tocca questa parte). Andrebbe estratto in una costante condivisa (es. in `activityEnergyEngine.js`) per evitare drift futuro tra i default.

- **Sync passi**: il blocco di gestione `onSyncSteps` (provider selection → file import → salvataggio record → aggiornamento `localStorage`) è duplicato quasi identico tra `renderPhysicsViewPage` e `renderActivitiesViewPage` — ulteriore conferma che le due viste sono largamente ridondanti.

- **`onDeleteCustomFood` in `renderNutritionViewPage`** usa `showToast('Errore nell\'eliminazione', 3000)` (forma legacy posizionale) invece di `{ duration: 3000, type: 'error' }` come fatto ovunque altrove nel file — funziona per retro-compatibilità della firma di `showToast`, ma perde lo stile/icona di errore. Incoerenza minore, non un bug funzionale.

- **`macroCalcolate.zuccheri`/`.fibra` azzerati per le entry da ricetta** (`openAddRecipeAsMeal`) — i totali di zuccheri e fibra non vengono sommati dagli ingredienti come invece accade per kcal/proteine/carboidrati/grassi. Le viste che si basano su questi campi (es. analisi micronutrienti/fibra) sottostimeranno sistematicamente i pasti aggiunti come ricette.

- **`console.log` di debug lasciati in produzione** in `renderDashboardView` (blocco composizione corporea: `'Baselines caricate:'`, `'Current baseline:'`, `'Caricamento dati per calcolo composizione...'`, `'Dati caricati:'`, `'Deltas calcolati:'`, `'Peso oggi:'`, `'Composizione stimata:'`, `'bodyCompData finale:'`, `'Nessun baseline presente'`) — rumore in console ad ogni caricamento dashboard quando esiste un baseline; non un bug funzionale ma andrebbe rimosso o messo dietro un flag di debug.

- **`openQuickAddWithFood` è codice morto.** Verificato con `grep -rn "openQuickAddWithFood(" js/` escludendo i match di `openQuickAddWithFoodAndMoment`: l'unica occorrenza nell'intero albero `js/` è la sua stessa dichiarazione (`js/app.js:2357`). Nessun punto del router, di `bindDashboardEvents`, `bindNutritionViewEvents`, `bindFridgeViewEvents` o altri moduli `ui/*.js` la richiama — il flusso "recenti" dentro il modal a tab usa `loadRecentFoodsWithMoment` → `openQuickAddWithFoodAndMoment` (con "AndMoment"), non questa funzione gemella. `openQuickAddWithFood` (56 righe, dalla riga 2357 alla 2441, fine file) può essere rimossa senza impatto funzionale.

---

## 4. Viste e componenti UI

# 04 — Moduli UI (js/ui/)

> Analisi dei moduli vista della PWA ContaCalorie. Ogni file segue il pattern `render*(state) → stringa HTML` + `bind*Events(container, callbacks) → void`, dove `render*` produce markup puro (nessun side-effect) e `bind*Events` collega gli event listener DOM invocando callback fornite dal chiamante (quasi sempre `js/app.js`, che detiene lo stato applicativo e orchestra la persistenza via `js/storage.js`).
>
> Ambito di questo documento: tutti i moduli in `js/ui/` **tranne** `fridgeView.js` (coperto da un'altra analisi), più i due file collegati al riconoscimento foto (`js/ui/photoAnalysis.js`, `js/photoNutrition.js`) e il modulo vocale (`js/ui/voiceInput.js`).

---

## Indice

1. [modal.js — sistema modale condiviso](#modaljs)
2. [dashboard.js — Home](#dashboardjs)
3. [nutritionView.js — Tab Nutrizione](#nutritionviewjs)
4. [physicsView.js — Tab Fisica](#physicsviewjs)
5. [activities.js — Sistema attività (modale separato)](#activitiesjs)
6. [onboarding.js — Setup iniziale profilo](#onboardingjs)
7. [foodSearch.js — Ricerca/aggiunta alimento](#foodsearchjs)
8. [userFoods.js — Alimenti personalizzati](#userfoodsjs)
9. [recipes.js — CRUD ricette](#recipesjs)
10. [weekView.js — Vista settimanale](#weekviewjs)
11. [weightLoss.js — Peso e composizione corporea](#weightlossjs)
12. [settings.js — Impostazioni](#settingsjs)
13. [statsView.js — Statistiche & insight](#statsviewjs)
14. [collapsible.js — Sezioni comprimibili (utility)](#collapsiblejs)
15. [swipeNav.js — Navigazione a swipe (utility)](#swipenavjs)
16. [lazyLoad.js — Caricamento progressivo (utility)](#lazyloadjs)
17. [estimatedFoodForm.js — Stima alimento senza dati precisi](#estimatedfoodformjs)
18. [composedFoodForm.js — Composizione piatto da ingredienti](#composedfoodformjs)
19. [photoAnalysis.js / photoNutrition.js — Analisi foto (CODICE MORTO)](#photoanalysisjs--photonutritionjs)
20. [voiceInput.js — Dettatura vocale](#voiceinputjs)
21. [Problemi / note](#problemi--note)

---

## modal.js

File: `js/ui/modal.js` (107 righe). È il modulo su cui dipendono quasi tutti gli altri (eccetto `activities.js`, che ha un sistema proprio — vedi sezione dedicata). Si appoggia al `<template id="modalTemplate">` definito in `index.html`, che contiene la struttura `.modal-overlay > .modal-close + .modal-body`.

### `showModal(contentHtml, bind?)`

**Cosa fa:** clona il contenuto del `<template id="modalTemplate">`, inietta `contentHtml` dentro `.modal-body` (via `innerHTML`, quindi **il chiamante deve già aver fatto l'escaping** di eventuali dati dinamici), collega la chiusura su click sul pulsante `.modal-close`, su click sul backdrop stesso (`.modal-overlay`, solo se il target è esattamente il backdrop e non un figlio), e sul tasto `Escape` (listener su `document`, rimosso alla chiusura). Appende il frammento a `document.body`, poi richiama `bind(modalRoot)` se fornita — questo è il punto in cui il chiamante collega i propri listener specifici al contenuto appena montato. Se `bind` non ha già spostato il focus dentro il modale, sposta l'autofocus sul primo `input`, `select`, `textarea` o `button.primary` trovato.

**A cosa serve:** è il costruttore generico di ogni modale dell'app (form di aggiunta pasto, editor attività — tranne quelle di `activities.js`, dettaglio micronutrienti, ecc.). Se `#modalTemplate` non esiste nel DOM, stampa un errore in console e non fa nulla (nessun modale mostrato, nessun crash).

**Nota tecnica:** siccome può esserci al più un modale attivo per volta nel flusso normale dell'app, `showModal` seleziona `.modal-overlay:last-of-type` per ottenere il riferimento al modale appena montato — funziona correttamente solo se non ci sono già altri `.modal-overlay` aperti in coda; l'app non sembra però supportare modali annidati/impilati.

### `closeModal()`

**Cosa fa:** rimuove dal DOM il primo `.modal-overlay` trovato con `document.querySelector`.

**A cosa serve:** chiusura programmatica del modale corrente, invocata dai callback dell'app dopo il salvataggio di un form (es. dopo `onSave` in un modale di aggiunta pasto).

### `showConfirm(message, opts?)`

**Cosa fa:** costruisce e mostra (sempre tramite lo stesso `<template id="modalTemplate">`) una finestra di conferma stilizzata coerente col design dell'app, in sostituzione del `confirm()` nativo del browser. Ritorna una `Promise<boolean>` che si risolve con `true` se l'utente clicca sul pulsante di conferma, `false` se clicca Annulla, sul pulsante di chiusura, sul backdrop, o preme Escape. Il testo del messaggio è impostato con `textContent` (non `innerHTML`), quindi è sicuro anche con dati dinamici non sanificati. Le opzioni supportate: `title` (default `'Conferma'`), `confirmLabel` (default `'Conferma'`), `cancelLabel` (default `'Annulla'`), `danger` (bool, se `true` colora di rosso il pulsante di conferma per azioni distruttive). Il pulsante di conferma riceve il focus automatico, così premere Invio conferma l'azione.

**A cosa serve:** è la funzione usata ovunque nell'app per chiedere conferma prima di eliminazioni o azioni distruttive (es. eliminare un alimento personalizzato in `nutritionView.js`, eliminare una sessione di attività in `physicsView.js`). Ha un fallback estremo al `window.confirm()` nativo se il template non è disponibile.

**Import:** usata direttamente da `nutritionView.js`, `physicsView.js`, e presumibilmente da molti punti in `app.js` e negli altri moduli vista (weightLoss.js, settings.js, recipes.js, userFoods indirettamente tramite app.js).

---

## dashboard.js

File: `js/ui/dashboard.js` (667 righe). Rappresenta la Home page dell'app: un riepilogo operativo giornaliero composto da un header di navigazione data + 6 card informative, ciascuna con CTA verso le tab di dettaglio.

### `renderDashboard(state, summary, warnings, bodyCompData, activityData, microData)`

**Cosa fa:** produce l'HTML completo della dashboard concatenando: header (data + 3 quick action), card Macros (cerchi di progresso), card Micronutrienti, card Bilancio Energetico, card Attività di Oggi, card Storico Peso, card Pasti di Oggi, card Status Rapido (trend). Raggruppa `state.meals` per `momento` (usando `MealMoments` da `models.js`) per costruire la card pasti.

**A cosa serve:** vista principale mostrata all'apertura dell'app (tab Home). Richiede `state.userProfile` per mostrare le card dipendenti dal profilo (alcune ritornano stringa vuota se il profilo non è impostato — vedi `renderCardOggi`, `renderCardStatusRapido`).

**Dati richiesti:**
- `state`: oggetto stato globale (`state.meals`, `state.currentDate`, `state.userProfile`, `state.nutritionTargets`, `state.dailyWeights`)
- `summary`: oggetto calcolato altrove (probabilmente da `nutritionEngine.js`/`statisticsEngine.js`) con `totaleCalorie`, `totaleProteine`, `totaleCarbo`, `totaleGrassi`, `tdee`, `activityKcal`, `weeklyTrend`
- `warnings`: array di stringhe di avviso nutrizionale
- `bodyCompData`: passato ma non consumato direttamente in questa funzione (probabile uso futuro o residuo)
- `activityData`: `{ steps, strengthCount, cardioCount, activityKcal, prefs }`
- `microData`: `{ hasMeals, analysis[], suggestions, remainingKcal }` per la card micronutrienti

### `renderMicroDetail(analysis)` (esportata)

**Cosa fa:** genera il markup per il **contenuto di un modale** (da passare a `showModal`) con l'elenco completo di tutti i micronutrienti monitorati, ciascuno con barra di progresso colorata per stato (`low`/`medium`/`ok`/`unknown`). Gestisce il caso array vuoto/nullo con un messaggio di fallback.

**A cosa serve:** è il markup mostrato quando l'utente clicca sul link "Vedi tutti i micronutrienti" o "Dettaglio" nella card Micronutrienti della dashboard, tramite il callback `onMicroDetail`.

### Funzioni interne (non esportate)

Tutte prefissate `render*` e non esportate — costruiscono le singole card:
- `renderCardMicronutrienti(microData)`: mostra stato "nessun pasto" se `!microData.hasMeals`; altrimenti calcola quali micronutrienti sono in carenza (`low`/`medium`) e mostra fino a 4 righe con barra di progresso e un suggerimento alimentare (`microData.suggestions[key][0]`) per colmare la carenza entro le calorie rimanenti. Se non ci sono carenze, mostra un banner verde di successo.
- `renderHeader(currentDate)`: header con navigazione giorno precedente/successivo (`#dashPrevDay`/`#dashNextDay`), etichetta data cliccabile con `<input type="date">` invisibile sovrapposto (`#dashDatePicker`) per la selezione rapida, pulsante "Torna a oggi" (mostrato solo se non si è già su oggi), e 3 quick action (`+ Pasto`, `+ Attività`, `+ Peso`).
- `renderMacroProgressCircles(summary, targets, warnings)`: 4 cerchi di progresso CSS (`conic-gradient`) per calorie/proteine/carbo/grassi, colore dinamico (rosso <75%, ambra <100%, verde ≥100%, cap visivo al 120%). Include link "Dettagli Nutrizione ↗" e blocco warning se presenti.
- `renderCardBilancio(summary)`: 4 box (Intake, TDEE, Esercizio, Bilancio) con colore/etichetta dinamici in base al bilancio calorico (deficit significativo <-500, deficit leggero <0, surplus >500, equilibrio altrimenti).
- `renderCardAttivitaOggi(activityData)`: snapshot passi/sessioni/kcal; stato vuoto se nessuna attività registrata.
- `renderCardStoricoPeso(dailyWeights, userProfile)`: box peso attuale, stima massa grassa/magra (da `bodyFatPercent` più recente o fallback dal profilo, default 20%), trend a 30 giorni con mini bar-chart CSS degli ultimi 30 pesi registrati. Stato vuoto se nessun peso registrato.
- `renderCardPastiOggi(grouped)`: 4 righe (una per `MealMoments`) con totale kcal per momento e totale generale.
- `renderCardStatusRapido(state, summary)`: 3 righe (ieri, 2 giorni fa, direzione trend) basate su `summary.weeklyTrend.dailyBalances`; ritorna stringa vuota se profilo assente o trend assente; mostra "dati insufficienti" se meno di 2 giorni di bilanci.

### `bindDashboardEvents(container, callbacks)`

**Cosa fa:** collega tutti gli event listener della dashboard. Callback attesi (tutti opzionali, verificati con `&&`/`?.`):

| Callback | Trigger |
|---|---|
| `onChangeDate(newIsoDate)` | click su prev/next giorno, "Torna a oggi", cambio `#dashDatePicker` |
| `onMicroDetail()` | click su `#microDetailLink` |
| `onGoToProjections()` | click su `#weightProjectionsLink` |
| `onAddMeal()` | click su `#quickAddMealBtn` |
| `onAddActivity()` | click su `#quickAddActivityBtn` |
| `onAddWeight()` | click su `#quickAddWeightBtn` (e anche `#quickAddWeightBtn2`, se presente nel DOM — bottone non renderizzato da questo file, probabile residuo per markup aggiunto altrove) |
| `onGoToNutrition()` | click su `#viewNutritionLink` / `#viewNutritionDetailLink` |
| `onGoToActivities()` | click su `#viewActivitiesLink` |
| `onGoToWeight()` | click su `#viewWeightLink` / `#viewWeightDetailLink` |
| `onBodyComp()` | click su `#addBodyCompBtn` |
| `onUpdateWeight()` | click su `#updateWeightBtn` |

**Nota:** `viewNutritionLink`, `viewActivitiesLink`, `viewWeightLink`, `viewWeightDetailLink`, `addBodyCompBtn`, `updateWeightBtn`, `quickAddWeightBtn2` non sono presenti nel markup generato da `renderDashboard`/dalle funzioni card di questo file — il binding li cerca comunque (con controllo di esistenza), suggerendo che siano ID legacy non più renderizzati o riservati per varianti future del markup.

---

## nutritionView.js

File: `js/ui/nutritionView.js` (418 righe). Tab "Nutrizione": dettaglio completo di macro, pasti per momento della giornata, alimenti personalizzati, e punto di ingresso alle ricette.

### Helper interni

- `_getSourceBadge(item)`: genera un badge colorato in base a `item.sourceType` (`A_DATABASE`, `B_PERSONALIZZATO`, `C_PASTO_COMPOSTO`, `D_STIMA_RAPIDA`, `E_RECENTI`) e `item.confidenceLevel`, per comunicare visivamente l'affidabilità del dato nutrizionale di un pasto registrato.
- `_getConfidenceIndicator(confidence)`: pallini colorati (●●●/●●○/●○○) a fianco del nome alimento in base al livello di confidenza (≥85 verde, ≥60 ambra, altrimenti rosso).

### `renderNutritionView(state, summary)`

**Cosa fa:** se `!state.userProfile` mostra un placeholder "Completa il profilo". Altrimenti raggruppa `state.meals` per momento e concatena: header, breakdown macro a tab, pasti per momento, alimenti personalizzati, sezione "Ricette" (con singolo bottone `#manageRecipesBtn`), analisi settimanale.

**A cosa serve:** vista di dettaglio nutrizionale, raggiungibile dai vari link "Dettagli Nutrizione" della dashboard.

**Nota rilevante — punto di ingresso alle ricette:** la sezione ricette qui è minimale (titolo + un bottone `Gestisci ricette →`); il vero CRUD ricette vive in `recipes.js` ed è raggiunto esclusivamente tramite il callback `onManageRecipes` collegato a questo bottone (vedi sotto). Senza questo bottone la vista ricette sarebbe irraggiungibile dalla tab Nutrizione (anche se `recipes.js` risulta raggiungibile anche dalla vista `foods`, vedi sezione `recipes.js`).

### `renderMacroBreakdown(summary)` / `renderMacroTab(key, data, unit, color, style)` (interni)

**Cosa fa:** costruiscono un pannello a tab (Calorie/Proteine/Carbs/Grassi) con switch client-side via classi/stile inline (non tramite re-render), ciascuna tab con barra di progresso, valore attuale/target, percentuale, quantità mancante. Legge `summary.confrontoConTarget.{calorie,proteine,carboidrati,grassi}`.

### `renderMealsByMoment(grouped, state)` / `renderMealMoment(moment, items, state)` (interni)

**Cosa fa:** per ciascun momento (`MealMoments`) renderizza una card con lista dei pasti registrati (nome, grammi, kcal, proteine, badge sorgente, indicatore confidenza, pulsanti modifica/elimina), il totale kcal/proteine del momento, e un bottone "+ Aggiungi Cibo". Stato vuoto: "— Nessun pasto qui —" se non ci sono voci per quel momento.

### `renderPersonalizedFoods(userFoods)` (interno)

**Cosa fa:** se `userFoods` è vuoto/assente, mostra stato vuoto con CTA "+ Nuovo Alimento"; altrimenti elenca gli alimenti personalizzati con kcal/proteine/carbo per 100g e pulsanti modifica/elimina, più lo stesso CTA in fondo.

### `renderWeeklyAnalysis(summary)` (interno)

**Cosa fa:** ritorna stringa vuota se `!summary.weeklyTrend`; altrimenti mostra intake medio settimanale, target, gap medio.

### `bindNutritionViewEvents(container, callbacks)`

**Cosa fa:** collega tutti gli event handler. Elenco callback attesi:

| Callback | Trigger |
|---|---|
| `onManageRecipes()` | click su `#manageRecipesBtn` — **unico punto di ingresso da questa vista alla gestione ricette** |
| `onAddMealToMoment(moment)` | click su `.add-to-moment-btn` |
| `onEditMeal(moment, index)` | click su `.meal-edit-btn` |
| `onDeleteMeal(moment, index)` | click su `.meal-delete-btn` — **nessuna conferma richiesta**: l'eliminazione è immediata, con undo previsto lato app tramite toast (commento esplicito nel codice) |
| `onCreateCustomFood()` | click su uno qualsiasi dei bottoni `#createCustomFoodBtn` (`querySelectorAll`, anche se l'ID è duplicato tra i due stati render — vedi nota HTML non valido sotto) |
| `onEditCustomFood(foodId)` | click su `.custom-food-edit-btn` |
| `onDeleteCustomFood(foodId)` | click su `.custom-food-delete-btn`, **previa conferma** tramite `showConfirm('Eliminare questo alimento personalizzato?', { confirmLabel: 'Elimina', danger: true })` — import diretto da `modal.js` |

Anche la logica di switch tab macro (`.macro-tab` click → aggiorna stile bordo/colore testo e mostra/nasconde `.macro-tab-content` corrispondente) è gestita interamente qui, senza bisogno di callback esterni.

**Nota su duplicazione ID:** `renderPersonalizedFoods` genera `id="createCustomFoodBtn"` sia nel ramo stato-vuoto sia nel ramo con dati — dato che i due rami sono mutuamente esclusivi in output, l'HTML finale ha sempre un solo elemento con quell'id (non è un vero duplicato runtime), ma il binding lo cerca comunque con `querySelectorAll` per sicurezza.

---

## physicsView.js

File: `js/ui/physicsView.js` (277 righe). Tab "Fisica", raggiunta tramite le view `physics`/`weight`/`activities` (tutte e tre mappate allo stesso handler `renderPhysicsViewPage()` in `app.js` — vedi nota architetturale sotto). Mostra attività (pesi/cardio/passi) in forma aggregata.

### `renderPhysicsView(state)`

**Cosa fa:** se `!state.userProfile` mostra placeholder "Completa il profilo". Altrimenti compone: header, riepilogo ultimi 7 giorni (`renderLast7DaysSummary`), riepilogo oggi (`renderTodaySummary`), sezione "Aggiungi Oggi" con 4 bottoni (Pesi/Cardio/Passi/Sincronizza), stato sincronizzazione passi (`renderStepsSyncStatus`), sessioni pesi recenti, sessioni cardio recenti, storico passi a 7 giorni (mini bar chart CSS).

**Dati richiesti (destrutturati da `state`):** `userProfile`, `last7Days` (array di oggetti giorno con `strengthCount`, `cardioCount`, `strengthMin`, `cardioMin`, `steps`, `activityKcal`, `strengthSessions`, `cardioSessions`), `todayStrength`, `todayCardio`, `todaySteps`, `prefs` (con `stepGoal`), `activitySyncStatus` (con `connectedProvider`, `lastSyncDate`).

### `bindPhysicsViewEvents(container, callbacks)`

**Cosa fa:** collega i pulsanti di apertura modale e i pulsanti modifica/elimina.

| Callback | Trigger |
|---|---|
| `onAddStrength()` | click `#openAddStrengthBtn` |
| `onAddCardio()` | click `#openAddCardioBtn` |
| `onAddSteps()` | click `#openAddStepsBtn` |
| `onSyncSteps()` | click su uno qualsiasi degli `#openSyncStepsBtn` (`querySelectorAll`, ce ne sono due nel markup: uno nella sezione "Aggiungi Oggi", uno nel banner "Non collegato") |
| `onDisconnectProvider()` | click `#disconnectProviderBtn` |
| `onEditStrength(id)` | click `.edit-strength-btn` |
| `onEditCardio(id)` | click `.edit-cardio-btn` |
| `onDeleteStrength(id)` | click `.delete-strength-btn`, **previa conferma** `showConfirm` (import da `modal.js`) |
| `onDeleteCardio(id)` | click `.delete-cardio-btn`, **previa conferma** `showConfirm` |

**A cosa serve/nota architetturale importante:** `physicsView.js` fornisce solo il markup e il binding dei bottoni di apertura; il **contenuto reale dei modali** (form aggiungi/modifica pesi, cardio, passi, selezione provider, import file) proviene da `js/ui/activities.js` (funzioni `showAddStrengthModal`, `showEditStrengthModal`, `showAddCardioModal`, `showEditCardioModal`, `showAddStepsModal`, `showProviderSelectionModal`, `showFileImportModal`), invocate direttamente da `app.js` dentro i callback passati a `bindPhysicsViewEvents` (vedi `js/app.js` righe ~571-627 e ~1700-1792). Quindi la tab "Fisica" combina lo *screen* di `physicsView.js` con il *sistema modale* di `activities.js` — non con `modal.js`.

---

## activities.js

File: `js/ui/activities.js` (1371 righe, il più grande dei moduli vista). Contiene **due cose logicamente distinte**:

1. Una vista completa alternativa (`renderActivitiesView` + `bindActivitiesEvents`) — **codice irraggiungibile dal routing dell'app** (vedi sotto).
2. Sette funzioni "`show*Modal`" che costruiscono e montano modali **con un sistema DOM indipendente da `modal.js`** — queste sono **attivamente usate** dalla tab Fisica (`physicsView.js`, tramite i callback cablati in `app.js`).

### `renderActivitiesView(state)` — CODICE IRRAGGIUNGIBILE

**Cosa fa:** produce un markup molto simile (quasi duplicato) a `renderPhysicsView` di `physicsView.js`: header "💪 Allenamenti & Attività", riepilogo 7 giorni, riepilogo oggi con elenco dettagliato di ogni sessione pesi/cardio del giorno (a differenza di `physicsView.js` che mostra solo conteggi aggregati), sezione "Aggiungi Attività Oggi", stato sync passi, sessioni recenti, storico passi.

**A cosa serve — verificato con grep:** in `js/app.js` la funzione `renderActivitiesViewPage()` (definita alla riga 1597) importa e usa `renderActivitiesView` + `bindActivitiesEvents`, ma **`renderActivitiesViewPage()` non viene mai chiamata da nessun punto del router `renderCurrentView()`**. Il dispatcher di `app.js` (righe ~177-190) instrada tutte e tre le view `'physics'`, `'weight'`, `'activities'` verso `renderPhysicsViewPage()` (che usa `physicsView.js`), non verso `renderActivitiesViewPage()`. `renderActivitiesViewPage` richiama sé stessa ricorsivamente come callback di re-render (dopo salvataggi/eliminazioni), ma essendo la funzione stessa priva di chiamanti esterni, l'intero ramo è morto a runtime nonostante sia internamente coerente e completo. Verosimilmente un vecchio screen "Attività" sostituito da `physicsView.js` senza rimuovere il file legacy.

### `bindActivitiesEvents(container, callbacks)` — CODICE IRRAGGIUNGIBILE

Stessa sorte di `renderActivitiesView`: collega `onAddStrength/onAddCardio/onAddSteps/onSyncSteps/onDisconnectProvider/onEditStrength/onEditCardio/onDeleteStrength/onDeleteCardio` (con conferma `showConfirm` da `modal.js` per le eliminazioni), ma non è mai raggiunta perché `renderActivitiesViewPage` non è mai invocata.

### Le 7 funzioni `show*Modal` — SISTEMA MODALE ATTIVO E ALTERNATIVO

Queste funzioni **non usano `modal.js`**: costruiscono l'HTML del modale come stringa con markup `<div class="modal" style="display:flex;"><div class="modal-content">...<div class="modal-header">...<button class="modal-close">...<div class="modal-body">`, lo assegnano a `document.createElement('div').innerHTML`, appendono l'elemento a `document.body`, e impostano `document.body.style.overflow = 'hidden'` per bloccare lo scroll di sfondo (comportamento che `modal.js` **non replica**: `showModal`/`showConfirm` non toccano `body.style.overflow`).

- **`showAddStrengthModal(onSave)`** — **Cosa fa:** form completo per una sessione pesi: data, titolo, categoria (gym/home_strength/calisthenics/cross_training), durata, RPE, gruppi muscolari (checkbox multipli), note, più una modalità "dettagliata" opzionale (toggle) che permette di aggiungere esercizi singoli (nome, serie, ripetizioni, carico, gruppo muscolare) dinamicamente con `#addExerciseBtn`. Valida i campi obbligatori mostrando errori inline tramite `showFormError` (vedi sotto) invece di bloccare silenziosamente. **A cosa serve:** raccogliere una sessione di allenamento pesi da salvare; il risultato è passato a `onSave(formData)`.
- **`showAddCardioModal(onSave)`** — **Cosa fa:** form per sessione cardio: data, tipo (10 opzioni con emoji), durata, intensità, distanza opzionale, frequenza cardiaca media opzionale, RPE opzionale, note. Validazione con messaggi inline via `showFormError`.
- **`showAddStepsModal(onSave, existingData)`** — **Cosa fa:** form passi (numero, distanza opzionale, minuti attivi opzionali, fonte manuale/importato). Se `existingData` è fornito, precompila i campi e disabilita il campo data (modalità modifica).
- **`showEditStrengthModal(existingSession, onSave)`** / **`showEditCardioModal(existingSession, onSave)`** — varianti di modifica delle rispettive `showAdd*Modal`, precompilate con i dati della sessione esistente.
- **`showProviderSelectionModal(onSelectProvider, { PROVIDERS, getAvailableProviders })`** — **Cosa fa:** elenca i provider di sincronizzazione disponibili (con emoji/nome, forniti dal chiamante) e un pulsante "Importa" per ciascuno; al click chiude il modale e invoca `onSelectProvider(providerId, provider)`.
- **`showFileImportModal(provider, onImport, { parseStepsFile })`** — **Cosa fa:** guida testuale su come esportare i dati dal provider selezionato (`provider.exportGuide`, elenco ordinato), più un flusso di selezione file/preview/import (usa `parseStepsFile` fornito dal chiamante per il parsing).

**A cosa servono:** sono il vero sistema di inserimento/modifica attività dell'app, richiamato da `app.js` dentro i callback di `bindPhysicsViewEvents` (es. `onAddStrength: () => showAddStrengthModal(async (data) => { ... })`).

### `showFormError(form, message)` (interna)

**Cosa fa:** inserisce (o riusa se già presente) un `<div class="form-error-message">` in cima al form con il messaggio di errore, visibile per 5 secondi poi nascosto automaticamente (`setTimeout` + `display:none`, l'elemento resta nel DOM). **A cosa serve:** validazione client-side dei form modale senza bloccare con `alert()`.

### Differenze concrete rispetto a `modal.js` (vedi anche sezione Problemi/note)

| Aspetto | `modal.js` (`showModal`/`showConfirm`) | `activities.js` (`show*Modal`) |
|---|---|---|
| Struttura DOM | Clona `<template id="modalTemplate">`, classe `.modal-overlay` / `.modal-body` | Costruisce stringa HTML con classe `.modal` / `.modal-content` / `.modal-header` / `.modal-body`, nessun `<template>` |
| Chiusura su Escape | Sì (`document.addEventListener('keydown', ...)`, rimosso alla chiusura) | **No** — nessun listener keydown in nessuna delle 7 funzioni |
| Chiusura su click backdrop | Sì (click su `.modal-overlay` stesso) | **No** — solo `.modal-close` e pulsante "Annulla" espliciti |
| Blocco scroll body | No | Sì (`document.body.style.overflow = 'hidden'`, poi ripristinato a `''` alla chiusura) |
| Autofocus primo campo | Sì (automatico se il bind non l'ha già gestito) | No, non gestito esplicitamente |
| API di chiusura programmatica | `closeModal()` esportata | Nessuna funzione equivalente esportata; ogni funzione gestisce la propria rimozione inline |

Entrambi i sistemi **funzionano correttamente** nel loro ambito d'uso attuale — nessun bug bloccante rilevato — ma la loro coesistenza è un'inconsistenza architetturale (vedi sezione finale).

---

## onboarding.js

File: `js/ui/onboarding.js` (152 righe). Flusso di setup iniziale in 4 step (wizard).

### `renderOnboarding(profile, targets)`

**Cosa fa:** produce un unico form con 4 blocchi `.onboarding-step` (di cui solo il primo visibile all'avvio, gli altri hanno classe `hidden`): Step 1 dati base (nome, data nascita, sesso, altezza, peso), Step 2 attività e obiettivo (livello attività, obiettivo dimagrire/mantenere/massa), Step 3 condizioni e preferenze (select multipli per condizioni mediche informative e preferenze dietetiche), Step 4 riepilogo target calcolati (contenitore `#onbSummary` popolato dinamicamente). Naviga con due bottoni fissi `#onbPrev`/`#onbNext`.

**A cosa serve:** raccogliere i dati minimi per calcolare i target nutrizionali iniziali e creare `state.userProfile`. Mostrata quando `!appState.userProfile` (vedi `renderCurrentView` in `app.js`).

### `bindOnboardingEvents(container, startProfile, onComplete, calculateTargets)`

**Cosa fa:** gestisce la navigazione tra i 4 step mostrando/nascondendo i blocchi (`showStep`), precompila i controlli con `startProfile` (valori di default), e quando l'utente raggiunge l'ultimo step calcola live il riepilogo target invocando `calculateTargets(profile)` (funzione passata dal chiamante, non importata — probabilmente da `nutritionEngine.js`, mostrata anche via import diretto `buildNutritionWarning` in testa al file anche se non usato direttamente in questo frammento visibile). Al click finale su "Completa" valida che nome e data di nascita siano presenti (altrimenti `alert()` nativo, non `showConfirm`/toast) e chiama `onComplete(profile)`.

**Nota firma non standard:** a differenza di tutti gli altri moduli vista, `bindOnboardingEvents` non accetta un singolo oggetto `callbacks` ma tre parametri posizionali distinti (`startProfile`, `onComplete`, `calculateTargets`) — inconsistenza minore di API rispetto al resto del codebase.

**Validazione:** unico punto dell'app (tra i file analizzati) che usa `alert()` nativo per un errore di validazione invece di un pattern UI coerente (toast/inline error).

---

## foodSearch.js

File: `js/ui/foodSearch.js` (53 righe). Schermata "Aggiungi alimento" minimale: due entry point (cibo personalizzato / stima senza dati precisi) più l'elenco degli alimenti personali salvati.

### `renderFoodSearch(state, searchResults, userFoods)`

**Cosa fa:** renderizza due bottoni primari (`#customFood`, `#estimatedFood`) e una lista degli `userFoods` esistenti (ognuno con bottone "Seleziona"), con stato vuoto illustrato se non ce ne sono. **Nota:** il parametro `searchResults` è accettato dalla firma ma **non è mai usato** nel corpo della funzione — probabile residuo di una versione precedente con ricerca testuale libera, oggi assente da questa vista (la ricerca vera vive altrove, es. in `recipes.js` tramite `searchFoods`).

### `bindFoodSearchEvents(container, callbacks)`

| Callback | Trigger |
|---|---|
| `onCustomFood()` | click `#customFood` |
| `onEstimatedFood()` | click `#estimatedFood` (opzionale, controllato con `&&`) |
| `onSelectFood(foodId, foodSource)` | click su qualunque `[data-food-id]` (bottoni "Seleziona" della lista) |

**A cosa serve:** punto di ingresso per aggiungere un alimento a un pasto quando non si passa dal flusso rapido di `nutritionView.js`.

---

## userFoods.js

File: `js/ui/userFoods.js` (89 righe). Gestione CRUD degli alimenti personalizzati (elenco + form), raggiungibile dalla vista `foods` (`renderFoodsView` in `app.js`, che concatena questo output con `renderRecipesSection` di `recipes.js`).

### `renderUserFoods(userFoods)`

**Cosa fa:** elenco semplice con bottone "Nuovo alimento" (`#newUserFood`) e, per ciascun alimento, nome/porzione/kcal e bottoni Modifica/Elimina. Stato vuoto illustrato se l'array è vuoto.

### `bindUserFoodsEvents(container, callbacks)`

| Callback | Trigger |
|---|---|
| `onCreate()` | click `#newUserFood` |
| `onEdit(id)` | click `[data-edit-id]` |
| `onDelete(id)` | click `[data-delete-id]` — **nessuna conferma qui** (a differenza di altri moduli che usano `showConfirm`); la conferma, se presente, è gestita dal chiamante in `app.js` |

### `renderUserFoodForm(food = {})`

**Cosa fa:** form completo per creare/modificare un alimento personalizzato: nome, porzione base, e valori nutrizionali per 100g (kcal, proteine, carboidrati, grassi, zuccheri, fibra, grassi saturi, sodio in mg). Titolo dinamico "Modifica"/"Nuovo" in base a `safeFood.id`.

### `bindUserFoodFormEvents(container, callbacks)`

| Callback | Trigger |
|---|---|
| `onSave(formData)` | click `#saveUserFood` — `formData` costruito da `getFormData(container)` (helper interno, non esportato) |
| `onCancel()` | click `#cancelUserFood` |

**A cosa serve:** form riutilizzato sia per la creazione sia per la modifica; il chiamante (`app.js`) decide quale via mostrando `renderUserFoodForm(existingFood)` oppure `renderUserFoodForm(null)`.

---

## recipes.js

File: `js/ui/recipes.js` (204 righe). CRUD ricette. Nonostante viva concettualmente vicino a `foodSearch.js`, la sua **vista contenitore è la vista `foods`**: `renderFoodsView()` in `app.js` concatena `renderUserFoods(...)` + `renderRecipesSection(...)` in un solo `mainContent.innerHTML`. Il punto di ingresso dalla tab Nutrizione è il bottone `#manageRecipesBtn` (`nutritionView.js`) che chiama `onManageRecipes` → `goToView('foods')`.

### `renderRecipesSection(recipes)`

**Cosa fa:** intestazione con bottone "+ Nuova Ricetta" (`#newRecipeBtn`) ed elenco delle ricette salvate, ciascuna con nome, conteggio ingredienti, porzioni base, descrizione opzionale, e tre bottoni ("Aggiungi al giorno", "Modifica", "Elimina"). Stato vuoto illustrato se non ci sono ricette.

### `bindRecipesEvents(container, callbacks)`

| Callback | Trigger |
|---|---|
| `onCreate()` | click `#newRecipeBtn` |
| `onAdd(recipeId)` | click `[data-add-recipe-id]` — aggiunge la ricetta come pasto del giorno |
| `onEdit(recipeId)` | click `[data-edit-recipe-id]` |
| `onDelete(recipeId)` | click `[data-delete-recipe-id]` — **nessuna conferma qui** (gestita eventualmente lato `app.js`) |

### `renderRecipeForm(recipe = null)`

**Cosa fa:** form per creare/modificare una ricetta: nome, descrizione opzionale, porzioni base, ricerca ingredienti (`#ingredientSearchInput` + `#addIngredientBtn`, risultati in `#ingredientSearchResults`), elenco ingredienti già aggiunti (con bottone Rimuovi ciascuno), e riepilogo nutrienti per porzione (`#recipeMacrosSummary`, valori inizialmente a `0`, aggiornati via JS in `bindRecipeFormEvents`).

### `bindRecipeFormEvents(container, callbacks, initialIngredients = [])`

**Cosa fa:** è la funzione più complessa del file — gestisce uno **stato locale in closure** (`ingredients`, array di `{ foodRef, grammi, per100g }`) sincronizzato con il DOM:
- `updateMacros()`: ricalcola kcal/proteine/carbo/grassi totali per porzione usando `calculateMacrosForAmount` (da `nutritionEngine.js`) diviso per il numero di porzioni.
- `renderList()`: ridisegna la lista ingredienti con input numerico per i grammi (editabile in-place, `data-ing-grams`) e bottone rimuovi (`data-remove-ing-idx`); ogni modifica aggiorna anche `updateMacros()`.
- `runSearch()`: cerca alimenti con `searchFoods(q)` (da `nutritionDataProvider.js`, **ricerca asincrona in tempo reale**, minimo 2 caratteri), mostra fino a 8 risultati cliccabili che aggiungono l'ingrediente allo stato locale con grammatura di default 100g.
- Submit (`#saveRecipeBtn`): valida nome non vuoto e almeno un ingrediente (con `alert()` nativo se mancano — stesso pattern di validazione "grezza" visto in `onboarding.js` e `estimatedFoodForm.js`), poi chiama `callbacks.onSave({ nome, descrizione, porzioniBase, ingredients })`.
- `#cancelRecipeBtn` → `callbacks.onCancel`.

**A cosa serve:** è l'unico form dell'app con ricerca alimenti integrata e calcolo macro live lato client, pensato per essere mostrato dentro un modale (`showModal`) da `app.js` (il markup ha `min-width: 320px` tipico di contenuto modale, non di sezione a piena pagina).

---

## weekView.js

File: `js/ui/weekView.js` (121 righe). Vista settimanale a scroll orizzontale.

### `renderWeekView(weekData, weeklyActivityStats)`

**Cosa fa:** riga di card cliccabili (una per giorno, `.week-day-card`) con badge di stato (`Ok`/`Basso`/`Alto`, mappati a classi CSS `status-ok`/`status-low`/`status-high`) e kcal totali del giorno. Segue con `renderWeeklyActivityStats` (interna): 4 box (kcal totali, sessioni, passi totali, media giornaliera) più badge "achievement" generati da `generateWeeklyBadges(stats)` (interna, non esportata) in base a soglie fisse (es. ≥2000 kcal attività → 🔥 "Settimana Fitta", ≥7 sessioni → ⭐, ≥70k passi → 🎯, media ≥10k passi/giorno → 🚶). Ritorna stringa vuota se non ci sono dati attività significativi.

### `bindWeekViewEvents(container, callbacks)`

| Callback | Trigger |
|---|---|
| `onSelectDay(dateIso)` | click su una `[data-day]` (card giorno) |

**A cosa serve:** navigazione rapida a un giorno specifico, presumibilmente per aggiornare `state.currentDate` e tornare alla dashboard/nutrizione su quel giorno.

---

## weightLoss.js

File: `js/ui/weightLoss.js` (584 righe). Scheda "Stima Perdita Peso", raggiunta dalla view `weightloss` (routing dedicato in `app.js`, **distinto** dalla view `weight` che invece porta a `physicsView.js` — vedi tabella di routing nella sezione Problemi). Tre blocchi: Oggi, Andamento, Obiettivo.

### `renderWeightLoss(state)`

**Cosa fa:** se manca `userProfile` o `tdee`, mostra placeholder. Altrimenti calcola intake/dispendio/deficit del giorno corrente e produce:
- **Blocco 1 "Oggi":** box intake/TDEE/esercizio/deficit-surplus netto (colore dinamico successo/danger), elenco sessioni odierne (`renderTodaysSessions`), tre form inline per aggiungere sessione pesi (`#weightsSessionForm`), sessione cardio (`#cardioSessionForm`, con campi extra velocità/inclinazione mostrati solo se tipo `treadmill`), e peso giornaliero (`#weightEntryForm`).
- **Blocco 2 "Andamento":** grafico a barre CSS ultimi 7 giorni di bilancio (`renderLast7DaysChart`), mini grafico SVG polyline del trend peso (`renderWeightTrendChart`, richiede almeno 2 misurazioni), riepilogo progressi con stima variazione mensile e — se disponibile — stima di composizione corporea a 30 giorni (`renderProgressSummary`).
- **Blocco 2b "Se continui così...":** proiezioni automatiche a 30/60/90 giorni (`renderAutoProjection`), con disclaimer esplicito sui limiti del modello (non tiene conto di variazioni ormonali, ritenzione idrica, ecc.).
- **Blocco 3 "Obiettivo Peso":** form peso obiettivo (`#goalWeightForm`) e calcolo ETA (data stimata di raggiungimento) tramite `estimateTimeToGoal` da `weightLossEstimator.js`, con gestione dei tre casi: obiettivo già raggiunto, obiettivo irraggiungibile al ritmo attuale (avviso), oppure data/ritmo stimati.

**Dati richiesti:** `userProfile`, `todayMeals`, `todayExercise` (con `totalExerciseCalories`, `sessions[]`), `tdee`, `todayWeightsSessions`, `todayCardioSessions`, `allWeightsSessions`, `allCardioSessions`, `dailyWeights`, `last7DaysBalances` (con `netDeficitOrSurplus`, `intakeKcal`, `exerciseData`), `tdeeAdaptive`, `state.projections`, `state.bodyCompositionEstimate`.

### `bindWeightLossEvents(container, callbacks)`

| Callback | Trigger |
|---|---|
| `onSaveGoalWeight(value)` | submit `#goalWeightForm`, validato 30-300 kg |
| `onSaveWeightsSession(session)` | submit `#weightsSessionForm` (reset automatico del form dopo submit) |
| `onSaveCardioSession(session)` | submit `#cardioSessionForm` (reset automatico) — mostra/nasconde campi treadmill in base al `change` del select tipo |
| `onSaveDailyWeight(pesoKg)` | submit `#weightEntryForm` (reset automatico) |
| `onDeleteSession(type, id)` | click `.delete-session-btn` |

**Nota:** nessuna conferma richiesta per `onDeleteSession` (né `showConfirm` né `confirm()` nativo) — eliminazione immediata.

---

## settings.js

File: `js/ui/settings.js` (630 righe). Impostazioni app: profilo, preferenze attività, backup/import dati, modalità avanzata, info/debug.

### `renderSettings()`

**Cosa fa:** produce un unico form-container con sezioni: Profilo (info dinamica in `#profileInfo`, bottone Modifica), Impostazioni Attività (modello energetico radio, activity factor slider condizionale, prevenzione doppio conteggio passi/cardio a piedi, inclusione passi nel TDEE, target passi slider, modalità eat-back radio con ratio slider condizionale), Backup & Recupero (export/import JSON), Modalità Avanzata (toggle sperimentale per tracking composizione corporea, con testo esplicativo su limiti e raccomandazione di calibrazione DEXA/BIA), Informazioni (versione app, storage), Debug (dietro `<details>`, bottoni per loggare stats IndexedDB/storage/bootstrap state).

**A cosa serve:** vista `settings`, tab Impostazioni.

### `bindSettingsEvents(container, callbacks)`

**Cosa fa:** effettua molteplici operazioni asincrone al bind (non solo attach di listener):
- `updateProfileInfo(container)`: carica il profilo con `loadUserProfile()` (da `storage.js`) e popola `#profileInfo`.
- `updateStorageInfo(container)`: importa dinamicamente `getStorageInfo` da `../storage/persistence.js` e mostra uso/quota storage in MB.
- Collega `#exportBtn` → `handleExport` (interna, chiama `backup.downloadBackupFile()` da `sync/backupService.js`).
- Collega `#importBtn` → apre il file picker nascosto `#backupFileInput`; il suo evento `change` chiama `handleImport(container, file)`.
- `onEditProfile()` callback opzionale su `#editProfileBtn`.
- `bindActivityPreferences(container)` (interna, asincrona): carica le preferenze attività esistenti con `loadActivityPreferences()` (o default via `getDefaultActivityPrefs()`) e collega ciascun controllo (radio/slider/checkbox) con salvataggio immediato via `saveActivityPreferences(prefs)` ad ogni `change` — **non c'è un bottone "Salva" esplicito per questa sezione: ogni modifica persiste subito**.
- Bottoni debug (`#logDbStatsBtn`, `#logStorageInfoBtn`, `#logBootstrapBtn`): eseguono import dinamici e stampano JSON in `#debugOutput` e in console.
- Toggle modalità avanzata (`#advancedModeToggle`): legge/scrive direttamente `localStorage.getItem/setItem('advancedMode', ...)` — **unico punto nei moduli vista analizzati che usa `localStorage` invece del layer di storage dell'app (`storage.js`/IndexedDB)**.

### `handleExport(container)` / `handleImport(container, file)` (interne)

**Cosa fanno:** `handleExport` disabilita il bottone, invoca il download del backup, mostra messaggio di stato. `handleImport` legge il file con `FileReader.readAsText`, valida che sia JSON parsabile e che superi `backup.validateExportData(data)`, mostra un **dialog di conferma personalizzato** (`showConfirmDialog`, vedi sotto — non `showConfirm` di `modal.js`) prima di sovrascrivere i dati locali con `backup.importAllUserData(data, 'replace')`, e infine propone (tramite `showConfirm` di `modal.js`, questa volta sì) di ricaricare la pagina.

### `showConfirmDialog(title, message)` (interna) — **TERZO SISTEMA DI DIALOG**

**Cosa fa:** costruisce un overlay di conferma **da zero** con `document.createElement`, styling inline diretto (non tramite `<template>` né classi `.modal-overlay`/`.modal`), senza gestione Escape, senza chiusura su click backdrop. Struttura HTML: `div` overlay fullscreen semi-trasparente → `div` contenuto centrato con bottoni `#confirmYes`/`#confirmNo`.

**A cosa serve:** usato **solo** per confermare l'import backup (azione distruttiva ad alto rischio: sovrascrive tutti i dati locali). È un **terzo pattern di dialog di conferma**, distinto sia da `showConfirm` (`modal.js`) sia dai modali `.modal`/`.modal-content` di `activities.js` — la stessa funzione `handleImport` in questo file usa infatti `showConfirmDialog` per la conferma pre-import ma `showConfirm` (importato da `modal.js`) per la proposta di reload post-import, nello stesso flusso.

### `bindActivityPreferences`, `getDefaultActivityPrefs` (interne)

Vedi sopra; `getDefaultActivityPrefs()` ritorna i default hardcoded (`energyModel: 'tdee_plus_extras'`, `activityFactor: 1.375`, `avoidDoubleCountingWalking: true`, `eatBackMode: 'partial'`, `eatBackRatio: 0.3`, `includeStepsInTdee: true`, `stepGoal: 10000`, `includeStrengthInExpenditure: true`, `includeCardioInExpenditure: true`).

---

## statsView.js

File: `js/ui/statsView.js` (145 righe). Vista "Statistiche & Insight".

### `renderStatsView(meals, dailyWeights, nutritionTargets, userProfile)`

**Cosa fa:** calcola internamente (chiamando funzioni importate, non riceve dati già pronti) `getWeeklyStats`, `generateCoachingInsights`, `getWeightTrend` (da `statisticsEngine.js` e `coachingRules.js`), e produce: sezione Insight Personali (card colorate per priorità high/medium/low), tabella settimanale (giorno/kcal/proteine/carbo/grassi/status con icona), riepilogo trend peso a 30 giorni (variazione, ritmo kg/settimana, elenco ultime 14 misurazioni), sparkline a barre CSS delle calorie settimanali con legenda colore.

**A cosa serve:** è l'unica vista tra quelle analizzate che **incapsula la propria business logic** invece di riceverla già calcolata da `app.js` — pattern diverso dal resto dei moduli (es. `renderDashboard` riceve `summary` già pronto).

### `bindStatsViewEvents(container, callbacks)`

**Cosa fa:** corpo vuoto con solo un commento (`// No interactive elements yet - could add date selectors or export buttons`). **A cosa serve:** nessuna — è uno stub, la vista è puramente informativa/read-only, nessun elemento interattivo da collegare.

---

## collapsible.js

File: `js/ui/collapsible.js` (74 righe). Utility riusabile per sezioni comprimibili.

### `initCollapsible(container)`

**Cosa fa:** cerca tutti gli elementi `[data-toggle="collapsible"]` dentro `container` e collega un click che alterna `aria-expanded`/`aria-hidden` e anima l'altezza (`max-height`, calcolata da `scrollHeight` al momento dell'apertura) e l'opacità del pannello associato (`data-target`), più la rotazione dell'icona `.toggle-icon` (▼ → 180°).

### `renderCollapsibleSection(id, title, content, open = false)`

**Cosa fa:** genera il markup di una sezione comprimibile completa (bottone toggle + pannello), con attributi ARIA corretti fin dal render iniziale in base al parametro `open`.

**A cosa serve:** helper generico per ridurre il carico cognitivo nascondendo contenuti secondari — **va verificato l'uso effettivo**: nessuno dei file vista letti finora (`dashboard.js`, `nutritionView.js`, `physicsView.js`, ecc.) lo importa direttamente; è probabile sia usato da `app.js` o da `fridgeView.js` (fuori ambito di questa analisi).

---

## swipeNav.js

File: `js/ui/swipeNav.js` (71 righe). Navigazione a swipe per mobile.

### `initSwipeNavigation(container, navButtons, onViewChange)`

**Cosa fa:** collega `touchstart`/`touchend` su `container`, calcola la differenza tra le coordinate X iniziale e finale del tocco; se supera `SWIPE_THRESHOLD` (50px) verso sinistra naviga al tab successivo, verso destra al precedente, ciclando circolarmente tra i `navButtons` (cerca quello con classe `.active` per determinare l'indice corrente) e chiamando `onViewChange(nextView)` con il valore di `data-view` del bottone target.

**A cosa serve:** confermato via grep — importato e usato in `app.js` (`initSwipeNavigation(mainContent, navButtons, (view) => {...})`, riga ~1525): permette di cambiare tab con uno swipe orizzontale sul contenuto principale, oltre al tap sui bottoni della bottom nav.

### `addSwipeHint(element)`

**Cosa fa:** applica un leggero effetto di opacità (`0.95` durante il touch, `1` al rilascio) come feedback visivo del tocco.

**A cosa serve — verificato via grep: NON risulta chiamata da nessun punto di `js/app.js` né degli altri moduli vista.** Funzione esportata ma **inutilizzata** (non è "irraggiungibile" in senso stretto come `renderActivitiesView`, ma è codice morto: nessun call site).

---

## lazyLoad.js

File: `js/ui/lazyLoad.js` (141 righe). Tre utility di performance per liste lunghe.

### `lazyLoadImages(selector = 'img[loading="lazy"]')`

**Cosa fa:** usa `IntersectionObserver` per caricare `img.dataset.src → img.src` solo quando l'immagine entra nel viewport (con `rootMargin: '50px'` di anticipo); fallback per browser senza `IntersectionObserver` che carica tutte le immagini subito.

**A cosa serve — confermato via grep: è l'unica delle tre funzioni del file effettivamente usata**, chiamata da `app.js` in almeno 3 punti (dopo render di viste con immagini, righe 391/436/569).

### `initLazyLoad(container, items, renderFn, options = {})`

**Cosa fa:** renderizza un batch iniziale di `itemsPerPage` (default 20) elementi tramite `renderFn(item)` (che deve ritornare un nodo DOM, non stringa HTML), poi collega uno scroll listener sul parent di `container` che carica altri batch quando ci si avvicina a `SCROLL_THRESHOLD` (200px) dal fondo.

**A cosa serve — verificato via grep: NON risulta importata/chiamata in `js/app.js`.** Codice morto — nessun punto dell'app usa paginazione a scroll infinito per le liste (es. elenco pasti, alimenti) attraverso questa utility.

### `createVirtualScroller(container, items, renderFn, itemHeight = 60)`

**Cosa fa:** implementazione di virtual scrolling (renderizza solo gli elementi visibili + buffer, con elementi spaziatori per mantenere la scrollbar corretta).

**A cosa serve — verificato via grep: NON risulta importata/chiamata in `js/app.js`.** Codice morto, come `initLazyLoad`.

---

## estimatedFoodForm.js

File: `js/ui/estimatedFoodForm.js` (284 righe). Flusso "Aggiungi alimento senza dati precisi": inserimento nome libero + peso, ricerca nel database ufficiale CREA, con opzione di passare alla composizione piatto per ingrediente.

### `renderEstimatedFoodForm()`

**Cosa fa:** form minimale (nome alimento libero, peso in grammi 1-1000) con bottone "Vedi stima" (`#estimFoodPreview`) e contenitore vuoto `#estimPreviewContainer` (inizialmente `display:none`) che viene popolato dinamicamente dopo la ricerca.

### `bindEstimatedFoodFormEvents(container, callbacks)`

**Cosa fa:** al click su "Vedi stima", valida nome non vuoto e peso 1-1000g (con `alert()` nativo in caso di errore), poi chiama `showEstimatedPreview` (interna).

### `showEstimatedPreview(container, foodName, grams, callbacks)` (interna, asincrona)

**Cosa fa:** cerca l'alimento nel database CREA tramite `searchInDataPacks(foodName, grams)` (da `dataPackLoader.js`). **Punto rilevante:** commento esplicito nel codice indica che una versione precedente restituiva un mock ("Pasta al pomodoro") quando l'alimento non era trovato, comportamento **rimosso deliberatamente** perché ingannava l'utente facendogli credere di avere un dato reale — ora, se non trovato, mostra un messaggio esplicito "❌ alimento non trovato" con invito a riprovare con un nome diverso o a inserire valori da etichetta, senza alcun fallback stimato generico. Se trovato, mostra un'anteprima nutrizionale completa (kcal/proteine/carbo/grassi/fibra/zuccheri) con badge fonte, un disclaimer sulla variabilità delle porzioni reali, e due azioni: "Aggiungi al pasto" (conferma diretta) oppure "🍝 Componi il piatto" (passa a `composedFoodForm.js`, sostituendo il contenuto del container e collegando `bindComposedFoodEvents` con callback che, alla conferma, costruisce un oggetto pasto con `origin: 'composed_from_ingredients'` e richiama `onCancel` che torna a questa stessa anteprima).

**A cosa serve:** flusso di stima quando l'utente non conosce/non trova il prodotto esatto ma sa cosa ha mangiato "a occhio" — bilancia usabilità (nessun blocco totale) e accuratezza (nessun dato inventato).

**Callback attesi:** `callbacks.onConfirm(estimatedFoodOrComposedFood)` — invocato sia dal ramo stima diretta sia (indirettamente, tramite `composedFoodForm.js`) dal ramo composizione piatto.

### `updateNutritionPreview(container, macros)` (interna)

**Cosa fa:** ridisegna la griglia `.nutrition-grid` con nuovi valori macro. **Nota:** definita ma il suo unico possibile chiamante non è visibile nel flusso letto — verosimilmente residuo non più invocato nel percorso corrente (il refresh dell'anteprima avviene invece ricostruendo l'intero `container.innerHTML` in `showEstimatedPreview`).

---

## composedFoodForm.js

File: `js/ui/composedFoodForm.js` (292 righe). Composizione di un piatto sommando più ingredienti singoli, ciascuno cercato nel database.

### `renderComposedFoodForm()`

**Cosa fa:** contenitore vuoto per la lista ingredienti (`#ingredientsList`, popolato via JS, non da questa funzione), bottone "➕ Aggiungi ingrediente" (`#addIngredientBtn`), e blocco anteprima totali (`#composedPreview`, inizialmente nascosto) con 6 valori (kcal, proteine, carbo, grassi, fibre, zuccheri) e bottoni Annulla/Conferma.

### `bindComposedFoodEvents(container, callbacks)`

**Cosa fa:** collega `#addIngredientBtn` a `addIngredientRow` (interna, aggiunge dinamicamente una riga con nome + grammatura + bottoni cerca/elimina), collega submit/cancel: `onComposedFoodConfirm({ type: 'composed', ingredients, totals })` (solo se `totals.totalGrams > 0`) e `onCancel()`. Aggiunge automaticamente la prima riga ingrediente all'avvio (`addIngredientRow(container)` chiamato subito dopo il binding).

### `addIngredientRow(container)` (interna)

**Cosa fa:** crea dinamicamente (via `document.createElement`, non template string + `innerHTML` sull'intero container) una riga con input nome/grammi, area risultato ricerca nascosta, bottoni "🔍 Cerca"/"❌". Il bottone cerca chiama `dataPackLoader.searchInDataPacks(foodName, grams)`; se trovato, salva i macro nel `dataset.macros` dell'input nome (serializzati JSON) e mostra un riepilogo inline; se non trovato, `alert()` nativo. Il bottone elimina rimuove la riga e ricalcola i totali. La modifica dei grammi (`change`) ricalcola i totali.

### `getIngredients(container)` / `calculateTotals(container)` / `updateComposedPreview(container)` (interne)

**Cosa fanno:** `getIngredients` estrae dal DOM solo gli ingredienti con `dataset.found === 'true'` e grammi validi; `calculateTotals` somma i macro pesati; `updateComposedPreview` aggiorna il blocco anteprima e lo mostra/nasconde in base a `totalGrams > 0`.

**A cosa serve:** usato sia come flusso standalone (probabile apertura diretta da `app.js` per "componi pasto da zero") sia come sotto-flusso di `estimatedFoodForm.js` quando l'utente clicca "Componi il piatto" da un'anteprima di stima non soddisfacente. **Nota di duplicazione:** la logica di ricerca ingrediente-per-ingrediente qui è concettualmente molto simile a quella di `recipes.js` (`bindRecipeFormEvents`/`runSearch`), ma le due implementazioni sono indipendenti, con API di ricerca diverse (`dataPackLoader.searchInDataPacks` qui, `nutritionDataProvider.searchFoods` in `recipes.js`) e markup/stato locale duplicati.

---

## photoAnalysis.js / photoNutrition.js — **CODICE MORTO CONFERMATO**

File: `js/ui/photoAnalysis.js` (49 righe) e `js/photoNutrition.js` (49 righe, fuori da `js/ui/` ma strettamente collegato).

### Verifica di raggiungibilità (grep eseguito su tutto `js/` e su `index.html`)

```
grep -rn "photoAnalysis\|photoNutrition" js/ index.html
→ js/ui/photoAnalysis.js:12:      <form id="photoAnalysisForm">
```

**Unico risultato: l'unica occorrenza della stringa `photoAnalysis` in tutto il codebase è l'`id` dell'elemento `<form>` dentro il file stesso.** Nessun file (`app.js` incluso) importa `renderPhotoAnalysis`, `bindPhotoAnalysisEvents`, `analyzePhoto`, o `isPhotoAnalysisConfigured`. Non esiste alcun bottone "📷 Foto" o simile nel resto della UI che apra questo modulo. **Conclusione: entrambi i file sono completamente irraggiungibili — dead code al 100%, non collegati a nessun punto di ingresso dell'app.**

### `renderPhotoAnalysis(items)` (js/ui/photoAnalysis.js)

**Cosa farebbe (se raggiunta):** form con una riga per ogni `item` rilevato dalla foto (nome editabile, grammi editabili, calorie/proteine calcolate in sola lettura, checkbox "Includi" per abilitare/disabilitare la voce), più bottoni Conferma/Annulla.

### `bindPhotoAnalysisEvents(container, callbacks)` (js/ui/photoAnalysis.js)

**Cosa farebbe:** al click su "Conferma", raccoglie tutti gli item con `enabled=true`/valori aggiornati e chiama `callbacks.onConfirm(items)`; Annulla chiama `callbacks.onCancel`.

### `isPhotoAnalysisConfigured()` / `analyzePhoto(imageBlob)` (js/photoNutrition.js)

**Cosa farebbero:** `isPhotoAnalysisConfigured()` verifica se `PHOTO_NUTRITION_API_URL` (costante esportata, attualmente **stringa vuota** hardcoded) è configurato. `analyzePhoto(imageBlob)` invierebbe l'immagine con `FormData` a un endpoint esterno via `fetch` POST e normalizzerebbe la risposta in una struttura `{ items: [...] }`. **Nota positiva sul codice stesso (anche se morto):** un commento nel codice chiarisce che una versione precedente restituiva dati mock quando l'endpoint non era configurato, comportamento rimosso a favore di un errore esplicito (`throw new Error('Analisi foto non configurata...')`) — stessa filosofia "mai inventare dati" già vista in `estimatedFoodForm.js`.

**Implicazione pratica:** l'intera funzionalità "analizza pasto da foto" non è disponibile agli utenti nella build attuale, nonostante il codice sia scritto, plausibile, e pronto a essere collegato (basterebbe importare `renderPhotoAnalysis`/`bindPhotoAnalysisEvents` in `app.js`, aggiungere un punto di ingresso UI, e configurare `PHOTO_NUTRITION_API_URL` con un backend reale).

---

## voiceInput.js

File: `js/ui/voiceInput.js` (49 righe). Pulsante di dettatura vocale riutilizzabile basato su Web Speech API.

### `wireVoiceButton(btn, input)`

**Cosa fa:** collega un pulsante microfono a un campo di input. Se `!btn || !input`, non fa nulla silenziosamente. **Verifica graceful degradation — confermata:** se `isSpeechRecognitionAvailable()` (helper da `utils.js`) ritorna `false`, il pulsante viene nascosto (`btn.style.display = 'none'`) e la funzione ritorna subito, senza collegare alcun listener — nessun errore, nessuna funzionalità rotta, l'utente digita normalmente. Se disponibile, al click avvia (o ferma, se già in ascolto — toggle tramite variabile `rec` in closure) il riconoscimento vocale tramite `startVoiceRecognition` (altro helper da `utils.js`), aggiornando l'icona del bottone (🎤 ↔ 🔴) e l'attributo `data-listening`. Al risultato riconosciuto, imposta `input.value` e dispatcha un evento `input` sintetico (`bubbles: true`) così che eventuali listener di ricerca già collegati sull'input (es. debounce di ricerca alimenti) reagiscano automaticamente senza bisogno di codice ad hoc.

**A cosa serve:** usato in `app.js` (riga ~2088) per collegare il microfono al campo di ricerca rapida alimenti (`#quickVoiceBtn`).

### `voiceButtonHtml(id)`

**Cosa fa:** ritorna il markup del bottone microfono standalone (stile inline, 44×44px, icona 🎤).

**A cosa serve:** usato in `app.js` (riga ~1973) per iniettare il bottone nel markup della ricerca rapida prima di collegarlo con `wireVoiceButton`.

**Conclusione robustezza:** il modulo degrada correttamente in assenza di supporto browser (Safari desktop più datati, alcuni browser mobile non basati su Chromium) — nessun crash, nessuna funzionalità bloccante rimossa, solo il bottone extra che scompare.

---

## Problemi / note

### Due (anzi tre) sistemi di modale/dialog coesistenti

Il codebase ha **tre implementazioni indipendenti** di overlay modale/conferma, non una:

1. **`js/ui/modal.js`** (`showModal`, `showConfirm`) — basato su `<template id="modalTemplate">`, classi `.modal-overlay`/`.modal-body`, chiusura su Escape e click backdrop, autofocus automatico. È il sistema "canonico" usato dalla maggior parte dei moduli (`nutritionView.js`, `physicsView.js` per le conferme di eliminazione, `settings.js` per il reload post-import, verosimilmente `recipes.js`/`userFoods.js`/`weightLoss.js` tramite `app.js`).
2. **`js/ui/activities.js`** (7 funzioni `show*Modal`) — markup costruito a stringa con classi `.modal`/`.modal-content`/`.modal-header`, nessuna gestione Escape/backdrop-click, blocco esplicito dello scroll body. **È il sistema realmente usato dalla tab Fisica** per aggiungere/modificare sessioni pesi, cardio, passi, e per l'import da provider esterni — quindi non è codice secondario, è il flusso principale di inserimento allenamenti.
3. **`js/ui/settings.js`** (`showConfirmDialog`, interna) — terzo pattern ad-hoc con `document.createElement` puro, styling inline diretto, nessuna classe riusabile, usato una sola volta per confermare l'import di un backup (azione distruttiva).

Tutti e tre **funzionano** nel proprio contesto (nessun bug bloccante rilevato), ma la frammentazione comporta: comportamenti UX incoerenti (Escape chiude alcuni modali e non altri; il backdrop è cliccabile solo nel sistema 1), superficie di manutenzione triplicata per qualunque fix di accessibilità o styling futuro, e rischio concreto che un nuovo modale venga scritto copiando il pattern "sbagliato" per il contesto.

### Codice morto confermato (verificato via grep su `js/` e `index.html`)

| File/funzione | Stato | Evidenza |
|---|---|---|
| `js/ui/photoAnalysis.js` (intero file) | **Morto al 100%** | Nessun import in nessun file; unica occorrenza della stringa è l'`id` interno al form |
| `js/photoNutrition.js` (intero file) | **Morto al 100%** | Nessun import in nessun file; `PHOTO_NUTRITION_API_URL` hardcoded a stringa vuota |
| `js/ui/activities.js` → `renderActivitiesView`, `bindActivitiesEvents` | **Morto** | `app.js` definisce `renderActivitiesViewPage()` che le userebbe, ma questa funzione non ha mai un chiamante nel router `renderCurrentView()` (tutte le view `physics`/`weight`/`activities` instradano a `renderPhysicsViewPage`, basata su `physicsView.js`) |
| `js/ui/lazyLoad.js` → `initLazyLoad`, `createVirtualScroller` | **Morto** | Solo `lazyLoadImages` è importata/usata in `app.js`; le altre due funzioni esportate non hanno alcun chiamante |
| `js/ui/swipeNav.js` → `addSwipeHint` | **Morto** | Solo `initSwipeNavigation` è usata in `app.js`; `addSwipeHint` non ha chiamanti |
| `js/ui/estimatedFoodForm.js` → `updateNutritionPreview` | **Probabile residuo** | Definita ma il flusso corrente (`showEstimatedPreview`) ricostruisce l'intero `innerHTML` invece di chiamarla; nessun call site trovato nel file |

Le 7 funzioni `show*Modal` di `activities.js`, pur vivendo nello stesso file del codice morto sopra, **sono vive e centrali** (usate da `physicsView.js`/`app.js`) — non vanno rimosse insieme al resto.

### Stati mancanti (loading/error/empty)

- **Loading assente ovunque:** nessuno dei moduli vista mostra uno stato "caricamento" esplicito durante operazioni asincrone. Esempi concreti: `estimatedFoodForm.js` durante `searchInDataPacks` (l'utente vede il bottone "Vedi stima" restare cliccabile, senza spinner, mentre la ricerca CREA è in corso — mitigato solo da log console, non da UI); `recipes.js` durante `searchFoods` in `runSearch`; `settings.js` durante `handleExport`/`handleImport` (qui c'è un minimo di feedback testuale via `showStatusMessage`, ma non un vero indicatore di progresso); `composedFoodForm.js` ha un caso parziale positivo (`searchBtn.textContent = '⏳ Cercando...'` con disabilitazione del bottone durante la ricerca ingrediente) — pattern non replicato altrove nonostante sia il più corretto tra tutti.
- **Error state spesso ridotto ad `alert()` nativo:** `onboarding.js`, `estimatedFoodForm.js`, `composedFoodForm.js`, `recipes.js` (`bindRecipeFormEvents`) usano `alert()` per errori di validazione invece di un pattern coerente con il resto dell'app (badge inline, `showFormError` di `activities.js`, o un sistema toast). `activities.js` è l'unico che implementa un vero error state inline nei form (`showFormError`), ma non è riusato dagli altri moduli.
- **Empty state generalmente ben coperto:** la maggior parte dei moduli gestisce correttamente l'assenza di dati con markup dedicato (`empty-state`/`empty-state-emoji`/`empty-state-title`/`empty-state-hint` in `foodSearch.js`, `userFoods.js`, `recipes.js`; messaggi `small-muted` semplici altrove) — punto di forza del codebase.

### Gap di accessibilità (a11y)

- I tre sistemi di modale hanno comportamento Escape/focus inconsistente (vedi sopra): solo `modal.js` gestisce focus trap parziale (autofocus al primo campo) e chiusura da tastiera; `activities.js` e `showConfirmDialog` di `settings.js` non offrono alcuna via da tastiera per chiudere se non tabulare fino al bottone.
- Nessun modale (nei tre sistemi) imposta `role="dialog"`, `aria-modal="true"`, o gestisce un vero focus trap (impedire il tab di uscire dal modale) — solo autofocus iniziale nel sistema 1.
- `dashboard.js`: il `<input type="date" id="dashDatePicker">` è reso invisibile e sovrapposto (`opacity: 0; position: absolute; inset: 0`) all'etichetta data cliccabile — pattern funzionale ma poco leggibile per screen reader (l'etichetta visiva `<h1>` e l'input reale sono disaccoppiati; non c'è un `aria-label` sull'`<h1>` che chiarisca che è anche un selettore data, anche se l'`<input>` stesso ha `aria-label="Scegli data"`).
- Molti pulsanti azione (modifica/elimina) nei moduli vista usano solo un'icona (✎/✕/🗑️) come contenuto testuale, senza `aria-label` — es. `physicsView.js`, `weightLoss.js` (`.delete-session-btn`), `recipes.js` (bottoni Rimuovi hanno testo, quindi ok), `nutritionView.js` (`.custom-food-edit-btn`/`.custom-food-delete-btn` — solo glifo, nessun `aria-label`). Contrasto: `dashboard.js` è più diligente (`aria-label="Giorno precedente"` sui bottoni prev/next, `aria-label="Modifica pasto"`/`aria-label="Elimina pasto"` in `nutritionView.js` sui pulsanti pasto).
- `collapsible.js` è invece un buon esempio positivo: gestisce `aria-expanded`/`aria-hidden` correttamente.

### Duplicazione di funzionalità/markup

- **`physicsView.js` vs `activities.js`:** quasi tutte le funzioni di rendering interne (`renderLast7DaysSummary`, `renderTodaySummary`, `renderStepsSyncStatus`, `renderRecentStrengthSessions`, `renderRecentCardioSessions`, `renderStepsHistory`) esistono in entrambi i file con markup quasi identico (differenze minori, es. `activities.js` mostra il dettaglio delle singole sessioni odierne mentre `physicsView.js` mostra solo conteggi aggregati). Il file `activities.js` sembra una versione precedente/più dettagliata mai rimossa dopo l'introduzione di `physicsView.js`.
- **Ricerca ingrediente duplicata:** `recipes.js` (`runSearch`, usa `nutritionDataProvider.searchFoods`) e `composedFoodForm.js` (`addIngredientRow`/ricerca, usa `dataPackLoader.searchInDataPacks`) implementano lo stesso concetto — "cerca un alimento e aggiungilo con una grammatura" — con API dati e markup completamente indipendenti.
- **Weight loss vs Physics vs Dashboard:** logica di calcolo bilancio energetico/trend peso è renderizzata in tre punti diversi (`dashboard.js` → card Bilancio Energetico e Storico Peso, `physicsView.js`/`weekView.js` → summary attività, `weightLoss.js` → blocchi Oggi/Andamento) con formule di colore/soglie leggermente diverse tra loro (es. soglie di deficit/surplus non condivise in un'unica costante).

### Frizioni UX

- **Validazione incoerente:** alcuni form bloccano con `alert()` nativo (rompe il flusso, stile non coerente con l'app), altri con messaggi inline (`showFormError` in `activities.js`, il migliore) — l'utente sperimenta due esperienze diverse a seconda di quale form sta compilando.
- **Salvataggio "silenzioso" delle preferenze in `settings.js`:** ogni slider/radio/checkbox in "Impostazioni Attività" salva immediatamente su `change`, senza bottone "Salva" né conferma visiva persistente (a parte l'eccezione del toggle "Modalità Avanzata" che mostra un messaggio di successo) — per l'utente non è sempre ovvio che la modifica sia già stata persistita.
- **`onDeleteMeal` in `nutritionView.js` non chiede conferma** (per design, con undo via toast lato app), mentre `onDeleteCustomFood` nello stesso file **sì** — incoerenza percepibile nello stesso schermo, anche se motivata (probabilmente l'eliminazione pasto è più frequente/reversibile via toast, l'alimento personalizzato no).
- **`dashboard.js` cerca ID non renderizzati** (`quickAddWeightBtn2`, `viewNutritionLink`, `viewActivitiesLink`, `viewWeightLink`, `viewWeightDetailLink`, `addBodyCompBtn`, `updateWeightBtn`) — non causa bug (i controlli sono opzionali), ma è un segnale di markup legacy non ripulito, che rende più difficile capire a colpo d'occhio quali collegamenti siano ancora "vivi".
- **`weight` vs `weightloss` vs `activities` come view separate ma sovrapposte:** `setActiveNav` tratta `weight`/`activities`/`weightloss` in modo diverso tra loro (`weight` e `activities` normalizzano alla tab nav `physics`; `weightloss` ha invece un proprio routing/rendering indipendente tramite `weightLoss.js`) — la relazione tra le tre view non è immediatamente ovvia leggendo solo `js/ui/*.js`, va ricostruita da `app.js`.
- **Tre database/ricerca alimenti paralleli senza un'unica fonte:** `nutritionDataProvider.searchFoods` (usato in `recipes.js`), `dataPackLoader.searchInDataPacks` (usato in `estimatedFoodForm.js` e `composedFoodForm.js`) — un utente potrebbe trovare un alimento cercandolo da un punto dell'app e non trovarlo (o trovare risultati diversi) cercando lo stesso nome da un altro punto.

---

## 5. Design system e PWA

# 05 — Design System, Theming, PWA

Analisi di: `css/theme.css`, `css/glassmorphism.css`, `css/styles.css`, `css/components.css`, `css/background.css`, `css/mobile-optimized-2026.css`, `index.html`, `js/themeManager.js`, `js/pwaHandler.js`, `sw.js`, `manifest.webmanifest`.

## Ordine di caricamento CSS

`index.html` (righe 16-23) carica i fogli in quest'ordine:

```
theme.css → glassmorphism.css → background.css → styles.css → components.css → mobile-optimized-2026.css
```

**Cosa fa:** `theme.css` definisce i design token (custom property su `:root[data-theme]`); `glassmorphism.css` definisce le classi componente riutilizzabili (`.glass-card`, `.btn-primary`, ecc.) che consumano quei token; `background.css` disegna lo sfondo animato; `styles.css` è il foglio principale con lo stile di ogni schermata dell'app; `components.css` è un design system più recente di widget riusabili (stat-box, list-row, fridge-*); `mobile-optimized-2026.css`, caricato per ultimo, applica override mobile-first (spacing, touch target, focus-visible globale, a11y).

**A cosa serve:** l'ordine è rilevante per la cascata — le regole in `mobile-optimized-2026.css` (es. `:focus-visible` globale, `.page-content`, `.card`) vincono su quelle omonime definite prima in `styles.css`, perché arrivano dopo con la stessa specificità.

---

## 1. Design token — `css/theme.css`

Il file è organizzato in tre livelli: blocco DARK, blocco LIGHT, blocco "Liquid Glass elevato" che sovrascrive parte dei token sopra (righe 186-264).

### 1.1 Colori base e superfici

| Token | Dark | Light | Cosa fa |
|---|---|---|---|
| `--bg-main` | `#07080f` | `#eef0f9` | Colore di sfondo pagina (dietro l'aurora animata) |
| `--bg-secondary` / `--bg-tertiary` | tonalità più chiare di `--bg-main` | idem | Sfondi secondari, non molto usati direttamente nei componenti (vedi § Problemi) |

### 1.2 Materiali vetro ("Liquid Glass")

| Token | Dark (base) | Light (base) | Cosa fa |
|---|---|---|---|
| `--glass-primary` | `rgba(22,25,41,.55)` | `rgba(255,255,255,.58)` | Colore di fondo delle card/superfici principali, sempre **neutro** (mai tinto), traslucido |
| `--glass-secondary` | `rgba(255,255,255,.06)` | `rgba(255,255,255,.42)` | Superfici "leggere" (list item, stat-box, input) |
| `--glass-thick` | `rgba(24,27,45,.72)` | `rgba(255,255,255,.72)` | Superfici "pesanti" (modali, dock) — più opache per garantire leggibilità sopra contenuto denso |
| `--glass-border` / `--glass-border-hover` / `--glass-border-active` | bordi bianchi a bassa opacità crescente | bordi bianchi quasi opachi, `-active` vira verso l'indigo | Bordo sottile da 1px su ogni "lastra" di vetro; lo stato hover/active lo rende più visibile |
| `--glass-highlight` / `--glass-highlight-strong` | `inset 0 1px 0 rgba(255,255,255,.12/.18)` | `inset 0 1px 0 rgba(255,255,255,.85/.95)` | Riflesso speculare: un inset-shadow da 1px in alto che simula la luce che colpisce il bordo superiore della lastra di vetro |

**Cosa fa:** questi quattro token (`--glass-primary`, `--blur-glass`, `--saturate-glass`, `--glass-border`, più `--glass-highlight` per l'ombra) sono gli "ingredienti" documentati nel commento di apertura di `glassmorphism.css`: sfondo traslucido neutro + `backdrop-filter: blur() saturate()` + bordo sottile + riflesso interno + ombra stratificata. Ogni componente `.glass-card`, `.btn-secondary`, `.navbar`, `.topbar`, `.icon-button`, `input/select/textarea` li combina allo stesso modo.

**A cosa serve:** dare l'effetto "vetro smerigliato" in stile Apple (Liquid Glass / macOS-iOS) con un'unica fonte di verità: cambiando questi 5-6 token in `theme.css` l'intera UI cambia materiale, senza toccare i singoli componenti.

### 1.3 Accenti colore

Un solo accento primario (indigo) più colori di sistema per stato:

- `--accent-cyan` (alias legacy, in realtà indigo chiaro: `#6e85ff` dark / `#5a6cf3` light)
- `--accent-purple`, `--accent-magenta` (alias legacy → violetto), `--accent-orange` (iOS orange, uso raro), `--accent-pink`

**Cosa fa:** nonostante i nomi (`cyan`, `magenta`) suggeriscano una palette multicolore, il commento in testa al file chiarisce che il sistema usa **un solo accento** (indigo) e questi sono alias storici mantenuti per compatibilità con codice che li referenzia ancora.

**A cosa serve:** evitare pannelli "colorati" (viola, ciano, ecc.) che romperebbero la coerenza del materiale vetro neutro; i nomi originali restano per non dover fare una migrazione di tutti i punti che li usano.

### 1.4 Testo

`--text-primary`, `--text-secondary`, `--text-muted`, `--text-disabled` — quattro livelli di enfasi, invertiti fra dark (chiaro su scuro) e light (scuro su chiaro).

### 1.5 Ombre

`--shadow-sm/md/lg` sono tutte **stratificate**: due `box-shadow` sommati, una ombra di "contatto" ravvicinata e una ombra "ambiente" larga e sfumata (es. dark `--shadow-md`: `0 2px 6px rgba(0,0,0,.22), 0 16px 40px -14px rgba(0,0,0,.55)`). `--shadow-glow` è dichiarata ma vuota (`0 0 0 transparent`) con commento esplicito "niente neon: il glow non è Apple".

**Cosa fa:** simula la profondità reale di una lastra sollevata dal piano — contatto netto vicino al bordo, alone morbido più lontano.

**A cosa serve:** è il tratto distintivo del linguaggio "Liquid Glass" vs. il glassmorphism generico anni 2020 con singola ombra piatta o glow neon.

### 1.6 Raggi, durate, easing

- `--radius-sm/md/lg/xl`: 10/14/20/26px, identici in dark e light.
- `--duration-fast/normal/slow`: 150/240/380ms.
- `--easing-smooth`: `cubic-bezier(0.32, 0.72, 0, 1)` — la curva "sheet" di iOS (apertura foglio modale).
- `--easing-bounce`: `cubic-bezier(0.34, 1.3, 0.5, 1)` — leggero overshoot per micro-interazioni.

**A cosa serve:** movimento coerente e minimale — nel commento di `glassmorphism.css` è esplicito: "Movimento: solo al press (scale 0.97), mai salti all'hover".

### 1.7 Blocco DEFAULTS pre-hydration (righe 114-132)

`:root` (senza `[data-theme]`) definisce un sottoinsieme dei token dark come fallback, usato nella finestra fra il parsing del CSS e l'attribuzione di `data-theme` da parte dello script inline in `<head>` (che in pratica è sincrono e quindi la finestra è pressoché nulla — vedi § Theming).

### 1.8 Alias di compatibilità all'indietro (righe 134-176)

```css
--bg: var(--bg-main);
--surface: var(--glass-primary);
--surface-strong: var(--glass-secondary);
--text: var(--text-primary);
--muted: var(--text-muted);
--primary: #7c8cff;      /* dark */ | #5a6cf3 (light)
--primary-light / --primary-dark
--accent: #a78bfa (dark) | #7d5cf0 (light)
--danger: iOS system red (#ff453a dark / #ff3b30 light)
--success: iOS system green (#30d158 dark / #34c759 light)
--border: var(--glass-border)
--shadow: var(--shadow-md)
--glass-blur: 40px (dark) | 36px (light)   /* valore numerico, non un blur() */
--color-border / --color-text / --color-text-secondary
```

**Cosa fa:** il commento nel file lo dice esplicitamente — "Centinaia di stili inline usano questi nomi: restano validi". `styles.css`, `components.css` e gli stili inline sparsi nei moduli `js/ui/*` usano quasi esclusivamente questi alias (`var(--primary)`, `var(--surface)`, `var(--border)`, `var(--muted)`) invece dei token "nuovi" (`--glass-primary`, `--text-primary`).

**A cosa serve:** disaccoppiare il refactor del sistema token (rinominato durante l'introduzione del linguaggio "Liquid Glass") dal resto della codebase, senza dover riscrivere ogni riferimento esistente. `--primary` non è un semplice ridirezionamento (`var(--glass-primary)` sarebbe sbagliato, è un colore diverso) ma un valore hex indipendente scelto per restare leggibile come colore di accento pieno (bottoni, link, focus ring) mentre `--glass-primary` è pensato solo come sfondo traslucido.

Da notare: `--glass-blur: 40px` è un **numero**, non una funzione `blur()` — è usato in un punto isolato di `styles.css` (riga 1097: `backdrop-filter: blur(var(--glass-blur))`), diverso dal pattern dominante `var(--blur-glass)` che invece è già un `blur(Npx)` completo. Sono due sistemi di naming che convivono (vedi § Problemi).

### 1.9 `color-scheme`

```css
html[data-theme="dark"] { color-scheme: dark; }
html[data-theme="light"] { color-scheme: light; }
```

**Cosa fa:** dice al browser quale schema di colori nativo usare per gli elementi di UI del sistema operativo/browser non stilizzati da CSS (scrollbar, autofill, selezione testo, controlli form nativi).

**A cosa serve:** evita scrollbar chiare su sfondo scuro (o viceversa) e migliora la coerenza visiva dei widget nativi del browser con il tema scelto dall'utente.

---

## 2. Il blocco "Liquid Glass" elevato (fine di `theme.css`, righe 186-264)

Questo è un secondo blocco di regole che **ridefinisce** (override, stessa specificità ma dichiarato dopo → vince in cascata) un sottoinsieme dei token glass già visti sopra, con l'obiettivo dichiarato nel commento: "materiali vetro premium (dark + light) ... Blur tenuto a un livello sostenibile per la GPU; su mobile è ridotto ulteriormente".

### 2.1 Cosa cambia rispetto al blocco base

| Token | Dark base → elevato | Light base → elevato |
|---|---|---|
| `--glass-primary` | `.55` → `.44` (più traslucido) | `.58` → `.40` (più traslucido) |
| `--glass-border` | `.10` → `.18` | `.65` → `.90` |
| `--glass-highlight` | `.12` → `.30` | `.85` → `1` (rim pieno) |
| `--blur-glass` | `40px` → `44px` | `36px` → `42px` |
| `--saturate-glass` | `180%` → `210%` | `170%` → `200%` |
| `--shadow-md` / `--shadow-lg` | ombre più profonde e più estese (es. `--shadow-lg` dark: raggio ambiente passa da `-18px` 70px a `-22px` 110px) | idem, tinte blu/indaco anziché nero puro |

**Cosa fa:** aumenta contemporaneamente la trasparenza (`--glass-primary` più basso) *e* il bordo/riflesso (`--glass-border`, `--glass-highlight` più alti) e il blur/saturazione. Il risultato è un vetro più "sottile e luminoso" — più si vede attraverso, ma il bordo e il rim diventano più marcati per mantenere la lastra leggibile e distinguibile dallo sfondo.

**A cosa serve:** è l'iterazione più recente del linguaggio visivo (il commento nel service worker, `APP_VERSION = 'v26'`, conferma: "stile Liquid Glass elevato"), pensata per avvicinarsi all'estetica "Liquid Glass" di Apple (iOS 18+/visionOS) rispetto alla versione glassmorphism più opaca e piatta della prima iterazione.

### 2.2 Sheen speculare sulle card

```css
.card {
  background-image: linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 46%);
}
html[data-theme="light"] .card {
  background-image: linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0) 52%);
}
```

**Cosa fa:** aggiunge un secondo layer, un gradiente lineare bianco che sfuma dall'alto verso il centro della card, sovrapposto (non sostitutivo) al `background` traslucido colorato/neutro.

**A cosa serve:** simula la luce che scivola sulla superficie curva superiore della lastra di vetro — la "firma" del materiale premium citata nel commento — senza coprire il colore/trasparenza sottostante, perché `background-image` si compone sopra `background-color`/`background` (rgba) invece di sostituirlo.

### 2.3 Fix del colore traccia `.fridge-bar`

```css
.fridge-bar { background: rgba(120,130,170,0.28); }
html[data-theme="light"] .fridge-bar { background: rgba(90,100,160,0.20); }
```

**Cosa fa:** la traccia (sfondo) delle barre macro nella vista "Il tuo Frigo" viene fissata a un colore rgba indipendente, invece di ereditare `var(--glass-secondary)` come nella definizione base in `components.css` (riga 117: `.fridge-bar { ... background:var(--glass-secondary); ... }`).

**A cosa serve:** con `--glass-secondary` reso più traslucido dal blocco elevato (es. dark `.06` → `.07`, quasi invariato, ma comunque un valore molto basso), la traccia della progress bar rischiava di risultare quasi invisibile sopra sfondi vari. Fissare un tono specifico e più contrastato garantisce che la barra resti leggibile indipendentemente da cosa succede dietro.

### 2.4 Media query performance mobile (righe 233-251)

```css
@media (max-width: 640px) {
  :root[data-theme="dark"], html[data-theme="dark"] {
    --glass-primary: rgba(18, 21, 36, 0.66);   /* più opaco: .44 → .66 */
    --glass-thick: rgba(20, 23, 40, 0.80);
    --blur-glass: blur(22px);                   /* 44px → 22px, dimezzato */
    --blur-glass-hover: blur(24px);
    --saturate-glass: saturate(150%);            /* 210% → 150% */
  }
  :root[data-theme="light"], html[data-theme="light"] {
    --glass-primary: rgba(255, 255, 255, 0.70);  /* .40 → .70 */
    --glass-thick: rgba(255, 255, 255, 0.82);
    --blur-glass: blur(20px);                     /* 42px → 20px */
    --blur-glass-hover: blur(22px);
    --saturate-glass: saturate(150%);              /* 200% → 150% */
  }
}
```

**Cosa fa:** sotto i 640px di viewport, il raggio di blur viene circa dimezzato (44px→22px dark, 42px→20px light) e le superfici diventano molto più opache (dark `.44`→`.66`, light `.40`→`.70`), con saturazione ridotta.

**A cosa serve — perché il backdrop-filter blur è costoso sulla GPU dei telefoni:** `backdrop-filter: blur()` obbliga il compositor a renderizzare un layer separato campionando ripetutamente i pixel sottostanti per ogni frame in cui l'elemento (o ciò che ha dietro) si muove — es. durante lo scroll, che su questa app è continuo (liste di pasti, storico, ecc.). Il costo del blur gaussiano scala con il quadrato del raggio in pixel, e le GPU mobili hanno bandwidth di memoria e fill-rate molto più bassi delle GPU desktop. Un blur da 44px su più elementi sovrapposti (topbar sticky + card + modali) può facilmente causare jank (frame drop) durante lo scroll su un iPhone di fascia media o su Android. Riducendo il raggio a ~20-22px il costo computazionale cala nettamente, e compensando con superfici più opache (meno bisogno che il blur "nasconda" i dettagli sottostanti per restare leggibile) il risultato visivo resta accettabile pur non essendo identico al desktop.

### 2.5 Fallback A11y: `prefers-reduced-transparency` (righe 253-257)

```css
@media (prefers-reduced-transparency: reduce) {
  :root[data-theme="dark"], html[data-theme="dark"] { --glass-primary: rgba(18,21,36,0.94); --glass-thick: rgba(20,23,40,0.97); }
  :root[data-theme="light"], html[data-theme="light"] { --glass-primary: rgba(255,255,255,0.94); --glass-thick: rgba(255,255,255,0.97); }
}
```

**Cosa fa:** quando l'utente ha attivato l'impostazione di sistema operativo "riduci trasparenza", le superfici vetro diventano quasi completamente opache (94-97% invece di 40-70%).

**A cosa serve:** `prefers-reduced-transparency` è una media feature CSS pensata per utenti con ipovisione o sensibilità visiva per cui i contenuti che "traspariscono" attraverso una superficie translucida riducono il contrasto e la leggibilità del testo sopra. Nota: questa regola non tocca `--blur-glass`, quindi il blur resta attivo — solo l'opacità del colore di sfondo aumenta, il che comunque riduce fortemente l'effetto "vede-attraverso".

### 2.6 Fallback `@supports not backdrop-filter` (righe 259-264)

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :root[data-theme="dark"], html[data-theme="dark"] { --glass-primary: rgba(18,21,36,0.96); --glass-thick: rgba(20,23,40,0.98); }
  :root[data-theme="light"], html[data-theme="light"] { --glass-primary: rgba(255,255,255,0.96); --glass-thick: rgba(255,255,255,0.98); }
}
```

**Cosa fa:** su browser che non supportano affatto `backdrop-filter` (né prefisso `-webkit-`, quindi niente vetro sfocato possibile), i token diventano quasi opachi (96-98%).

**A cosa serve:** senza questo fallback, un browser senza `backdrop-filter` mostrerebbe le card con lo stesso colore rgba parzialmente trasparente ma **senza alcun blur**, rendendo il testo sovrapposto a contenuti/sfondo sottostante illeggibile (il colore di sfondo da solo, senza sfocatura, non basta a garantire contrasto). Rendendo il colore quasi opaco si ottiene una superficie "flat" leggibile come degradazione elegante.

---

## 3. Componenti vetro — `css/glassmorphism.css`

**Cosa fa:** definisce le classi builder-block del linguaggio visivo, tutte espresse in termini dei token di `theme.css` (mai colori hardcoded, tranne poche eccezioni di stato come `rgba(5,7,14,.45)` sull'overlay modale).

Componenti principali:

- **`.glass-card` / `.glass-card-light`**: la card base — `background: var(--glass-primary)`, `backdrop-filter: var(--blur-glass) var(--saturate-glass)` (doppio, con prefisso `-webkit-` per Safari), bordo `var(--glass-border)`, `box-shadow: var(--glass-highlight), var(--shadow-md)` (due box-shadow: l'inset per il riflesso + l'ombra esterna stratificata). Transizione solo su `border-color` e `box-shadow`. `:active` scala a `0.995` (quasi impercettibile, coerente col principio "movimento minimo").
- **`.btn-primary`**: gradiente verticale sul colore `--primary` (da +12% bianco a colore pieno, via `color-mix`), ombra inset per il rim luminoso + ombra colorata soft sotto (`color-mix(in srgb, var(--primary) 65%, transparent)`). `:active` scala a `0.97` con leggero scurimento (`brightness(0.96)`).
- **`.btn-ghost` / `.btn-secondary`**: varianti meno enfatizzate, la seconda con vetro vero (backdrop-filter).
- **`.modal-overlay`**: sfondo scuro/chiaro semitrasparente con `blur(20px) saturate(120%)` fisso (non tokenizzato) + animazione `fadeIn`.
- **`.modal-content`**: usa `var(--glass-thick, var(--glass-primary))` — fallback esplicito nel caso `--glass-thick` non fosse definito — con blur ancora più alto (`blur(48px)`, fisso, non tokenizzato) e `--glass-highlight-strong` per un rim più marcato, coerente con l'idea che gli elementi "sopra" tutto (modali) meritano il materiale più pesante/leggibile. Animazione `slideUp` (curva iOS).
- **`.navbar`, `.list-item`, `.badge`, `.badge-secondary`**: pattern minori dello stesso linguaggio.
- **`.glass-card-elevated` / `.glass-card-floating`**: due varianti di solo `box-shadow` (rispettivamente `--shadow-md` e `--shadow-lg` con relativo highlight) da comporre su `.glass-card` per dare più o meno "elevazione" percepita.
- Media query `@media (max-width: 640px)` in fondo: riduce padding di card/modali e bottoni per schermi piccoli (non tocca blur — quello è gestito centralmente in `theme.css`).

**A cosa serve:** è la libreria di classi effettivamente applicate nell'HTML/JS (vedi `js/ui/*`), il "vocabolario" visivo riusabile sopra i token grezzi.

---

## 4. Componenti recenti — `css/components.css`

**Cosa fa:** design system più mirato, introdotto per sostituire stili inline ripetuti nei moduli JS (`.card-head`, `.grid-2/3`, `.stack`, `.stat-box`, `.list-row`, `.bar-track/.bar-fill`, `.note-banner`, `.btn-tinted`) più un blocco dedicato interamente alla vista "Il Tuo Frigo" (`fridgeView.js`): score animato, barre macro, tile suggerimento con stagger via `animation-delay` inline, badge "in scadenza" con pulse animation, lista della spesa.

Pattern d'uso: il colore d'accento per-istanza si passa con una custom property inline `style="--c:#3b82f6"`, letta dai componenti come `var(--c, var(--primary))` — fallback al primary se non specificato.

**A cosa serve:** riduce duplicazione di stile inline nei moduli JS; centralizza le regole di interazione (stagger, pulse, focus-visible) per la feature "Frigo" più recente.

Nota su a11y: righe 138 e 183-189 aggiungono `:focus-visible` esplicito solo per gli elementi del Frigo (`.fridge-sug`, `.small-action` dentro `.fridge-item-actions`/`.fridge-shop-item`, `#fridgeAdd`, `#fridgeNotify`), con un commento che ammette il problema strutturale: "l'app non lo definisce sui button: qui lo aggiungo per la navigazione da tastiera" — vedi § Problemi.

---

## 5. Sfondo animato — `css/background.css`

**Cosa fa:** disegna un "aurora" di 4 blob radiali molto grandi (70-130vw), fortemente sfocati (`blur(90px)` desktop, `blur(60-70px)` mobile) e desaturati, in `mix-blend-mode: screen` (dark) o `normal` (light), che derivano lentamente con animazioni CSS `translate3d`+`scale` da 90 a 150 secondi di durata, ciascuna con un piccolo `animation-delay` negativo per sfalsare le fasi. Il commento in testa spiega la scelta di design: prima c'erano blob "lava lamp" (blur 8px, colori pieni/neon), ora sostituiti da campi di colore enormi e sfumati che "derivano dietro il vetro" lasciando che sia il blur dei pannelli a fare la sfocatura percepita, non il blob stesso.

- `.bg-container`: gradiente radiale di base fisso (blu scurissimo in dark, quasi bianco in light) + vignettatura in basso via `::after`.
- 4 `.blob-N` con `will-change: transform` e `translateZ(0)` per forzare il layer compositing GPU-accelerato, evitando repaint del resto della pagina durante l'animazione.
- `@media (prefers-reduced-motion: reduce)`: disattiva tutte le animazioni dei blob.
- `@media (max-width: 768px)`: blob ingranditi (per coprire meglio viewport strette) ma blur ridotto (90px→60px, 100px→70px light) — altra ottimizzazione GPU mobile.
- `.content-wrapper`: wrapper con `z-index:1` e `position:relative` per stare sopra `.bg-container` (`z-index:0`).

**A cosa serve:** dà profondità/vita dietro le lastre di vetro senza il costo di un vero motion background renderizzato via canvas/WebGL — è puro CSS/GPU compositing.

---

## 6. Ottimizzazioni mobile 2026 — `css/mobile-optimized-2026.css`

Caricato per ultimo, quindi vince sulla cascata precedente a parità di specificità.

**Cosa fa (per sezione):**

- **Design token aggiuntivi**: spacing 8px-based (`--space-xs` a `--space-2xl`), scala tipografica mobile-first (`--font-size-xs` a `--font-size-3xl`), line-height, e due token per touch target (`--touch-target: 48px`, `--touch-target-sm: 44px`) — soglie minime WCAG/Apple HIG per aree cliccabili.
- **`button:not([class])`**: applica touch target minimo (48px) solo ai bottoni "nudi" senza classe — quelli con classe (`.btn-primary`, `.icon-button`, ecc.) già gestiscono le proprie dimensioni altrove.
- **`input, select, textarea`**: font-size forzato a `--font-size-lg` (18px) — su iOS Safari un font-size < 16px sui campi di input causa uno zoom automatico indesiderato al focus; 18px garantisce margine.
- **`:focus-visible` globale**: `outline: 2px solid var(--primary); outline-offset: 2px;` — **unica regola dell'intera codebase che applica un anello di focus visibile a *ogni* elemento** (non solo bottoni), attivo per navigazione da tastiera.
- **`@media (prefers-reduced-motion: reduce)`**: azzera durata di ogni `animation`/`transition` nell'intero documento (`* { animation-duration: 0.01ms !important; ... }`) — copertura più ampia della sola disattivazione dei blob in `background.css`.
- **`@media (prefers-contrast: more)`**: aggiunge un bordo visibile ai bottoni quando l'utente richiede più contrasto.
- **Indicatori di progresso, layout mobile (`.page-content`, `.card`, `.nav-button`, `.list-item`), data viz (`.stat-grid`, `.stat-item`, `.stat-value`)**: ridefiniscono/rifiniscono classi già presenti altrove — es. `.page-content` qui ha `max-width:600px` e padding diverso da quello in `styles.css` (riga 128-131), e vince per ordine di caricamento.
- **Sezione "Collapsible" (2026 UX)**: stile per `[data-toggle="collapsible"]` con icona freccia che ruota 180° quando `aria-expanded="true"` — pattern per ridurre carico cognitivo nascondendo contenuto secondario.

**A cosa serve:** è lo strato di rifinitura "mobile-first 2026" applicato sopra un sistema più vecchio (`styles.css`), che introduce anche l'unico vero baseline di accessibilità da tastiera dell'app.

---

## 7. Theming — script pre-paint + `ThemeManager`

### 7.1 Script inline in `index.html` (righe 28-46)

```js
const savedTheme = localStorage.getItem('theme')
  || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
document.documentElement.setAttribute('data-theme', savedTheme);
```

**Cosa fa:** eseguito in un `<script>` sincrono nel `<head>`, **prima** che qualsiasi CSS venga applicato al DOM visibile e prima che `js/themeManager.js` (caricato più avanti come modulo) venga eseguito. Legge `localStorage.theme`; se assente, verifica `prefers-color-scheme: light` di sistema (default a `dark` se n é salvato né `light` di sistema). Applica subito l'attributo `data-theme` sull'elemento `<html>`.

**A cosa serve:** evitare il FOUC/flash — se il tema venisse applicato solo dopo il parsing di `app.js` (un modulo, quindi differito), l'utente vedrebbe per una frazione di secondo il tema di default (`dark`, hardcoded nell'attributo statico `data-theme="dark"` in `<html>` al punto 2 del file) anche se ha scelto/preferisce `light`. Lo script sincrono chiude questa finestra. Da notare il secondo IIFE subito sotto, che silenzia `console.log/debug/info` in produzione (mantenendo `warn`/`error`) a meno di `localhost`/`127.0.0.1` o `?debug=1` in query string.

**Nota realizzativa:** `<html lang="it" data-theme="dark">` (riga 2) ha già `data-theme="dark"` come valore statico nel markup. Lo script lo sovrascrive immediatamente all'esecuzione, quindi per un utente `light` non c'è comunque flash visibile in pratica (lo script gira prima che il browser dipinga qualunque pixel, essendo bloccante e in `<head>` prima di ogni `<link rel="stylesheet">` con effetto visivo... in realtà i `<link>` sono *sopra* nello script, ma il paint reale avviene solo dopo il parsing completo dell'head + primo elemento renderizzabile del body, quindi l'attributo è già corretto per allora).

### 7.2 `js/themeManager.js` — classe `ThemeManager`

Istanza singleton esportata: `export const themeManager = new ThemeManager()`.

- **`loadTheme()`**: stessa logica dello script inline (localStorage → altrimenti `prefers-color-scheme` di sistema, default `dark`), rieseguita qui per inizializzare lo stato interno della classe (`this.current`).
- **`init()`** (chiamato dal costruttore): applica il tema corrente via `applyTheme()`, poi registra un listener su `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)` — se **non** c'è una preferenza esplicita salvata (`!localStorage.getItem(this.storageKey)`), un cambio del tema di sistema a runtime (es. l'utente passa da chiaro a scuro nelle impostazioni del telefono mentre l'app è aperta) aggiorna automaticamente il tema dell'app.
- **`applyTheme(theme)`**: imposta `data-theme` sull'elemento `<html>`, aggiunge/rimuove le classi `theme-dark`/`theme-light` (ridondanti con l'attributo, presumibilmente per selettori CSS che usano classe anziché attributo altrove — nessun file css analizzato le usa però, vedi § Problemi), dispatcha un evento custom `themechange` con `detail: { theme }`.
- **`setTheme(theme)`**: chiama `applyTheme()` e **persiste** la scelta in `localStorage` — questa è la funzione chiamata quando l'utente fa una scelta esplicita (toggle) o quando il listener di sistema propaga un cambio (ma solo se non c'era già una preferenza salvata, quindi non "esplicita" in quel path... il codice comunque scrive in localStorage anche in quel branch, il che di fatto trasforma il cambio di sistema in una preferenza salvata — vedi § Problemi).
- **`toggleTheme()`**: alterna dark↔light e chiama `setTheme()`.
- **`getTheme()` / `isDark()` / `isLight()`**: getter di stato.

**A cosa serve — pattern "default segue il sistema, la scelta esplicita persiste":** finché l'utente non ha mai toccato il toggle, l'app segue sempre `prefers-color-scheme` (sia al caricamento sia a runtime via il listener `change`). Nel momento in cui l'utente preme il pulsante toggle (`#themeToggle` in `index.html`, riga 91, gestito nello `<script type="module">` di fondo pagina che chiama `themeManager.toggleTheme()`), quella scelta viene scritta in `localStorage` e da quel momento **vince sempre** su qualunque cambiamento del tema di sistema, perché `loadTheme()` controlla `localStorage` per primo e il listener di `init()` si disattiva da solo (`if (!localStorage.getItem(...))`) una volta che la chiave esiste.

Il bottone toggle in `index.html` (righe 113-137) aggiorna anche l'icona (☀️/🌙) e sincronizza i meta tag `theme-color` (colore della status bar su mobile) col tema scelto, perché i meta `theme-color` statici nell'head usano `media="(prefers-color-scheme: ...)"` che segue solo il sistema, non la scelta esplicita in-app.

---

## 8. Service Worker — `sw.js`

### 8.1 Versionamento cache

```js
const APP_VERSION = 'v26';
const CACHE_NAME = `calorie-pwa-${APP_VERSION}`;
```

**Cosa fa:** `APP_VERSION` è, per dichiarazione esplicita nel commento di testa, **l'unica costante da cambiare per pubblicare un aggiornamento** — determina il nome della cache Cache Storage.

**A cosa serve:** è il meccanismo di cache-busting a livello di service worker: cambiando la stringa, `install` apre una cache nuova con nome diverso, e `activate` cancella tutte le cache con nome diverso da quella corrente (vedi sotto) — quindi bump di versione = invalidazione totale della vecchia cache per tutti i client, senza dover rinominare/cache-bust ogni singolo asset.

### 8.2 `CRITICAL_ASSETS` vs `STATIC_ASSETS`

- **`CRITICAL_ASSETS`** (9 file): `index.html`, i CSS/JS minimi per bootstrap (`styles.css`, `theme.css`, `mobile-optimized-2026.css`, `app.js`, `storage.js`, `appBootstrap.js`), il manifest, e **i due dataset alimentari** (`italian_foods_full.json`, `crea_hierarchy.json`).
- **`STATIC_ASSETS`** (~45 file): resto dei CSS, tutti gli altri moduli JS (`js/ui/*`, engine vari), le icone.

**Cosa fa (in `install`):**
```js
cache.addAll(CRITICAL_ASSETS.map(a => new Request(a, { cache: 'reload' })))
  .then(() => Promise.allSettled(STATIC_ASSETS.map(a => cache.add(new Request(a, { cache: 'reload' })))));
```
`CRITICAL_ASSETS` usa `cache.addAll()`, che **fallisce interamente** (rifiuta la promise) se anche un solo asset non si scarica. `STATIC_ASSETS` usa `Promise.allSettled()` su singoli `cache.add()`, quindi i fallimenti individuali sono **tollerati** (loggati implicitamente ma non bloccanti).

**A cosa serve:** garantire che l'app funzioni offline al minimo indispensabile (shell + database alimenti, essenziale perché la ricerca cibo deve funzionare offline dal primo avvio) anche se qualche asset secondario non accessorio fallisse il download durante l'installazione del SW (es. rete instabile) — un 404 o timeout su un modulo UI non critico non deve impedire l'intera installazione del service worker.

Ogni richiesta usa `{ cache: 'reload' }`, che forza il bypass della cache HTTP del browser durante il download iniziale in cache — garantisce che si stia effettivamente cachando l'ultima versione dal network, non una versione HTTP-cached stale.

### 8.3 `install` / `activate`

```js
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(/* cache.open + addAll/allSettled */);
});

self.addEventListener('activate', event => {
  self.clients.claim();
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
});
```

**Cosa fa:** `skipWaiting()` in `install` forza il nuovo service worker a diventare attivo immediatamente, senza aspettare che tutte le tab con la vecchia versione si chiudano. `clients.claim()` in `activate` fa sì che il nuovo SW prenda immediatamente il controllo di tutte le pagine aperte (anche quelle già caricate prima dell'attivazione), invece di aspettare un reload. Il cleanup cancella ogni cache con nome diverso da `CACHE_NAME` corrente (quindi ogni versione precedente).

**A cosa serve:** aggiornamenti aggressivi e immediati — appropriato per una PWA installata standalone dove l'utente non ricarica spesso manualmente. Il rovescio della medaglia: un client può ricevere codice nuovo mentre uno stato JS in-memory vecchio è ancora attivo nella tab (mitigato dal banner "nuova versione" menzionato nel commento di testa, gestito presumibilmente in `appBootstrap.js` tramite l'evento `message`/`controllerchange`, non incluso nello scope di questa analisi).

### 8.4 Strategia fetch

```js
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;   // solo same-origin

  const isHtml = event.request.destination === 'document';
  const isAppAsset = isHtml || url.pathname.startsWith('/css/') || .../js/ .../data/ .../icons/ || manifest;

  if (isAppAsset) {
    event.respondWith(staleWhileRevalidate(event));
  } else {
    event.respondWith(/* network-first con fallback cache */);
  }
});
```

**Cosa fa:** filtra subito richieste non-GET e cross-origin (lasciate al comportamento di rete di default del browser, senza intercettazione). Per tutto ciò che è "app shell" (documento HTML, CSS, JS, dataset JSON, icone, manifest) applica **stale-while-revalidate**. Per tutto il resto (es. eventuali chiamate a API esterne, se presenti altrove nell'app) applica **network-first con fallback su cache**.

**`staleWhileRevalidate(event)`:**
```js
function staleWhileRevalidate(event) {
  return caches.match(event.request, { ignoreSearch: true }).then(cached => {
    const networkUpdate = fetchWithTimeout(new Request(event.request.url, { cache: 'no-cache' }))
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request.url.split('?')[0], clone));
        }
        return response;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(networkUpdate);
      return cached;      // risposta immediata dalla cache
    }
    return networkUpdate.then(response => {
      if (response) return response;
      if (event.request.destination === 'document') {
        return caches.match('/index.html', { ignoreSearch: true });  // fallback SPA
      }
      return Response.error();
    });
  });
}
```

**Cosa fa:**
1. Cerca in cache con `{ ignoreSearch: true }` — ignora i query string nel matching, quindi `app.js?t=12345` e `app.js` sono considerati la stessa entry.
2. Se c'è un hit in cache, la ritorna **immediatamente** al client, e avvia in parallelo (`event.waitUntil`, non blocca la risposta) un fetch di rete con `{ cache: 'no-cache' }` che bypassa la cache HTTP del browser, per garantire di ricevere davvero l'ultima versione dal server se disponibile.
3. Se il fetch di rete ha successo (status 200), aggiorna l'entry in Cache Storage — chiave normalizzata togliendo il query string (`url.split('?')[0]`), coerente con `ignoreSearch: true` usato in lettura.
4. Se non c'era nulla in cache (cache miss), attende il risultato di rete; se anche quello fallisce e la richiesta è per un documento HTML, fa fallback su `/index.html` cachato (comportamento da SPA: qualunque route sconosciuta risolve alla shell); altrimenti propaga un `Response.error()`.

`fetchWithTimeout` (5000ms) avvolge ogni `fetch` in una `Promise.race` con un timeout — su reti 3G/lente un fetch che non risponde in 5s viene trattato come fallito, evitando che l'utente resti in attesa indefinita quando la cache potrebbe già avere una risposta valida pronta.

**A cosa serve:** l'utente ottiene sempre una risposta rapida (dalla cache, se esiste) evitando la latenza di rete percepita, mentre in background la cache si allinea alla versione più recente — al prossimo reload/navigazione l'utente vedrà l'aggiornamento. `ignoreSearch: true` risolve il problema dei cache-busting query param (`?t=...`, comuni per bypassare cache HTTP lato client in altre parti del codice) che altrimenti genererebbero un cache miss ad ogni richiesta con timestamp diverso.

**Branch "tutto il resto" (network-first):**
```js
fetchWithTimeout(event.request)
  .then(response => {
    if (!response || response.status !== 200) {
      return caches.match(event.request, { ignoreSearch: true }).then(c => c || response);
    }
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
    return response;
  })
  .catch(() => caches.match(event.request, { ignoreSearch: true }));
```

**Cosa fa:** prova prima la rete; se la risposta manca o non è 200, prova la cache come fallback (altrimenti restituisce comunque la risposta di rete anche se non-200); se la rete fallisce del tutto (eccezione/timeout), fallback su cache.

**A cosa serve:** per risorse che non sono "app shell" (potenzialmente contenuti dinamici o di terze parti), privilegia sempre il dato più fresco dalla rete, usando la cache solo come rete di sicurezza.

### 8.5 Messaggio `SKIP_WAITING`

```js
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
```

**A cosa serve:** dà al codice applicativo (`appBootstrap.js`, fuori scope diretto ma menzionato nei commenti) un modo per forzare l'attivazione di un SW "in attesa" (es. dopo che l'utente conferma un banner "nuova versione disponibile, ricarica ora"), bypassando l'attesa naturale del lifecycle del service worker.

---

## 9. `js/pwaHandler.js` — install prompt

**Cosa fa:**

- Riceve l'evento `beforeinstallprompt` **catturato in anticipo** da uno script inline in `index.html` (righe 52-60: `window.__beforeInstallPromptEvent`/`__beforeInstallPromptCaught`), oppure lo ascolta direttamente se non ancora catturato — pattern necessario perché `beforeinstallprompt` può scattare prima che i moduli JS (differiti) siano eseguiti.
- Verifica readiness del service worker (`navigator.serviceWorker.ready`), ma **non lo registra** — la registrazione avviene una sola volta in `appBootstrap.js` (commento esplicito in `index.html` riga 49-50 che segnala una vecchia duplicazione ormai rimossa: "prima era duplicata anche qui → doppi listener update").
- Ascolta `appinstalled` per nascondere il bottone e persistere `appInstalled=true` in `localStorage`.
- `isStandalone()`: rileva se l'app gira già come PWA installata via tre segnali (`navigator.standalone` per iOS legacy, `matchMedia('(display-mode: standalone)')` standard, o `document.referrer` che contiene `android-app://`).
- `triggerInstallPrompt()`: se il prompt nativo è disponibile, lo mostra (`installPrompt.prompt()`) e gestisce l'esito (`userChoice`); altrimenti fa **device detection via user-agent** (Android+Chrome/Brave vs iOS Safari vs fallback generico) per mostrare istruzioni manuali passo-passo specifiche per piattaforma, perché iOS Safari non espone mai `beforeinstallprompt` (l'installazione lì è sempre manuale via "Condividi → Aggiungi a Home").
- `showInstallDiagnostics()`: modal di debug con stato completo (protocollo, HTTPS, supporto SW, manifest caricato, prompt catturato) — utile per diagnosticare perché l'installazione non è disponibile su un dato browser/dispositivo.
- `verifyManifest()`: fetch del manifest a runtime e verifica che ogni icona dichiarata risponda con successo — diagnostica proattiva di problemi comuni (icone mancanti bloccano l'installabilità PWA).

**A cosa serve:** la UX di installazione PWA è frammentata per design tra browser (Chrome/Edge/Brave desktop e Android espongono un prompt nativo intercettabile; iOS Safari no) — questo modulo unifica l'esperienza offrendo sempre un bottone (`#installAppBtn` in `index.html`) che o triggera il prompt nativo o mostra istruzioni guidate.

---

## 10. `manifest.webmanifest`

**Cosa fa:** dichiara nome (`Conta Calorie`/`Calorie`), `start_url: "/"`, `scope: "/"`, `display: "standalone"` (nasconde la UI del browser quando installata), `orientation: "portrait"`, colori (`background_color: #f5f7ff`, `theme_color: #6366f1` — quest'ultimo coincide col meta `theme-color` light in `index.html`), e 4 icone (192/512 `any` + 192/512 `maskable`, quest'ultime richieste per l'adattamento alle forme icona di Android — nota: la entry maskable 512 punta allo stesso file PNG della entry `any` 512, `/icons/icon-512.png`, non a un file maskable dedicato).

**A cosa serve:** è il file richiesto dallo standard Web App Manifest perché il browser consideri l'app installabile e sappia come presentarla una volta aggiunta alla home screen (icona, nome, colori splash screen, modalità standalone senza barra indirizzi).

---

## Problemi / note

- **Doppio sistema di naming dei token.** Convivono due generazioni di variabili: quelle "nuove" (`--glass-primary`, `--text-primary`, `--shadow-md`, `--blur-glass`) definite nei blocchi dark/light principali, e gli "alias di compatibilità" (`--primary`, `--surface`, `--text`, `--muted`, `--border`, `--accent`) che sono quelli realmente usati dalla stragrande maggioranza di `styles.css`, `components.css` e degli stili inline nei moduli `js/ui/*`. Il rischio pratico: chi tocca il blocco "Liquid Glass elevato" di `theme.css` (che ridefinisce solo i token *nuovi*) può avere l'impressione di aver aggiornato l'intera palette, mentre `--primary`/`--accent`/`--danger`/`--success` restano fissi come hex indipendenti — non seguono affatto l'evoluzione "elevata" del glass. Sono deliberatamente non collegati (perché rappresentano colori pieni, non materiali vetro), ma la distinzione non è ovvia leggendo solo `css/glassmorphism.css` o `css/components.css`.
- **`--glass-blur` è un'anomalia isolata.** È l'unico token che contiene un numero puro (`40px`/`36px`) invece di una funzione `blur()` completa come tutti gli altri (`--blur-glass: blur(40px)`), ed è usato una sola volta in `styles.css` riga 1097 (`backdrop-filter: blur(var(--glass-blur))`). Un refactor che rinominasse o rimuovesse `--blur-glass` senza controllare anche `--glass-blur` lascerebbe quel punto silenziosamente rotto (nessun errore, semplicemente niente blur se la variabile sparisse, perché la sintassi `blur(var(--x))` con `--x` non definita risulta in `blur()` invalido → property ignorata).
- **Valori di blur "vetro pesante" non tokenizzati.** `.modal-overlay` (`blur(20px) saturate(120%)`) e `.modal-content` (`blur(48px)`) in `glassmorphism.css`, e diversi punti analoghi in `styles.css` (es. `blur(44px)`, `blur(16px) saturate(135%)`, `blur(6px)`, `blur(8px)`), hardcodano il raggio invece di usare `var(--blur-glass)`. Significa che la media query mobile-performance e i due fallback a11y in fondo a `theme.css` (che agiscono solo su `--blur-glass`/`--saturate-glass`) **non riducono il blur di questi elementi specifici** su mobile o per utenti con `prefers-reduced-transparency`/senza supporto `backdrop-filter` — restano al valore fisso originale. Per i modali (elemento con superficie più grande e spesso sopra contenuto scrollabile) questo è probabilmente il punto di maggior costo GPU non coperto dall'ottimizzazione mobile.
- **Focus-visible sui bottoni: presente ma minimale, aggiunto "in emergenza".** L'unica regola che dà un anello di focus a *ogni* bottone dell'app (incluso il toggle tema, il bottone install, tutte le CTA `.btn-primary`/`.btn-secondary`/`.btn-ghost`, i bottoni "nudi" nei moduli UI) è la regola globale `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }` in `mobile-optimized-2026.css`. Non ci sono regole `:focus-visible` dedicate su `.btn-primary`, `.icon-button`, `.glass-card` interattive, ecc. — il commento in `components.css` righe 183-184 lo conferma esplicitamente per il modulo Frigo: "l'app non lo definisce sui button: qui lo aggiungo per la navigazione da tastiera", il che implica che prima di quell'aggiunta *nessun* focus visibile esisteva affatto per quei controlli, e che l'unica rete di sicurezza reale per il resto dell'app è la regola globale di `mobile-optimized-2026.css` (che comunque copre correttamente tutti gli elementi, essendo un selettore universale sullo pseudo-stato, non serve altro). Il rischio residuo è stilistico/di specificità: qualunque componente futuro con `outline: none` esplicito su `:focus` (come fanno già `input:focus`/`select:focus`/`textarea:focus` in più punti di `styles.css`, che però ricompensano con un `box-shadow` visibile) romperebbe silenziosamente il fallback globale per quell'elemento se non aggiungesse un proprio anello sostitutivo.
- **`--bg-secondary` / `--bg-tertiary` sembrano poco usati.** Definiti in entrambi i temi in `theme.css` ma non referenziati da nessuno dei file CSS letti in questa analisi (`grep` mentale sui file: solo `--bg-main`, tramite l'alias `--bg`, appare in `html,body { background-color: var(--bg); }`). Possibile residuo di un refactor precedente o riservato a componenti non ancora analizzati.
- **Classi `theme-dark`/`theme-light` aggiunte da `ThemeManager.applyTheme()`** non risultano usate da nessun selettore CSS nei file analizzati (che usano tutti `[data-theme="dark|light"]`). Se non servono ad altri moduli JS non coperti da questo audit, sono ridondanti.
- **Sincronizzazione dello stato "preferenza esplicita" un po' fragile.** `ThemeManager.init()` registra il listener di sistema con la guardia `if (!localStorage.getItem(this.storageKey))`, valutata solo al momento in cui l'evento `change` scatta (non quando il listener viene registrato). Se l'utente non ha mai scelto esplicitamente e il sistema cambia tema, `setTheme()` viene chiamato e **scrive** in `localStorage` — da quel momento in poi il comportamento "segue il sistema" per quell'utente si interrompe silenziosamente (la sessione diventa equivalente a una scelta esplicita, anche se l'utente non ha mai toccato il toggle). È una conseguenza implicita del riuso di `setTheme()` per entrambi i path (toggle manuale e propagazione di sistema), non necessariamente un bug bloccante, ma diverge dal comportamento "default segue sempre il sistema finché non tocchi il toggle" che il resto della documentazione/commenti lascia intendere.
- **Manifest: icona maskable 512 duplicata.** La entry `icon-512-maskable` punta a `/icons/icon-512.png`, lo stesso file della entry `any` 512×512, non a un asset con safe-zone dedicata per maschere adattive Android. Visivamente può risultare in un logo tagliato ai bordi su launcher Android che applicano una maschera (cerchio, squircle, ecc.), perché un'icona "any" tipicamente non lascia il padding di sicurezza richiesto dalla spec maskable.
- **Performance: molti `backdrop-filter` sovrapposti nello stesso viewport.** Con topbar sticky (`.topbar`/`.navbar`), card multiple (`.glass-card`/`.card`), bottom nav, e potenzialmente un modale aperto sopra tutto, il numero di elementi con `backdrop-filter` attivo contemporaneamente può essere alto; ognuno richiede il proprio layer di compositing. La mitigazione mobile (blur ridotto sotto 640px) copre la maggior parte dei casi tramite i token centralizzati, ma non i punti con blur hardcoded elencati sopra.
