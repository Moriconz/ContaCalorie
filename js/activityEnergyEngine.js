/*
  Modulo di calcolo calorie per attività fisica (pesi + cardio).
  Usa MET dal Compendium of Physical Activities (2022) ed equazioni ACSM per treadmill.
  Tutte le funzioni sono pure (zero side-effects).

  Fonti:
  - Compendium of Physical Activities: Ainsworth et al., Med Sci Sports Exerc, 2022
  - ACSM Treadmill Equations: American College of Sports Medicine
  - Conversione MET→kcal: Roza & Shizgal, 1978
*/

// === CONFIGURAZIONE MET (Compendium 2022) ===
export const MET_WEIGHTS = {
  leggero: 3.0,     // resistance training, light effort
  moderato: 4.5,    // resistance training, moderate effort
  intenso: 6.0      // resistance training, vigorous effort
};

// Bonus MET per gruppi muscolari grandi
export const SPLIT_BONUS_MET = {
  push: 0,
  pull: 0,
  legs: 0.5,        // gambe coinvolgono massa muscolare maggiore
  lower: 0.5,
  upper: 0,
  full_body: 1.0    // coinvolge tutto il corpo
};

export const MET_CARDIO = {
  treadmill:       null,    // usa ACSM equations
  corsa_outdoor:   { lento: 7.0, moderato: 9.5, intenso: 12.0 },
  camminata:       { lento: 2.5, moderato: 3.5, intenso: 4.5 },
  bike:            { lento: 4.0, moderato: 6.8, intenso: 9.0 },
  ellittica:       { lento: 4.0, moderato: 6.0, intenso: 8.0 },
  altro:           { lento: 4.0, moderato: 6.0, intenso: 8.0 }
};

// MET tables per DB v5 cardioType (con 3 livelli: low/medium/high)
export const MET_CARDIO_V5 = {
  running:        { low: 7.0, medium: 9.5, high: 12.0 },
  walking:        { low: 2.5, medium: 3.5, high: 4.5 },
  cycling:        { low: 4.0, medium: 6.8, high: 9.0 },
  rowing:         { low: 4.0, medium: 7.0, high: 10.0 },
  hiit:           { low: 7.0, medium: 9.0, high: 12.0 },
  swimming:       { low: 5.0, medium: 7.0, high: 9.0 },
  hiking:         { low: 4.0, medium: 5.3, high: 7.0 },
  treadmill:      null,     // usa ACSM equations
  elliptical:     { low: 4.0, medium: 6.0, high: 8.0 },
  stair_climber:  { low: 6.0, medium: 8.0, high: 10.0 },
  other:          { low: 4.0, medium: 6.0, high: 8.0 }
};

// Bonus MET per muscleGroups (array, DB v5)
export const MUSCLE_GROUP_BONUS = {
  legs: 0.5,
  glutes: 0.5,
  hamstrings: 0.3,
  calves: 0.2,
  core: 0.1
};

// Conversione MET → kcal/min
// Formula: kcal/min = MET × 3.5 × pesoKg / 200
function metToKcalPerMin(met, pesoKg) {
  return (met * 3.5 * pesoKg) / 200;
}

// === BACKWARD COMPATIBILITY HELPERS ===

// Legge durata da DB v5 (durationMin) o legacy (durataMin)
function getDuration(session) {
  return session.durationMin ?? session.durataMin ?? 0;
}

// Converte intensità pesi → chiave MET ('leggero'|'moderato'|'intenso')
// Supporta sia RPE 1-10 (v5) che stringhe (legacy)
function getWeightIntensityKey(session) {
  const rpe = session.intensityRpe ?? session.intensita;
  if (typeof rpe === 'number') {
    if (rpe <= 4) return 'leggero';
    if (rpe <= 7) return 'moderato';
    return 'intenso';
  }
  return rpe ?? 'moderato';
}

// Converte intensità cardio legacy → chiave MET ('lento'|'moderato'|'intenso')
function getLegacyIntensityKey(session) {
  const val = session.intensita;
  if (typeof val === 'number') {
    if (val <= 4) return 'lento';
    if (val <= 7) return 'moderato';
    return 'intenso';
  }
  return val ?? 'moderato';
}

