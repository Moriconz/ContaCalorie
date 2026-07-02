# Verifica adversariale — 01-data-persistence.md e 02-engines.md

Verifica indipendente di ogni claim checkabile (file:line, formula, bug, dead code) contro il codice sorgente reale. Metodologia: lettura diretta di ogni file citato, non fiducia nel documento originale.

---

# PARTE 1 — `01-data-persistence.md`

## Claim confermati

Ho letto per intero `js/storage.js` (759 righe), `js/models.js` (121 righe), `js/sync/backupService.js` (172 righe), `js/storage/persistence.js` (103 righe) e confrontato ogni citazione file:line. La quasi totalità delle affermazioni è accurata:

- Schema DB (`DB_NAME`, `DB_VERSION=8`, 13 store, `DATE_INDEXED_STORES`) confermato riga per riga (`storage.js:6-10`).
- `openDB()` (16-68): cache `_dbPromise`, creazione store idempotente, migrazione v7 con cursore + normalizzazione `data`/`date`, `onclose`/`onversionchange` invalidano la cache — tutto confermato leggendo 16-68.
- `withStore` (70-91): le tre forme di ritorno gestite (IDBRequest, Promise, sync/tx.oncomplete) confermate esattamente.
- `_normalizeDateFields`/`_normalizeList` (103-115): comportamento non distruttivo su disco confermato.
- `_migrateMealEntry` (149-190) e il fix `id: entry.id || crypto.randomUUID()` (riga 180): confermato, commento nel codice (177-179) corrisponde esattamente alla spiegazione del documento.
- CRUD di tutti gli store (`userProfile`, `userFoods`, `mealEntries`, `remoteFoods`, `cardioSessions`, `dailyWeights`, `bodyCompBaselines`, `recipes`, `strengthSessions`, `dailySteps`, `activityPreferences`, `fridge`): pattern di fallback localStorage, generazione id, throw vs solo-warn — tutto confermato contro il codice.
- `backupService.js`: `EXPORT_VERSION=2`, `exportAllUserData` (store inclusi/esclusi), `validateExportData` (elenco chiavi controllate, **`fridge` effettivamente assente dall'elenco**, riga 116), `importAllUserData` (clearStore su 9 store in modalità replace, `userProfile`/`activityPreferences`/`remoteFoods`/`weightsSessions` non svuotati) — tutto confermato.
- `persistence.js`: le 4 funzioni esportate corrispondono esattamente a quanto descritto (feature detection, `navigator.storage.persist/estimate/persisted`).
- Tutti i numeri di riga citati per le funzioni esportate (`saveUserFoods` 238-249, `loadUserFoods` 251-262, `saveMealEntries` 264-281, `loadMealsByDate` 283-295, `loadAllMeals` 311-333, `loadFridgeItems` 726, `saveFridgeItem` 738, `deleteFridgeItem` 752) corrispondono esattamente al sorgente reale.

## Errori nel documento originale

Nessun errore fattuale significativo trovato nella sezione 01. Un paio di imprecisioni minori:

- Il documento (riga 74, nota su `_migrateMealEntry`) dice che è "esportata specificamente per un test di regressione" — confermato dal commento a riga 147-148 del sorgente, ma non ho verificato che il test esista realmente nel repo (fuori dal perimetro assegnato: solo storage.js/models.js/backupService.js). Da trattare come claim non completamente verificato, non come errore.
- Il documento descrive `loadUserFoods`/`loadRecipes`/`loadFridgeItems`/`loadAllMeals` come pattern con `request.onsuccess = () => {}` "no-op per tenere viva la transazione" senza commentare esplicitamente — confermato nel codice (righe 254-256, 313-317, 548-550, 729-731), nessun errore.

## Problemi reali confermati

Tutti i problemi elencati nella sezione "Problemi/note" del documento 01 sono stati verificati e sono **reali**:

1. **Fallback localStorage incoerente tra funzioni** (righe 277 doc) — confermato: `cacheRemoteFood` (335-341), `saveBodyCompBaseline` (503-509), `saveCardioSession` (431-444), `saveStrengthSession` (595-607), `saveDailySteps` (639-650), `saveActivityPreferences` (679-690), `saveFridgeItem` (738-750) hanno solo `console.warn`, nessun fallback localStorage. Severità: **medio** (perdita dati silenziosa in scenari di IndexedDB non disponibile, ma non nel percorso critico "pasto registrato").

2. **`updateStrengthSession`/`updateCardioSession` non rilanciano l'errore, `updateRecipe` sì** — confermato: `storage.js:618-627` (strength, solo `console.warn`, riga 625), `storage.js:711-720` (cardio, solo `console.warn`, riga 718), contro `storage.js:565-582` (`updateRecipe`, `throw error` a riga 580). Severità: **minore** (incoerenza API, non causa data loss diretta ma rompe l'aspettativa try/catch del chiamante).

