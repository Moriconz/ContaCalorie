# 02 — Verifica adversariale: App Shell (js/app.js, appBootstrap.js, utils.js)

> Verifica indipendente di `docs/analysis/03-app-shell.md` contro il codice sorgente reale in `js/app.js` (2442 righe), `js/appBootstrap.js` (293 righe), `js/utils.js` (121 righe), più cross-check su `js/storage.js` e `js/ui/*.js` dove necessario. Ogni claim controllata a mano con grep/lettura diretta del file, non per fiducia nel documento originale.

## Claim confermati

Confermati riga-per-riga (nessuna discrepanza) i seguenti blocchi del documento originale:

- **`js/appBootstrap.js`** intero: `bootstrapApp()`, sequenza `waitForDOM → initializeDatabase → requestPersistentStorage/registerServiceWorker (background) → listenToServiceWorkerMessages`, gestione errore bloccante solo se `localStorage` non disponibile, `showBootstrapError`/`showStorageWarningBanner`/`notifyNewVersionAvailable`, struttura `bootstrapState`. Tutto verificato contro il file reale, corrispondenza esatta inclusi i testi dei commenti.
- **`js/utils.js`** intero: tutte le funzioni esportate (`escapeHtml`, `emptyStateHtml`, `todayISO`, `formatDateIT`, `formatDateShortIT`, `capitalize`, `buildLastNDates`, `isSpeechRecognitionAvailable`, `startVoiceRecognition`) corrispondono esattamente a firma, comportamento e commenti descritti. Import reale in `app.js` riga 37 conferma che solo `escapeHtml`, `formatDateIT`, `buildLastNDates` sono usate lì.
- **`appState`** (righe 40-48) e riferimenti DOM `mainContent`/`bottomNav`/`themeToggle` (righe 50-52): struttura esatta. `themeToggle` confermato mai più referenziato nel file dopo la dichiarazione (grep pulito).
- **Router `renderCurrentView()`** (righe 162-206): tabella di dispatch `if/else` verificata esatta, inclusi gli alias `weight`→`renderPhysicsViewPage()` e `activities`→`renderPhysicsViewPage()` e il default a `renderDashboardView()`.
- **`goToView`, `setActiveNav`, `populateBottomNav`, `init()`, `attachInstallButton()`**: codice esatto, comportamento e ordine di esecuzione confermati.
- **`showToast`** (righe 65-111): stacking a 3 toast, tipi `info/success/error`, durata minima 5000ms con azione, dismiss animato — tutto confermato.
- **`deleteSessionWithUndo`** (righe 117-134): logica e ordine operazioni confermati; chiamanti confermati esattamente `renderPhysicsViewPage` (righe 588, 610), `renderWeightLossView` (riga 926), `renderActivitiesViewPage` (righe 1727, 1760).
- **`loadState()`, `reportError()`**: codice esatto.
- **Flusso `showFoodDetailModal`**: genera `id: crypto.randomUUID()` lato client, valida `grams >= 1`, chiama `applyMealToFridge` dopo `saveMealEntries` — tutto confermato riga per riga (1027-1104).
- **`getPer100gRef` / `editMealModal`**: logica di derivazione per100g stabile e salvataggio dell'intero array `appState.meals` via `saveMealEntries(appState.meals)` confermati (1112-1245).
- **Flusso `openAddRecipeAsMeal`**: `applyRecipeToFridge(recipe.ingredients, portions)` confermato chiamato **dopo** `saveMealEntries([entry])` (riga 1495, dopo riga 1493) — claim esplicitamente richiesta, confermata vera. `macroCalcolate.zuccheri`/`.fibra` hardcoded a `0` confermato (righe 1485-1486).
- **`openQuickAddWithFoodAndMoment`**: l'oggetto `entry` (righe 2220-2226) **non contiene `id`** — confermato per lettura diretta. Validazione grammi (`!grams || grams < 1`) confermata riga 2215.
- **`_migrateMealEntry` in `js/storage.js:149-184`**: testo del commento e riga `id: entry.id || crypto.randomUUID()` (riga 180) corrispondono esattamente alla citazione nel documento. Confermato che sia il path IndexedDB (`saveMealEntries`, riga 269) sia il fallback localStorage (riga 276) applicano `_migrateMealEntry` prima di persistere.
- **`deleteMealEntry`**: commento `// FIX: ora la cancellazione è persistita davvero` confermato testuale (`app.js:453`).
- **Wiring `renderFoodsView`**: catena confermata esatta — `js/ui/nutritionView.js:103` (bottone `#manageRecipesBtn`), riga 349 (`addEventListener` → `onManageRecipes?.()`), `js/app.js:487` (`onManageRecipes: () => goToView('foods')`) e dispatch del router a `renderFoodsView()`. Tutti i numeri di riga citati dal documento sono esatti.
- **`renderActivitiesViewPage` come dead code**: confermato con grep — tutte le occorrenze di `renderActivitiesViewPage` in `app.js` sono auto-riferimenti interni alla funzione stessa (ri-render dopo le proprie azioni); nessun punto di ingresso dal router, da `goToView`, o da bottom nav.
- **`attachBottomNav` — bug swipe nel listener di click**: confermato esatto (righe 1511-1531): il blocco `initSwipeNavigation` è annidato dentro il listener `click`, con shadowing della costante `mainContent`.
- **Duplicazione blocco default `activityPrefs`**: confermate 4 occorrenze esatte via grep (righe 238, 507, 947, 1628) in `renderDashboardView`, `renderPhysicsViewPage`, `renderWeekViewPage`, `renderActivitiesViewPage`.
- **`onDeleteCustomFood` con firma legacy `showToast`**: confermato esatto, riga 484: `showToast('Errore nell\'eliminazione', 3000)`.
- **`openQuickAddWithFood` come dead code**: confermato con grep sull'intero albero `js/` — unica occorrenza è la propria dichiarazione (`app.js:2357`), nessun chiamante.
- **Export/import Settings**: confermato che `renderSettingsView` passa solo `onEditProfile` a `bindSettingsEvents`; tutta la logica export/import (`#exportBtn`/`#importBtn`, `backup.importAllUserData(data, 'replace')`, `import()` dinamici di `storage/persistence.js` e `appBootstrap.js`) vive in `js/ui/settings.js`, confermato via grep diretto.

