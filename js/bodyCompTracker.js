/*
  Tracker di composizione corporea.
  Gestisce baseline BF%, ricalibrazioni, e calcoli dei delta fat/lean nel tempo.

  ⚠️ DISCLAIMER: Stime basate su modello energetico semplificato.
     NON sono misure cliniche.
*/

import { estimateBodyCompositionChange } from './bodyCompositionModel.js';
import { estimateAdaptiveTDEE, getTheoreticalTDEE } from './weightLossEstimator.js';
import { aggregateDailyExercise } from './activityEnergyEngine.js';

// ============================================================================
// CONFIGURAZIONE
// ============================================================================

const CONFIG = {
  windowDaysForDelta: 7,           // finestra di calcolo delta (7 giorni)
  maxDriftKg: 1.5,                 // scarto massimo accettato tra peso stimato e misurato
  minDaysForBaseline: 7,           // almeno 7 giorni di dati prima di usare baseline
  kcalPerKgFat: 7700
};

// ============================================================================
// 16.1 STRUTTURA BASELINE
// ============================================================================

/**
 * Crea un nuovo baseline di composizione corporea.
 * @param {string} dateBaseline - data YYYY-MM-DD
 * @param {number} weightBaselineKg - peso in kg
 * @param {number} bodyFatPercentBaseline - BF% (0–100)
 * @returns {Object} baseline calibrato
 */
export function createBodyCompBaseline(dateBaseline, weightBaselineKg, bodyFatPercentBaseline) {
  const bfPercent = Math.max(5, Math.min(95, bodyFatPercentBaseline)); // clamp 5–95%
  const fatKgBaseline = weightBaselineKg * (bfPercent / 100);
  const leanKgBaseline = weightBaselineKg - fatKgBaseline;

  return {
    dateBaseline,
    weightBaselineKg: parseFloat(weightBaselineKg.toFixed(2)),
    bodyFatPercentBaseline: parseFloat(bfPercent.toFixed(1)),
    fatKgBaseline: parseFloat(fatKgBaseline.toFixed(2)),
    leanKgBaseline: parseFloat(leanKgBaseline.toFixed(2))
  };
}

// ============================================================================
// 16.2 GESTIONE RICALIBRAZIONI
// ============================================================================

/**
 * Ottiene il baseline più recente valido per una data.
 * @param {Array} baselines - array di baseline (ordinato per dateBaseline)
 * @param {string} referenceDate - data YYYY-MM-DD
 * @returns {Object} baseline più recente ≤ referenceDate, o null
 */
export function getCurrentBaseline(baselines, referenceDate) {
  if (!baselines || baselines.length === 0) {
    return null;
  }

  const refDate = new Date(referenceDate);
  const validBaselines = baselines.filter(b => new Date(b.dateBaseline) <= refDate);

  if (validBaselines.length === 0) {
    return null;
  }

  // Ordina per data descrescente e prendi il primo
  return validBaselines.sort((a, b) => new Date(b.dateBaseline) - new Date(a.dateBaseline))[0];
}

// ============================================================================
// 16.3 CALCOLO DELTA FAT/LEAN DAL BASELINE
// ============================================================================

/**
 * Calcola i delta fat/lean accumulati dal baseline al giorno specificato.
 * @param {Object} baseline - baseline di partenza
 * @param {string} todayDate - data target YYYY-MM-DD
 * @param {Array} allMeals - tutti i pasti
 * @param {Array} allWeightsSessions - tutte sessioni pesi
 * @param {Array} allCardioSessions - tutte sessioni cardio
 * @param {Array} dailyWeights - tutte pesate
 * @param {Object} userProfile - profilo utente
 * @returns {Object} { totalFatDelta, totalLeanDelta, daysProcessed, warning }
 */
