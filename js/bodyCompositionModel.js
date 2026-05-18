/*
  Modello euristico di composizione corporea (grasso vs massa magra).
  Stima la ripartizione del peso perso/guadagnato tra FM (fat mass) e FFM (lean mass).

  ⚠️ DISCLAIMER: Modello semplificato basato su medie di popolazione da studi controllati.
     NON è una misura clinica. Solo indicativo per capire il trend.

  Fonti principali:
  - Helms et al. (2014) - Evidence-based recommendations for natural bodybuilding contest preparation
  - Garthe et al. (2011) - Effect of two different weight-loss rates on body composition and strength
  - Phillips & Van Loon (2011) - Dietary protein and muscle mass in resistance training
*/

// ============================================================================
// CONFIGURAZIONE PARAMETRI (facilmente aggiornabili)
// ============================================================================

// Deficit Score: soglie di aggressività (% TDEE)
const DEFICIT_SCORE_CONFIG = {
  lieveSoglia: 0.10,        // 10% TDEE = deficit lieve
  moderataSoglia: 0.20,     // 20% TDEE = deficit moderato
  lieveScore: 0.2,
  moderataScore: 0.5,
  aggressivaScore: 0.9
};

// Resistance Training Score: sessioni ottimali e parametri
const TRAINING_SCORE_CONFIG = {
  targetSessionsPerWeek: 3,  // 3+ sedute = massimo effetto muscle-sparing
  minSessionsForBaseScore: 2,
  scorePerSession: 0.25,     // 0.25 score per seduta oltre la prima
  rpeBoost: 0.2              // bonus aggiuntivo se RPE medio alto
};

// Protein Score: range di adeguatezza (g/kg)
const PROTEIN_SCORE_CONFIG = {
  lowThreshold: 1.2,         // < 1.2 g/kg = basso
  mediumThreshold: 1.6,      // 1.2–1.6 = medio
  highThreshold: 2.2,        // 1.6–2.2 = alto
  // Scores:
  lowScore: 0.2,
  mediumScore: 0.5,
  highScore: 0.8,
  veryHighScore: 1.0
};

// Lean Mass Retention Index: pesi dei fattori
const LEAN_RETENTION_CONFIG = {
  trainingBoost: 0.35,       // peso dell'allenamento
  proteinBoost: 0.35         // peso delle proteine
};

// Frazione di peso perso da FFM (lean mass) in deficit
const DEFICIT_SPLIT_CONFIG = {
  baseLeanFraction: 0.30,    // 30% del peso perso è FFM in condizioni medie
  minLeanFraction: 0.05      // 5% minimo (condizioni ottimali)
};

// Frazione di peso guadagnato da FFM (lean mass) in surplus
const SURPLUS_SPLIT_CONFIG = {
  minLeanFraction: 0.05,     // quasi tutto grasso senza allenamento
  maxLeanFraction: 0.40      // fino al 40% di lean gain in condizioni ottimali
};

// ============================================================================
// FUNZIONI AUSILIARIE
// ============================================================================

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// 14.2 INDICI PRINCIPALI (0–1)
// ============================================================================

/**
 * Calcola quanto è aggressivo il deficit rispetto a TDEE.
 * @param {number} avgDeficitPercentTDEE - deficit come frazione di TDEE (es. 0.15 = 15%)
 * @returns {number} score 0–1
 */
export function getDeficitScore(avgDeficitPercentTDEE) {
  const absPercent = Math.abs(avgDeficitPercentTDEE);

  if (absPercent <= DEFICIT_SCORE_CONFIG.lieveSoglia) {
    return DEFICIT_SCORE_CONFIG.lieveScore;
  } else if (absPercent <= DEFICIT_SCORE_CONFIG.moderataSoglia) {
    // interpolazione lineare tra lieve e moderato
    const t = (absPercent - DEFICIT_SCORE_CONFIG.lieveSoglia) /
              (DEFICIT_SCORE_CONFIG.moderataSoglia - DEFICIT_SCORE_CONFIG.lieveSoglia);
    return DEFICIT_SCORE_CONFIG.lieveScore + t * (DEFICIT_SCORE_CONFIG.moderataScore - DEFICIT_SCORE_CONFIG.lieveScore);
  } else {
    return DEFICIT_SCORE_CONFIG.aggressivaScore;
  }
}

/**
 * Calcola uno score per qualità dell'allenamento con pesi.
 * @param {number} weightsSessionsPerWeek - sedute/settimana (es. 3)
 * @param {number} avgRPE - RPE medio (1–10), opzionale
 * @returns {number} score 0–1
 */