## Errori nel documento originale

### 1. `renderWeekViewPage` NON è un caso dubbio — usa lo stesso identico fallback `activityPrefs`
Il documento (sezione "Duplicazione del blocco di default `activityPrefs`") scrive che `renderWeekViewPage` "invece usa `prefs` senza fallback esplicito nello stesso modo — verificare coerenza se si tocca questa parte", lasciando intendere un pattern diverso o incerto. In realtà, verificato a `js/app.js:946-955`:
```js
const activityPrefs = prefs || {
  energyModel: 'tdee_plus_extras',
  avoidDoubleCountingWalking: true,
  eatBackMode: 'partial',
  eatBackRatio: 0.3,
  includeStepsInTdee: true,
  stepGoal: 10000,
  includeStrengthInExpenditure: true,
  includeCardioInExpenditure: true
};
```
È **byte-per-byte identico** ai blocchi in `renderDashboardView` (riga 237), `renderPhysicsViewPage` (riga 506) e `renderActivitiesViewPage` (riga 1627). Non c'è nulla da "verificare" — è la quarta copia esatta, non un caso a parte. Il conteggio "almeno 4 punti" del documento è corretto nel numero, ma la caratterizzazione di `renderWeekViewPage` come diversa/incerta è sbagliata.

### 2. `openQuickAddWithFood` — conteggio righe errato
Il documento (sezione Problemi) afferma: *"`openQuickAddWithFood` (56 righe, dalla riga 2357 alla 2441, fine file)"*. Verificato: 2441 − 2357 + 1 = **85 righe**, non 56. Il claim di raggiungibilità (dead code, unico riferimento è la propria dichiarazione) resta corretto; solo il conteggio righe è sbagliato.