// Converte intensità cardio v5 → ('low'|'medium'|'high')
// Supporta sia intensityLevel (string) che intensityRpe (number)
function getV5IntensityKey(session) {
  if (session.intensityLevel) return session.intensityLevel;
  const rpe = session.intensityRpe;
  if (typeof rpe === 'number') {
    if (rpe <= 4) return 'low';
    if (rpe <= 7) return 'medium';
    return 'high';
  }
  return 'medium';
}

// === ALLENAMENTO PESI ===

/**
 * Stima calorie da sessione di pesi.
 * Supporta sia DB v5 (durationMin, intensityRpe, muscleGroups[])
 * che legacy (durataMin, intensita, tipoSplit).
 * @param {Object} session - { durationMin|durataMin, intensityRpe|intensita, muscleGroups|tipoSplit }
 * @param {Object} userProfile - { pesoKg }
 * @returns {number} calorie stimate
 */
export function estimateWeightsCalories(session, userProfile) {
  const duration = getDuration(session);
  const { pesoKg = 70 } = userProfile;

  if (duration <= 0) return 0;

  const intensityKey = getWeightIntensityKey(session);
  const baseMet = MET_WEIGHTS[intensityKey] || MET_WEIGHTS.moderato;

  // Bonus: per DB v5 usa muscleGroups (array), per legacy usa tipoSplit
  let bonus = 0;
  if (Array.isArray(session.muscleGroups)) {
    bonus = session.muscleGroups.reduce((sum, g) => sum + (MUSCLE_GROUP_BONUS[g] || 0), 0);
  } else {
    bonus = SPLIT_BONUS_MET[session.tipoSplit] || 0;
  }

  const met = baseMet + bonus;
  const kcalPerMin = metToKcalPerMin(met, pesoKg);
  return Math.round(kcalPerMin * duration);
}

// === ALLENAMENTO CARDIO - TREADMILL (ACSM equations) ===

/**
 * Calcola VO2 per treadmill usando equazioni ACSM.
 * @param {number} speedMPerMin - velocità in m/min
 * @param {number} gradeDecimal - inclinazione in decimale (es. 0.05 = 5%)
 * @returns {number} VO2 in ml/kg/min
 */
function calculateVO2_Treadmill(speedMPerMin, gradeDecimal) {
  // Soglia camminata/corsa: ~100 m/min ≈ 6 km/h
  const walkingThreshold = 100;

  if (speedMPerMin <= walkingThreshold) {
    // Walking equation: VO2 = 0.1×speed + 1.8×speed×grade + 3.5
    return 0.1 * speedMPerMin + 1.8 * speedMPerMin * gradeDecimal + 3.5;
  } else {
    // Running equation: VO2 = 0.2×speed + 0.9×speed×grade + 3.5
    return 0.2 * speedMPerMin + 0.9 * speedMPerMin * gradeDecimal + 3.5;
  }
}

/**
 * Converte VO2 → kcal/min.
 * Formula: kcal/min = (VO2 × pesoKg / 1000) × 5
 * @param {number} vo2 - VO2 in ml/kg/min
 * @param {number} pesoKg - peso in kg
 * @returns {number} kcal/min
 */
function vo2ToKcalPerMin(vo2, pesoKg) {
  return (vo2 * pesoKg / 1000) * 5;
}

// === ALLENAMENTO CARDIO - ALTRI TIPI ===

/**
 * Stima calorie da sessione cardio.
 * Supporta sia DB v5 (cardioType, intensityLevel, intensityRpe, caloriesBurnedManual)
 * che legacy (tipo, intensita, velocitaKmh, inclinazioneGrade).
 * @param {Object} session - { cardioType|tipo, durationMin|durataMin, intensityLevel|intensita, ... }
 * @param {Object} userProfile - { pesoKg }
 * @returns {number} calorie stimate
 */