export function computeBodyCompDeltasSinceBaseline(
  baseline,
  todayDate,
  allMeals,
  allWeightsSessions,
  allCardioSessions,
  dailyWeights,
  userProfile
) {
  if (!baseline) {
    return {
      totalFatDelta: 0,
      totalLeanDelta: 0,
      daysProcessed: 0,
      warning: 'Nessun baseline disponibile'
    };
  }

  const startDate = new Date(baseline.dateBaseline);
  const endDate = new Date(todayDate);

  if (endDate < startDate) {
    return {
      totalFatDelta: 0,
      totalLeanDelta: 0,
      daysProcessed: 0,
      warning: 'Data target precedente al baseline'
    };
  }

  // Filtra dati dal baseline in poi
  const mealsInRange = allMeals.filter(m => {
    const mDate = new Date(m.data);
    return mDate >= startDate && mDate <= endDate;
  });

  const weightsInRange = allWeightsSessions.filter(s => {
    const sDate = new Date(s.data);
    return sDate >= startDate && sDate <= endDate;
  });

  const cardioInRange = allCardioSessions.filter(s => {
    const sDate = new Date(s.data);
    return sDate >= startDate && sDate <= endDate;
  });

  const weightsDataInRange = dailyWeights.filter(w => {
    const wDate = new Date(w.data);
    return wDate >= startDate && wDate <= endDate;
  });

  // Dividi in finestre di CONFIG.windowDaysForDelta
  let totalFatDelta = 0;
  let totalLeanDelta = 0;
  let daysProcessed = 0;

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const windowEnd = new Date(currentDate);
    windowEnd.setDate(windowEnd.getDate() + CONFIG.windowDaysForDelta);
    const windowEndCapped = windowEnd < endDate ? windowEnd : endDate;

    const dateStr = currentDate.toISOString().slice(0, 10);
    const windowEndStr = windowEndCapped.toISOString().slice(0, 10);

    // Dati della finestra
    const windowMeals = mealsInRange.filter(m => m.data >= dateStr && m.data <= windowEndStr);
    const windowWeights = weightsInRange.filter(s => s.data >= dateStr && s.data <= windowEndStr);
    const windowCardio = cardioInRange.filter(s => s.data >= dateStr && s.data <= windowEndStr);

    if (windowMeals.length === 0) {
      // Finestra senza dati, salta
      currentDate.setDate(currentDate.getDate() + CONFIG.windowDaysForDelta);
      continue;
    }

    // Calcola medie della finestra
    const uniqueDays = new Set(windowMeals.map(m => m.data));
    const windowDaysCount = uniqueDays.size;
    daysProcessed += windowDaysCount;

    const totalIntake = windowMeals.reduce((sum, m) => sum + (m.macroCalcolate?.kcal || 0), 0);
    const totalProtein = windowMeals.reduce((sum, m) => sum + (m.macroCalcolate?.proteine || 0), 0);
    const avgIntakePerDay = Math.round(totalIntake / windowDaysCount);
    const avgProteinPerKg = userProfile.pesoKg > 0 ? (totalProtein / windowDaysCount) / userProfile.pesoKg : 1.0;

    // Calcola esercizio e stats
    let totalExerciseKcal = 0;
    let weightsCount = 0;
    let totalRPE = 0;

    uniqueDays.forEach(dayStr => {
      const dayWeights = windowWeights.filter(s => s.data === dayStr);
      const dayCardio = windowCardio.filter(s => s.data === dayStr);
      const dayExercise = aggregateDailyExercise(dayWeights, dayCardio, userProfile);
      totalExerciseKcal += dayExercise.totalExerciseCalories || 0;
      weightsCount += dayWeights.length;
      dayWeights.forEach(s => {
        if (typeof s.intensita === 'number') {
          totalRPE += s.intensita;
        } else {
          const rpeMap = { leggero: 3, moderato: 6, intenso: 9 };
          totalRPE += rpeMap[s.intensita] || 5;
        }
      });
    });

    const avgExercisePerDay = Math.round(totalExerciseKcal / windowDaysCount);
    const avgRPE = weightsCount > 0 ? totalRPE / weightsCount : 5;
    const weightsPerWeek = (weightsCount / (windowDaysCount / 7));

    // Usa TDEE teorico (per stabilità)
    const tdee = getTheoreticalTDEE(userProfile);
    const avgDeficitPerDay = avgIntakePerDay - (tdee + avgExercisePerDay);

    // Stima composizione per questa finestra
    const bodyCompChange = estimateBodyCompositionChange(
      avgDeficitPerDay,
      windowDaysCount,
      tdee,
      { weightsSessionsPerWeek: weightsPerWeek, avgRPE },
      { proteinPerKg: avgProteinPerKg }
    );

    totalFatDelta += bodyCompChange.fatKgChange;
    totalLeanDelta += bodyCompChange.leanKgChange;

    currentDate.setDate(currentDate.getDate() + CONFIG.windowDaysForDelta);
  }

  return {
    totalFatDelta: parseFloat(totalFatDelta.toFixed(2)),
    totalLeanDelta: parseFloat(totalLeanDelta.toFixed(2)),
    daysProcessed,
    warning: null
  };
}

