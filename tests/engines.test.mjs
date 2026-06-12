/*
  Unit test per gli engine di calcolo (funzioni pure).
  Esecuzione: npm test  (oppure: node --test tests/)

  Proteggono i calcoli critici — TDEE, macro, deficit, attività — dalle
  regressioni (es. chiavi rinominate, già successo con la dashboard).
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateMacrosForAmount,
  calculateEnergyTargets,
  aggregateDailySummary,
  buildNutritionWarning,
  estimateWeightChange
} from '../js/nutritionEngine.js';

import {
  getTheoreticalTDEE,
  getDailyEnergyBalance,
  getEnergyBalanceSummary,
  estimateLinearWeightChange,
  estimateTimeToGoal,
  KCAL_PER_KG_FAT
} from '../js/weightLossEstimator.js';

import {
  estimateStepsCalories,
  applyEatBackCalories,
  shouldExcludeStepsCalories,
  estimateWeightsCalories
} from '../js/activityEnergyEngine.js';

import {
  getDeficitScore,
  getProteinScore,
  getResistanceTrainingScore,
  getLeanMassRetentionIndex,
  splitWeightChangeDeficit
} from '../js/bodyCompositionModel.js';

import { escapeHtml, buildLastNDates } from '../js/utils.js';

// ─── nutritionEngine ────────────────────────────────────────────────

const PASTA = { per100g: { kcal: 360, proteine: 12, carboidrati: 70, zuccheri: 3, grassi: 2, fibra: 3, sodioMg: 10 } };

test('calculateMacrosForAmount: 100 g = valori per100g', () => {
  const m = calculateMacrosForAmount(PASTA, 100);
  assert.equal(m.kcal, 360);
  assert.equal(m.proteine, 12);
  assert.equal(m.carboidrati, 70);
});

test('calculateMacrosForAmount: 50 g = metà', () => {
  const m = calculateMacrosForAmount(PASTA, 50);
  assert.equal(m.kcal, 180);
  assert.equal(m.proteine, 6);
});

test('calculateMacrosForAmount: campi opzionali assenti → 0, non NaN', () => {
  const m = calculateMacrosForAmount({ per100g: { kcal: 100, proteine: 5, carboidrati: 10, zuccheri: 1, grassi: 2 } }, 100);
  assert.equal(m.fibra, 0);
  assert.equal(m.sodioMg, 0);
  assert.equal(m.grassi_saturi, 0);
});

test('calculateEnergyTargets: BMR uomo > donna a parità di profilo', () => {
  const base = { pesoKg: 70, altezzaCm: 170, dataNascita: '1995-01-01', attività: 'moderato', obiettivo: 'mantenere' };
  const m = calculateEnergyTargets({ ...base, sesso: 'M' });
  const f = calculateEnergyTargets({ ...base, sesso: 'F' });
  assert.ok(m.calorie > f.calorie, `uomo ${m.calorie} kcal deve superare donna ${f.calorie}`);
});

test('calculateEnergyTargets: obiettivo dimagrire taglia le calorie vs mantenere', () => {
  const base = { pesoKg: 80, altezzaCm: 180, sesso: 'M', dataNascita: '1990-01-01', attività: 'moderato' };
  const cut = calculateEnergyTargets({ ...base, obiettivo: 'dimagrire' });
  const maint = calculateEnergyTargets({ ...base, obiettivo: 'mantenere' });
  assert.ok(cut.calorie < maint.calorie);
  assert.ok(cut.proteine > maint.proteine, 'in deficit le proteine/kg salgono');
});

test('calculateEnergyTargets: customTargets sovrascrive i calcolati', () => {
  const t = calculateEnergyTargets({ pesoKg: 70, sesso: 'M', customTargets: { calorie: 1234 } });
  assert.equal(t.calorie, 1234);
});

test('calculateEnergyTargets: floor 1100 kcal mai violato', () => {
  const t = calculateEnergyTargets({ pesoKg: 35, altezzaCm: 140, sesso: 'F', dataNascita: '1950-01-01', attività: 'sedentario', obiettivo: 'dimagrire' });
  assert.ok(t.calorie >= 1100);
});

test('aggregateDailySummary: somma i macro e confronta coi target', () => {
  const meals = [
    { macroCalcolate: { kcal: 500, proteine: 30, carboidrati: 60, grassi: 15, fibra: 5, zuccheri: 8, sodioMg: 300, grassi_saturi: 4 } },
    { macroCalcolate: { kcal: 700, proteine: 40, carboidrati: 80, grassi: 25, fibra: 7, zuccheri: 10, sodioMg: 500, grassi_saturi: 8 } }
  ];
  const s = aggregateDailySummary(meals, { calorie: 2000, proteine: 140, carboidrati: 250, grassi: 65, fibra: 28, zuccheri: 40 });
  assert.equal(s.totaleCalorie, 1200);
  assert.equal(s.totaleProteine, 70);
  assert.equal(s.confrontoConTarget.calorie.difference, -800);
  assert.equal(s.confrontoConTarget.proteine.percent, 50);
});

test('aggregateDailySummary: giorno vuoto → tutti 0', () => {
  const s = aggregateDailySummary([], { calorie: 2000 });
  assert.equal(s.totaleCalorie, 0);
  assert.equal(s.confrontoConTarget.calorie.percent, 0);
});

test('buildNutritionWarning: ipertensione + sodio alto → warning', () => {
  const w = buildNutritionWarning({ condizioni: ['ipertensione'] }, { totaleSodioMg: 3000, totaleZuccheri: 0, totaleGrassiSaturi: 0 });
  assert.equal(w.length, 1);
  assert.match(w[0], /sodio/i);
});

test('buildNutritionWarning: nessuna condizione → nessun warning', () => {
  const w = buildNutritionWarning({ condizioni: [] }, { totaleSodioMg: 9999, totaleZuccheri: 999, totaleGrassiSaturi: 99 });
  assert.equal(w.length, 0);
});

test('estimateWeightChange: 770 kcal/die di deficit ≈ 0.7 kg/settimana', () => {
  const e = estimateWeightChange(770);
  assert.equal(e.weekly, 0.7);
});

// ─── weightLossEstimator ────────────────────────────────────────────

test('getTheoreticalTDEE: profilo default plausibile (1500-4000 kcal)', () => {
  const tdee = getTheoreticalTDEE({ pesoKg: 75, altezzaCm: 175, sesso: 'M', dataNascita: '1992-06-15', attività: 'moderato' });
  assert.ok(tdee > 1500 && tdee < 4000, `TDEE ${tdee} fuori range`);
});

test('getDailyEnergyBalance: deficit negativo quando intake < spesa', () => {
  const b = getDailyEnergyBalance(1800, { totalExerciseCalories: 300 }, 2200);
  assert.equal(b.totalExpenditure, 2500);
  assert.equal(b.netDeficitOrSurplus, -700);
});

test('getEnergyBalanceSummary: medie corrette', () => {
  const days = [
    getDailyEnergyBalance(2000, { totalExerciseCalories: 0 }, 2200),
    getDailyEnergyBalance(1800, { totalExerciseCalories: 200 }, 2200)
  ];
  const s = getEnergyBalanceSummary(days);
  assert.equal(s.days, 2);
  assert.equal(s.avgIntake, 1900);
  assert.equal(s.avgNet, -400);
});

test('estimateTimeToGoal: 5 kg con 500 kcal/die deficit ≈ 77 giorni', () => {
  // tdee 2200 + exercise 300 - intake 2000 = 500 kcal/die di deficit
  const r = estimateTimeToGoal(80, 75, 2000, 300, 2200);
  assert.equal(r.days, Math.round(5 * KCAL_PER_KG_FAT / 500));
  assert.ok(r.kgPerWeek > 0.4 && r.kgPerWeek < 0.5);
});

test('estimateTimeToGoal: già all\'obiettivo → 0 giorni', () => {
  const r = estimateTimeToGoal(70, 75, 2000, 0, 2200);
  assert.equal(r.days, 0);
  assert.ok(r.warning);
});

test('estimateTimeToGoal: surplus → mai (Infinity) con warning', () => {
  const r = estimateTimeToGoal(80, 75, 3000, 0, 2200);
  assert.equal(r.days, Infinity);
  assert.ok(r.warning);
});

test('estimateLinearWeightChange: -7700 kcal totali ≈ -1 kg', () => {
  const r = estimateLinearWeightChange(-770, 10);
  assert.ok(Math.abs(r.kgChange + 1) < 0.01, `atteso ~-1 kg, ottenuto ${r.kgChange}`);
});

// ─── activityEnergyEngine ───────────────────────────────────────────

test('estimateStepsCalories: scala col peso e col conteggio', () => {
  const light = estimateStepsCalories({ steps: 10000 }, { pesoKg: 60 });
  const heavy = estimateStepsCalories({ steps: 10000 }, { pesoKg: 90 });
  assert.ok(heavy > light);
  assert.equal(estimateStepsCalories({ steps: 0 }, { pesoKg: 70 }), 0);
  assert.equal(estimateStepsCalories(null, { pesoKg: 70 }), 0);
});

test('applyEatBackCalories: none/partial/full', () => {
  assert.equal(applyEatBackCalories(500, { eatBackMode: 'none' }), 0);
  assert.equal(applyEatBackCalories(500, { eatBackMode: 'full' }), 500);
  assert.equal(applyEatBackCalories(500, { eatBackMode: 'partial', eatBackRatio: 0.3 }), 150);
  assert.equal(applyEatBackCalories(-100, { eatBackMode: 'full' }), 0);
});

test('shouldExcludeStepsCalories: esclude solo provider + cardio walking + pref attiva', () => {
  const steps = { steps: 8000, source: 'provider' };
  const walkCardio = [{ cardioType: 'walking' }];
  assert.equal(shouldExcludeStepsCalories(steps, walkCardio, { avoidDoubleCountingWalking: true }), true);
  assert.equal(shouldExcludeStepsCalories(steps, walkCardio, { avoidDoubleCountingWalking: false }), false);
  assert.equal(shouldExcludeStepsCalories({ ...steps, source: 'manual' }, walkCardio, { avoidDoubleCountingWalking: true }), false);
  assert.equal(shouldExcludeStepsCalories(steps, [{ cardioType: 'cycling' }], { avoidDoubleCountingWalking: true }), false);
});

test('estimateWeightsCalories: durata 0 → 0; sessione tipica > 0', () => {
  assert.equal(estimateWeightsCalories({ durationMin: 0 }, { pesoKg: 80 }), 0);
  const kcal = estimateWeightsCalories({ durationMin: 60, intensityRpe: 7, muscleGroups: ['legs'] }, { pesoKg: 80 });
  assert.ok(kcal > 100 && kcal < 800, `kcal pesi ${kcal} fuori range plausibile`);
});

// ─── bodyCompositionModel ───────────────────────────────────────────

test('getDeficitScore / getProteinScore / training: range 0-1', () => {
  for (const v of [0, 5, 10, 20, 35]) {
    const s = getDeficitScore(v);
    assert.ok(s >= 0 && s <= 1, `deficitScore(${v})=${s}`);
  }
  for (const v of [0.5, 1.2, 1.8, 2.5]) {
    const s = getProteinScore(v);
    assert.ok(s >= 0 && s <= 1, `proteinScore(${v})=${s}`);
  }
  const t = getResistanceTrainingScore(3, 7);
  assert.ok(t >= 0 && t <= 1);
});

test('splitWeightChangeDeficit: fat+lean = totale, retention alta → meno massa magra persa', () => {
  // Nota: deficitScore alto = deficit aggressivo → retention più bassa
  const good = splitWeightChangeDeficit(-2, getLeanMassRetentionIndex(0.1, 0.9, 0.9));
  const bad = splitWeightChangeDeficit(-2, getLeanMassRetentionIndex(0.9, 0.1, 0.1));
  assert.ok(Math.abs((good.fatKgChange + good.leanKgChange) - (-2)) < 0.02);
  assert.ok(Math.abs(good.leanKgChange) < Math.abs(bad.leanKgChange), 'retention alta deve preservare massa magra');
});

// ─── utils ──────────────────────────────────────────────────────────

test('escapeHtml: neutralizza i tag', () => {
  assert.equal(escapeHtml('<img onerror=alert(1)>'), '&lt;img onerror=alert(1)&gt;');
  assert.equal(escapeHtml('Pasta & fagioli'), 'Pasta &amp; fagioli');
});

test('buildLastNDates: 7 date che finiscono alla data richiesta', () => {
  const dates = buildLastNDates('2026-06-12', 7);
  assert.equal(dates.length, 7);
  assert.equal(dates[6], '2026-06-12');
  assert.equal(dates[0], '2026-06-06');
});

// ─── nutritionDataProvider: stemming IT ─────────────────────────────

const { _wordVariants } = await import('../js/nutritionDataProvider.js');

test('_wordVariants: plurali italiani comuni', () => {
  assert.ok(_wordVariants('mele').has('mela'));
  assert.ok(_wordVariants('mela').has('mele'));
  assert.ok(_wordVariants('pomodori').has('pomodoro'));
  assert.ok(_wordVariants('funghi').has('fungo'));
  assert.ok(_wordVariants('fichi').has('fico'));
  assert.ok(_wordVariants('noci').has('noce'));
});

test('_wordVariants: parole corte e accenti', () => {
  assert.ok(_wordVariants('tè').has('te'));
  assert.equal(_wordVariants('blu').size, 1);
});