export function estimateCardioCalories(session, userProfile) {
  const duration = getDuration(session);
  const { pesoKg = 70 } = userProfile;

  if (duration <= 0) return 0;

  // Se c'è un valore manuale inserito dall'utente, usarlo (prioritario)
  if (session.caloriesBurnedManual && session.caloriesBurnedManual > 0) {
    return Math.round(session.caloriesBurnedManual);
  }

  // Determina tipo attività: preferisci campo v5, fallback a legacy
  const activityType = session.cardioType ?? session.tipo;

  // Treadmill: usa ACSM equations (legacy fields velocitaKmh, inclinazioneGrade)
  if (activityType === 'treadmill') {
    const speedMPerMin = (session.velocitaKmh || 0) * 16.67;  // km/h → m/min
    const gradeDecimal = (session.inclinazioneGrade || 0) / 100;
    const vo2 = calculateVO2_Treadmill(speedMPerMin, gradeDecimal);
    const kcalPerMin = vo2ToKcalPerMin(vo2, pesoKg);
    return Math.round(kcalPerMin * duration);
  }

  // Cerca prima in MET_CARDIO_V5 (nuovi tipi DB v5)
  if (MET_CARDIO_V5[activityType]) {
    const intensityKey = getV5IntensityKey(session);
    const met = MET_CARDIO_V5[activityType][intensityKey] || MET_CARDIO_V5[activityType].medium;
    const kcalPerMin = metToKcalPerMin(met, pesoKg);
    return Math.round(kcalPerMin * duration);
  }

  // Fallback: cerca in MET_CARDIO legacy per compatibilità con vecchi record
  const intensityKey = getLegacyIntensityKey(session);
  const cardioMets = MET_CARDIO[activityType];
  if (!cardioMets) return 0;

  const met = cardioMets[intensityKey] || cardioMets.moderato;
  const kcalPerMin = metToKcalPerMin(met, pesoKg);
  return Math.round(kcalPerMin * duration);
}

// === STIMA CALORIE PASSI ===

/**
 * Stima calorie da numero di passi.
 * Usa activeMinutes se disponibile, altrimenti distanceKm, altrimenti conteggio passi.
 * @param {Object} stepsRecord - { steps, distanceKm, activeMinutes }
 * @param {Object} userProfile - { pesoKg }
 * @param {Object} prefs - activity preferences (non usate qui, ma per future estensioni)
 * @returns {number} calorie stimate
 */
export function estimateStepsCalories(stepsRecord, userProfile, prefs = {}) {
  if (!stepsRecord) return 0;

  const { steps = 0, distanceKm, activeMinutes } = stepsRecord;
  const { pesoKg = 70 } = userProfile;

  if (steps <= 0) return 0;

  // Se ho i minuti attivi (da health provider), usa MET walking moderato (3.5)
  if (activeMinutes && activeMinutes > 0) {
    const met = 3.5;
    const kcalPerMin = metToKcalPerMin(met, pesoKg);
    return Math.round(kcalPerMin * activeMinutes);
  }

  // Se ho distanza, stima da km (~60 kcal per km per 70kg, scalato per peso)
  if (distanceKm && distanceKm > 0) {
    const kcalPerKm = 0.85 * (pesoKg / 70) * 60;
    return Math.round(kcalPerKm * distanceKm);
  }

  // Fallback: stima da conteggio passi (~0.04 kcal per passo, scalato per peso)
  const kcalPerStep = 0.04 * (pesoKg / 70);
  return Math.round(steps * kcalPerStep);
}

// === ANTI-DOUBLE-COUNTING ===

/**
 * Determina se escludere le calorie dai passi (per evitare doppio conteggio con cardio walking).
 * Esclude se:
 * - prefs.avoidDoubleCountingWalking è true
 * - I passi provengono da un provider (non manual)
 * - C'è una sessione cardio walking/hiking lo stesso giorno
 * @param {Object} stepsRecord - { steps, source }
 * @param {Array} cardioSessions - sessioni cardio della giornata
 * @param {Object} prefs - { avoidDoubleCountingWalking }
 * @returns {boolean} true se escludere i passi
 */
export function shouldExcludeStepsCalories(stepsRecord, cardioSessions = [], prefs = {}) {
  if (!prefs.avoidDoubleCountingWalking) return false;
  if (!stepsRecord || !stepsRecord.steps) return false;

  // Se i passi sono inseriti manualmente, non escludere
  if (stepsRecord.source === 'manual') return false;

  // Verifica se c'è una sessione cardio di camminata/trekking
  const walkingCardioTypes = ['walking', 'hiking', 'camminata'];
  const hasWalkingSession = cardioSessions.some(c => {
    const type = c.cardioType ?? c.tipo;
    return walkingCardioTypes.includes(type);
  });

  return hasWalkingSession;
}

// === EAT-BACK CALORIES ===

/**
 * Calcola quante calorie dall'attività ritornare al budget alimentare (eat-back).
 * @param {number} totalActivityKcal - totale calorie bruciate da attività
 * @param {Object} prefs - { eatBackMode, eatBackRatio }
 *   eatBackMode: 'none' | 'partial' | 'full' (default: 'partial')
 *   eatBackRatio: 0.0-1.0 (default: 0.3 = 30% se partial)
 * @returns {number} calorie da mangiare indietro
 */