// ============================================================================
// 16.3 STIMA GIORNALIERA DI COMPOSIZIONE
// ============================================================================

/**
 * Stima la composizione corporea odierna.
 * @param {Object} baseline - baseline calibrato
 * @param {number} weightTodayKg - peso odierno misurato
 * @param {Object} deltas - { totalFatDelta, totalLeanDelta } da computeBodyCompDeltasSinceBaseline
 * @returns {Object} { fatKgToday, leanKgToday, bfPercentToday, weightEstimatedFromModel, drift }
 */
export function estimateCompositionToday(baseline, weightTodayKg, deltas) {
  if (!baseline) {
    return {
      error: 'Nessun baseline disponibile'
    };
  }

  const fatKgToday = baseline.fatKgBaseline + deltas.totalFatDelta;
  const leanKgToday = baseline.leanKgBaseline + deltas.totalLeanDelta;
  const weightEstimated = fatKgToday + leanKgToday;

  const bfPercentToday = weightTodayKg > 0 ? (fatKgToday / weightTodayKg) * 100 : 0;

  const drift = Math.abs(weightEstimated - weightTodayKg);

  return {
    fatKgToday: parseFloat(fatKgToday.toFixed(2)),
    leanKgToday: parseFloat(leanKgToday.toFixed(2)),
    bfPercentToday: parseFloat(Math.max(2, Math.min(98, bfPercentToday)).toFixed(1)),
    weightEstimatedFromModel: parseFloat(weightEstimated.toFixed(2)),
    weightMeasuredToday: parseFloat(weightTodayKg.toFixed(2)),
    drift: parseFloat(drift.toFixed(2)),
    driftWarning: drift > CONFIG.maxDriftKg
  };
}

// ============================================================================
// 16.4 MODALITÀ SENZA BASELINE (DELTA ONLY)
// ============================================================================

/**
 * Calcola delta fat/lean da una data arbitraria (senza baseline assoluto).
 * @param {string} startDate - data inizio YYYY-MM-DD
 * @param {string} endDate - data fine YYYY-MM-DD
 * @param {Array} allMeals - tutti pasti
 * @param {Array} allWeightsSessions
 * @param {Array} allCardioSessions
 * @param {Array} dailyWeights
 * @param {Object} userProfile
 * @returns {Object} { deltaFatKg, deltaLeanKg, daysAnalyzed }
 */
export function computeDeltasInRange(
  startDate,
  endDate,
  allMeals,
  allWeightsSessions,
  allCardioSessions,
  userProfile
) {
  // Usa stesso metodo di computeBodyCompDeltasSinceBaseline ma con fake baseline
  const fakeBaseline = {
    dateBaseline: startDate,
    fatKgBaseline: 0,
    leanKgBaseline: 0
  };

  const result = computeBodyCompDeltasSinceBaseline(
    fakeBaseline,
    endDate,
    allMeals,
    allWeightsSessions,
    allCardioSessions,
    [], // no daily weights per delta mode
    userProfile
  );

  return {
    deltaFatKg: result.totalFatDelta,
    deltaLeanKg: result.totalLeanDelta,
    daysAnalyzed: result.daysProcessed
  };
}
