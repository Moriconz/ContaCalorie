/**
 * Validation module — Range checking + mensaggi di errore
 */

export const RANGES = {
  weight: { min: 30, max: 200, unit: 'kg' },
  height: { min: 140, max: 220, unit: 'cm' },
  age: { min: 13, max: 120, unit: 'anni' },
  grams: { min: 1, max: 3000, unit: 'g' },
  bodyFat: { min: 5, max: 95, unit: '%' },
  reps: { min: 1, max: 100, unit: 'ripetizioni' },
  sets: { min: 1, max: 20, unit: 'set' }
};

export function validateWeight(kg) {
  if (!kg || isNaN(kg)) return { valid: false, error: 'Peso richiesto' };
  if (kg < RANGES.weight.min) return { valid: false, error: `Peso troppo basso (min ${RANGES.weight.min} ${RANGES.weight.unit})` };
  if (kg > RANGES.weight.max) {
    return { 
      valid: false, 
      warning: `Peso molto alto (${kg} ${RANGES.weight.unit}). Verifica se è in kg. Continuo comunque.`,
      valid: true 
    };
  }
  return { valid: true };
}

export function validateHeight(cm) {
  if (!cm || isNaN(cm)) return { valid: false, error: 'Altezza richiesta' };
  if (cm < RANGES.height.min) return { valid: false, error: `Altezza troppo bassa (min ${RANGES.height.min} ${RANGES.height.unit})` };
  if (cm > RANGES.height.max) return { valid: false, error: `Altezza troppo alta (max ${RANGES.height.max} ${RANGES.height.unit})` };
  return { valid: true };
}

export function validateAge(age) {
  if (!age || isNaN(age)) return { valid: false, error: 'Età richiesta' };
  if (age < RANGES.age.min) return { valid: false, error: `Età minima ${RANGES.age.min} ${RANGES.age.unit}` };
  if (age > RANGES.age.max) return { valid: false, error: `Età massima ${RANGES.age.max} ${RANGES.age.unit}` };
  return { valid: true };
}

export function validateGrams(grams) {
  if (!grams || isNaN(grams)) return { valid: false, error: 'Grammi richiesti (1-3000)' };
  if (grams < RANGES.grams.min) return { valid: false, error: `Minimo ${RANGES.grams.min} ${RANGES.grams.unit}` };
  if (grams > RANGES.grams.max) return { valid: false, error: `Massimo ${RANGES.grams.max} ${RANGES.grams.unit}` };
  if (grams > 1000) {
    return { 
      valid: true,
      warning: `Porzione grande (${grams}g). Verifica grammi.`
    };
  }
  return { valid: true };
}

export function validateBodyFat(percent) {
  if (!percent || isNaN(percent)) return { valid: false, error: 'Body Fat % richiesto' };
  if (percent < RANGES.bodyFat.min) return { valid: false, error: `Minimo ${RANGES.bodyFat.min}${RANGES.bodyFat.unit}` };
  if (percent > RANGES.bodyFat.max) return { valid: false, error: `Massimo ${RANGES.bodyFat.max}${RANGES.bodyFat.unit}` };
  if (percent < 10 || percent > 50) {
    return {
      valid: true,
      warning: `Body Fat % insolito (${percent}${RANGES.bodyFat.unit}). Calibrazione DEXA confermata?`
    };
  }
  return { valid: true };
}

export function validateReps(reps) {
  if (!reps || isNaN(reps)) return { valid: false, error: 'Ripetizioni richieste' };
  if (reps < RANGES.reps.min || reps > RANGES.reps.max) {
    return { valid: false, error: `Ripetizioni: ${RANGES.reps.min}-${RANGES.reps.max}` };
  }
  return { valid: true };
}

export function validateSets(sets) {
  if (!sets || isNaN(sets)) return { valid: false, error: 'Set richiesti' };
  if (sets < RANGES.sets.min || sets > RANGES.sets.max) {
    return { valid: false, error: `Set: ${RANGES.sets.min}-${RANGES.sets.max}` };
  }
  return { valid: true };
}

export function formatValidationMessage(result) {
  if (result.valid && result.warning) {
    return `⚠️ ${result.warning}`;
  }
  if (!result.valid && result.error) {
    return `❌ ${result.error}`;
  }
  return `✅ OK`;
}
