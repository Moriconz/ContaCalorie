/*
  Sistema di coaching deterministico basato su regole.
  Genera suggerimenti da metriche aggr per ultimi 7-30 giorni.
  NIENTE AI - solo regole logiche.
*/

import { getWeeklyStats, categorizeDailyDeficit, getProteinAdequacy, getFibreAdequacy } from './statisticsEngine.js';

export function generateCoachingInsights(meals, dailyWeights, nutritionTargets, userProfile) {
  /**
   * Genera 2-3 insight basati su regole deterministiche
   * Ritorna array di { title, message, priority (high/medium/low), icon }
   */
  const insights = [];

  // Regola 1: Adeguatezza proteiche
  const last7Days = getWeeklyStats(meals, nutritionTargets);
  const avgProteine = last7Days.reduce((sum, day) => sum + day.proteine, 0) / last7Days.length;
  const proteinStatus = getProteinAdequacy(avgProteine, userProfile.pesoKg);

  if (proteinStatus.status === 'insufficiente') {
    insights.push({
      title: '💪 Aumenta le proteine',
      message: proteinStatus.message + '. Consigliato: uova, pollo, tonno, ricotta, yogurt greco.',
      priority: 'high',
      icon: '💪'
    });
  } else if (proteinStatus.status === 'adeguato') {
    insights.push({
      title: '✅ Proteine in target',
      message: proteinStatus.message + '. Mantieni questo trend.',
      priority: 'low',
      icon: '✅'
    });
  }

  // Regola 2: Trend deficit calorico
  const avgCalorie = last7Days.reduce((sum, day) => sum + day.totaleCalorie, 0) / last7Days.length;
  const deficitData = categorizeDailyDeficit(avgCalorie, nutritionTargets.tdee, userProfile.pesoKg);

  if (deficitData.category === 'molto-aggressivo') {
    insights.push({
      title: '⚠️ Deficit molto aggressivo',
      message: `${deficitData.message}. Stima: ${deficitData.estimatedMonthLoss}kg/mese. Considera di aumentare calorie se senti fatica.`,
      priority: 'high',
      icon: '⚠️'
    });
  } else if (deficitData.category === 'moderato') {
    insights.push({
      title: '💡 Deficit sostenibile',
      message: `${deficitData.message}. Stima: ${deficitData.estimatedMonthLoss}kg/mese. Ritmo buono.`,
      priority: 'medium',
      icon: '💡'
    });
  } else if (deficitData.category === 'mantenimento') {
    insights.push({
      title: 'ℹ️ Sei in mantenimento',
      message: `Calorie intorno al TDEE. Peso stabile.`,
      priority: 'low',
      icon: 'ℹ️'
    });
  } else if (deficitData.category === 'surplus-importante') {
    insights.push({
      title: '📈 Surplus calorico importante',
      message: `${deficitData.message}. Se non ricerchi guadagno muscolare, considera di ridurre.`,
      priority: 'medium',
      icon: '📈'
    });
  }

  // Regola 3: Coerenza tracciamento
  const daysWithData = last7Days.filter(d => d.totaleCalorie > 0).length;
  if (daysWithData < 5) {
    insights.push({
      title: '📝 Traccia più consistentemente',
      message: `Registrate solo ${daysWithData}/7 giorni. Accuratezza migliore = risultati migliori.`,
      priority: 'high',
      icon: '📝'
    });
  } else if (daysWithData === 7) {
    insights.push({
      title: '🏆 Tracking perfetto',
      message: `7 giorni su 7 tracciati. Ottimo!`,
      priority: 'low',
      icon: '🏆'
    });
  }

  // Regola 4: Fibre
  const avgFibre = last7Days.reduce((sum, day) => {
    const dayMeals = meals.filter(m => m.data === day.data);
    return sum + dayMeals.reduce((s, meal) => s + (meal.macroCalcolate?.fibra || 0), 0);
  }, 0) / last7Days.length;

  const fibreStatus = getFibreAdequacy(avgFibre);
  if (fibreStatus.status === 'insufficiente') {
    insights.push({
      title: '🥬 Aumenta le fibre',
      message: fibreStatus.message + '. Consigliato: verdure, cereali integrali, legumi.',
      priority: 'medium',
      icon: '🥬'
    });
  }

  return insights.slice(0, 3); // Ritorna max 3 insight
}

export function evaluateRule(ruleName, meals, dailyWeights, nutritionTargets, userProfile) {
  /**
   * Valuta una singola regola e ritorna { passed, message, metric }
   */
  const last7Days = getWeeklyStats(meals, nutritionTargets);

  switch (ruleName) {
    case 'protein-adequacy': {
      const avgProteine = last7Days.reduce((sum, day) => sum + day.proteine, 0) / last7Days.length;
      const status = getProteinAdequacy(avgProteine, userProfile.pesoKg);
      return {
        passed: status.status === 'adeguato',
        message: status.message,
        metric: `${status.gPerKg} g/kg`
      };
    }

    case 'deficit-moderate': {
      const avgCalorie = last7Days.reduce((sum, day) => sum + day.totaleCalorie, 0) / last7Days.length;
      const deficit = nutritionTargets.tdee - avgCalorie;
      const isModerate = deficit >= 500 && deficit <= 750;
      return {
        passed: isModerate,
        message: isModerate ? 'Deficit moderato' : `Deficit: ${Math.round(deficit)} kcal/giorno`,
        metric: `${Math.round(deficit)} kcal`
      };
    }

    case 'consistency-tracking': {
      const daysWithData = last7Days.filter(d => d.totaleCalorie > 0).length;
      return {
        passed: daysWithData >= 6,
        message: `${daysWithData}/7 giorni tracciati`,
        metric: `${daysWithData}/7`
      };
    }

    case 'fibre-adequacy': {
      const avgFibre = last7Days.reduce((sum, day) => {
        const dayMeals = meals.filter(m => m.data === day.data);
        return sum + dayMeals.reduce((s, meal) => s + (meal.macroCalcolate?.fibra || 0), 0);
      }, 0) / last7Days.length;
      const status = getFibreAdequacy(avgFibre);
      return {
        passed: status.status === 'adeguato',
        message: status.message,
        metric: `${Math.round(avgFibre)}g/giorno`
      };
    }

    case 'weight-loss-pace': {
      if (!dailyWeights || dailyWeights.length < 7) {
        return {
          passed: false,
          message: 'Dati peso insufficienti',
          metric: 'N/A'
        };
      }

      const recent = dailyWeights.sort((a, b) => new Date(a.data) - new Date(b.data)).slice(-7);
      if (recent.length < 2) return { passed: false, message: 'Dati insufficienti', metric: 'N/A' };

      const deltaKg = recent[recent.length - 1].pesoKg - recent[0].pesoKg;
      const isPace = deltaKg < 0 && deltaKg > -1.5; // Perso 0-1.5 kg in 7 giorni è buono
      return {
        passed: isPace,
        message: isPace ? 'Ritmo di calo sostenibile' : `Calo: ${Math.round(deltaKg * 10) / 10}kg/settimana`,
        metric: `${Math.round(deltaKg * 10) / 10}kg`
      };
    }

    default:
      return { passed: false, message: 'Regola non riconosciuta', metric: 'N/A' };
  }
}
