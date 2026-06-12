# Conta Calorie — Considerazioni, criticità e migliorie

> Analisi critica dopo lettura completa del codice. Ordinata per priorità: prima i **bug reali**, poi **codice morto**, **architettura**, **sicurezza**, **UI/UX** e **idee di prodotto**. Ogni punto indica il file coinvolto.

---

## ✅ Stato implementazione (aggiornato durante il lavoro)

- **Fatto** — 1.1, 1.2, 1.5 (dashboard: anelli macro su target reali, bilancio TDEE/esercizio popolato, emoji pasti).
- **Fatto** — 1.3 (date/data) risolto in modo **non distruttivo**: i record di sessioni/passi/pesi vengono normalizzati in lettura con entrambi i campi `date` e `data` (vedi `_normalizeDateFields` in `storage.js`). Questo corregge anche il bug per cui la vista Fisica filtrava `strengthSessions` (campo `.date`) per `.data` → sessioni pesi sempre vuote.
- **Fatto** — 1.4: rimossa la funzione morta `openQuickAdd()` (+ `loadRecentFoods`).
- **Fatto** — 3.5: `estimateAdaptiveTDEE` riscritto pulito (una formula, niente variabili scartate).
- **Fatto (parziale)** — cap. 2: rimossi `nutritionSourceStrategy.js`, `validation.js`, `test.html`, `debug.html`, `generate-italian-foods*.js`, e le funzioni morte `renderCardPeso`/`renderMacroCard` in dashboard.
- **Da rivedere (correzione del mio assessment iniziale)** — Il "DB fantasma" e i file "duplicati" **non sono codice morto**: sono agganciati alla feature di **backup** (`js/sync/backupService.js` + `db/indexedDbClient.js`), che però è **rotta** perché opera su un database (`conta-calorie-db`) che l'app reale non popola mai (i dati veri stanno in `ContaCalorieDB` via `storage.js`). Vedi 3.1 aggiornato.
- **Fatto** — 3.4: creato `computeDayActivityKcal` in `activityEnergyEngine.js` + `buildLastNDates` in `utils.js`; dashboard refactorata e **corretto il bug** per cui il trend settimanale leggeva lo store pesi legacy (vuoto) invece di `strengthSessions`.
- **Fatto** — 4.1: creato `js/utils.js` con `escapeHtml` e applicato ai nomi controllati dall'utente in `app.js`, `userFoods.js`, `recipes.js`, `nutritionView.js` (mitigazione XSS).
- **Fatto** — 5.7: date dell'header dashboard formattate in italiano (`formatDateIT`).
- **Fatto** — 6.1: vista **Statistiche & Coaching collegata** alla navigazione (nuova voce nav `📈 Statistiche`, `renderStatsViewPage` in `app.js`).
- **Fatto** — 3.1 (backup): `js/sync/backupService.js` riscritto per usare il DB reale `storage.js` (export/import ora operano sui dati veri). Aggiunti `clearStore`, `loadAllStrengthSessions`, `loadAllDailySteps` a `storage.js`.
- **Fatto (parziale)** — 3.1 (split `app.js`): estratto il sistema modali in `js/ui/modal.js` (primo passo); `app.js` da 2.419 → ~2.180 righe.
- **Non fatto (refactor molto grandi, da concordare/testare in browser)** — split completo di `app.js` per vista, migrazione completa dei ~900 stili inline a un design system CSS, consolidamento dei file duplicati `persistence.js`/`backupService.js` (root vs `js/`) e rimozione del DB fantasma da `appBootstrap`/`settings`.

---

## 🔴 1. Bug concreti (da correggere)

### 1.1 Dashboard: gli anelli macro usano chiavi sbagliate → valori sempre errati
In [`js/ui/dashboard.js`](js/ui/dashboard.js):
- `renderCardOggi` legge `targets.dailyCalories / dailyProtein / dailyCarbs / dailyFats`, ma `nutritionTargets` (da `calculateEnergyTargets`) espone `calorie / proteine / carboidrati / grassi`. Risultato: i target cadono **sempre** sul default hardcoded `{2000, 160, 250, 65}`, ignorando il profilo utente.
- `renderMacroProgressCircles` legge `summary.totalProteine / totalCarboidrati / totalGrassi`, ma l'aggregato produce `totaleProteine / totaleCarbo / totaleGrassi`. Risultato: gli anelli di proteine/carbo/grassi mostrano **0 / NaN**.
- **Impatto**: la card più importante della home è di fatto rotta. È la prima cosa da sistemare.

