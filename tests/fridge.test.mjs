/*
  Test funzioni pure di "Il Tuo Frigo".
  Esecuzione: node --test ./tests/fridge.test.mjs
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeFridgeSuggestions,
  computeGaps,
  computeDailyScore,
  computeWeeklyInsight,
  computeCookableRecipes,
  weakestMacro,
  computeShoppingList,
  expiringSoon,
  planRecipeDecrements
} from '../js/ui/fridgeView.js';

const NOW = 1_700_000_000_000;
const inHours = h => NOW + h * 3600_000;

function item(over = {}) {
  return {
    id: over.id || Math.random().toString(36),
    foodId: over.foodId || 'f', nome: over.nome || 'X',
    quantity: over.quantity ?? 500, unit: over.unit || 'g',
    expiresAt: over.expiresAt ?? null,
    per100g: over.per100g || { kcal: 100, proteine: 10, carboidrati: 10, grassi: 5 }
  };
}

// gaps con proteine come carenza principale
const gaps = { kcal: { remaining: 800, pct: 0.5 }, proteine: { remaining: 40, pct: 0.4 }, carboidrati: { remaining: 30, pct: 0.6 }, grassi: { remaining: 10, pct: 0.7 } };

test('frigo vuoto → nessun suggerimento', () => {
  assert.deepEqual(computeFridgeSuggestions(gaps, [], NOW), []);
});

test('zero carenze → nessun suggerimento (se non in scadenza)', () => {
  const noGaps = { kcal: { remaining: 0, pct: 1 }, proteine: { remaining: 0, pct: 1 }, carboidrati: { remaining: 0, pct: 1 }, grassi: { remaining: 0, pct: 1 } };
  assert.deepEqual(computeFridgeSuggestions(noGaps, [item()], NOW), []);
});

test('item proteico ordinato sopra item povero', () => {
  const ricco = item({ nome: 'Pollo', per100g: { kcal: 165, proteine: 31, carboidrati: 0, grassi: 4 } });
  const povero = item({ nome: 'Lattuga', per100g: { kcal: 15, proteine: 1, carboidrati: 2, grassi: 0 } });
  const r = computeFridgeSuggestions(gaps, [povero, ricco], NOW);
  assert.equal(r[0].item.nome, 'Pollo');
});

test('scadenza imminente alza lo score', () => {
  const fresco = item({ nome: 'A' });
  const scade = item({ nome: 'B', expiresAt: inHours(12) }); // <24h → urgenza 1
  const r = computeFridgeSuggestions(gaps, [fresco, scade], NOW);
  assert.equal(r[0].item.nome, 'B');
  assert.equal(r[0].soon, true);
});

test('item senza macro ma in scadenza compare comunque', () => {
  const vuoto = item({ nome: 'Misterioso', unit: 'pz', quantity: 2, expiresAt: inHours(10), per100g: {} });
  const r = computeFridgeSuggestions(gaps, [vuoto], NOW);
  assert.equal(r.length, 1);
  assert.equal(r[0].portionG, 0); // non calcolabile in grammi
});

test('item senza macro e senza scadenza → scartato', () => {
  const vuoto = item({ unit: 'pz', per100g: {}, expiresAt: null });
  assert.deepEqual(computeFridgeSuggestions(gaps, [vuoto], NOW), []);
});

test('cap a 5 risultati', () => {
  const many = Array.from({ length: 20 }, (_, i) => item({ id: 'i' + i, nome: 'n' + i }));
  assert.equal(computeFridgeSuggestions(gaps, many, NOW).length, 5);
});

test('porzione non supera la scorta disponibile', () => {
  const poco = item({ quantity: 30 }); // <150 default
  const r = computeFridgeSuggestions(gaps, [poco], NOW);
  assert.equal(r[0].portionG, 30);
});

test('performance: 100 item < 50ms', () => {
  const many = Array.from({ length: 100 }, (_, i) => item({ id: 'p' + i, expiresAt: i % 3 ? null : inHours(40) }));
  const t = performance.now();
  computeFridgeSuggestions(gaps, many, NOW);
  assert.ok(performance.now() - t < 50);
});

test('computeGaps: deficit corretto e nullo senza target', () => {
  assert.equal(computeGaps([], null), null);
  const meals = [{ macroCalcolate: { kcal: 500, proteine: 20, carboidrati: 50, grassi: 10 } }];
  const g = computeGaps(meals, { calorie: 2000, proteine: 100, carboidrati: 200, grassi: 60 });
  assert.equal(g.proteine.remaining, 80);
  assert.equal(g.kcal.remaining, 1500);
});

test('expiringSoon: solo <72h con scorta >0', () => {
  const items = [
    item({ nome: 'A', expiresAt: inHours(10) }),   // sì
    item({ nome: 'B', expiresAt: inHours(100) }),  // no, >72h
    item({ nome: 'C', expiresAt: null }),          // no, nessuna scadenza
    item({ nome: 'D', expiresAt: inHours(5), quantity: 0 }) // no, esaurito
  ];
  assert.deepEqual(expiringSoon(items, NOW).map(i => i.nome), ['A']);
});

test('computeDailyScore: 0..100', () => {
  const s = computeDailyScore(gaps, [{ foodRef: { id: 'a' } }], [item()], NOW);
  assert.ok(s >= 0 && s <= 100);
});

test('computeCookableRecipes: match per id e per nome, ordina per copertura', () => {
  const fridge = [
    item({ id: 'f1', foodId: 'pollo', nome: 'Petto di pollo', quantity: 400 }),
    item({ id: 'f2', foodId: 'riso', nome: 'Riso', quantity: 1000 })
  ];
  const recipes = [
    // 2/2 ingredienti: uno per id, uno per nome (foodRef senza id, come dal form)
    { id: 'r1', nome: 'Pollo e riso', porzioniBase: 1, ingredients: [
      { foodRef: { id: 'pollo', name: 'Petto di pollo' }, grammi: 150 },
      { foodRef: { name: 'riso' }, grammi: 100 } ] },
    // 1/2: manca la pasta
    { id: 'r2', nome: 'Pasta al pollo', porzioniBase: 1, ingredients: [
      { foodRef: { id: 'pollo' }, grammi: 100 },
      { foodRef: { name: 'pasta' }, grammi: 120 } ] },
    // 0/1: scartata (ratio<0.5)
    { id: 'r3', nome: 'Insalata', porzioniBase: 1, ingredients: [ { foodRef: { name: 'lattuga' }, grammi: 80 } ] }
  ];
  const r = computeCookableRecipes(recipes, fridge);
  assert.equal(r.length, 2);
  assert.equal(r[0].recipe.id, 'r1');
  assert.equal(r[0].have, 2);
  assert.equal(r[0].enough, 2);
  assert.deepEqual(r[1].missing, ['pasta']);
});

test('computeCookableRecipes: frigo o ricette vuoti → []', () => {
  assert.deepEqual(computeCookableRecipes([], [item()]), []);
  assert.deepEqual(computeCookableRecipes([{ id: 'x', nome: 'X', ingredients: [{ foodRef: { name: 'q' }, grammi: 10 }] }], []), []);
});

test('computeCookableRecipes: scorta insufficiente → match ma non enough', () => {
  const fridge = [item({ foodId: 'pollo', nome: 'Pollo', quantity: 50 })];
  const recipes = [{ id: 'r', nome: 'R', porzioniBase: 1, ingredients: [{ foodRef: { id: 'pollo' }, grammi: 200 }] }];
  const r = computeCookableRecipes(recipes, fridge);
  assert.equal(r[0].have, 1);
  assert.equal(r[0].enough, 0);
});

test('planRecipeDecrements: scala per id/nome, scala con porzioni, ignora pz', () => {
  const fridge = [
    item({ id: 'f1', foodId: 'pollo', nome: 'Pollo', quantity: 400, unit: 'g' }),
    item({ id: 'f2', foodId: 'riso', nome: 'Riso', quantity: 1000, unit: 'g' }),
    item({ id: 'f3', foodId: 'uova', nome: 'Uova', quantity: 6, unit: 'pz' })
  ];
  const ings = [
    { foodRef: { id: 'pollo' }, grammi: 150 },
    { foodRef: { name: 'Riso' }, grammi: 100 },   // match per nome
    { foodRef: { id: 'uova' }, grammi: 2 }          // pz → ignorato
  ];
  const plan = planRecipeDecrements(ings, 2, fridge); // 2 porzioni
  assert.equal(plan.get('f1'), 300); // 150*2
  assert.equal(plan.get('f2'), 200); // 100*2
  assert.equal(plan.has('f3'), false);
});

test('planRecipeDecrements: ingredienti ripetuti si sommano', () => {
  const fridge = [item({ id: 'f1', foodId: 'pollo', nome: 'Pollo', unit: 'g' })];
  const ings = [{ foodRef: { id: 'pollo' }, grammi: 50 }, { foodRef: { name: 'Pollo' }, grammi: 30 }];
  assert.equal(planRecipeDecrements(ings, 1, fridge).get('f1'), 80);
});

test('computeWeeklyInsight: null se <7 giorni', () => {
  assert.equal(computeWeeklyInsight([], []), null);
  const seven = Array.from({ length: 7 }, () => ({ pct: { proteine: 0.5, carboidrati: 1, grassi: 1 } }));
  const ins = computeWeeklyInsight(seven, [item({ nome: 'Pollo', per100g: { proteine: 31 } })]);
  assert.match(ins, /proteine/);
  assert.match(ins, /Pollo/);
});

test('weakestMacro: trova il macro più carente, null se sufficiente', () => {
  const seven = Array.from({ length: 7 }, () => ({ pct: { proteine: 0.4, carboidrati: 1, grassi: 0.95 } }));
  assert.equal(weakestMacro(seven).macro, 'proteine');
  const ok = Array.from({ length: 7 }, () => ({ pct: { proteine: 0.95, carboidrati: 1, grassi: 1 } }));
  assert.equal(weakestMacro(ok), null);
  assert.equal(weakestMacro([]), null);
});

test('computeShoppingList: top per macro, esclude ciò che è già nel frigo', () => {
  const foods = [
    { id: 'pollo', nome: 'Pollo', source: 'A', per100g: { proteine: 31 } },
    { id: 'tonno', nome: 'Tonno', source: 'A', per100g: { proteine: 26 } },
    { id: 'pane', nome: 'Pane', source: 'A', per100g: { proteine: 8 } },
    { id: 'olio', nome: 'Olio', source: 'A', per100g: { proteine: 0 } } // scartato: 0
  ];
  const fridge = [item({ foodId: 'pollo', nome: 'Pollo' })]; // già in frigo → escluso
  const r = computeShoppingList({ macro: 'proteine' }, foods, fridge, 5);
  assert.deepEqual(r.map(x => x.food.nome), ['Tonno', 'Pane']);
  assert.equal(r[0].value, 26);
});

test('computeShoppingList: null weak o DB vuoto → []', () => {
  assert.deepEqual(computeShoppingList(null, [{ id: 'a', nome: 'A', per100g: { proteine: 10 } }], []), []);
  assert.deepEqual(computeShoppingList({ macro: 'proteine' }, [], []), []);
});