### 3. Precisazione minore: il commento sui 10gg nel fridge insight è taggato `ponytail:`, non menzionato
Non un errore di sostanza, ma il documento cita il commento di `js/app.js:751-753` parafrasandolo senza notare che è esplicitamente marcato `ponytail:` nel codice reale (`// Insight settimanale: ... (ponytail: 10gg basta per trovarne 7; se servono finestre più lunghe, alza la costante).`). Irrilevante ai fini funzionali, citato qui solo per completezza della verifica.

## Problemi reali confermati

### `renderActivitiesViewPage()` non raggiungibile dal router — CONFERMATO (critico/medio)
Verificato: il dispatch di `renderCurrentView()` (righe 173-199) non contiene alcun branch che chiami `renderActivitiesViewPage()`; il branch `currentView === 'activities'` (riga 189) chiama `renderPhysicsViewPage()`. Confermato anche che `onAddActivity` nella dashboard (riga 394) naviga a `goToView('activities')`, che tramite il router finisce comunque su `renderPhysicsViewPage()` — coerente, non un secondo bug, ma conferma che `'activities'` come stringa di vista esiste nel codice solo come alias verso Physics, mai come ingresso alla vista dedicata. Circa 265 righe di codice quasi duplicato (1597-1862) sono irraggiungibili dalla UI. Severità: **medio** (non rompe nulla per l'utente, ma è debito tecnico consistente e fonte di rischio se qualcuno modifica una copia dimenticando l'altra).

### `attachBottomNav()` re-inizializza lo swipe a ogni click — CONFERMATO (medio)
Verificato esatto a `js/app.js:1511-1531`. Il blocco che chiama `initSwipeNavigation(mainContent, navButtons, ...)` è annidato dentro `bottomNav.addEventListener('click', event => {...})`, quindi viene rieseguito a ogni tap di un bottone della bottom nav, non una sola volta all'avvio. La costante locale `mainContent` (riga 1521) ombreggia effettivamente quella di modulo (riga 50 dello stesso file) — stesso nodo DOM, innocuo dal punto di vista funzionale ma fonte di confusione per chi legge/manutiene. Non ho ispezionato l'implementazione interna di `initSwipeNavigation` (fuori scope dichiarato per questo file), quindi non posso confermare se accumula listener duplicati internamente o se fa già una pulizia difensiva; resta comunque un pattern di inizializzazione scorretto indipendentemente da questo. Severità: **medio**.

### Entry senza `id` nel ramo quick-add (`openQuickAddWithFoodAndMoment`) — CONFERMATO (minore, mitigato da safety net)
Confermato che l'oggetto `entry` costruito a `js/app.js:2220-2226` non imposta `id`, e che questo viene generato solo a valle da `_migrateMealEntry` dentro `saveMealEntries` (che non riassegna l'id generato all'oggetto in `appState.meals`, già pushato prima). Severità: **minore** — nessun impatto di persistenza (il dato salvato ha sempre id), ma l'oggetto in `appState.meals` resta senza `id` fino al prossimo reload da storage; qualunque `appState.meals.find(m => m.id === x)` su un'entry appena aggiunta per questa via, prima del reload, fallirebbe silenziosamente.

### `macroCalcolate.zuccheri`/`.fibra` azzerati per le entry da ricetta — CONFERMATO (minore)
Confermato a `js/app.js:1485-1486` (`zuccheri: 0, fibra: 0` hardcoded, non sommati dagli ingredienti come invece kcal/proteine/carboidrati/grassi). Severità: **minore**, ma con effetto a cascata reale sulle analisi micronutrienti/fibra che sottostimeranno sistematicamente i pasti aggiunti come ricette.

