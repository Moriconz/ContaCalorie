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

// Conversione MET → kcal/min
// Formula: kcal/min = MET × 3.5 × pesoKg / 200
function metToKcalPerMin(met, pesoKg) {
  return (met * 3.5 * pesoKg) / 200;
}

// === ALLENAMENTO PESI ===

/**
 * Stima calorie da sessione di pesi.
 * @param {Object} session - { durataMin, intensita, tipoSplit }
 * @param {Object} userProfile - { pesoKg }
 * @returns {number} calorie stimate
 */
export function estimateWeightsCalories(session, userProfile) {
  const { durataMin, intensita, tipoSplit = 'push' } = session;
  const { pesoKg = 70 } = userProfile;

  // Converte RPE 1-10 o string intensità → chiave MET
  let intensityKey = intensita;
  if (typeof intensita === 'number') {
    // RPE 1-4 = leggero, 5-7 = moderato, 8-10 = intenso
    if (intensita <= 4) intensityKey = 'leggero';
    else if (intensita <= 7) intensityKey = 'moderato';
    else intensityKey = 'intenso';
  }

  const baseMet = MET_WEIGHTS[intensityKey] || MET_WEIGHTS.moderato;
  const bonus = SPLIT_BONUS_MET[tipoSplit] || 0;
  const met = baseMet + bonus;

  const kcalPerMin = metToKcalPerMin(met, pesoKg);
  return Math.round(kcalPerMin * durataMin);
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
 * Stima calorie da sessione cardio (qualsiasi tipo).
 * @param {Object} session - { tipo, durataMin, intensita, velocitaKmh, inclinazioneGrade }
 * @param {Object} userProfile - { pesoKg }
 * @returns {number} calorie stimate
 */
export function estimateCardioCalories(session, userProfile) {
  const { tipo, durataMin, intensita, velocitaKmh = 0, inclinazioneGrade = 0 } = session;
  const { pesoKg = 70 } = userProfile;

  if (tipo === 'treadmill') {
    // Usa equazioni ACSM
    const speedMPerMin = velocitaKmh * 16.67;  // km/h → m/min
    const gradeDecimal = inclinazioneGrade / 100;
    const vo2 = calculateVO2_Treadmill(speedMPerMin, gradeDecimal);
    const kcalPerMin = vo2ToKcalPerMin(vo2, pesoKg);
    return Math.round(kcalPerMin * durataMin);
  } else {
    // Usa MET da Compendium
    let intensityKey = intensita;
    if (typeof intensita === 'number') {
      // RPE: converte a intensità
      if (intensita <= 4) intensityKey = 'lento';
      else if (intensita <= 7) intensityKey = 'moderato';
      else intensityKey = 'intenso';
    }

    const cardioMets = MET_CARDIO[tipo];
    if (!cardioMets) return 0;

    const met = cardioMets[intensityKey] || cardioMets.moderato;
    const kcalPerMin = metToKcalPerMin(met, pesoKg);
    return Math.round(kcalPerMin * durataMin);
  }
}

// === AGGREGAZIONE GIORNALIERA ===

/**
 * Aggrega le calorie da esercizio per un giorno.
 * @param {Array} weightsSessions - sessioni pesi della giornata
 * @param {Array} cardioSessions - sessioni cardio della giornata
 * @param {Object} userProfile - profilo utente
 * @returns {Object} { weightsCalories, cardioCalories, totalExerciseCalories, sessions }
 */
export function aggregateDailyExercise(weightsSessions = [], cardioSessions = [], userProfile) {
  const sessions = [];
  let weightsCalories = 0;
  let cardioCalories = 0;

  // Calcola calorie da pesi
  weightsSessions.forEach(session => {
    const kcal = estimateWeightsCalories(session, userProfile);
    weightsCalories += kcal;
    sessions.push({
      type: 'weights',
      id: session.id,
      durataMin: session.durataMin,
      calories: kcal,
      label: `${session.tipoSplit} (${session.durataMin}min)`
    });
  });

  // Calcola calorie da cardio
  cardioSessions.forEach(session => {
    const kcal = estimateCardioCalories(session, userProfile);
    cardioCalories += kcal;
    const label = session.tipo === 'treadmill'
      ? `Treadmill ${session.velocitaKmh}km/h (${session.durataMin}min)`
      : `${session.tipo} (${session.durataMin}min)`;
    sessions.push({
      type: 'cardio',
      id: session.id,
      durataMin: session.durataMin,
      calories: kcal,
      label
    });
  });

  return {
    weightsCalories,
    cardioCalories,
    totalExerciseCalories: weightsCalories + cardioCalories,
    sessions
  };
}
