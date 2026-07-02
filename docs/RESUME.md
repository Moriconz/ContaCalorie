# RESUME — leggi questo file prima di tutto il resto

Scopo: ripartire su questo progetto senza dover rileggere codice o `docs/APP_ANALYSIS.md`
(2900 righe, costoso). Questo file basta per l'85% delle richieste. Scava più a fondo
solo se serve (vedi "Dove guardare per approfondire" in fondo).

## Cos'è l'app

**Conta Calorie** — PWA vanilla JS (no framework, no backend) per tracking calorie/macro,
allenamenti, peso, composizione corporea. IndexedDB per la persistenza, installabile come
app (service worker + manifest). Utente singolo, uso quotidiano reale.

- Repo canonico: `github.com/Moriconz/ContaCalorie` (main, no branch protection) — lavora QUI.
- Deploy: Vercel, auto-deploy su push a `main`. Root layout statico (`vercel.json`).
- Copia locale gemella: `~/Desktop/conta calorie` — repo git standalone (nessun remote),
  usata come backup di sicurezza. Dopo ogni fix nel repo canonico, sincronizza i file
  modificati lì e fai un commit locale (pattern già stabilito, vedi git log di entrambe).
  NON confonderla col repo canonico — non ha remote, un push lì non va da nessuna parte.

## Architettura in 30 secondi

- `index.html` — shell, carica CSS in ordine (theme→glassmorphism→background→styles→
  components→mobile-optimized), script anti-flash tema in testa al `<head>`.
- `js/app.js` (~2180 righe) — router (`if/else` su `appState.currentView`), tutte le
  view `render*View()`, tutti i flussi CRUD pasto/ricetta. File centrale, quasi tutto passa
  di qui.
- `js/storage.js` — IndexedDB (`ContaCalorieDB`, `DB_VERSION` attuale **8**), store con
  `keyPath:'id'`. Ogni save DEVE garantire un `id` (vedi bug storico sotto).
- `js/ui/*.js` — coppie `render*(state)→HTML string` + `bind*Events(container, cb)`.
- `js/*Engine.js`, `js/*.js` in root — calcoli puri (TDEE, macro, stime, frigo).
- `js/ui/fridgeView.js` — feature "Il Tuo Frigo" (vedi sotto), tutta la logica pura è qui.
- `sw.js` — **`APP_VERSION` è l'UNICA costante da bumpare per pubblicare un rilascio**.
  Se non la bumpi dopo una modifica, i client restano sulla cache vecchia. Versione
  attuale: **v28**.
- `css/theme.css` — design tokens + un blocco "Liquid Glass elevato" in coda (dark+light,
  con perf mobile via `@media (max-width:640px)` che riduce il blur). Tema default =
  preferenza di sistema (`prefers-color-scheme`), la scelta esplicita dell'utente vince
  e resta salvata in `localStorage['theme']`.

## Stato attuale (dopo l'ultimo giro di lavoro)

### Feature "Il Tuo Frigo" — completa
Inventario con scadenze, gap nutrizionali del giorno, suggerimenti (score = copertura
deficit*0.6 + urgenza scadenza*0.4), ricette cucinabili dal frigo, lista della spesa dai
deficit cronici, notifiche di scadenza PWA. Tutto in `js/ui/fridgeView.js` + wiring in
`app.js`. 50 test in `tests/`.

### Audit multi-agente completo (5 agenti analisi + 3 agenti verifica indipendente)
Trovati e **corretti**: 2 bug critici (NaN nelle statistiche settimanali/mensili per
mismatch nome campo; contatore "usati di recente" bloccato a 1 per splice-before-read) +
13 problemi medi/minori (swipe-nav che duplicava i listener ad ogni click sulla bottom
nav; funzione chiamata ma mai definita; redirect di contesto sbagliato dopo creazione
alimento; zuccheri/fibra azzerati nei pasti-da-ricetta; ecc.). Dettaglio completo in
`docs/APP_ANALYSIS.md` + `docs/verification/*.md`.

**NON risolto, lasciato documentato**: incoerenza tra i 2 sistemi di modale (`modal.js`
condiviso vs quello ad-hoc di `activities.js`) — ora **allineati visivamente** (stessa
grafica, stesso bottom-sheet mobile, stessi token), ma restano JS separati (Escape/
backdrop-click funzionano diversamente). Se serve unificarli anche a livello di
meccanismo JS, non ancora fatto.

