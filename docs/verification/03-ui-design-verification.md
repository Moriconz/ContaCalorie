# 03 — Verifica avversariale: UI Views (04) + Design/PWA (05)

> Ogni claim verificabile (riferimenti file:riga, codice morto, wiring di callback, valori token CSS) dei documenti 04 e 05 è stato controllato direttamente contro il codice sorgente in `/Users/riccardomoricone/Documents/GitHub/ContaCalorie`. Metodo: grep mirati su tutto `js/` e `css/`, lettura diretta dei file citati, conteggio righe.

## Claim confermati

Copertura verificata riga per riga, in sintesi (dettagli nelle sezioni sotto dove rilevante):

- **`modal.js`**: `showModal`/`closeModal`/`showConfirm` — comportamento (template clone, Escape handler, click-backdrop, autofocus, `showConfirm` con `textContent` per il messaggio) confermato identico alla descrizione, file `js/ui/modal.js` (106 righe, non 107 come scritto nel doc — differenza trascurabile).
- **`renderActivitiesViewPage()` irraggiungibile dal router**: confermato con precisione chirurgica. `renderCurrentView()` (`js/app.js:162-206`) instrada `'physics'`/`'weight'`/`'activities'` tutte a `renderPhysicsViewPage()` (righe 178, 188, 190). Gli unici 10 call site di `renderActivitiesViewPage` sono tutti **interni al corpo della funzione stessa** (righe 1704, 1717, 1727, 1737, 1750, 1760, 1770, 1782, 1831, 1851), come callback di re-render dopo save/delete — nessun chiamante esterno. Il claim del documento 04 è esatto, non un'approssimazione.
- **Le 7 funzioni `show*Modal` di `activities.js` sono vive**: confermato. `bindPhysicsViewEvents` in `js/app.js:570-627` le richiama tutte (`showAddStrengthModal`, `showEditStrengthModal`, `showAddCardioModal`, `showEditCardioModal`, `showAddStepsModal`, `showProviderSelectionModal`, `showFileImportModal`), esattamente nel range di righe citato dal doc.
- **Differenze tra sistema modale 1 (`modal.js`) e sistema 2 (`activities.js`)**: confermate tutte. `activities.js` imposta `document.body.style.overflow = 'hidden'` (es. riga 440, 639, 756, 876, 1024, 1126, 1210) e non ha alcun listener `keydown`/Escape né click-su-backdrop in nessuna delle 7 funzioni (verificato via grep su tutto il file: zero occorrenze di `keydown`/`Escape`).
- **`settings.js` come terzo sistema di dialog**: confermato. `showConfirmDialog` (righe 580-628) usa `document.createElement` puro, styling inline, nessuna gestione Escape/backdrop. `handleImport` (riga 390) usa **entrambi** i sistemi nello stesso flusso: `showConfirmDialog` per la conferma pre-import (riga 419) e `showConfirm` di `modal.js` per il prompt di reload post-import (riga 442) — claim confermato con citazione di riga esatta.
- **photoAnalysis.js / photoNutrition.js — dead code al 100%**: confermato via grep su tutto `js/` e `index.html`. Unica occorrenza della stringa `photoAnalysis` nel repo è `js/ui/photoAnalysis.js:12` (`id="photoAnalysisForm"`, interno al file stesso).
- **`addSwipeHint`, `initLazyLoad`, `createVirtualScroller`, `updateNutritionPreview`**: tutti confermati come codice morto/residuo — nessun call site esterno trovato.
- **`nutritionView.js` — duplicazione `id="createCustomFoodBtn"`**: confermato, righe 260 e 284 (rami mutuamente esclusivi), binding con `querySelectorAll` a riga 393.
- **`onDeleteMeal` senza conferma vs `onDeleteCustomFood` con `showConfirm`**: confermato, righe 388 e 410-411 di `nutritionView.js`.
- **`dashboard.js` — ID cercati ma mai renderizzati** (`quickAddWeightBtn2`, `viewNutritionLink`, `viewActivitiesLink`, `viewWeightLink`, `viewWeightDetailLink`, `addBodyCompBtn`, `updateWeightBtn`): confermato, zero occorrenze `id="..."` per queste stringhe in tutto `dashboard.js` — solo referenziate nel binding con guardia `&&`.
- **Aria-label incoerenti**: confermato — `meal-edit-btn`/`meal-delete-btn` in `nutritionView.js:229-230` hanno `aria-label`, mentre `custom-food-edit-btn`/`custom-food-delete-btn` (righe 278-279) no; stessa assenza in `physicsView.js:169-170,197-198` e `weightLoss.js:258`.
- **Sezione CSS/PWA (doc 05)**: ordine di caricamento CSS (`index.html:16-23`), tutti i valori dei token dark/dark-elevato/light nel blocco "Liquid Glass" (`theme.css` righe 13-64 base vs 186-264 elevato — inclusi `--glass-primary` .55→.44, `--glass-border` .10→.18, `--glass-highlight` .12→.30, `--blur-glass` 40px→44px, `--saturate-glass` 180%→210%), media query mobile-performance (righe 236-251), fallback `prefers-reduced-transparency` e `@supports not backdrop-filter`, blocco alias di compatibilità (righe 134-176), `--glass-blur` come numero puro usato una sola volta in `styles.css:1097` — **tutti confermati con corrispondenza esatta** al codice sorgente.
- **`ThemeManager`** (`js/themeManager.js`): comportamento di `loadTheme`/`init`/`applyTheme`/`setTheme`/`toggleTheme` confermato riga per riga, inclusa la sottigliezza sulla guardia `if (!localStorage.getItem(this.storageKey))` valutata dentro l'handler dell'evento `change` (riga 29) che rende "silenziosamente permanente" la preferenza di sistema alla prima propagazione.
- **`sw.js`**: `APP_VERSION = 'v26'` con commento "stile Liquid Glass elevato" citato testualmente (riga 16), `CRITICAL_ASSETS` con esattamente 9 file, logica `install`/`activate`/`staleWhileRevalidate`/fetch handler riprodotta con corrispondenza di codice pressoché letterale.
- **`manifest.webmanifest`**: tutti i campi confermati, incluso il duplicato dell'icona maskable 512 che punta allo stesso file `/icons/icon-512.png` dell'icona `any` 512 (righe 19 e 31 del manifest).
- **`mobile-optimized-2026.css`**: `button:not([class))` a 48px (righe 44-49), `input,select,textarea` forzati a `font-size-lg` 18px (righe 51-55), `:focus-visible` globale (righe 58-61), `prefers-reduced-motion` su `*` (righe 67-72), `prefers-contrast: more` (righe 74-78) — tutti confermati.
- **`components.css` — focus-visible solo sul modulo Frigo**: confermato con commento citato testualmente ("l'app non lo definisce sui button: qui lo aggiungo per la navigazione da tastiera", righe 183-184), selettori a righe 138 e 185-187 esatte.
- **`input:focus`/`select:focus`/`textarea:focus` con `outline: none` compensato da `box-shadow`**: confermato, `styles.css:270-276`.
- **`.modal-overlay`/`.modal-content` con blur hardcoded non tokenizzato**: confermato — `.modal-overlay` usa `blur(20px) saturate(120%)` fisso (`glassmorphism.css:124`), `.modal-content` usa `blur(48px)` fisso ma **con saturate tokenizzato** (`var(--saturate-glass)`, riga 149 — dettaglio che il doc non specifica ma non lo contraddice).