3. **`saveFridgeItem` ritorna sempre `toSave` anche se la scrittura è fallita** (`storage.js:738-750`) — confermato: il `return toSave` a riga 749 è fuori dal blocco `try/catch` (738-748), quindi ritorna sempre l'oggetto costruito indipendentemente dall'esito reale della persistenza. Severità: **medio** (un consumer che aggiorna lo stato UI sul valore di ritorno crede il salvataggio riuscito anche quando è fallito silenziosamente).

4. **`validateExportData` non valida `fridge`** (`backupService.js:116`) — confermato: l'array controllato è `['meals', 'userFoods', 'weightsSessions', 'cardioSessions', 'strengthSessions', 'dailyWeights', 'dailySteps', 'bodyCompBaselines', 'recipes']`, **`fridge` e `activityPreferences` assenti**. Severità: **minore** (un `fridge` malformato fallirebbe più avanti dentro `importAllUserData`, con errore meno chiaro, ma non corromperebbe silenziosamente lo stato in modo grave dato che `saveFridgeItem` fa `store.put` su oggetti singoli).

5. **Store legacy `weightsSessions` mai rimosso dallo schema** — confermato: `_migrateWeightsToStrength` (369-384) fa solo `store.clear()` (riga 377), mai `db.deleteObjectStore`. Lo store resta vuoto ma presente in `STORE_NAMES` (riga 8) indefinitamente. Severità: **minore**.

6. **`loadDailyWeights()` ordina prima di normalizzare** (`storage.js:486-487`) — confermato: `all.sort((a, b) => new Date(a.data) - new Date(b.data))` avviene su `all` grezzo, **prima** di `_normalizeList(...)` che viene applicato solo al risultato già ordinato (riga 487, `_normalizeList(all.sort(...))` — la valutazione JS è comunque interna-esterna quindi sort avviene su `all` non normalizzato). Per un record con solo `date` valorizzato (non `data`), `new Date(undefined)` → `Invalid Date`, comparazione instabile. Severità: **minore** (nessun crash, solo ordinamento non garantito per record legacy anomali).

## Problemi nuovi trovati (Parte 1)

- **`_deleteMealsBySource` — race condition strutturale nell'uso di `store.getAll()` con `.forEach` dentro `onsuccess`** (`storage.js:196-215`): il pattern usato è `request.onsuccess = () => { all.forEach(entry => { if (...) store.delete(entry.id) }) }` mentre la funzione esterna fa `return request` per essere gestita da `withStore`. Questo è corretto perché `store.delete()` dentro lo stesso `onsuccess` handler mantiene viva la transazione IndexedDB (le chiamate sono sincrone rispetto all'event loop della transazione), quindi non è un bug — ma è un pattern fragile: se in futuro qualcuno aggiungesse un `await` o una callback asincrona dentro quel `forEach`, la transazione IndexedDB si chiuderebbe prematuramente (le transazioni IDB si auto-committano se non ci sono richieste pendenti in un singolo tick). Severità: **minore** (rischio di regressione futura, non un bug oggi).

