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
