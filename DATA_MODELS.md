# 📊 Modelli Dati — Conta Calorie v5

Questo documento descrive gli schemi per i dati di attività, passi e preferenze utente.

---

## 1. Strength Sessions (Allenamenti Pesi)

### Store: `strengthSessions` (DB v5)

```javascript
{
  id: "uuid",
  date: "YYYY-MM-DD",
  startTime?: "HH:MM",          // opzionale
  endTime?: "HH:MM",            // opzionale
  title: "Push day",            // es. Push day, Leg day, Full body
  category: "gym",              // enum: gym, home_strength, calisthenics, cross_training
  durationMin: 60,              // durata totale in minuti
  intensityRpe: 7,              // 1-10, Rating Perceived Exertion
  muscleGroups: ["chest", "shoulders", "triceps"],  // array di stringhe
  volumeScore?: 120,            // score sintetico opzionale (es. sum(sets×reps×weight))
  exercises?: [                 // array OPZIONALE per modalità dettagliata
    {
      name: "Bench Press",
      sets: 4,
      reps: 8,
      loadKg: 100,
      rpe?: 8,
      muscleGroup: "chest"
    }
  ],
  notes?: "Buona sessione",
  createdAt: "ISO-8601",
  updatedAt: "ISO-8601",
  source: "manual"              // manual | imported | estimated
}
```

**Regole:**
- `date` è obbligatorio (chiave di ricerca)
- Se `exercises` non è presente, usare `durationMin + intensityRpe + category` per stimare kcal
- Se `exercises` è presente, calcolare `volumeScore` e usarlo per stima più accurata
- `muscleGroups` è un array per supportare multipli gruppi (es. upper body = chest + back + shoulders)

---

## 2. Cardio Sessions (Allenamenti Cardio)

### Store: `cardioSessions` (DB v5 - esteso)

```javascript
{
  id: "uuid",
  data: "YYYY-MM-DD",           // campo originale mantenuto per compatibilità
  startTime?: "HH:MM",
  endTime?: "HH:MM",
  cardioType: "running",        // walking | running | cycling | rowing | hiit | swimming | hiking | other
  durationMin: 30,
  distanceKm?: 5.2,             // opzionale
  avgHeartRate?: 150,           // opzionale, bpm
  intensityLevel: "moderate",   // low | medium | high
  intensityRpe?: 6,             // opzionale, 1-10
  caloriesBurnedManual?: 300,   // opzionale, se l'utente lo sa
  notes?: "Trail run felice",
  createdAt?: "ISO-8601",       // nuovo campo
  updatedAt?: "ISO-8601",       // nuovo campo
  source: "manual"              // manual | imported | estimated
}
```

**Regole:**
- Mantieni `data` per compatibilità con codice esistente
- Se `cardioType === 'treadmill'`, usa `velocitaKmh` e `inclinazioneGrade` (campi già presenti nel form)
- Se `distanceKm` è assente, stimarlo da `durationMin + cardioType + intensityLevel`
- Se `caloriesBurnedManual` è presente e > 0, considerare se usarlo o usare stima MET (configurabile)

---

## 3. Daily Steps

### Store: `dailySteps` (DB v5 - NEW)

```javascript
{
  id: "YYYY-MM-DD",            // chiave: è anche la data
  date: "YYYY-MM-DD",
  steps: 12500,
  source: "manual",            // manual | google_fit | health_connect | apple_health | imported_file
  distanceKm?: 8.4,            // opzionale, calcolato da stride length se non presente
  activeMinutes?: 120,         // opzionale, minuti di movimento moderato/vigoroso
  caloriesEstimated?: 450,     // CAUTELA: usare solo se source da provider affidabile
  syncMeta?: {                 // metadata del sync esterno
    provider: "google_fit",    // which provider originally gave this data
    externalId?: "gfit_12345",
    importedAt: "ISO-8601",
    rawPayloadVersion?: "2024-01"
  },
  updatedAt: "ISO-8601"
}
```

**Regole critiche:**
- `date` è la chiave (uno step record per giorno)
- `source` traccia da dove vengono i dati (importante per anti-double-count)
- `caloriesEstimated` NON deve essere usato automaticamente nel TDEE senza logica anti-double-count
- Se esiste già un record per la data e viene importato uno nuovo:
  - Chiedere merge/sostituzione/mantieni manuale
  - Tracciare il merge in `syncMeta`

---

## 4. Activity Preferences (Configurazione Utente)

### Store: `activityPreferences` (DB v5 - NEW)

```javascript
{
  id: "current",               // sempre "current", singleton
  
  // === Modello Energetico ===
  energyModel: "tdee_plus_extras",  // tdee_plus_extras | tdee_with_factor
  // tdee_plus_extras: TDEE base (sedentario) + attività extra
  // tdee_with_factor: TDEE calcolato con activity factor scelto
  
  activityFactor?: 1.375,      // se energyModel === "tdee_with_factor"
                                // 1.2=sedentario, 1.375=moderato, 1.55=attivo, 1.725=molto attivo
  
  // === Double Counting Prevention ===
  avoidDoubleCountingWalking: true,  // se importo passi da app, non contare anche cardio "walking"
  
  // === Eat Back Calories ===
  eatBackMode: "partial",      // none | partial | full
  eatBackRatio: 0.3,           // se partial, percentuale da mangiare indietro (0.0-1.0)
  
  // === Steps Configuration ===
  includeStepsInTdee: true,    // includi passi nel calcolo TDEE?
  stepGoal: 10000,             // step goal giornaliero
  preferredStepSource: "connected",  // manual | connected (da app)
  strideLengthCm?: 78,         // lunghezza passo per conversion step→distance (auto-calcolata se non presente)
  
  // === Activity Inclusion ===
  includeStrengthInExpenditure: true,
  includeCardioInExpenditure: true,
  
  // === Optional Overrides ===
  bodyWeightKgOverride?: 75,   // se diverso da userProfile.pesoKg (es. per DEXA vs bilancia)
  
  // === Metadata ===
  createdAt: "ISO-8601",
  updatedAt: "ISO-8601"
}
```