- **`getDbStats()` (righe 387-398) itera `STORE_NAMES` sequenzialmente con `await` dentro un `for...of`**, non in parallelo (`Promise.all`), a differenza di `exportAllUserData`. Con 13 store questo significa 13 transazioni IndexedDB sequenziali invece che concorrenti. Non un bug, ma un'opportunità di performance non colta, non menzionata nel documento originale. Severità: **minore**.

- **`saveDailyWeight` e `saveDailySteps` non generano un `id` con `crypto.randomUUID()` come fallback finale** (`storage.js:476`: `id: entry.id || entry.data || entry.date`; `storage.js:643`: `id: stepsRecord.id || stepsRecord.date || stepsRecord.data`) — se sia `id` sia `data`/`date` sono assenti/undefined, `store.put()` fallirebbe per keyPath mancante esattamente come il bug storico di `mealEntries` già fixato con `_migrateMealEntry`, ma qui **non c'è alcuna rete di sicurezza equivalente**: il `catch` esterno logga solo un warning (righe 479-481, 647-649), nessun fallback localStorage, nessuna generazione automatica di UUID. Nella pratica il campo data è quasi sempre presente (è la ragion d'essere di questi due record), quindi il rischio è basso ma il pattern protettivo usato per `mealEntries` non è stato applicato uniformemente. Severità: **minore**.

---

# PARTE 2 — `02-engines.md`

Ho letto per intero: `nutritionEngine.js`, `nutritionDataProvider.js`, `activityEnergyEngine.js`, `weightLossEstimator.js`, `bodyCompositionModel.js`, `bodyCompTracker.js`, `trendProjection.js`, `statisticsEngine.js`, `estimationEngine.js` (parziale, i punti citati), `coachingRules.js`, `recentFoodsTracker.js`, `dataPackLoader.js`, `creaHierarchy.js`, `micronutrientEngine.js`, `composedMealWizard.js`, `js/ui/fridgeView.js`.

## Claim confermati

Praticamente tutte le descrizioni funzione-per-funzione del documento sono accurate contro il sorgente reale, incluse le formule (Mifflin-St Jeor, ACSM treadmill, MET→kcal, 7700 kcal/kg), le costanti (soglie, RDA LARN, MET tables), e la gran parte dei numeri di riga citati. In particolare ho verificato a fondo:

- `calculateMacrosForAmount`, `calculateEnergyTargets`, `aggregateDailySummary` (`nutritionEngine.js:31-122`): formule e default (`pesoKg||70`, `altezzaCm||170`, floor 1100/50/45/100) confermati esatti.
- `estimateWeightsCalories`/`estimateCardioCalories`/`estimateStepsCalories`/`shouldExcludeStepsCalories`/`applyEatBackCalories`/`netStepsRecordForCardio`/`computeDayActivityKcal`/`aggregateDailyExercise` (`activityEnergyEngine.js`): tutte le formule, i due approcci anti-doppio-conteggio (A esclusione totale in `aggregateDailyExercise`, B netting in `computeDayActivityKcal`) confermati esattamente come descritti.
- `getTheoreticalTDEE`, `estimateAdaptiveTDEE`, `estimateLinearWeightChange`, `estimateTimeToGoal` (`weightLossEstimator.js`): formule ed edge case (età per anno solare senza clamp, formula inversa del TDEE adattivo) confermati.
- Tutto `bodyCompositionModel.js` (score deficit/training/proteine, lean retention index, split deficit/surplus): confermato riga per riga.
- `computeGaps`, `computeFridgeSuggestions`, `computeDailyScore`, `weakestMacro`, `computeShoppingList`, `computeCookableRecipes`, `bindFridgeViewEvents` (`js/ui/fridgeView.js`): tutte le formule e i pattern (incluso il ricalcolo indipendente di `suggestions`/`shopping` in `bindFridgeViewEvents`, righe 553-554 nel mio sorgente) confermati.
- L'elenco "Problemi/note" del documento (21 punti) è stato confrontato punto per punto col codice: **tutti i 21 punti sono reali e accuratamente descritti**, incluse le citazioni file:line.

