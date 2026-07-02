/*
  Proiezione automatica del peso e composizione corporea.
  Basa le stime sul trend effettivo degli ultimi N giorni.

  ⚠️ DISCLAIMER: Modello semplificato per ordine di grandezza.
     NON tiene conto di variazioni ormonali, cicli mestruali, malattie,
     ritenzione idrica, stress, sonno, ecc.
*/

import { estimateBodyCompositionChange } from './bodyCompositionModel.js';
import { estimateAdaptiveTDEE, getTheoreticalTDEE } from './weightLossEstimator.js';
import { aggregateDailyExercise } from './activityEnergyEngine.js';

// ============================================================================
// CONFIGURAZIONE
// ============================================================================

const CONFIG = {
  minDaysForProjection: 14,        // almeno 14 giorni di dati
  defaultWindowDays: 30,            // usa ultimi 30 giorni come trend
  kcalPerKgFat: 7700,               // lineare: 7700 kcal = 1 kg
  minWeightsForTrend: 2             // almeno 2 pesate nel periodo
};

// ============================================================================
// 15.1 RACCOLTA DATI TREND
// ============================================================================

/**
 * Raccoglie i dati degli ultimi N giorni per la proiezione.
 * @param {number} windowDays - giorni da considerare (default 30)
 * @param {Array} allMeals - tutti i pasti
 * @param {Array} allWeightsSessions - tutte le sessioni pesi
 * @param {Array} allCardioSessions - tutte le sessioni cardio
 * @param {Array} dailyWeights - tutte le pesate
 * @param {Object} userProfile - profilo utente
 * @returns {Object} trend data con flag insufficientData
 */
export function getTrendWindowData(windowDays = CONFIG.defaultWindowDays, allMeals, allWeightsSessions, allCardioSessions, dailyWeights, userProfile) {
  // Calcola la data di inizio della finestra
  const now = new Date();
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);

  // Filtra dati nel range
  const mealsWindow = allMeals.filter(meal => new Date(meal.data) >= windowStart);
  const weightsWindow = allWeightsSessions.filter(s => new Date(s.data) >= windowStart);
  const cardioWindow = allCardioSessions.filter(s => new Date(s.data) >= windowStart);
  const weightsWindow_days = dailyWeights.filter(w => new Date(w.data) >= windowStart);

  // Verifica dati sufficienti
  if (weightsWindow_days.length < CONFIG.minWeightsForTrend) {
    return {
      insufficientData: true,
      reason: `Servono almeno ${CONFIG.minWeightsForTrend} misurazioni di peso.`,
      daysAvailable: weightsWindow_days.length
    };
  }

  // Giorni unici con almeno un pasto loggato — la soglia sotto è dichiarata in
  // giorni, quindi va confrontata con questo, non col conteggio grezzo dei pasti
  // (un utente con 3 pasti/giorno soddisfaceva la soglia "14 giorni" dopo ~5).
  const uniqueDays = new Set(mealsWindow.map(m => m.data));
  const daysLogged = uniqueDays.size || 1;

  if (uniqueDays.size < CONFIG.minDaysForProjection) {
    return {
      insufficientData: true,
      reason: `Servono almeno ${CONFIG.minDaysForProjection} giorni di log alimentari.`,
      daysAvailable: uniqueDays.size
    };
  }

  // Calcola medie
  const totalIntake = mealsWindow.reduce((sum, meal) => sum + (meal.macroCalcolate?.kcal || 0), 0);
  const totalProtein = mealsWindow.reduce((sum, meal) => sum + (meal.macroCalcolate?.proteine || 0), 0);

  const avgIntakeKcal = Math.round(totalIntake / daysLogged);
  const avgProteinPerKg = userProfile.pesoKg > 0 ? (totalProtein / daysLogged) / userProfile.pesoKg : 1.0;

  // Calcola esercizio medio (per giorno loggato)
  let totalExerciseKcal = 0;
  let weightsSessionsPerWeek = 0;
  let totalRPE = 0;
  let rpeCount = 0;

  uniqueDays.forEach(dateStr => {
    const dayWeights = weightsWindow.filter(s => s.data === dateStr);
    const dayCardio = cardioWindow.filter(s => s.data === dateStr);

    if (dayWeights.length > 0 || dayCardio.length > 0) {
      const dayExercise = aggregateDailyExercise(dayWeights, dayCardio, userProfile);
      totalExerciseKcal += dayExercise.totalExerciseCalories || 0;

      // Calcola RPE medio da pesi
      dayWeights.forEach(s => {
        if (typeof s.intensita === 'number') {
          totalRPE += s.intensita;
          rpeCount++;
        } else {
          const rpeMap = { leggero: 3, moderato: 6, intenso: 9 };
          totalRPE += rpeMap[s.intensita] || 5;
          rpeCount++;
        }
      });
    }
  });

  const avgExerciseKcal = Math.round(totalExerciseKcal / daysLogged);
  const avgRPE = rpeCount > 0 ? totalRPE / rpeCount : 5;
  weightsSessionsPerWeek = (weightsWindow.length / (windowDays / 7));

  // Peso: media degli ultimi 3-7 giorni
  const recentWeights = weightsWindow_days.sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 7);
  const currentWeightAvg = recentWeights.length > 0
    ? recentWeights.reduce((sum, w) => sum + w.pesoKg, 0) / recentWeights.length
    : userProfile.pesoKg;

  return {
    insufficientData: false,
    windowDays,
    daysLogged,
    avgIntakeKcal,
    avgExerciseKcal,
    avgProteinPerKg: parseFloat(avgProteinPerKg.toFixed(2)),
    weightsSessionsPerWeek: parseFloat(weightsSessionsPerWeek.toFixed(1)),
    avgRPE: parseFloat(avgRPE.toFixed(1)),
    currentWeight: parseFloat(currentWeightAvg.toFixed(1)),
    weightHistoryWindow: weightsWindow_days,
    mealsWindow,
    weightsWindow,
    cardioWindow
  };
}