export function getResistanceTrainingScore(weightsSessionsPerWeek = 0, avgRPE = 5) {
  if (weightsSessionsPerWeek === 0) {
    return 0;
  }

  // Score base dal numero di sessioni
  const baseScore = Math.min(
    weightsSessionsPerWeek * TRAINING_SCORE_CONFIG.scorePerSession,
    1.0
  );

  // Bonus se RPE medio è alto (>= 7)
  const rpeBonus = avgRPE >= 7 ? TRAINING_SCORE_CONFIG.rpeBoost : 0;

  return clamp(baseScore + rpeBonus, 0, 1);
}

/**
 * Calcola uno score per adeguatezza dell'intake proteico.
 * @param {number} proteinPerKg - proteine in g/kg di peso corporeo
 * @returns {number} score 0–1
 */
export function getProteinScore(proteinPerKg) {
  if (proteinPerKg < PROTEIN_SCORE_CONFIG.lowThreshold) {
    return PROTEIN_SCORE_CONFIG.lowScore;
  } else if (proteinPerKg < PROTEIN_SCORE_CONFIG.mediumThreshold) {
    // interpolazione tra basso e medio
    const t = (proteinPerKg - PROTEIN_SCORE_CONFIG.lowThreshold) /
              (PROTEIN_SCORE_CONFIG.mediumThreshold - PROTEIN_SCORE_CONFIG.lowThreshold);
    return PROTEIN_SCORE_CONFIG.lowScore + t * (PROTEIN_SCORE_CONFIG.mediumScore - PROTEIN_SCORE_CONFIG.lowScore);
  } else if (proteinPerKg < PROTEIN_SCORE_CONFIG.highThreshold) {
    // interpolazione tra medio e alto
    const t = (proteinPerKg - PROTEIN_SCORE_CONFIG.mediumThreshold) /
              (PROTEIN_SCORE_CONFIG.highThreshold - PROTEIN_SCORE_CONFIG.mediumThreshold);
    return PROTEIN_SCORE_CONFIG.mediumScore + t * (PROTEIN_SCORE_CONFIG.highScore - PROTEIN_SCORE_CONFIG.mediumScore);
  } else {
    return PROTEIN_SCORE_CONFIG.veryHighScore;
  }
}

// ============================================================================
// 14.3 LEAN MASS RETENTION INDEX
// ============================================================================

/**
 * Calcola l'indice di preservazione della massa magra in deficit.
 * @param {number} deficitScore - 0–1
 * @param {number} resistanceTrainingScore - 0–1
 * @param {number} proteinScore - 0–1
 * @returns {number} leanRetentionIndex 0–1
 */
export function getLeanMassRetentionIndex(deficitScore, resistanceTrainingScore, proteinScore) {
  // Base: più è aggressivo il deficit, meno FFM si preserva
  const baseRetention = 1 - deficitScore;

  // Boost dall'allenamento e dalle proteine
  const trainingBoost = LEAN_RETENTION_CONFIG.trainingBoost * resistanceTrainingScore;
  const proteinBoost = LEAN_RETENTION_CONFIG.proteinBoost * proteinScore;

  const retention = baseRetention + trainingBoost + proteinBoost;
  return clamp(retention, 0, 1);
}

// ============================================================================
// 14.4 RIPARTIZIONE IN DEFICIT
// ============================================================================

/**
 * Stima la ripartizione tra grasso e massa magra persa in deficit.
 * @param {number} linearKgChange - kg dal modello lineare (negativo = perdita)
 * @param {number} leanRetentionIndex - 0–1
 * @returns {Object} { fatKgChange, leanKgChange, fatPercent, leanPercent }
 */
export function splitWeightChangeDeficit(linearKgChange, leanRetentionIndex) {
  const absoluteChange = Math.abs(linearKgChange);

  // Calcola la frazione di FFM persa (varia con retention index)
  const leanLossFraction = clamp(
    DEFICIT_SPLIT_CONFIG.baseLeanFraction -
      leanRetentionIndex * (DEFICIT_SPLIT_CONFIG.baseLeanFraction - DEFICIT_SPLIT_CONFIG.minLeanFraction),
    DEFICIT_SPLIT_CONFIG.minLeanFraction,
    DEFICIT_SPLIT_CONFIG.baseLeanFraction
  );

  // kg di massa magra persa
  const leanKgLost = absoluteChange * leanLossFraction;
  // kg di grasso perso
  const fatKgLost = absoluteChange - leanKgLost;

  // Restituisci con segno negativo (perdita)
  const fatKgChange = -fatKgLost;
  const leanKgChange = -leanKgLost;

  const fatPercent = absoluteChange > 0 ? (fatKgLost / absoluteChange) * 100 : 0;
  const leanPercent = absoluteChange > 0 ? (leanKgLost / absoluteChange) * 100 : 0;

  return {
    fatKgChange: parseFloat(fatKgChange.toFixed(2)),
    leanKgChange: parseFloat(leanKgChange.toFixed(2)),
    fatPercent: parseFloat(fatPercent.toFixed(1)),
    leanPercent: parseFloat(leanPercent.toFixed(1))
  };
}

