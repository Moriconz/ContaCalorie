/*
  Modulo di stima perdita peso: TDEE teorico/adattivo, deficit, proiezioni.
  Tutte le funzioni sono pure.

  Fonti:
  - BMR Mifflin-St Jeor: Mifflin et al., 1990
  - KCAL per kg grasso: Hall et al., 2012, Lancet (range 7000-8000, usiamo 7700)
  - Adaptive metabolic models: Peters et al., 2016 (perdere peso cambia il metabolismo)
*/

// === CONFIGURAZIONE ===
export const KCAL_PER_KG_FAT = 7700;  // kcal per 1 kg di grasso corporeo

export const ACTIVITY_MULTIPLIERS = {
  sedentario: 1.2,     // poco esercizio
  leggero: 1.375,      // 1-3 gg/sett esercizio
  moderato: 1.55,      // 3-5 gg/sett
  intenso: 1.725       // 6-7 gg/sett o alto volume
};

// === TDEE TEORICO ===

/**
 * Calcola il TDEE teorico usando formula BMR × fattore attività.
 * BMR formula: Mifflin-St Jeor.
 * @param {Object} userProfile - { pesoKg, altezzaCm, dataNascita, sesso, attività }
 * @returns {number} TDEE in kcal
 */
export function getTheoreticalTDEE(userProfile) {
  const { pesoKg = 70, altezzaCm = 170, dataNascita, sesso = 'non specificato', attività = 'moderato' } = userProfile;

  // Calcola età
  let age = 30;
  if (dataNascita) {
    age = new Date().getFullYear() - new Date(dataNascita).getFullYear();
  }

  // BMR Mifflin-St Jeor
  let bmr;
  if (sesso === 'F') {
    bmr = 10 * pesoKg + 6.25 * altezzaCm - 5 * age - 161;
  } else if (sesso === 'M') {
    bmr = 10 * pesoKg + 6.25 * altezzaCm - 5 * age + 5;
  } else {
    // sesso 'non specificato'
    bmr = 10 * pesoKg + 6.25 * altezzaCm - 5 * age;
  }

  const multiplier = ACTIVITY_MULTIPLIERS[attività] || ACTIVITY_MULTIPLIERS.moderato;
  return Math.round(bmr * multiplier);
}

// === BILANCIO ENERGETICO GIORNALIERO ===

/**
 * Calcola il bilancio energetico netto per un giorno.
 * @param {number} intakeKcal - calorie assunte
 * @param {Object} exerciseData - risultato di aggregateDailyExercise()
 * @param {number} tdee - TDEE usato (teorico o adattivo)
 * @returns {Object} { intakeKcal, tdee, exerciseData, totalExpenditure, netDeficitOrSurplus }
 */
export function getDailyEnergyBalance(intakeKcal, exerciseData = {}, tdee) {
  const totalExerciseCalories = exerciseData.totalExerciseCalories || 0;
  const totalExpenditure = tdee + totalExerciseCalories;
  const netDeficitOrSurplus = intakeKcal - totalExpenditure;  // negativo = deficit

  return {
    intakeKcal,
    tdee,
    exerciseData,
    totalExpenditure,
    netDeficitOrSurplus
  };
}

// === MEDIE SU PERIODI ===

/**
 * Calcola medie su un range di giorni.
 * @param {Array} dailyBalances - array di getDailyEnergyBalance() risultati
 * @returns {Object} { avgIntake, avgExpenditure, avgNet, days }
 */
export function getEnergyBalanceSummary(dailyBalances = []) {
  if (dailyBalances.length === 0) {
    return { avgIntake: 0, avgExpenditure: 0, avgNet: 0, days: 0 };
  }

  const totalIntake = dailyBalances.reduce((sum, d) => sum + d.intakeKcal, 0);
  const totalExpenditure = dailyBalances.reduce((sum, d) => sum + d.totalExpenditure, 0);
  const totalNet = dailyBalances.reduce((sum, d) => sum + d.netDeficitOrSurplus, 0);

  const days = dailyBalances.length;

  return {
    avgIntake: Math.round(totalIntake / days),
    avgExpenditure: Math.round(totalExpenditure / days),
    avgNet: Math.round(totalNet / days),
    days
  };
}

// === STIMA PESO PERSO (MODELLO LINEARE) ===

/**
 * Stima perdita peso usando il modello lineare 7700 kcal ≈ 1 kg.
 * @param {number} avgDeficitPerDay - deficit medio giornaliero (negativo = perdita)
 * @param {number} days - numero di giorni
 * @returns {Object} { kgChange, grams }
 */
export function estimateLinearWeightChange(avgDeficitPerDay, days) {
  // deficit positivo → perdita (negativo in termini di peso)
  const totalDeficit = avgDeficitPerDay * days;
  const kgChange = totalDeficit / KCAL_PER_KG_FAT;
  return {
    kgChange: parseFloat(kgChange.toFixed(2)),
    grams: Math.round(kgChange * 1000),
    label: 'Stima teorica (modello lineare)'
  };
}