export function applyEatBackCalories(totalActivityKcal, prefs = {}) {
  const { eatBackMode = 'partial', eatBackRatio = 0.3 } = prefs;

  if (totalActivityKcal <= 0) return 0;

  switch (eatBackMode) {
    case 'none':
      return 0;
    case 'full':
      return Math.round(totalActivityKcal);
    case 'partial':
      const ratio = Math.min(1, Math.max(0, eatBackRatio));
      return Math.round(totalActivityKcal * ratio);
    default:
      return 0;
  }
}

// === ANTI-DOPPIO-CONTEGGIO: CARDIO "A PIEDI" vs PASSI (approccio B) ===

// Tipi di cardio che generano passi conteggiati anche dal contapassi.
// Gli altri (bici, nuoto, vogatore, ellittica) NON sovrappongono i passi.
export const FOOT_BASED_CARDIO = ['walking', 'running', 'hiking', 'treadmill', 'camminata', 'corsa_outdoor'];

// Cadenza media (passi/min) per stimare i passi quando manca la distanza.
const CADENCE_SPM = { walking: 110, camminata: 110, hiking: 105, running: 160, corsa_outdoor: 160, treadmill: 130 };
// Passi per km quando la distanza è disponibile (falcata più lunga in corsa).
const STEPS_PER_KM = { walking: 1400, camminata: 1400, hiking: 1450, running: 1100, corsa_outdoor: 1100, treadmill: 1250 };

function isFootBased(session) {
  return FOOT_BASED_CARDIO.includes(session.cardioType ?? session.tipo);
}

/**
 * Stima quanti passi ha generato una sessione di cardio "a piedi".
 * Usa la distanza se presente, altrimenti durata × cadenza. 0 per cardio non a piedi.
 */
export function estimateCardioSteps(session) {
  if (!session || !isFootBased(session)) return 0;
  const type = session.cardioType ?? session.tipo;
  const duration = getDuration(session);
  const dist = session.distanceKm;
  if (dist && dist > 0) return Math.round(dist * (STEPS_PER_KM[type] || 1300));
  if (duration > 0) return Math.round(duration * (CADENCE_SPM[type] || 120));
  return 0;
}

/**
 * Approccio B: sottrae dal record passi del giorno la quota attribuibile al cardio a piedi
 * (passi, distanza e minuti attivi), così quei passi non vengono conteggiati due volte.
 * I cardio non-a-piedi non toccano i passi.
 * @returns {Object|null} record passi "nettato" (o l'originale se nessun cardio a piedi)
 */
export function netStepsRecordForCardio(stepsRecord, cardioSessions = []) {
  if (!stepsRecord) return stepsRecord;
  const footCardio = cardioSessions.filter(isFootBased);
  if (footCardio.length === 0) return stepsRecord;

  const cardioSteps = footCardio.reduce((s, c) => s + estimateCardioSteps(c), 0);
  const cardioKm = footCardio.reduce((s, c) => s + (c.distanceKm || 0), 0);
  const cardioMin = footCardio.reduce((s, c) => s + getDuration(c), 0);

  return {
    ...stepsRecord,
    steps: Math.max(0, (stepsRecord.steps || 0) - cardioSteps),
    distanceKm: stepsRecord.distanceKm != null ? Math.max(0, stepsRecord.distanceKm - cardioKm) : stepsRecord.distanceKm,
    activeMinutes: stepsRecord.activeMinutes != null ? Math.max(0, stepsRecord.activeMinutes - cardioMin) : stepsRecord.activeMinutes,
    _nettedForCardio: true
  };
}

// === HELPER GIORNALIERO CENTRALIZZATO (usato da dashboard/fisica/settimana) ===

/**
 * Calcola le calorie attività di un singolo giorno dai gruppi di sessioni già filtrate.
 * Centralizza la logica prima duplicata in 4 viste.
 * Applica l'anti-doppio-conteggio (approccio B): i passi generati dal cardio a piedi
 * vengono sottratti dai passi del giorno prima di stimarne le calorie.
 * Disattivabile con prefs.avoidDoubleCountingWalking === false.
 * @param {Array} dayStrength - sessioni pesi del giorno (strengthSessions)
 * @param {Array} dayCardio - sessioni cardio del giorno
 * @param {Object|null} daySteps - record passi del giorno
 * @param {Object} userProfile - { pesoKg }
 * @param {Object} prefs - activity preferences
 * @returns {{strengthKcal:number, cardioKcal:number, stepsKcal:number, stepsExcluded:boolean, activityKcal:number}}
 */