// ============================================================================
// 14.5 RIPARTIZIONE IN SURPLUS
// ============================================================================

/**
 * Stima la ripartizione tra grasso e massa magra guadagnata in surplus.
 * @param {number} linearKgChange - kg dal modello lineare (positivo = guadagno)
 * @param {number} resistanceTrainingScore - 0–1
 * @param {number} proteinScore - 0–1
 * @returns {Object} { fatKgChange, leanKgChange, fatPercent, leanPercent }
 */
export function splitWeightChangeSurplus(linearKgChange, resistanceTrainingScore, proteinScore) {
  const absoluteChange = Math.abs(linearKgChange);

  // Indice di "guadagno muscolare": media pesata di training e proteine
  const leanGainIndex = clamp(
    0.5 * resistanceTrainingScore + 0.5 * proteinScore,
    0,
    1
  );

  // Frazione di peso che va a massa magra
  const leanGainFraction = SURPLUS_SPLIT_CONFIG.minLeanFraction +
    leanGainIndex * (SURPLUS_SPLIT_CONFIG.maxLeanFraction - SURPLUS_SPLIT_CONFIG.minLeanFraction);

  // kg di massa magra guadagnati
  const leanKgGain = absoluteChange * leanGainFraction;
  // kg di grasso guadagnati
  const fatKgGain = absoluteChange - leanKgGain;

  // Restituisci con segno positivo (guadagno)
  const fatKgChange = fatKgGain;
  const leanKgChange = leanKgGain;

  const fatPercent = absoluteChange > 0 ? (fatKgGain / absoluteChange) * 100 : 0;
  const leanPercent = absoluteChange > 0 ? (leanKgGain / absoluteChange) * 100 : 0;

  return {
    fatKgChange: parseFloat(fatKgChange.toFixed(2)),
    leanKgChange: parseFloat(leanKgChange.toFixed(2)),
    fatPercent: parseFloat(fatPercent.toFixed(1)),
    leanPercent: parseFloat(leanPercent.toFixed(1))
  };
}

// ============================================================================
// 14.6 INTERFACCIA COMUNE
// ============================================================================

/**
 * Stima completa della composizione corporea.
 * @param {number} avgDeficitPerDay - kcal/giorno (negativo = deficit, positivo = surplus)
 * @param {number} days - numero di giorni
 * @param {number} tdee - TDEE in kcal/giorno
 * @param {Object} trainingStats - { weightsSessionsPerWeek, avgRPE }
 * @param {Object} nutritionStats - { proteinPerKg }
 * @returns {Object} composizione stimata
 */
export function estimateBodyCompositionChange(
  avgDeficitPerDay,
  days,
  tdee,
  trainingStats = {},
  nutritionStats = {}
) {
  // Calcola il cambio di peso lineare (7700 kcal/kg)
  const totalDeficit = avgDeficitPerDay * days;
  const linearKgChange = totalDeficit / 7700;

  // Calcola i vari score
  const deficitPercentTDEE = avgDeficitPerDay / tdee;
  const deficitScore = getDeficitScore(deficitPercentTDEE);
  const resistanceTrainingScore = getResistanceTrainingScore(
    trainingStats.weightsSessionsPerWeek || 0,
    trainingStats.avgRPE || 5
  );
  const proteinScore = getProteinScore(nutritionStats.proteinPerKg || 1.0);

  // Calcola il lean retention index
  const leanRetentionIndex = getLeanMassRetentionIndex(
    deficitScore,
    resistanceTrainingScore,
    proteinScore
  );

  // Separa tra deficit e surplus
  let compositionChange;
  if (linearKgChange < 0) {
    // Deficit: perdi peso
    compositionChange = splitWeightChangeDeficit(linearKgChange, leanRetentionIndex);
  } else {
    // Surplus: guadagni peso
    compositionChange = splitWeightChangeSurplus(
      linearKgChange,
      resistanceTrainingScore,
      proteinScore
    );
  }

  return {
    linearKgChange: parseFloat(linearKgChange.toFixed(2)),
    deficitScore: parseFloat(deficitScore.toFixed(2)),
    resistanceTrainingScore: parseFloat(resistanceTrainingScore.toFixed(2)),
    proteinScore: parseFloat(proteinScore.toFixed(2)),
    leanRetentionIndex: parseFloat(leanRetentionIndex.toFixed(2)),
    ...compositionChange
  };
}