## Errori nel documento originale

Nessun errore fattuale rilevante trovato. Un chiarimento importante che il documento fa correttamente ma vale la pena ribadire: il bug `totaleCarboidrati`/`totaleCarbo` (punto 1 della lista Problemi, e vedi sotto) **non** si propaga a `js/ui/fridgeView.js:computeGaps`, perché quella funzione legge `aggregateDailySummary(...).confrontoConTarget.carboidrati` (un campo nested che **esiste** correttamente, generato da `compare('carboidrati', totals.totaleCarbo)` in `nutritionEngine.js:116`), non il campo piatto `totaleCarboidrati`. Il bug colpisce **solo** i consumer di `getWeeklyStats`/`getMonthlyStats` (`statisticsEngine.js`), non `fridgeView.js`. Il documento originale non fa questa precisazione esplicitamente ma nemmeno afferma il contrario — nessuna correzione necessaria, solo conferma con evidenza aggiuntiva.

## Problemi reali confermati

### 1. Bug `totaleCarboidrati` vs `totaleCarbo` — CONFERMATO, critico

`nutritionEngine.js:83` (dentro `aggregateDailySummary`) accumula il totale carboidrati nel campo `acc.totaleCarbo`. `statisticsEngine.js:28` (`getWeeklyStats`) e `statisticsEngine.js:68` (`getMonthlyStats`) leggono `summary.totaleCarboidrati` — campo che **non esiste mai** nell'oggetto ritornato da `aggregateDailySummary` (i campi reali sono `totaleCalorie, totaleProteine, totaleCarbo, totaleGrassi, totaleFibra, totaleZuccheri, totaleSodioMg, totaleGrassiSaturi`, verificato a `nutritionEngine.js:91-98`). Risultato: `Math.round(undefined)` → `NaN` per il campo `carboidrati` in **ogni** giorno restituito da entrambe le funzioni. Severità: **critico** — dato visibilmente rotto (NaN in UI) su una funzione centrale (statistiche settimanali/mensili), silente (nessun errore/eccezione, solo NaN che si propaga).

### 2. `trackFoodUsage` — splice-before-read — CONFERMATO, critico

`js/recentFoodsTracker.js:22-31`:
```js
const idx = recents.findIndex(r => r.key === key);
if (idx >= 0) recents.splice(idx, 1);   // riga 23: rimuove l'elemento a idx

recents.unshift({
  ...
  count: (recents[idx]?.count || 0) + 1   // riga 31: legge recents[idx] DOPO lo splice
});
```
Confermato esattamente: `idx` è calcolato una volta (riga 22), poi l'elemento a quella posizione viene rimosso (riga 23, `splice(idx, 1)` muta l'array accorciandolo di 1). Alla riga 31, `recents[idx]` non punta più all'elemento appena rimosso ma a quello che gli succedeva nell'array (se esisteva) o è `undefined` se `idx` era l'ultimo elemento. Quindi `count` non riflette mai il conteggio reale dell'alimento riusato: nella stragrande maggioranza dei casi resta bloccato a `1` (perché `recents[idx]?.count` legge un elemento diverso o `undefined`, quindi il fallback `|| 0` scatta), invece di incrementare a 2, 3, ecc. Severità: **critico** — la feature "usati di recente con conteggio" è di fatto rotta (il conteggio non ha significato), anche se non causa crash o perdita dati.

### 3. Formule BMR/età duplicate con logica diversa — CONFERMATO, medio