// === TDEE ADATTIVO DA DATI REALI ===

/**
 * Stima il TDEE effettivo dai dati reali di peso e intake/exercise.
 * Modello semplificato: assume che il delta peso osservato rispecchi il deficit calorico totale.
 *
 * @param {Array} weightHistory - [ { data, pesoKg }, ... ] ordinato per data
 * @param {Array} dailyBalances - [ getDailyEnergyBalance() risultati ]
 * @returns {Object} { adaptiveTDEE, reliability, daysUsed, vsTheoretical }
 */
export function estimateAdaptiveTDEE(weightHistory = [], dailyBalances = []) {
  // Richiede almeno 7 giorni di dati
  if (weightHistory.length < 7 || dailyBalances.length < 7) {
    return {
      adaptiveTDEE: null,
      reliability: 'insufficient',
      daysUsed: Math.min(weightHistory.length, dailyBalances.length),
      vsTheoretical: null
    };
  }

  // Peso medio dei primi/ultimi 3 giorni (smussa il rumore della bilancia)
  const weightSorted = [...weightHistory].sort((a, b) => new Date(a.data) - new Date(b.data));
  const pesoFinale = weightSorted.slice(-3).reduce((sum, w) => sum + w.pesoKg, 0) / 3;
  const pesoIniziale = weightSorted.slice(0, 3).reduce((sum, w) => sum + w.pesoKg, 0) / 3;
  const deltaKg = pesoFinale - pesoIniziale;  // negativo = perdita

  const daysUsed = dailyBalances.length;

  // Variazione energetica giornaliera implicita dal peso osservato (7700 kcal/kg)
  const deltaKcalPerDay = (deltaKg * KCAL_PER_KG_FAT) / daysUsed;

  // Medie osservate
  const avgIntake = dailyBalances.reduce((s, d) => s + (d.intakeKcal || 0), 0) / daysUsed;
  const avgExercise = dailyBalances.reduce((s, d) => s + (d.exerciseData?.totalExerciseCalories || 0), 0) / daysUsed;

  // Definizione: deltaKcalPerDay = avgIntake - TDEE - avgExercise
  // → TDEE adattivo (spesa di mantenimento, esclusa l'attività) che spiega i dati reali
  const tdeeAdaptive = Math.round(avgIntake - avgExercise - deltaKcalPerDay);

  // Affidabilità in base ai giorni di dati
  let reliability = 'low';
  if (daysUsed >= 28) reliability = 'high';
  else if (daysUsed >= 14) reliability = 'medium';

  return {
    adaptiveTDEE: tdeeAdaptive,
    reliability,
    daysUsed,
    vsTheoretical: null  // confronto col teorico calcolato esternamente
  };
}

// === PROIEZIONE VERSO OBIETTIVO ===

/**
 * Stima il tempo necessario per raggiungere un peso obiettivo.
 * @param {number} currentWeightKg - peso attuale
 * @param {number} goalWeightKg - peso obiettivo
 * @param {number} avgIntakePlanned - media kcal/giorno prevista (es. 2000)
 * @param {number} avgExercisePlanned - media kcal esercizio/giorno prevista (es. 500)
 * @param {number} tdee - TDEE usato (teorico o adattivo)
 * @returns {Object} { weeks, kgPerWeek, days, warning }
 */
export function estimateTimeToGoal(currentWeightKg, goalWeightKg, avgIntakePlanned, avgExercisePlanned, tdee) {
  const deltaKg = currentWeightKg - goalWeightKg;  // positivo = perdita

  if (deltaKg <= 0) {
    return {
      weeks: 0,
      kgPerWeek: 0,
      days: 0,
      warning: 'Peso attuale >= peso obiettivo'
    };
  }

  // Deficit previsto
  const predictedDeficit = (tdee + avgExercisePlanned) - avgIntakePlanned;  // positivo = deficit

  if (predictedDeficit <= 0) {
    return {
      weeks: Infinity,
      kgPerWeek: 0,
      days: Infinity,
      warning: 'Intake >= spesa: non perderai peso'
    };
  }

  // Giorni necessari
  const totalKcalDeficit = deltaKg * KCAL_PER_KG_FAT;
  const days = Math.round(totalKcalDeficit / predictedDeficit);
  const weeks = (days / 7).toFixed(1);
  const kgPerWeek = (predictedDeficit * 7 / KCAL_PER_KG_FAT).toFixed(2);

  // Warning se deficit troppo aggressivo
  let warning = null;
  if (predictedDeficit > 500) {
    warning = `⚠️ Deficit ${predictedDeficit} kcal/giorno è aggressivo. Max consigliato ~500 kcal/giorno`;
  }

  return {
    weeks: parseFloat(weeks),
    kgPerWeek: parseFloat(kgPerWeek),
    days,
    warning
  };
}