## Errori nel documento originale

1. **Doc 05 — `--bg-secondary` NON è inutilizzato come affermato.** Il documento (§ Problemi, penultimo punto) dichiara: *"Definiti in entrambi i temi in theme.css ma non referenziati da nessuno dei file CSS letti in questa analisi"*. Questo è **falso per `--bg-secondary`**: è effettivamente usato in `css/styles.css:1419`, dentro il blocco fallback `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))`:
   ```css
   .card, .glass-card, .glass-card-light, .modal-card, .modal-content,
   .bottom-nav, .topbar, .toast, .list-item {
     background: var(--bg-secondary);
   }
   ```
   Il claim resta corretto solo per `--bg-tertiary`, che è genuinamente privo di ogni uso al di fuori della propria definizione in `theme.css`. Severità: minore (imprecisione fattuale, non cambia la sostanza dell'osservazione ma la formula "nessuno dei due" è sbagliata per uno dei due token).

2. **Doc 05 — conteggio `STATIC_ASSETS` impreciso.** Il documento dichiara "~45 file"; il conteggio reale in `sw.js` (blocco `const STATIC_ASSETS = [...]`) è **53 entry**, circa il 18% in più della stima. Essendo preceduto da tilde è presentato come approssimazione, ma lo scarto è abbastanza ampio da meritare una correzione. Severità: minore.

3. **Doc 04 — numero righe `modal.js`**: il documento dichiara 107 righe, il file reale ne ha 106. Scarto trascurabile, probabile differenza di conteggio EOF, non un errore sostanziale.

Non sono stati trovati altri errori fattuali nei claim verificabili (riferimenti a righe, wiring di callback, valori di token, presenza/assenza di codice) nei due documenti — il resto delle affermazioni controllate risulta accurato, incluse le affermazioni più "sorprendenti" o controintuitive (es. `renderActivitiesViewPage` che ha 10 call site ma è comunque irraggiungibile, perché tutti interni a sé stessa).

## Problemi reali confermati

Ordinati per severità.

### Critico

Nessun problema di severità critica confermato in questa passata (nessun bug bloccante, nessuna perdita di dati, nessuna falla di sicurezza sfruttabile allo stato attuale — coerente con la conclusione di entrambi i documenti originali che i tre sistemi modale "funzionano" ciascuno nel proprio ambito).

### Medio

1. **Tre sistemi di modale/dialog coesistenti, frammentazione UX/manutenzione reale.** Confermato con evidenza diretta: `modal.js` (Escape + backdrop-click + autofocus), `activities.js` (blocco scroll body, nessun Escape/backdrop), `settings.js::showConfirmDialog` (nessuno dei due, styling inline puro). Le 7 funzioni `show*Modal` di `activities.js` non sono codice secondario — sono il flusso di inserimento allenamenti realmente usato (`js/app.js:570-627`). Impatto: un utente che preme Escape per chiudere un modale di allenamento (sistema 2) non ottiene lo stesso comportamento che ha imparato con i modali di eliminazione pasto (sistema 1) — inconsistenza di interazione riproducibile, non solo teorica. File: `js/ui/modal.js`, `js/ui/activities.js` (righe 353-1371), `js/ui/settings.js:580-628`.

### Minore

1. **Conteggio righe impreciso in più punti del doc 04** (`modal.js` 107 vs 106 reali — vedi sopra) — irrilevante materialmente ma segnalato per completezza.

## Problemi nuovi trovati

Problemi individuati autonomamente durante la verifica, non presenti né nel documento 04 né nel 05.

### Medio

1. **`recipes.js::runSearch` — nessuna gestione errori sulla ricerca ingredienti.** `js/ui/recipes.js:167-181`, funzione `async function runSearch()`: `await searchFoods(q)` a riga 170 non è avvolto in try/catch. Se `searchFoods` rigetta (es. IndexedDB non disponibile, dataset non caricato), la promise fallisce silenziosamente — nessun messaggio d'errore, nessun log, il pulsante "Cerca"/tasto Enter smette semplicemente di produrre risultati senza alcun feedback per l'utente. Contrasto diretto con `composedFoodForm.js`, che nello stesso genere di flusso (ricerca ingrediente) gestisce esplicitamente lo stato di attesa e un `alert()` nativo in caso di non-trovato (`js/ui/composedFoodForm.js`, dentro `addIngredientRow`). Severità: medio — rompe silenziosamente un flusso di editing ricette senza alcun segnale diagnostico.

2. **`settings.js::showConfirmDialog` non fa escaping del messaggio.** `js/ui/settings.js:607-614`: `content.innerHTML = "<h3>${title}</h3><p>...${message}...</p>..."` inserisce `message` via `innerHTML` senza alcun escaping, a differenza di `showConfirm` in `modal.js` che usa deliberatamente `.textContent` per lo stesso scopo (commento esplicito nel codice: "textContent per il messaggio: mai HTML da dati dinamici", `modal.js:83`). Il progetto è consapevole del pattern corretto e lo applica altrove (`settings.js` stesso importa e usa `escapeHtml` da `utils.js` a riga 331 per il nome profilo). Allo stato attuale l'unico chiamante costruisce `message` da una data formattata (`new Date(data.exportedAt).toLocaleDateString()`, non input utente diretto), quindi non è sfruttabile oggi — ma è un pattern fragile: se in futuro qualcuno passasse dati utente non sanificati a `showConfirmDialog`, si aprirebbe un'iniezione HTML. Severità: medio (difetto di robustezza/pattern inconsistente, non exploit attivo).

3. **`onboarding.js` — validazione minima non blocca la navigazione tra step intermedi.** `bindOnboardingEvents` valida nome e data di nascita solo al click finale su "Completa" (coerente col doc 04), ma non è stata trovata alcuna validazione per gli step intermedi (es. altezza/peso a 0 o negativi, livello attività non selezionato) prima di avanzare da uno step al successivo — l'utente può premere "Avanti" attraverso tutti e 4 gli step senza inserire nulla se non nome e data di nascita, arrivando al riepilogo finale con target calcolati su dati vuoti/default. Non verificato se `calculateTargets` gestisce gracefully input vuoti (fuori ambito di questa analisi, che copre solo `js/ui/*`) — severità stimata medio in attesa di verifica del motore di calcolo a monte.

### Minore

1. **`recipes.js` — label del pulsante "Aggiungi" fuorviante.** `js/ui/recipes.js:82`: `<button id="addIngredientBtn" class="primary">Aggiungi</button>`, posizionato accanto al campo di ricerca ingrediente (riga 81), ma il suo handler (riga 183) chiama `runSearch()`, non un'azione di aggiunta diretta — l'aggiunta effettiva avviene solo dopo, cliccando uno dei risultati della ricerca (riga 175-180). Un utente che si aspetta che "Aggiungi" aggiunga l'ingrediente scritto nel campo osserva invece l'apertura di una lista risultati. Micro-frizione di copy/UX.

2. **Escaping HTML non uniforme nei moduli vista.** Solo 9 dei 21 file analizzati importano/usano `escapeHtml` (`activities.js`, `dashboard.js`, `foodSearch.js`, `fridgeView.js`, `nutritionView.js`, `photoAnalysis.js`, `settings.js`, `recipes.js`, `userFoods.js`) — gli altri (es. `weightLoss.js`, `physicsView.js`, `statsView.js`, `weekView.js`) non lo importano affatto. Non è stata trovata evidenza di un'iniezione sfruttabile concreta in questa passata (dati numerici o enumerati in gran parte dei campi non-escaped), ma l'incoerenza rende più facile introdurre in futuro un campo testo libero renderizzato senza escaping in un modulo che non ha mai adottato il pattern. Da approfondire con un audit dedicato dei singoli campi testo-libero.

3. **Nessun problema di contrasto colore emerso da controllo statico dei token (nota, non un difetto).** Controllo a campione dei rapporti `--text-muted`/`--text-disabled` su `--glass-primary`/`--bg-main` non ha evidenziato valori palesemente sotto soglia WCAG AA a lettura diretta dei valori hex/rgba (es. dark `--text-muted: #8a93ab` su `--bg-main: #07080f` è un contrasto ampio). Un controllo rigoroso richiederebbe un tool di calcolo contrasto automatizzato (fuori ambito per verifica manuale in questa sessione) — annotato solo per completezza, non conteggiato come problema.

---

## Riepilogo conteggio

- **Errori nel documento originale:** 3 totali — 2 di sostanza (`--bg-secondary` erroneamente detto inutilizzato in doc 05; conteggio `STATIC_ASSETS` "~45" vs 53 reali in doc 05) + 1 trascurabile (conteggio righe `modal.js` in doc 04, 107 vs 106).
- **Problemi reali confermati (già flaggati nei doc originali):** 1 medio (frammentazione a 3 sistemi di modale/dialog), 1 minore (imprecisione conteggio righe), 0 critico.
- **Problemi nuovi trovati (non nei doc originali):** 3 medio (`recipes.js::runSearch` senza try/catch; `showConfirmDialog` senza escaping; validazione onboarding permissiva tra step), 3 minori (copy fuorviante bottone "Aggiungi"; escaping HTML non uniforme tra moduli; nota su contrasto colore non verificabile a fondo), 0 critico.
- **Totale complessivo per severità: critico 0, medio 4, minore 5.**
