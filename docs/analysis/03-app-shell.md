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