### `console.log` di debug in produzione (dashboard, composizione corporea) — CONFERMATO (minore)
Confermati tutti i 9 `console.log`/`console.error` citati dal documento nel blocco composizione corporea di `renderDashboardView` (righe 318, 320, 323, 332, 344, 349, 353, 360, 362, più `console.error` con stack trace nel catch a riga 365-366). Severità: **minore**, rumore console, nessun impatto funzionale.

### `onDeleteCustomFood` con firma legacy `showToast` — CONFERMATO (minore), ma NON isolato
Confermato a `js/app.js:484`. Il documento lo presenta come un caso isolato; la verifica indipendente (vedi sezione successiva) mostra che è in realtà un pattern ripetuto in almeno altri 4 punti del file, non menzionati dal documento originale.

## Problemi nuovi trovati

### 1. `showToast` con firma legacy (niente `type:'error'`) è un pattern ripetuto, non un caso isolato — severità minore, ma sistemico
Il documento segnala solo `onDeleteCustomFood` (riga 484). Verifica indipendente con grep mirato su `showToast\(.*, \d+\)` trova almeno altre 4 occorrenze della stessa classe di bug (durata numerica posizionale invece di `{ duration, type: 'error' }`), tutte per messaggi di errore che quindi perdono icona/stile di errore:
- `js/app.js:666` — dentro `onSyncSteps` di `renderPhysicsViewPage`: `showToast('❌ Errore durante l\'importazione. Riprova.', 4000)`.
- `js/app.js:1720` — dentro `onEditStrength` di `renderActivitiesViewPage`: `showToast('❌ Errore nell\'aggiornamento. Riprova.', 4000)`.
- `js/app.js:1753` — dentro `onEditCardio` di `renderActivitiesViewPage`: stesso pattern.
- `js/app.js:1785` — dentro `onEditSteps` di `renderActivitiesViewPage`: stesso pattern.
- `js/app.js:1835` — dentro `onSyncSteps` di `renderActivitiesViewPage`: stesso pattern (`showToast('❌ Errore durante l\'importazione. Riprova.', 4000)`).

Da notare l'ironia: la chiamata "gemella" corretta esiste appena sopra ciascuna di queste (es. riga 651/1820 usa correttamente `{ duration: 4000, type: 'error' }` per "Nessun record importato"), a conferma che il pattern corretto era noto a chi ha scritto il codice ma non applicato in modo coerente in tutti i catch. Severità: **minore** (nessun impatto funzionale, solo styling/icona mancante), ma essendo ripetuto 5 volte vale la pena di una singola passata di pulizia invece di un fix puntuale.

### 2. `deleteDailyWeights` chiamata ma mai definita/importata — funzione rotta, oggi mascherata da wiring UI mancante
`js/app.js:697`, dentro `onDeleteWeight` (righe 695-703) passato a `bindPhysicsViewEvents` in `renderPhysicsViewPage`:
```js
onDeleteWeight: async (date) => {
  try {
    await deleteDailyWeights(date);
    ...
```
Verificato: `deleteDailyWeights` **non è importata** in cima al file (riga 7 elenca `deleteDailySteps` ma non `deleteDailyWeights`/`deleteDailyWeight`), e **non esiste come export in `storage.js`** — l'unica funzione di cancellazione "daily" presente è `deleteDailySteps` (`js/storage.js:669`). Se eseguito, questo ramo lancerebbe `ReferenceError: deleteDailyWeights is not defined`, silenziosamente inghiottito dal `try/catch` locale che mostra solo un generico "Errore eliminazione peso".