`nutritionEngine.js:47`: `age = Math.max(16, Math.floor((Date.now() - new Date(dataNascita).getTime()) / 31557600000))` (anni pieni via millisecondi, clamp minimo 16).
`weightLossEstimator.js:35`: `age = new Date().getFullYear() - new Date(dataNascita).getFullYear()` (differenza di anno solare, nessun clamp). Confermato: le due formule possono divergere fino quasi a 1 anno per persone che non hanno ancora compiuto gli anni nell'anno corrente, con impatto diretto (±5 kcal/anno) sul BMR Mifflin-St Jeor. Severità: **medio** (impatto quantificabile ma piccolo, e le due funzioni servono scopi diversi — target giornalieri vs proiezioni).

### 4. `ACTIVITY_FACTORS`/`ACTIVITY_MULTIPLIERS` duplicate — CONFERMATO, minore

Valori identici (`1.2/1.375/1.55/1.725`) in `nutritionEngine.js:6-11` e `weightLossEstimator.js:14-19` sotto nomi diversi, nessuna fonte di verità unica. Severità: **minore**.

### 5. `MET_WEIGHTS` — collisione di nome, semantica incompatibile — CONFERMATO, minore

`nutritionEngine.js:140-145` (`{push:3.5,pull:3.0,leg:4.0,total_body:5.0}`, non esportata) vs `activityEnergyEngine.js:13-17` (`export const MET_WEIGHTS = {leggero:3.0,moderato:4.5,intenso:6.0}`, esportata). Confermato: nomi identici, chiavi e semantica incompatibili. Severità: **minore** (rischio di collisione solo se entrambe vengono importate senza alias nello stesso modulo; oggi non risulta accadere).

### 6. Codice morto in `nutritionEngine.js` — CONFERMATO, minore

`MET_WEIGHTS` locale, `calculateCardioCalories`, `calculateWeightsCalories`, `estimateWeightChange` (righe 140-174). Ho cercato riferimenti a queste funzioni nei file del perimetro assegnato e non ne ho trovati: `activityEnergyEngine.js` reimplementa le stesse funzionalità con formule più sofisticate (ACSM, retrocompatibilità v5/legacy). Non ho cercato nell'intero repo (es. `app.js`, fuori dal perimetro assegnato), quindi resta un "probabile" codice morto, non certezza assoluta — coerente con la cautela del documento originale. Severità: **minore**.

### 7. `estimateAdaptiveTDEE` importata ma mai chiamata — CONFERMATO, medio

