/*
  Statistiche e analisi sui dati di registrazione.
  Calcola riepiloghi settimanali/mensili, trend peso, deficit categorizzazione.
*/

import { aggregateDailySummary } from './nutritionEngine.js';

export function getWeeklyStats(meals, nutritionTargets, endDate = new Date()) {
  /**
   * Calcola statistiche settimanali (ultimi 7 giorni)
   * Ritorna array di 7 giorni con: data, label, totaleCalorie, macros, status, deficit
   */
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);

    const dayMeals = meals.filter(m => m.data === dateKey);
    const summary = aggregateDailySummary(dayMeals, nutritionTargets);

    days.push({
      data: dateKey,
      label: d.toLocaleDateString('it-IT', { weekday: 'short' }).charAt(0).toUpperCase() +
             d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(1),
      totaleCalorie: summary.totaleCalorie,
      proteine: Math.round(summary.totaleProteine),
      carboidrati: Math.round(summary.totaleCarbo),
      grassi: Math.round(summary.totaleGrassi),
      deficitCalorie: nutritionTargets.tdee - summary.totaleCalorie,
      status: summary.confrontoConTarget.calorie.percent >= 90 && summary.confrontoConTarget.calorie.percent <= 110 ? 'ok' :
              summary.confrontoConTarget.calorie.percent < 90 ? 'basso' : 'alto'
    });
  }
  return days;
}

export function getMonthlyStats(meals, nutritionTargets, year = new Date().getFullYear(), month = new Date().getMonth()) {
  /**
   * Calcola statistiche mensili
   * Ritorna { meseLabel, giorni: [{data, giorno, calorie, ...}], medieSettimanali: [...], totaleDaysTracked }
   */
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const meseLabel = firstDay.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  const giorni = [];
  let totalCalorie = 0, totalDays = 0;

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    const dateKey = d.toISOString().slice(0, 10);

    const dayMeals = meals.filter(m => m.data === dateKey);
    const summary = aggregateDailySummary(dayMeals, nutritionTargets);

    if (summary.totaleCalorie > 0) {
      totalCalorie += summary.totaleCalorie;
      totalDays++;
    }

    giorni.push({
      data: dateKey,
      giorno: i,
      calorie: summary.totaleCalorie,
      proteine: Math.round(summary.totaleProteine),
      carboidrati: Math.round(summary.totaleCarbo),
      grassi: Math.round(summary.totaleGrassi),
      deficitCalorie: nutritionTargets.tdee - summary.totaleCalorie,
      status: summary.confrontoConTarget.calorie.percent >= 90 && summary.confrontoConTarget.calorie.percent <= 110 ? '✓' :
              summary.confrontoConTarget.calorie.percent < 90 ? '↓' : '↑'
    });
  }

  return {
    meseLabel,
    giorni,
    mediaGiornaliera: totalDays > 0 ? Math.round(totalCalorie / totalDays) : 0,
    totaleDaysTracked: totalDays
  };
}