**Regole:**
- Singleton: sempre id="current"
- Se non presente, usare valori default sensati:
  ```javascript
  {
    energyModel: "tdee_plus_extras",
    avoidDoubleCountingWalking: true,
    eatBackMode: "partial",
    eatBackRatio: 0.3,
    includeStepsInTdee: true,
    stepGoal: 10000,
    includeStrengthInExpenditure: true,
    includeCardioInExpenditure: true
  }
  ```

---

## 5. Daily Weights (Esteso)

### Store: `dailyWeights` (DB v2 - unchanged, ma riferimento)

```javascript
{
  id: "YYYY-MM-DD",
  data: "YYYY-MM-DD",
  pesoKg: 75.5,
  // Opzionali per integrazione futura:
  bodyFatPercentage?: 22.5,
  source?: "manual"             // manual | imported | estimated
}
```

---

## 6. Cardio/Weights Sessions — Campi Legacy vs New

### Backward Compatibility

Campi ORIGINALI (NON toccare):
- `weightsSessions`: `id`, `data`, `tipoSplit`, `durataMin`, `intensita`
- `cardioSessions`: `id`, `data`, `tipo`, `durataMin`, `intensita`, `velocitaKmh`, `inclinazioneGrade`

Nuovi campi (added safe, v5 migration):
- Entrambi: `createdAt`, `updatedAt`, `source`, `notes`, `startTime`, `endTime`, `muscleGroups` (strength), `cardioType`, `distanceKm`, etc.

**Regola d'oro:** Se un campo legacy non esiste, NON crashare. Usare default sensati.

---

## 7. Flussi di Sincronizzazione Passi

### Import da Google Fit / Health Connect / Apple Health

```javascript
// Da provider → app
fetchedStepsData = {
  date: "2026-05-20",
  steps: 12500,
  distanceKm: 8.4,
  activeMinutes: 120,
  source: "google_fit"  // o health_connect, apple_health
}

// → salva in dailySteps con syncMeta
await saveDailySteps({
  date: fetchedStepsData.date,
  steps: fetchedStepsData.steps,
  distanceKm: fetchedStepsData.distanceKm,
  activeMinutes: fetchedStepsData.activeMinutes,
  source: fetchedStepsData.source,
  syncMeta: {
    provider: fetchedStepsData.source,
    externalId: response.dataSourceId,
    importedAt: new Date().toISOString()
  }
})
```

### Import da File (CSV/JSON)

```javascript
// User uploads CSV: Date | Steps | Distance
// Parse → map → salva come dailySteps con source="imported_file"
await saveDailySteps({
  date: parsedRow.date,
  steps: parsedRow.steps,
  distanceKm: parsedRow.distance || null,
  source: "imported_file",
  syncMeta: {
    provider: "imported_file",
    importedAt: new Date().toISOString(),
    rawPayloadVersion: "csv_v1"
  }
})
```

---

## 8. Calcoli e Derivati (Non persistiti, calcolati al volo)

### Per ogni giorno:

```javascript
// Carica per data
const strengthSessions = await loadStrengthSessionsByDateRange(date, date)
const cardioSessions = await loadCardioSessionsByDateRange(date, date)
const stepsRecord = await loadDailyStepsByDate(date)
const prefs = await loadActivityPreferences()

// Calcola kcal spesi (vedi activityEnergyEngine.js)
const strengthKcal = strengthSessions.reduce((sum, s) => sum + estimateWeightsCalories(s, userProfile), 0)
const cardioKcal = cardioSessions.reduce((sum, s) => sum + estimateCardioCalories(s, userProfile), 0)
const stepsKcal = stepsRecord ? estimateStepsCalories(stepsRecord, userProfile, prefs) : 0

// Anti-double-count: se source passi è app E c'è cardio "walking" lo stesso giorno
const finalStepsKcal = shouldExcludeStepsCalories(stepsRecord, cardioSessions, prefs) ? 0 : stepsKcal

// Totale attività + eat-back
const totalActivityKcal = strengthKcal + cardioKcal + finalStepsKcal
const eatenBackCalories = applyEatBackCalories(totalActivityKcal, prefs)

// Budget finale
const tdeeBase = ... (da nutritionEngine)
const adjustedBudget = tdeeBase + eatenBackCalories  // o con activity factor se configured
```

---

## 9. Migrazione (DB v4 → v5)

**Cosa cambia:**
- Tre nuovi stores: `dailySteps`, `activityPreferences`, `strengthSessions`
- Campi nuovi in `weightsSessions` e `cardioSessions` (backward compatible)

**Cosa rimane uguale:**
- Tutti i dati esistenti restano intatti
- Campi legacy non vengono modificati

**On-the-fly defaults:**
- Se `loadActivityPreferences()` ritorna null, app usa defaults sensati
- Se un `weightsSessions` non ha `createdAt`, usare `data` come fallback timestamp

---

## Checklist Implementazione

- [ ] DB_VERSION = 5 ✅
- [ ] STORE_NAMES include dailySteps, activityPreferences, strengthSessions ✅
- [ ] Storage methods implementati ✅
- [ ] Import in app.js updated ✅
- [ ] Nessun dato perso in migrazione ✅
- [ ] Defaults sensati per nuovi records
- [ ] Anti-double-count logic in activityEnergyEngine (FASE 4)
- [ ] Eat-back logic in activityEnergyEngine (FASE 4)
- [ ] UI modali (FASE 3)
