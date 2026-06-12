/*
  Calcoli puri per macro, target energetici e riepiloghi giornalieri.
  Parametri configurabili in alto per aggiornare la logica senza cambiare il flusso.
*/

export const ACTIVITY_FACTORS = {
  sedentario: 1.2,
  leggero: 1.375,
  moderato: 1.55,
  intenso: 1.725
};

export const CALORIE_ADJUSTMENT = {
  dimagrire: -0.15,
  mantenere: 0,
  massa: 0.1
};

export const PROTEIN_G_PER_KG = {
  dimagrire: 1.8,
  mantenere: 1.4,
  massa: 2.0
};

export const FAT_RATIO = 0.25;
export const DEFAULT_FIBER_TARGET = 28;
export const DEFAULT_SUGAR_THRESHOLD = 40;
export const SODIUM_THRESHOLD = 2300;
export const SATURATED_FAT_THRESHOLD = 18;

export function calculateMacrosForAmount(foodItem, grams) {
  const ratio = grams / 100;
  const source = foodItem.per100g || foodItem || {};
  return {
    kcal: Number((source.kcal * ratio).toFixed(0)),
    proteine: Number((source.proteine * ratio).toFixed(1)),
    carboidrati: Number((source.carboidrati * ratio).toFixed(1)),
    zuccheri: Number((source.zuccheri * ratio).toFixed(1)),
    grassi: Number((source.grassi * ratio).toFixed(1)),
    grassi_saturi: Number(((source.grassi_saturi || 0) * ratio).toFixed(1)),
    fibra: Number(((source.fibra || 0) * ratio).toFixed(1)),
    sodioMg: Number(((source.sodioMg || 0) * ratio).toFixed(0))
  };
}

export function calculateEnergyTargets(profile) {
  const age = profile.dataNascita ? Math.max(16, Math.floor((Date.now() - new Date(profile.dataNascita).getTime()) / 31557600000)) : 30;
  const weight = profile.pesoKg || 70;
  const height = profile.altezzaCm || 170;
  const sex = profile.sesso;

  const baseBmr = sex === 'F'
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : sex === 'M'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age;

  const activityFactor = ACTIVITY_FACTORS[profile.attività] || ACTIVITY_FACTORS.moderato;
  const tdee = Math.round(baseBmr * activityFactor);
  const adjustment = CALORIE_ADJUSTMENT[profile.obiettivo] ?? 0;
  const calorie = Math.max(1100, Math.round(tdee * (1 + adjustment)));

  const proteine = Math.max(50, Math.round(weight * (PROTEIN_G_PER_KG[profile.obiettivo] || 1.5)));
  const grassi = Math.max(45, Math.round((calorie * FAT_RATIO) / 9));
  const carboidrati = Math.max(100, Math.round((calorie - proteine * 4 - grassi * 9) / 4));

  const targets = {
    calorie,
    proteine,
    carboidrati,
    grassi,
    fibra: DEFAULT_FIBER_TARGET,
    zuccheri: DEFAULT_SUGAR_THRESHOLD
  };

  return profile.customTargets ? { ...targets, ...profile.customTargets } : targets;
}

export function aggregateDailySummary(mealEntriesForDay, nutritionTargets) {
  const totals = mealEntriesForDay.reduce((acc, entry) => {
    acc.totaleCalorie += entry.macroCalcolate.kcal || 0;
    acc.totaleProteine += entry.macroCalcolate.proteine || 0;
    acc.totaleCarbo += entry.macroCalcolate.carboidrati || 0;
    acc.totaleGrassi += entry.macroCalcolate.grassi || 0;
    acc.totaleFibra += entry.macroCalcolate.fibra || 0;
    acc.totaleZuccheri += entry.macroCalcolate.zuccheri || 0;
    acc.totaleSodioMg += entry.macroCalcolate.sodioMg || 0;
    acc.totaleGrassiSaturi += entry.macroCalcolate.grassi_saturi || 0;
    return acc;
  }, {
    totaleCalorie: 0,
    totaleProteine: 0,
    totaleCarbo: 0,
    totaleGrassi: 0,
    totaleFibra: 0,
    totaleZuccheri: 0,
    totaleSodioMg: 0,
    totaleGrassiSaturi: 0
  });

  const compare = (name, value) => {
    const target = nutritionTargets[name] || 0;
    return {
      target,
      actual: value,
      difference: Number((value - target).toFixed(1)),
      percent: target ? Number((value / target * 100).toFixed(1)) : 0
    };
  };

  return {
    ...totals,
    confrontoConTarget: {
      calorie: compare('calorie', totals.totaleCalorie),
      proteine: compare('proteine', totals.totaleProteine),
      carboidrati: compare('carboidrati', totals.totaleCarbo),
      grassi: compare('grassi', totals.totaleGrassi),
      fibra: compare('fibra', totals.totaleFibra),
      zuccheri: compare('zuccheri', totals.totaleZuccheri)
    }
  };
}

export function buildNutritionWarning(profile, dailySummary) {
  const warnings = [];
  const conditions = profile?.condizioni || [];
  if (conditions.includes('ipertensione') && dailySummary.totaleSodioMg > SODIUM_THRESHOLD) {
    warnings.push('Attenzione: il sodio giornaliero supera la soglia consigliata per ipertensione.');
  }
  if (conditions.includes('prediabete') && dailySummary.totaleZuccheri > DEFAULT_SUGAR_THRESHOLD) {
    warnings.push('Attenzione: zuccheri semplici elevati rispetto al profilo prediabete.');
  }
  if (conditions.includes('colesterolo alto') && dailySummary.totaleGrassiSaturi > SATURATED_FAT_THRESHOLD) {
    warnings.push('Attenzione: grassi saturi elevati per condizione colesterolo alto.');
  }
  return warnings;
}

// Allenamento e stima perdita peso
const MET_WEIGHTS = {
  push: 3.5,
  pull: 3.0,
  leg: 4.0,
  total_body: 5.0
};

export function calculateCardioCalories(weightKg, minutes, speedKmh, inclinationPct = 0) {
  let met;
  if (speedKmh < 4) met = 2.5;
  else if (speedKmh < 6) met = 3.5;
  else if (speedKmh < 8) met = 7.0;
  else if (speedKmh < 10) met = 9.0;
  else met = 11.5;

  const inclBonus = speedKmh < 6 ? 0.07 * inclinationPct : 0.05 * inclinationPct;
  met += inclBonus;
  return Math.round(met * weightKg * (minutes / 60));
}

export function calculateWeightsCalories(weightKg, minutes, trainingType) {
  const met = MET_WEIGHTS[trainingType] || 3.5;
  return Math.round(met * weightKg * (minutes / 60));
}

export function estimateWeightChange(deficitKcalPerDay) {
  const perWeek = (deficitKcalPerDay * 7) / 7700;
  const perMonth = (deficitKcalPerDay * 30) / 7700;
  const perThreeMonths = (deficitKcalPerDay * 90) / 7700;
  return {
    weekly: parseFloat(perWeek.toFixed(2)),
    monthly: parseFloat(perMonth.toFixed(2)),
    threeMonths: parseFloat(perThreeMonths.toFixed(2))
  };
}
