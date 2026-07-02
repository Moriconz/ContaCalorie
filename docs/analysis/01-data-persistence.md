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