Tuttavia, verificato anche che `onDeleteWeight` **non è mai invocato dalla UI**: `grep -rn "onDeleteWeight" js/ui/` non produce risultati né in `physicsView.js` né in `activities.js` — a differenza di `onDeleteStrength`/`onDeleteCardio`, effettivamente collegati (`callbacks.onDeleteStrength?.()`/`callbacks.onDeleteCardio?.()` in `physicsView.js:264,272`), non esiste alcun bottone "elimina peso" nel markup di queste viste. Il bug è quindi reale nel codice ma **oggi irraggiungibile** dalla UI osservata in questo file. Severità: **minore allo stato attuale** (dead callback), ma da correggere prima di esporre un bottone "elimina peso" in UI, perché romperebbe immediatamente la feature. Fix naturale: implementare/importare una funzione di cancellazione peso in `storage.js` (es. `deleteDailyWeight(date)`, singolare, coerente con `saveDailyWeight`).

### 3. `openCustomFoodForm` torna sempre a `renderFoodsView()` dopo il salvataggio, anche se invocata da Nutrizione o Ricerca — UX friction (medio)
`js/app.js:1275-1298`, in particolare la callback `onSave` (riga 1292: `renderFoodsView();`). La funzione è condivisa da tre contesti di chiamata diversi:
- `renderNutritionViewPage` → `onCreateCustomFood: () => openCustomFoodForm()` (riga 471)
- `renderSearchView` → `onCustomFood: () => openCustomFoodForm()` (riga 716)
- `renderFoodsView` → `onCreate: () => openCustomFoodForm()` (riga 733)

In tutti e tre i casi, al salvataggio la callback ri-renderizza incondizionatamente `renderFoodsView()`, indipendentemente da dove l'utente si trovasse. Un utente che crea un alimento personalizzato mentre è nella vista Nutrizione (il caso più comune, dato il bottone "+ Nuovo Alimento Personalizzato" visibile lì) viene spostato automaticamente alla vista Ricette/Alimenti invece di restare nel contesto in cui stava lavorando (es. stava per aggiungere quell'alimento a un pasto). Da confrontare con `editCustomFoodModal` (riga 1247), che correttamente ri-renderizza `renderNutritionViewPage()` perché ha un solo chiamante coerente. Severità: **medio** — friction UX reale, l'utente perde il filo del task che stava svolgendo (nessuna perdita dati, ma serve ri-navigare manualmente).

Da notare: il percorso "quick-add" ha una soluzione migliore per lo stesso problema — `openCustomFoodFormWithMoment` (riga 1925) incatena esplicitamente `openQuickAddWithFoodAndMoment(...)` dopo il salvataggio invece di un `render*View()` fisso, mantenendo l'utente nel flusso di aggiunta pasto. `openCustomFoodForm` (la funzione "generica", non quella "WithMoment") non ha questo trattamento.