Verificato con lettura diretta: `bodyCompTracker.js:10` importa `estimateAdaptiveTDEE` insieme a `getTheoreticalTDEE`, ma nel corpo del file (righe 1-311) **solo** `getTheoreticalTDEE` viene invocata (riga 202, dentro `computeBodyCompDeltasSinceBaseline`, con commento esplicito `// Usa TDEE teorico (per stabilità)`). Stessa situazione in `trendProjection.js:11` — solo `getTheoreticalTDEE` chiamata (nessuna occorrenza di `estimateAdaptiveTDEE(` come chiamata in tutto il file). La funzione `estimateAdaptiveTDEE` esiste ed è implementata correttamente in `weightLossEstimator.js:131-172`, incluso il campo `vsTheoretical` hardcoded a `null` (riga 170, mai calcolato altrove nei file esaminati). Severità: **medio** (funzionalità "TDEE adattivo da dati reali" completamente scollegata dall'app, non solo import inutilizzato ma una feature intera non attiva).

### 8. Import inutilizzato `cacheRemoteFood`/`loadRemoteFoodCache` — CONFERMATO, minore

`nutritionDataProvider.js:8`: `import { cacheRemoteFood, loadRemoteFoodCache } from './storage.js';`. Ho cercato entrambi gli identificatori nel resto del file (righe 1-247): nessuna occorrenza d'uso oltre l'import. Severità: **minore**.

### 9. Due cache DB CREA indipendenti — CONFERMATO, minore

`nutritionDataProvider.js:13-27` (`foodDatabase`, module-level) e `dataPackLoader.js:8-21` (`_italianFoodsFull`, module-level) fanno entrambi `fetch('/data/italian_foods_full.json')` con cache separata. Confermato: nessuna condivisione di cache tra i due moduli. Severità: **minore** (spreco di banda se entrambi i moduli sono usati nella stessa sessione, non un bug funzionale).

### 10. `searchInDataPacks` ritorna il primo match, non il migliore — CONFERMATO, minore

`dataPackLoader.js:86-111`: il `for (const food of italianFoods)` ritorna al primo `fuzzyMatch` positivo (riga 91-92, `return` immediato dentro il loop), senza accumulare/ordinare per punteggio come fa invece `searchFoods` in `nutritionDataProvider.js`. Confermato esattamente. Severità: **minore**.

### 11. `estimateLinearWeightChange` — convenzione di segno ambigua nel commento — CONFERMATO, minore

`weightLossEstimator.js:110-119`: il commento a riga 111 dice "deficit positivo → perdita (negativo in termini di peso)" ma il codice (riga 112-113) fa `kgChange = (avgDeficitPerDay * days) / KCAL_PER_KG_FAT` senza inversione di segno — un `avgDeficitPerDay` positivo produce un `kgChange` positivo (aumento), non una perdita. Confermato: il commento è fuorviante rispetto al comportamento reale del codice. Severità: **minore** (funzione pura, comportamento deterministico e documentato nel JSDoc sopra la riga incriminata come "negativo = perdita", quindi il contratto reale è chiaro leggendo l'intera funzione — solo il commento inline a riga 111 è impreciso).

### 12. `categorizeDailyDeficit` — `userWeight` non usato — CONFERMATO, minore

`statisticsEngine.js:124`: `function categorizeDailyDeficit(dailyCalorie, tdee, userWeight = 70)` — confermato che `userWeight` non compare in nessun calcolo del corpo (righe 125-159 usano solo `dailyCalorie`/`tdee`). Severità: **minore**.

### 13. Target proteine/fibre incoerenti tra moduli — CONFERMATO, minore

`nutritionEngine.PROTEIN_G_PER_KG` (righe 19-23): `1.4-2.0` g/kg per obiettivo. `statisticsEngine.getProteinAdequacy` (righe 167-168): soglie fisse `1.6-2.2` g/kg indipendenti dall'obiettivo. Confermato: un utente con obiettivo "mantenere" (target ufficiale 1.4 g/kg) riceverebbe da `getProteinAdequacy`/`coachingRules` una valutazione "insufficiente" anche centrando esattamente il proprio target personale. Severità: **minore** (incoerenza di design, non crash).

### 14. Due approcci anti-double-counting passi — CONFERMATO, medio

`activityEnergyEngine.aggregateDailyExercise` (righe 419-484) usa `shouldExcludeStepsCalories` (approccio A, esclusione totale, riga 464). `computeDayActivityKcal` (righe 388-405) usa `netStepsRecordForCardio` (approccio B, netting granulare, righe 393-394). Confermato: entrambe le funzioni sono esportate e coesistono nello stesso modulo. Ho verificato che `bodyCompTracker.js:184` e `trendProjection.js:90` chiamano **`aggregateDailyExercise`** (quindi approccio A), non `computeDayActivityKcal`. Non ho verificato l'uso in `app.js` (fuori dal perimetro assegnato) per sapere se le viste dashboard usano A o B. Severità: **medio** (calcoli potenzialmente incoerenti tra viste diverse per lo stesso giorno, se `app.js` usa `computeDayActivityKcal` altrove).

### 15. `getTrendWindowData` — soglia "giorni insufficienti" basata su conteggio pasti — CONFERMATO, medio

`trendProjection.js:60`: `if (mealsWindow.length < CONFIG.minDaysForProjection)` dove `CONFIG.minDaysForProjection = 14` (riga 19) è dichiaratamente una soglia di **giorni**, ma `mealsWindow.length` è un conteggio di **pasti**. Confermato: con una media realistica di 3+ pasti/giorno, il guardrail si soddisfa dopo ~5 giorni invece dei 14 dichiarati nel messaggio (riga 63: `Servono almeno ${CONFIG.minDaysForProjection} giorni di log alimentari`). Il fallback `daysAvailable: Math.ceil(mealsWindow.length/3)` (riga 64) conferma consapevolezza della differenza pasti/giorni, ma non è applicato al confronto principale. Severità: **medio** (un utente con pochi giorni di dati reali riceve proiezioni a 30/60/90 giorni presentate come valide quando i dati sottostanti sono insufficienti per essere statisticamente significativi).

## Problemi nuovi trovati (Parte 2)

### N1. `getProteinAdequacy` — divisione per `userWeightKg` non protetta da zero/undefined — nuovo, medio

`statisticsEngine.js:162-184`: `getProteinAdequacy(totalProteine, userWeightKg)` calcola `ratioGram = totalProteine / userWeightKg` (riga 169) e `minTarget = userWeightKg * 1.6` / `maxTarget = userWeightKg * 2.2` (righe 167-168) senza alcun controllo su `userWeightKg` essere `0`, `undefined` o `null`. Ho verificato i due call site: `coachingRules.js:19` e `coachingRules.js:117` chiamano entrambi `getProteinAdequacy(avgProteine, userProfile.pesoKg)` passando il valore **grezzo** del profilo, senza fallback (`|| 70` come fatto invece altrove, es. `nutritionEngine.js:48`). Se `userProfile.pesoKg` è `undefined` (profilo incompleto) o `0`, `minTarget`/`maxTarget` diventano `NaN`/`0`, `ratioGram` diventa `NaN` o `Infinity`. Con `totalProteine < NaN` che valuta sempre `false` in JS, il controllo `if (totalProteine < minTarget)` (riga 172) e `else if (totalProteine > maxTarget)` (riga 175) falliscono entrambi silenziosamente, facendo cadere l'esecuzione nel ramo `else` finale (riga 178-180: `status = 'adeguato'`) con un messaggio contenente `NaN g/kg` — un profilo incompleto genererebbe quindi un falso "proteine adeguate" invece di un errore o un messaggio di dati mancanti. File:line: `js/statisticsEngine.js:167-169`, chiamanti `js/coachingRules.js:19,117`. Severità: **medio** (stato applicativo plausibile — utente non ha ancora compilato il peso nel profilo — con esito silenzioso e fuorviante, non un crash).

### N2. `estimateBodyCompositionChange` — divisione per `tdee` non protetta da zero — nuovo, minore

`bodyCompositionModel.js:277`: `const deficitPercentTDEE = avgDeficitPerDay / tdee;` nessun guard contro `tdee === 0`. Se `tdee` fosse `0` (scenario limite: `getTheoreticalTDEE` con `pesoKg`/`altezzaCm` entrambi a `0` e formula Mifflin-St Jeor risultante in BMR negativo poi arrotondato/troncato a un TDEE di 0, oppure un `tdee` esterno malformato passato manualmente) si otterrebbe `Infinity`/`NaN`, che si propaga a `getDeficitScore` (che fa solo confronti su `Math.abs`, quindi `NaN <= x` è sempre `false`, portando al ramo finale `aggressivaScore: 0.9` per `NaN`, dato che l'ultimo `else` è raggiunto). In pratica `getTheoreticalTDEE`/`calculateEnergyTargets` hanno entrambi fallback `|| 70`/`|| 170` sui parametri di peso/altezza che rendono un TDEE realmente pari a 0 quasi impossibile nella pratica applicativa corrente, quindi il rischio reale è basso. Severità: **minore**.

### N3. `micronutrientEngine.getRda` — chiave micro inesistente ritorna `null` propagato senza guardia esplicita in `analyzeMicronutrients` — nuovo, minore

`micronutrientEngine.js:83`: `const rda = getRda(key, sex);` — `key` proviene sempre da `Object.keys(MICRO_META)` (riga 82) quindi in pratica non può essere una chiave sconosciuta, ma la funzione `getRda` esportata (riga 36-40) è chiamabile con qualunque `key` esterna e ritorna `null` silenziosamente se non trovata, senza loggare un warning — un consumer esterno di `getRda` (fuori dal perimetro dei file esaminati) potrebbe ricevere `null` senza sapere se è un valore RDA legittimamente nullo o una chiave sbagliata. Severità: **minore** (nessun impatto nel codice esaminato, solo API poco difensiva).

### N4. `computeShoppingList`/`computeCookableRecipes` in `fridgeView.js` — `normName` non allineata, confermato più a fondo con edge case aggiuntivo

Oltre a quanto già segnalato dal documento originale (punto 17), ho notato che `computeCookableRecipes` (righe 281-310) e `planRecipeDecrements` (righe 338-353) condividono lo stesso pattern di match `byId`/`byName`, ma **`planRecipeDecrements` non filtra `quantity<=0`** per costruire `byId`/`byName` (righe 341-344: nessun check su `it.quantity`), mentre `computeCookableRecipes` sì (riga 286: `if ((it.quantity ?? 0) <= 0) continue;`). Questo significa che `planRecipeDecrements`, se chiamato con un `fridgeItems` contenente un item già a quantità 0 (es. race condition tra due azioni ravvicinate, o un item non ancora ripulito dall'inventario), potrebbe comunque pianificare un decremento su di esso, producendo `next = Math.max(0, 0 - grams) = 0` (righe 364, in `applyRecipeToFridge`) — innocuo nel risultato finale (l'item finisce comunque eliminato, stesso esito) ma un'incoerenza di guardia tra le due funzioni "gemelle". File:line: `js/ui/fridgeView.js:341-344` vs `js/ui/fridgeView.js:286`. Severità: **minore** (nessun impatto pratico visibile, solo incoerenza di stile difensivo tra funzioni che condividono la stessa logica di matching).

---

# Riepilogo conteggi

- **Critico:** 2 (bug `totaleCarboidrati`/`totaleCarbo` in statisticsEngine; bug splice-before-read in `trackFoodUsage`)
- **Medio:** 8 (fallback localStorage incoerente; `saveFridgeItem` falso successo; formule BMR/età duplicate; `estimateAdaptiveTDEE` mai collegata; due approcci anti-double-counting passi; `getTrendWindowData` soglia pasti/giorni; `getProteinAdequacy` divisione non protetta — nuovo; `validateExportData` non valida `fridge` — minore/medio borderline, classificato medio per il rischio di import silenzioso malformato)
- **Minore:** ~19 (tutti gli altri punti elencati sopra: `update*Session` incoerenza throw, store legacy mai rimosso, `loadDailyWeights` ordina prima di normalizzare, race condition strutturale `_deleteMealsBySource`, `getDbStats` sequenziale, `saveDailyWeight`/`saveDailySteps` senza rete di sicurezza id — nuovo; duplicazioni costanti ACTIVITY_FACTORS/MULTIPLIERS, MET_WEIGHTS collisione, codice morto nutritionEngine, import inutilizzato cacheRemoteFood, due cache CREA, searchInDataPacks primo-match, commento fuorviante estimateLinearWeightChange, userWeight non usato, target proteine/fibre incoerenti, `estimateBodyCompositionChange` divisione per tdee non protetta — nuovo, `getRda` null silenzioso — nuovo, `planRecipeDecrements` guardia quantity incoerente — nuovo, ESTIMATION_CATEGORIES/CONDIMENTI_EXTRAS dead code, magic number non commentati, disclaimer non omogenei)

Il documento originale (`02-engines.md`) si è rivelato molto accurato: nessuna claim verificabile è risultata falsa. I tre bug esplicitamente segnalati dal richiedente (splice-before-read in `trackFoodUsage`, mismatch `totaleCarboidrati`/`totaleCarbo`, due approcci di anti-double-counting passi) sono **tutti confermati reali** con evidenza diretta dal codice sorgente.