// ============================================================================
// 15.2-15.4 PROIEZIONE
// ============================================================================

/**
 * Proietta peso e composizione corporea per N giorni.
 * @param {number} daysAhead - 30, 60, 90
 * @param {Object} trendData - da getTrendWindowData()
 * @param {Object} userProfile - profilo utente
 * @param {number} tdee - TDEE da usare (teorico o adattivo)
 * @param {boolean} usedAdaptiveTDEE - flag se TDEE è adattivo
 * @returns {Object} proiezione
 */
export function projectWeightAndComposition(daysAhead, trendData, userProfile, tdee, usedAdaptiveTDEE = false) {
  if (trendData.insufficientData) {
    return {
      error: trendData.reason,
      daysAvailable: trendData.daysAvailable
    };
  }

  const currentWeight = trendData.currentWeight;
  const plannedIntake = trendData.avgIntakeKcal;
  const plannedExercise = trendData.avgExerciseKcal;
  const plannedProteinPerKg = trendData.avgProteinPerKg;
  const plannedWeightsPerWeek = trendData.weightsSessionsPerWeek;
  const plannedAvgRPE = trendData.avgRPE;

  // Calcola deficit/surplus previsto
  const predictedTotalExpenditure = tdee + plannedExercise;
  const predictedDeficitPerDay = plannedIntake - predictedTotalExpenditure; // negativo = deficit

  // Usa modello di composizione corporea
  const bodyCompChange = estimateBodyCompositionChange(
    predictedDeficitPerDay,
    daysAhead,
    tdee,
    {
      weightsSessionsPerWeek: plannedWeightsPerWeek,
      avgRPE: plannedAvgRPE
    },
    {
      proteinPerKg: plannedProteinPerKg
    }
  );

  // Peso futuro
  const futureWeight = currentWeight + bodyCompChange.fatKgChange + bodyCompChange.leanKgChange;

  return {
    daysAhead,
    currentWeight: parseFloat(currentWeight.toFixed(1)),
    futureWeight: parseFloat(futureWeight.toFixed(1)),
    linearKgChange: bodyCompChange.linearKgChange,
    fatKgChange: bodyCompChange.fatKgChange,
    leanKgChange: bodyCompChange.leanKgChange,
    fatPercent: bodyCompChange.fatPercent,
    leanPercent: bodyCompChange.leanPercent,
    // Contesto
    adaptiveTDEEUsed: tdee,
    isAdaptiveTDEETrusted: usedAdaptiveTDEE,
    avgIntakeKcal: plannedIntake,
    avgExerciseKcal: plannedExercise,
    avgProteinPerKg: plannedProteinPerKg,
    deficitScore: bodyCompChange.deficitScore,
    resistanceTrainingScore: bodyCompChange.resistanceTrainingScore,
    proteinScore: bodyCompChange.proteinScore,
    predictedDeficitPerDay: parseFloat(predictedDeficitPerDay.toFixed(0))
  };
}

// ============================================================================
// WRAPPER: calcola proiezioni per 30/60/90 giorni in una chiamata
// ============================================================================

/**
 * Calcola tutte le proiezioni (30/60/90 giorni).
 * @param {Object} trendData - da getTrendWindowData()
 * @param {Object} userProfile - profilo utente
 * @param {number} tdee - TDEE
 * @param {boolean} usedAdaptiveTDEE
 * @returns {Object} { projections30, projections60, projections90, insufficientData }
 */
export function calculateAllProjections(trendData, userProfile, tdee, usedAdaptiveTDEE) {
  if (trendData.insufficientData) {
    return {
      insufficientData: true,
      reason: trendData.reason,
      daysAvailable: trendData.daysAvailable
    };
  }

  return {
    insufficientData: false,
    projection30: projectWeightAndComposition(30, trendData, userProfile, tdee, usedAdaptiveTDEE),
    projection60: projectWeightAndComposition(60, trendData, userProfile, tdee, usedAdaptiveTDEE),
    projection90: projectWeightAndComposition(90, trendData, userProfile, tdee, usedAdaptiveTDEE),
    trendSummary: {
      windowDays: trendData.windowDays,
      daysLogged: trendData.daysLogged,
      avgIntake: trendData.avgIntakeKcal,
      avgExercise: trendData.avgExerciseKcal,
      avgProteinPerKg: trendData.avgProteinPerKg
    }
  };
}