### 4. Due import morti da `recentFoodsTracker.js`: `suggestMealMomentByTime` e `getLastMealMoment` — minore
`js/app.js:36`: `import { trackFoodUsage, getRecents, suggestMealMomentByTime, getLastMealMoment } from './recentFoodsTracker.js';`. Verificato con grep mirato: `trackFoodUsage` e `getRecents` sono effettivamente usate (4 e 1 occorrenze rispettivamente, oltre all'import), ma `suggestMealMomentByTime` e `getLastMealMoment` **non compaiono mai altrove nel file**. Entrambe sono definite ed esportate realmente in `js/recentFoodsTracker.js` (righe 84 e 96), quindi non è un typo di nome — sono importazioni morte. Nota di contesto: `app.js` ha una propria funzione locale `suggestMealMoment()` (righe 2334-2341) che duplica una logica simile basata sull'ora del giorno, invece di usare la versione importata da `recentFoodsTracker.js` — possibile residuo di refactoring incompleto. Severità: **minore** (nessun impatto funzionale, solo peso morto e potenziale confusione su quale funzione sia quella "vera").

### 5. `showWeightUpdateModal` non usa il pattern di binding standard di `showModal` — inconsistenza minore, rischio di regressione futura
`js/app.js:2279`: `showModal(html);` — a differenza di **tutti** gli altri ~15 usi di `showModal` nel file, qui non viene passato il secondo argomento `bind` (callback che riceve il container del modal). Invece, il codice successivo (righe 2281-2285) usa `document.querySelector('#weightDateInput')` ecc. direttamente sul documento globale, non scoping al modal:
```js
showModal(html);
const cancelBtn = document.querySelector('#cancelWeightBtn');
const saveBtn = document.querySelector('#saveWeightBtn');
const weightInput = document.querySelector('#weightInput');
const dateInput = document.querySelector('#weightDateInput');
const bodyFatInput = document.querySelector('#bodyFatInput');
```
Funziona oggi perché c'è sempre un solo modal aperto alla volta e gli id sono univoci nel DOM in quel momento, ma è fragile: se in futuro coesistessero due modal (o se lo stesso id comparisse altrove nella vista sottostante), questo codice selezionerebbe l'elemento sbagliato. È anche l'unico punto del file che fa binding eventi fuori dal meccanismo `bind(modalRoot)` previsto da `js/ui/modal.js`. Effetto collaterale secondario: siccome non c'è `bind`, `showModal` esegue il proprio auto-focus di default (`js/ui/modal.js:33-36`) sul primo `input, select, textarea, button.primary` trovato nel modal — che qui è il campo Data (`#weightDateInput`), non il campo Peso, probabilmente non l'intento UX (registrare il peso è l'azione primaria, non la data). Severità: **minore**.

### 6. Incoerenza tra "elimina con conferma" e "elimina con solo undo" tra tipi di entità simili — UX, minore
Confrontando i flussi di cancellazione:
- Pasti (`onDeleteMeal`, righe 445-470) e sessioni forza/cardio (`deleteSessionWithUndo`, righe 117-134): cancellano **immediatamente al click**, senza `showConfirm`, protetti solo da un toast "Annulla" a scomparsa (5s minimo).
- Alimenti personalizzati (`deleteUserFood`, riga 1306) e ricette (`deleteRecipeConfirm`, riga 1358): chiedono **prima** conferma esplicita con `showConfirm(..., { confirmLabel: 'Elimina', danger: true })`, e in più offrono comunque l'undo dopo.

Non è necessariamente uno sbaglio di design (si potrebbe argomentare che pasti/sessioni sono azioni più frequenti e a basso costo di un tap accidentale), ma è un'incoerenza di pattern non discussa dal documento originale, tra azioni della stessa categoria (cancellazioni distruttive di entità utente). Severità: **minore**.

---

## Riepilogo conteggi

| Severità | Conteggio | Voci |
|---|---|---|
| Critico | 0 | — |
| Medio | 3 | `renderActivitiesViewPage` irraggiungibile dal router; `attachBottomNav` re-inizializza swipe a ogni click; `openCustomFoodForm` reindirizza sempre a `renderFoodsView()` anche da Nutrizione/Ricerca |
| Minore | 8 | entry senza `id` nel ramo quick-add; `zuccheri`/`fibra` azzerati per pasti-da-ricetta; `console.log` di debug in produzione (dashboard); pattern `showToast` con firma legacy senza `type:'error'` (6 occorrenze totali, contate come 1 voce sistemica); `deleteDailyWeights` chiamata ma mai definita (dead callback, oggi irraggiungibile da UI); due import morti da `recentFoodsTracker.js`; `showWeightUpdateModal` non usa il binding standard di `showModal`; incoerenza tra cancellazioni con conferma vs. solo-undo |

Nota: i conteggi includono sia i problemi già segnalati dal documento originale e confermati veri, sia quelli trovati indipendentemente in questa verifica (elencati per esteso nelle sezioni "Problemi reali confermati" e "Problemi nuovi trovati"). Gli errori di accuratezza del documento originale (conteggio righe `openQuickAddWithFood`, caratterizzazione di `renderWeekViewPage`) sono classificati a parte nella sezione "Errori nel documento originale" e non contano come bug applicativi.