export function getWeightTrend(weightEntries, days = 30) {
  /**
   * Analizza trend di peso negli ultimi N giorni
   * Ritorna { trend (up/down/stable), deltaKg, velocita (kg/settimana), dataPoints: [...] }
   */
  if (!weightEntries || weightEntries.length === 0) {
    return { trend: 'no-data', deltaKg: 0, velocita: 0, dataPoints: [] };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffDateKey = cutoffDate.toISOString().slice(0, 10);

  const recent = weightEntries.filter(w => w.data >= cutoffDateKey).sort((a, b) => new Date(a.data) - new Date(b.data));

  if (recent.length < 2) {
    return { trend: 'insufficient-data', deltaKg: 0, velocita: 0, dataPoints: recent };
  }

  const firstWeight = recent[0].pesoKg;
  const lastWeight = recent[recent.length - 1].pesoKg;
  const deltaKg = lastWeight - firstWeight;

  const daysDiff = (new Date(recent[recent.length - 1].data) - new Date(recent[0].data)) / (1000 * 60 * 60 * 24);
  const weeksElapsed = Math.max(daysDiff / 7, 1);
  const velocita = deltaKg / weeksElapsed;

  let trend = 'stable';
  if (Math.abs(deltaKg) > 0.5) {
    trend = deltaKg > 0 ? 'up' : 'down';
  }

  return {
    trend,
    deltaKg: Math.round(deltaKg * 10) / 10,
    velocita: Math.round(velocita * 100) / 100,
    dataPoints: recent
  };
}

export function categorizeDailyDeficit(dailyCalorie, tdee, userWeight = 70) {
  /**
   * Categorizza il deficit/surplus calorico
   * Ritorna { category, message, rateKgPerWeek }
   */
  const deficit = tdee - dailyCalorie;
  const rateKgPerWeek = (deficit * 7) / 7700; // 7700 kcal = 1 kg di grasso

  let category, message;

  if (dailyCalorie < tdee - 1000) {
    category = 'molto-aggressivo';
    message = '↓ Deficit molto aggressivo (>1000 kcal)';
  } else if (dailyCalorie < tdee - 750) {
    category = 'aggressivo';
    message = '↓ Deficit aggressivo (750-1000 kcal)';
  } else if (dailyCalorie < tdee - 500) {
    category = 'moderato';
    message = '↓ Deficit moderato (500-750 kcal)';
  } else if (dailyCalorie <= tdee + 100) {
    category = 'mantenimento';
    message = '= Mantenimento/leggero deficit';
  } else if (dailyCalorie <= tdee + 250) {
    category = 'surplus-lieve';
    message = '↑ Leggero surplus (100-250 kcal)';
  } else {
    category = 'surplus-importante';
    message = '↑ Surplus importante (>250 kcal)';
  }

  return {
    category,
    message,
    rateKgPerWeek: Math.round(rateKgPerWeek * 100) / 100,
    estimatedMonthLoss: Math.round(rateKgPerWeek * 4.3 * 10) / 10
  };
}

export function getProteinAdequacy(totalProteine, userWeightKg) {
  /**
   * Valuta adeguatezza proteiche
   * Consigliato: 1.6-2.2 g/kg per composizione corporea
   */
  // Guardia: senza peso valido (profilo incompleto) i calcoli darebbero NaN,
  // che i confronti sotto avrebbero fatto cadere silenziosamente su "adeguato".
  const safeWeightKg = userWeightKg || 70;
  const minTarget = safeWeightKg * 1.6;
  const maxTarget = safeWeightKg * 2.2;
  const ratioGram = totalProteine / safeWeightKg;

  let status, message;
  if (totalProteine < minTarget) {
    status = 'insufficiente';
    message = `Proteine insufficienti: ${Math.round(totalProteine)}g (target: ${Math.round(minTarget)}-${Math.round(maxTarget)}g)`;
  } else if (totalProteine > maxTarget) {
    status = 'eccesso';
    message = `Proteine in eccesso: ${Math.round(totalProteine)}g (target: ${Math.round(minTarget)}-${Math.round(maxTarget)}g)`;
  } else {
    status = 'adeguato';
    message = `Proteine adeguate: ${Math.round(totalProteine)}g (${Math.round(ratioGram * 10) / 10} g/kg)`;
  }

  return { status, message, gPerKg: Math.round(ratioGram * 10) / 10 };
}

export function getFibreAdequacy(totalFibre) {
  /**
   * Valuta adeguatezza fibre
   * Consigliato: 25-35 g/giorno
   */
  const minTarget = 25;
  const maxTarget = 35;

  let status, message;
  if (totalFibre < minTarget) {
    status = 'insufficiente';
    message = `Fibre insufficienti: ${Math.round(totalFibre)}g (target: ${minTarget}-${maxTarget}g)`;
  } else if (totalFibre > maxTarget * 1.2) {
    status = 'eccesso';
    message = `Fibre in eccesso: ${Math.round(totalFibre)}g`;
  } else {
    status = 'adeguato';
    message = `Fibre adeguate: ${Math.round(totalFibre)}g`;
  }

  return { status, message };
}