### 1.2 Dashboard: TDEE ed esercizio del "Bilancio Energetico" sempre a 0
`renderCardBilancio` legge `summary.tdee` e `summary.activityKcal`, ma `aggregateDailySummary` non popola questi campi. Il bilancio mostra TDEE 0 e quindi un "deficit" pari all'intake. Anche `summary.weeklyTrend` usa `daySummary.tdee` (inesistente) → deficit settimanale falsato.

### 1.3 Incoerenza campo data `date` vs `data`
In [`js/storage.js`](js/storage.js) `strengthSessions` e `dailySteps` usano `date`, mentre `weightsSessions/cardioSessions/dailyWeights/mealEntries` usano `data`. In [`js/app.js`](js/app.js) `renderActivitiesViewPage` filtra `strengthSessions.filter(s => s.date === ...)` ma cardio con `c.data === ...`: facile introdurre filtri che non matchano. Uniformare su un solo nome (consiglio: `date` ISO ovunque).

### 1.4 `openQuickAdd()` usa `moment` non definito
In [`js/app.js`](js/app.js:1851) dentro `openQuickAdd` viene chiamato `openEstimationWizard(moment, ...)` ma `moment` non esiste in quello scope (esiste solo in `openQuickAddWithMoment`). ReferenceError se quel ramo viene eseguito.

### 1.5 Emoji pasti mai corrette nella dashboard
`renderCardPastiOggi` confronta `moment === 'Colazione'` (maiuscolo) ma `MealMoments` è minuscolo (`'colazione'`): l'emoji cade sempre sul default 🌙.

### 1.6 Modifica pasto: ricalcolo macro lossy
In [`js/app.js`](js/app.js) `editMealModal` ricava i valori per 100 g dividendo `macroCalcolate` per i grammi salvati. Con arrotondamenti ripetuti i valori derivano. Meglio salvare il riferimento `per100g` nell'entry.

---

## 🟠 2. Codice morto / duplicato (da rimuovere)

Dopo la migrazione a CREA è rimasto parecchio non collegato:

