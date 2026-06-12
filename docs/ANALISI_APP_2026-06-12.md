# Analisi completa — Conta Calorie (12/06/2026)

> **AGGIORNAMENTO (stesso giorno)** — Interventi applicati:
> ✅ Indici IndexedDB su `data` (DB v7, migrazione automatica e normalizzazione `date`/`data` su disco)
> ✅ Fix edit pasto lossy (`per100g` di riferimento persistito nell'entry)
> ✅ Service worker: registrazione unica (solo appBootstrap), versione unica `APP_VERSION`, stale-while-revalidate, precache DB alimenti CREA (ricerca offline al primo avvio), rimossi i `?t=1002`
> ✅ `.vercelignore` + root ripulita (script → `/scripts`, docs → `/docs`, eliminato `index.html.bak`)
> ✅ Banner persistente se IndexedDB non disponibile (l'app continua su localStorage invece di fallire in silenzio)
> ✅ escapeHtml esteso a dashboard, foodSearch, photoAnalysis, activities (note), estimationEngine
> ✅ Selettore data in dashboard (‹ › + date picker + "Torna a oggi")
>
> Restano aperti (più tempo/test): split di `app.js`, migrazione stili inline, unit test engine, barcode scanner, notifiche.
>
> **SECONDO BATCH (stesso giorno)**:
> ✅ 29 unit test sugli engine (`npm test`, node:test, zero dipendenze) — TDEE, macro, deficit, ETA, attività, body comp
> ✅ Ricerca con stemming IT: "mela" trova "Mele", "funghi" trova "fungo" (varianti singolare/plurale + accenti)
> ✅ Obiettivo peso + data stimata di arrivo (ETA) nella vista Percorso, su ritmo reale ultimi 7 giorni e TDEE adattivo
> ✅ 9 `confirm()` nativi sostituiti da `showConfirm()` coerente col design (modale con Elimina/Annulla)
> ✅ Rimosso il mock foto con dati finti (ora errore esplicito se non configurato) + 59 righe di codice morto
> ✅ `models.js` Origins allineati ai valori reali usati nell'app
> ✅ Log di debug silenziati in produzione (riattivabili con `?debug=1`)
> ✅ `package.json` con `npm start` / `npm test`; `server.js` → `server.cjs`
>
> Restano aperti: split di `app.js`, migrazione stili inline, barcode scanner OpenFoodFacts, notifiche, pasti preferiti.
>
> **TERZO BATCH — UI/UX (stesso giorno)**:
> ✅ **BUG CRITICO trovato e corretto**: l'eliminazione pasto non veniva mai persistita su IndexedDB (il pasto ricompariva al reload) — aggiunto `deleteMealEntry()`
> ✅ Toast 2.0: tipi success/error con bordo colorato, stacking (max 3), aria-live, posizionati sopra la bottom nav
> ✅ **Undo "Annulla"** su tutte le eliminazioni: pasti, alimenti custom, ricette, sessioni pesi/cardio (il pasto si elimina al tap, senza conferma — l'undo la sostituisce)
> ✅ Bottom nav: etichette testuali sotto le emoji (Home/Pasti/Attività/Trend/Altro), griglia corretta (era 6 colonne per 5 bottoni), aria-current
> ✅ Empty state coerenti (emoji+titolo+suggerimento) per ricette, alimenti personali, pasti
> ✅ Modali: chiusura con Escape, autofocus sul primo campo, focus sul bottone conferma
> ✅ Touch target 42px per i bottoni ✎/✕ nelle liste pasti
> ✅ Scroll intelligente: cambio vista → in cima; refresh stessa vista → mantiene la posizione
> ✅ Status bar (meta theme-color) sincronizzata col tema scelto manualmente
> ✅ APP_VERSION → v19
>
> **QUARTO BATCH — Redesign "Liquid Glass" stile Apple (stesso giorno)**:
> ✅ `theme.css` riscritto: UN accento (indigo) al posto di 5 neon, vetro neutro, colori di sistema iOS (success #30d158, danger #ff453a), blur 40px + saturate(180%), riflesso speculare (`--glass-highlight`), ombre stratificate contatto+ambiente, curva "sheet" iOS
> ✅ `background.css`: via i blob lava-lamp (blur 8px, opacità piena) → aurora con campi colore enormi ultra-sfocati (blur 90-100px) che respirano in 90-150s, vignettatura
> ✅ `glassmorphism.css`: materiali rifatti — niente più salti hover, solo press scale(0.97); badge tinted; backdrop modale blur(20px)
> ✅ Modali: lastra spessa blur(48px); su mobile diventano **bottom sheet iOS con grabber**; bottone chiudi a cerchietto frosted
> ✅ **Bottom nav → dock flottante** staccato dai bordi (stile iOS 18), tab attiva = pill tinted, niente bordi per bottone
> ✅ Bottoni: primary a tinta solida con luce interna (via gradiente indigo→magenta + glow), secondary vetro con riflesso, **quick action dashboard → bottoni tinted iOS** (riempimento 17% + testo a tinta piena)
> ✅ Tipografia: stack SF Pro (-apple-system), tracking -0.022em sui titoli, antialiasing
> ✅ Input: focus ring 4px al 22% dell'accento
> ✅ Pulizia: rimosso blocco `.dark` legacy, allineato `mobile-optimized-2026.css` (sovrascriveva il redesign), fallback `@supports` per browser senza backdrop-filter
> ✅ APP_VERSION → v20

Analisi fresca di tutto il codice. Verificato anche lo stato dei punti già tracciati in `CONSIDERAZIONI_E_MIGLIORIE.md`: i bug dashboard (chiavi macro, TDEE a 0, emoji pasti), il backup rotto, `date`/`data` e l'escape XSS principale risultano **già corretti**. Qui sotto solo ciò che resta o è nuovo.

---

## 🔴 DA SISTEMARE (bug e rischi reali)

### 1. Modifica pasto: ricalcolo lossy (ancora presente)
`js/app.js` righe ~1030 e ~1048: i per-100g vengono ricavati dividendo `macroCalcolate / grammi` a ogni modifica. Modifiche ripetute fanno derivare i valori. **Fix**: salvare `per100g` di riferimento nell'entry pasto e usare sempre quello.

### 2. Service worker: 3 problemi
- **Doppia registrazione**: `index.html` (inline) e `appBootstrap.js` registrano entrambi `/sw.js`. Innocuo ma confonde la gestione degli update (due listener `updatefound`). Tenerne una sola (appBootstrap).
- **Cache-first su HTML/JS critici senza versioning dei file**: gli aggiornamenti arrivano solo cambiando `CACHE_NAME` a mano (e i `?t=1002` in index.html sono un secondo meccanismo manuale parallelo). Facile dimenticarsene → utenti con versioni miste. **Fix**: stale-while-revalidate per gli asset critici, o un piccolo script che genera `CACHE_NAME` e query-string da un'unica costante `APP_VERSION`.
- **DB alimenti non pre-cachato**: `data/italian_foods_full.json` (536 KB) non è in `STATIC_ASSETS`. Al primo avvio offline la ricerca alimenti non funziona. Aggiungerlo al precache (è il cuore dell'app).

### 3. XSS: copertura incompleta
`escapeHtml` è applicato in 7 file, ma `dashboard.js`, `weekView.js`, `activities.js` e altri interpolano ancora dati in `innerHTML` (56 usi totali). I nomi pasto in dashboard oggi passano da percorsi già escapati a monte, ma è fragile. **Fix**: audit sistematico — regola: ogni `${...}` che contiene dati utente passa da `escapeHtml`.

### 4. Deploy Vercel pubblica tutto il repo
`vercel.json` con `public: true` e nessun `.vercelignore`: i 18 script `.py`/`.sh`, 21 file `.md`, `index.html.bak`, `crea_database_complete.csv` (500+ KB) e `.claude/settings.local.json` vengono pubblicati online. **Fix**: aggiungere `.vercelignore` (o spostare tutto in `/docs` e `/scripts` ed escluderli).

### 5. Nessuna gestione del fallimento IndexedDB in UI
Se IndexedDB non è disponibile (Safari private mode, storage pieno) molte funzioni fanno `catch → return []`: l'app sembra funzionare ma non salva nulla. **Fix**: se `initStorage()` fallisce, mostrare un banner persistente "I dati non vengono salvati".

---

## 🟠 DA MIGLIORARE (qualità e manutenibilità)

1. **`app.js` ancora monolite (2.320 righe)** — il piano di split per vista era già previsto: completarlo. Le funzioni `renderXView` hanno già i moduli UI corrispondenti, va solo spostato il controller. Sostituire la catena `if/else if` del routing con una mappa `{ view: handler }`.
2. **845 stili inline nei template JS** — colori e spaziature hardcoded ovunque. Migrare gradualmente ai token di `theme.css` (`--primary`, `--surface`...). Beneficio doppio: coerenza dark/light e possibilità di una CSP senza `unsafe-inline`.
3. **165 `console.log` in produzione** — creare `log()` con flag `DEBUG` e ripulire (anche i log emoji nel `<head>` di index.html).
4. **9 `confirm()` nativi** — sostituire con il modale unico già esistente (`ui/modal.js`) + pattern "elimina con Undo" nel toast.
5. **Pulizia root del repo** — spostare i 18 script Python/shell in `/scripts`, i 21 `.md` in `/docs`, eliminare `index.html.bak`. Il root di un progetto deployato dovrebbe contenere solo ciò che serve a runtime.
6. **Zero test automatici** — gli engine (nutritionEngine, activityEnergyEngine, bodyCompositionModel, weightLossEstimator) sono funzioni pure: perfetti per unit test. Bastano Vitest + 20-30 test sui calcoli critici (TDEE, macro, deficit) per proteggersi dalle regressioni che già vi sono capitate (chiavi sbagliate in dashboard).
7. **`models.js` disallineato** — `Origins` non include gli origin reali usati (`estimate`, `recipe_saved`, `composed_from_ingredients`...). Allinearlo e usare i factory ovunque, così i bug di "campo con nome diverso" non si ripetono.

---

## ⚡ DA OTTIMIZZARE (prestazioni)

1. **IndexedDB senza indici (0 `createIndex`)** — `loadMealsByDate` e simili fanno `getAll()` + filtro JS su tutto lo store. Con mesi di dati il dashboard rallenta. **Fix**: bump `DB_VERSION` a 7, `createIndex('data', 'data')` su mealEntries/cardioSessions/strengthSessions/dailySteps/dailyWeights e usare `index.getAll(IDBKeyRange.only(date))`. È l'ottimizzazione con il miglior rapporto costo/beneficio.
2. **Re-render totale a ogni azione** — ogni modifica rifà `innerHTML` dell'intera vista e ricarica tutti i dati, perdendo scroll/focus. Mitigazione pragmatica senza framework: aggiornare solo la card toccata (es. dopo aggiunta pasto, aggiornare solo lista pasti + anelli).
3. **Ricerca alimenti** — il JSON da 536 KB è caricato lazy e indicizzato in memoria: va bene. Due miglioramenti: pre-cache nel SW (punto 🔴2) e stemming leggero IT (singolare/plurale: "mela" → "Mele") sfruttando il levenshtein già presente in `dataPackLoader`.
4. **Cache headers Vercel** — css/js a `max-age=3600` + query string manuale: se si adotta il versioning unico (🔴2), si può salire a `max-age=31536000, immutable`.

---

## 🟢 DA AGGIUNGERE (feature, in ordine di valore/costo)

1. **Selettore data in dashboard** — consultare/modificare giorni passati senza passare dalla vista Settimana. Basso costo, uso quotidiano.
2. **Obiettivo peso + data stimata (ETA)** — `estimateTimeToGoal` esiste già nell'engine, va solo esposto in UI (card in vista Percorso/WeightLoss).
3. **Barcode scanner con OpenFoodFacts** — per i prodotti confezionati (CREA resta la fonte per alimenti base). API gratuita, `BarcodeDetector` nativo su Chrome Android + fallback libreria. È la feature che più riduce l'attrito di inserimento.
4. **Pasti preferiti / "colazione tipo"** — salvare combinazioni ricorrenti oltre ai recenti (`recentFoodsTracker` già esistente è la base).
5. **Promemoria locali** — notifica "registra il pranzo" via Notification API + trigger del SW. Aumenta la retention del tracking.
6. **Foto pasto reale** — `photoNutrition.js` è ancora un mock con endpoint vuoto. O integrare un servizio reale (es. endpoint serverless che chiama un modello vision) o nascondere il bottone finché non c'è: oggi mostra dati finti all'utente.
7. **Backup automatico schedulato** — `backupService` ora funziona: aggiungere export automatico periodico (File System Access API o reminder mensile) per protezione dati su dispositivo singolo.

---

## 📋 Piano d'azione consigliato

| # | Intervento | Sforzo | Impatto |
|---|---|---|---|
| 1 | Indici IndexedDB + fix edit pasto lossy | basso | alto |
| 2 | SW: una sola registrazione, versione unica, precache JSON alimenti | basso | alto |
| 3 | `.vercelignore` + pulizia root (`/scripts`, `/docs`, via `.bak`) | basso | medio |
| 4 | Banner errore storage + audit escapeHtml completo | basso | medio |
| 5 | Selettore data dashboard + ETA obiettivo peso | medio | alto |
| 6 | Unit test sugli engine (Vitest) | medio | alto (a lungo termine) |
| 7 | Split `app.js` per vista + routing a mappa | medio-alto | medio |
| 8 | Barcode scanner OpenFoodFacts | medio | alto |
| 9 | Migrazione stili inline → design system | alto | medio |

> Nota positiva: gli engine di calcolo restano la parte più solida del progetto e i fix principali della scorsa analisi risultano davvero applicati. I problemi residui sono concentrati su infrastruttura (SW, IDB, deploy) e su `app.js`.