export function computeDayActivityKcal(dayStrength = [], dayCardio = [], daySteps = null, userProfile = {}, prefs = {}) {
  const strengthKcal = dayStrength.reduce((sum, s) => sum + (s.estimatedKcal || estimateWeightsCalories(s, userProfile)), 0);
  const cardioKcal = dayCardio.reduce((sum, c) => sum + (c.estimatedKcal || estimateCardioCalories(c, userProfile)), 0);

  // Approccio B: netta i passi attribuibili al cardio a piedi (default attivo)
  const applyNetting = prefs.avoidDoubleCountingWalking !== false;
  const stepsForCalc = (applyNetting && daySteps) ? netStepsRecordForCardio(daySteps, dayCardio) : daySteps;
  const stepsKcal = stepsForCalc ? estimateStepsCalories(stepsForCalc, userProfile, prefs) : 0;
  const stepsExcluded = !!daySteps && (daySteps.steps || 0) > 0 && (!stepsForCalc || (stepsForCalc.steps || 0) === 0);

  return {
    strengthKcal,
    cardioKcal,
    stepsKcal,
    stepsExcluded,
    activityKcal: strengthKcal + cardioKcal + stepsKcal
  };
}

// === AGGREGAZIONE GIORNALIERA ===

/**
 * Aggrega le calorie da esercizio per un giorno.
 * Supporta pesi, cardio, passi e applica anti-double-counting + eat-back.
 * @param {Array} weightsSessions - sessioni pesi della giornata
 * @param {Array} cardioSessions - sessioni cardio della giornata
 * @param {Object} userProfile - profilo utente
 * @param {Object} stepsRecord - (opzionale) record dei passi del giorno
 * @param {Object} prefs - (opzionale) activity preferences per anti-double-counting e eat-back
 * @returns {Object} { weightsCalories, cardioCalories, stepsCalories, totalExerciseCalories, totalActivityKcal, eatenBackCalories, stepsExcluded, sessions }
 */
export function aggregateDailyExercise(
  weightsSessions = [],
  cardioSessions = [],
  userProfile,
  stepsRecord = null,
  prefs = {}
) {
  const sessions = [];
  let weightsCalories = 0;
  let cardioCalories = 0;

  // Calcola calorie da pesi
  weightsSessions.forEach(session => {
    const kcal = estimateWeightsCalories(session, userProfile);
    weightsCalories += kcal;
    const title = session.title || session.tipoSplit || 'Pesi';
    const duration = getDuration(session);
    sessions.push({
      type: 'weights',
      id: session.id,
      durataMin: duration,
      calories: kcal,
      label: `${title} (${duration}min)`
    });
  });

  // Calcola calorie da cardio
  cardioSessions.forEach(session => {
    const kcal = estimateCardioCalories(session, userProfile);
    cardioCalories += kcal;
    const type = session.cardioType ?? session.tipo;
    const duration = getDuration(session);
    const label = type === 'treadmill'
      ? `Treadmill ${session.velocitaKmh}km/h (${duration}min)`
      : `${type} (${duration}min)`;
    sessions.push({
      type: 'cardio',
      id: session.id,
      durataMin: duration,
      calories: kcal,
      label
    });
  });

  // Calcola calorie da passi con anti-double-counting
  const stepsExcluded = shouldExcludeStepsCalories(stepsRecord, cardioSessions, prefs);
  const stepsCalories = (!stepsExcluded && stepsRecord)
    ? estimateStepsCalories(stepsRecord, userProfile, prefs)
    : 0;

  // Totali
  const totalExerciseCalories = weightsCalories + cardioCalories;
  const totalActivityKcal = weightsCalories + cardioCalories + stepsCalories;
  const eatenBackCalories = applyEatBackCalories(totalActivityKcal, prefs);

  return {
    weightsCalories,
    cardioCalories,
    stepsCalories,
    totalExerciseCalories,
    totalActivityKcal,
    eatenBackCalories,
    stepsExcluded,
    sessions
  };
}
