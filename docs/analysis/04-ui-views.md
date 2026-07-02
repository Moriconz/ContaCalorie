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
