/*
  Regressione storage: ogni meal entry DEVE avere un id, altrimenti store.put
  fallisce (keyPath 'id') e il pasto finisce nel fallback localStorage invisibile
  alle letture da IndexedDB → perdita dati. Bug trovato in QA, fix in _migrateMealEntry.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _migrateMealEntry } from '../js/storage.js';

test('_migrateMealEntry: assegna un id quando manca (anti-perdita dati)', () => {
  const m = _migrateMealEntry({ data: '2026-06-26', momento: 'pranzo', grammi: 150, macroCalcolate: { kcal: 200 } });
  assert.ok(m.id && typeof m.id === 'string', 'id mancante: il pasto si perderebbe nel fallback localStorage');
});

test('_migrateMealEntry: preserva l\'id esistente', () => {
  const m = _migrateMealEntry({ id: 'fixed-123', data: '2026-06-26', grammi: 100, macroCalcolate: {} });
  assert.equal(m.id, 'fixed-123');
});

test('_migrateMealEntry: id diversi per entry diverse senza id', () => {
  const a = _migrateMealEntry({ grammi: 1, macroCalcolate: {} });
  const b = _migrateMealEntry({ grammi: 1, macroCalcolate: {} });
  assert.notEqual(a.id, b.id);
});

test('_migrateMealEntry: null in ingresso → null', () => {
  assert.equal(_migrateMealEntry(null), null);
});