| Elemento | Stato | Note |
|---|---|---|
| `js/nutritionSourceStrategy.js` (550 righe) | **0 import** | orfano dopo rimozione wizard cotture |
| `js/validation.js` | **0 import** | mai usato |
| `js/ui/statsView.js` | **0 import** | feature "statistiche/coaching" non in navigazione |
| `js/statisticsEngine.js` + `js/coachingRules.js` | usati solo da statsView (morto) | cluster morto trascinato |
| `storage/persistence.js` e `sync/backupService.js` (root) | duplicati | le versioni vive sono in `js/storage/` e `js/sync/` |
| `generate-italian-foods.js` / `-complete.js` (~38 KB l'uno) | script build legacy | obsoleti post-CREA |
| `test.html`, `debug.html` | artefatti dev | |
| `db/indexedDbClient.js` | **DB fantasma** | vedi 3.1 |
| Funzioni in `app.js`/`dashboard.js`: `renderMacroCard`, `renderCardPeso`, `renderWeightLossView` (non in routing) | morte/scollegate | |

> Una pulizia qui toglie facilmente **>1.500 righe** e riduce la confusione. Nota: c'è una feature **Statistiche + Coaching già scritta** (`statsView`/`coachingRules`) mai esposta — invece di cancellarla si potrebbe **collegarla** (vedi 6.1).

### 3.1 Due database IndexedDB paralleli → la feature di backup è ROTTA
[`js/appBootstrap.js`](js/appBootstrap.js) chiama `initDb()` di [`db/indexedDbClient.js`](db/indexedDbClient.js) che apre il DB **`conta-calorie-db`** (store: meals, workouts, bodyComp, settings, syncQueue). Ma tutti i dati reali dell'app passano da [`js/storage.js`](js/storage.js) che usa un DB **diverso**, `ContaCalorieDB` (store: mealEntries, userFoods, weightsSessions…).

**Correzione rispetto alla prima analisi**: `conta-calorie-db` NON è semplicemente morto — è usato da [`js/sync/backupService.js`](js/sync/backupService.js) (export/import) e da [`js/ui/settings.js`](js/ui/settings.js). Il problema reale è che il **backup legge/scrive il DB sbagliato**: esporta da `conta-calorie-db` (che l'app non popola mai) e importa lì dentro (dove l'app non legge mai). Risultato: **export vuoto, import inefficace**. Va corretto puntando il backup agli store reali di `storage.js`, non eliminato alla cieca. Inoltre esistono due copie divergenti di `persistence.js` e `backupService.js` (in root e in `js/`) raggiunte da import con path relativi diversi: da consolidare con attenzione e **test nel browser**.

---

## 🟡 3. Architettura

### 3.1 `app.js` è un monolite da 2.416 righe
Mescola: stato globale, routing, 12+ funzioni di render-vista, decine di modali costruite a mano, logica di business inline. Difficile da mantenere e testare.
**Proposta**: estrarre i modali in moduli `ui/modals/*.js`; spostare le funzioni `renderXView` ciascuna nel proprio modulo UI (già esistono i file, basta spostarci la logica del controller); introdurre un mini-router (`viewRegistry`) al posto della catena `if/else if`.

### 3.2 Re-render totale a ogni azione
Ogni modifica fa `innerHTML = renderX(...)` dell'intera vista e ricarica tutti i dati (`loadAllMeals`, `loadAllWeightsSessions`…). Su dataset grandi diventa lento e perde stato del DOM (scroll, focus).
**Proposta**: aggiornamenti mirati o un piccolo layer reattivo; oppure adottare un micro-framework (Preact/Lit) se si è disposti a un build step.

### 3.3 Query non indicizzate
`loadMealsByDate` carica **tutti** i pasti e filtra in JS; idem per sessioni. C'è già un client con indici (`db/indexedDbClient.js`) ma è quello morto. Aggiungere indici `date` agli store realmente usati.

### 3.4 Duplicazione del calcolo attività
Il blocco "ultimi 7 giorni con kcal attività" è riscritto quasi identico in `renderDashboardView`, `renderPhysicsViewPage`, `renderActivitiesViewPage`, `renderWeekViewPage`. Centralizzare in una funzione unica (es. `buildLast7DaysActivity()`).

### 3.5 `estimateAdaptiveTDEE` confuso
In [`js/weightLossEstimator.js`](js/weightLossEstimator.js) la funzione contiene commenti di incertezza ("Err, sto confondendo…"), variabili calcolate e scartate (`adaptiveTDEE` vs `tdeeAdaptive`) e chiama `getEnergyBalanceSummary` ~6 volte. Da riscrivere pulita (una sola formula, una sola chiamata).

### 3.6 `models.js` non riflette i dati reali
La lista `Origins` non include gli origin realmente usati (`estimate`, `recipe_saved`, `composed_from_ingredients`, `recent_quick_add`…) e i factory non sono usati ovunque. Allinearlo o usarlo come unica fonte di verità per creare le entry.

---

## 🔒 4. Sicurezza / robustezza

### 4.1 XSS da dati utente in `innerHTML`
Nomi di alimenti/ricette/note inseriti dall'utente vengono interpolati direttamente in template `innerHTML` (es. `${food.nome}`, `${recipe.nome}` in `app.js`, `dashboard.js`). Un nome tipo `<img onerror=...>` esegue codice. È un'app locale single-user, quindi rischio basso, ma con import file (passi) e possibile sync futura va gestito.
**Proposta**: una helper `escapeHtml()` applicata a tutti gli input utente, o costruzione DOM via `textContent`.

### 4.2 `~906` attributi `style="..."` inline nei JS
Oltre alla manutenibilità, impediscono una Content-Security-Policy stretta (niente `unsafe-inline`). Spostare in classi CSS.

### 4.3 Gestione errori "silenziosa"
Molte funzioni storage fanno `catch { return [] }` o `console.warn`: un fallimento di scrittura può passare inosservato e l'utente crede di aver salvato. Aggiungere feedback utente sui fallimenti di scrittura critici.

---

## 🎨 5. UI / UX

### 5.1 Stili inline ovunque → incoerenza visiva
Colori (`#22c55e`, `#3b82f6`…), spaziature e raggi sono ripetuti a mano in centinaia di punti invece di usare i token del tema (`--primary`, `--surface`…). Conseguenza: difficile garantire coerenza e supporto reale a dark/light. **Creare un design system minimo** (classi `.stat-card`, `.macro-ring`, `.pill`, palette semantica) e migrarci i render.

### 5.2 Navigazione poco scopribile
Viste utili (Settimana, Ricette/Alimenti, ricerca dedicata, statistiche) non sono nella bottom nav. L'utente non sa che esistono. Valutare: nav a 5 voci o una sezione "Altro".

### 5.3 Coerenza dei modali
I modali sono costruiti ognuno con markup/stili propri; alcuni hanno "Annulla", altri "Indietro", bottoni in ordine diverso, larghezze diverse. Servirebbe un componente modale unico con header/footer standard e ordine bottoni coerente.

### 5.4 Feedback e stati vuoti
Buoni i `showToast`, ma mancano: stati di caricamento uniformi (solo activities ha lo spinner), conferme non bloccanti (si usa `confirm()` nativo per le eliminazioni), e "undo" dopo eliminazione (meglio di un confirm).

### 5.5 Accessibilità
- Contrasto dei testi `--muted` su superfici glass da verificare (WCAG AA).
- Molti elementi cliccabili sono `<div>`/`<a href="#">` senza ruolo/focus: usare `<button>`.
- Touch target: alcuni link "Dettagli ↗" sono piccoli per il mobile.
- Input numerici: ok `font-size:16px` (evita zoom iOS), mantenere ovunque.

### 5.6 Internazionalizzazione mista
UI in italiano ma chiavi/commenti/alcune label miste IT/EN. Va bene se resta IT-only; altrimenti estrarre le stringhe.

### 5.7 Date "grezze" in UI
La home mostra `Oggi: 2026-05-22` (ISO). Meglio formattare in italiano (`giovedì 22 maggio`). Manca anche un modo per cambiare giorno dalla dashboard (si passa solo dalla vista Settimana).

---

## 🟢 6. Idee di prodotto / nuove funzionalità

1. **Collegare la sezione Statistiche & Coaching già scritta** (`statsView` + `coachingRules` + `statisticsEngine`): trend settimanali/mensili, adeguatezza proteine/fibre, insight automatici. È codice pronto e inutilizzato — il quick win più grande.
2. **Export/Import dati completo** (backup JSON di tutto il DB): esiste `backupService` ma è parziale e legato solo a settings. Utile per cambio dispositivo.
3. **Diario per data navigabile**: selettore data in dashboard per consultare/modificare giorni passati senza passare dalla vista Settimana.
4. **Obiettivo peso + ETA**: `estimateTimeToGoal` esiste già nell'engine ma non è esposto in UI.
5. **Preferiti / pasti rapidi ricorrenti**: oltre ai "recenti", permettere di salvare combinazioni (es. "colazione tipo").
6. **Scanner codice a barre / foto**: c'è già lo scheletro `photoNutrition`/`photoAnalysis` (stub). Integrare un'API reale o OpenFoodFacts solo per i prodotti confezionati (mantenendo CREA per gli alimenti base).
7. **Ricerca con singolare/plurale e accenti**: oggi è per prefisso, quindi "mela" non trova "Mele". Aggiungere stemming leggero IT.
8. **Promemoria/notifiche** (PWA push o local) per registrare i pasti.

---

## 7. Piano d'azione consigliato (ordine)

1. **Fix dashboard** (1.1, 1.2) — è visibile e rotto.
2. **Uniformare `date`/`data`** (1.3) e fix `openQuickAdd` (1.4).
3. **Rimuovere codice morto e il DB fantasma** (cap. 2 + 3.1) — riduce rumore prima di rifattorizzare.
4. **Centralizzare il calcolo "ultimi 7 giorni"** (3.4) e ripulire `estimateAdaptiveTDEE` (3.5).
5. **Collegare Statistiche & Coaching** (6.1) — alto valore, basso costo.
6. **Design system minimo + escape HTML** (5.1, 4.1) — base per UI coerente e sicura.
7. **Spezzare `app.js`** (3.1) — refactor incrementale, un modale/vista alla volta.

> Nota: gli **engine di calcolo** (nutrition, activity, bodyComp, weightLoss) sono la parte migliore del progetto — ben documentati, con fonti e funzioni pure. Conviene preservarli e costruirci sopra una UI più solida, non riscriverli.