### Bug ricerca alimenti — corretto (trovato da screenshot utente)
Il DB CREA usa nomi tipo `"Pollo, petto, crudo"` (con virgole). La normalizzazione delle
parole per l'indice di ricerca NON rimuoveva la punteggiatura → "pollo," restava
indicizzato con la virgola attaccata → query multi-parola tipo "petto di pollo" non
trovavano mai la voce. Colpiva **577 alimenti su 900 (64% del DB)**. Fix in
`js/nutritionDataProvider.js:normalizeWord` (ora tratta la punteggiatura come spazio).
Verificato con simulazione diretta dell'algoritmo + test nel browser.

### UI modale allenamento (pesi) — rifatta
Lo screenshot dell'utente mostrava il modale "Nuovo Allenamento Pesi" con grafica
inconsistente rispetto al resto dell'app e checkbox grezzi per i gruppi muscolari.
Corretto: `.modal`/`.modal-content` in `css/styles.css` ora usa gli stessi token
(`--glass-thick`, `--shadow-lg`, `--radius-xl`), stessa animazione di entrata, stesso
bottom-sheet mobile con grabber del sistema condiviso (`modal.js`). Gruppi muscolari
ora sono chip a pillola cliccabili (`.chip-toggle`, in `css/components.css`) invece
della griglia di checkbox — checkbox nativa nascosta ma accessibile (tab/screen reader
ok), stato attivo sincronizzato via classe JS in `js/ui/activities.js`.

## Bug/pattern da NON reintrodurre

- **Ogni meal entry DEVE avere un `id`** prima di `store.put` (keyPath è `'id'`).
  `storage.js:_migrateMealEntry` fa da rete di sicurezza (`id: entry.id ||
  crypto.randomUUID()`) — se scrivi un nuovo percorso di salvataggio pasto, passa
  sempre da lì o assicurati tu stesso l'id, altrimenti la entry finisce nel fallback
  localStorage, invisibile alle letture da IndexedDB (perdita dati silenziosa, già
  successo una volta).
- **Bump `sw.js:APP_VERSION`** dopo OGNI modifica a file serviti dall'app (JS/CSS/HTML),
  altrimenti il rilascio non arriva ai client per via della cache stale-while-revalidate.
- **`normalizeWord` in nutritionDataProvider.js** ora strippa la punteggiatura — se la
  tocchi di nuovo, ri-testa con `"Pollo, petto, crudo"` vs query `"petto di pollo"`.
- Non fidarti delle notifiche "completed" degli agenti in background senza controllare
  i token consumati/il file scritto su disco — in questa sessione più agenti hanno
  "completato" con 0 token reali per limiti di sessione, mascherati da notifica di
  successo.

## Convenzioni operative di questa sessione (utili da ripetere)

- Test: `npm test` (54 test, `tests/*.test.mjs`, node:test nativo, no framework).
- Verifica in browser: `preview_start` sul repo `Documents/GitHub/ContaCalorie`
  (config `contacalorie-repo` in `.claude/launch.json` del progetto career-ops), poi
  `preview_eval` per bustare cache SW (`unregister()` + `caches.delete`) prima di
  ogni test, altrimenti si testa codice vecchio cachato.
- Commit separati per categoria (bug critici / medi-minori / feature / docs), non un
  monolite — rende il git log leggibile e i revert mirati possibili.
- Dopo ogni fix nel repo canonico: sincronizza gli stessi file in `~/Desktop/conta
  calorie` e fai un commit locale lì (nessun push, non ha remote).
- Push sempre esplicito, mai automatico senza che sia stato chiesto o sia coerente col
  pattern già stabilito nella sessione.

## Dove guardare per approfondire (solo se serve davvero)

- `docs/APP_ANALYSIS.md` — analisi cosa-fa/a-cosa-serve di OGNI funzione dell'app
  (~2900 righe, 5 sezioni: dati/persistenza, engine, app-shell, viste, design/PWA).
- `docs/verification/*.md` — 3 report di verifica indipendente con evidenza file:riga
  per ogni problema trovato/confermato/scartato.
- `templates/states.yml`, `DATA_CONTRACT.md` — non esistono in questo repo (sono di
  un progetto diverso, career-ops — non confondere i due progetti se lavori da sessioni
  con entrambi in contesto).
