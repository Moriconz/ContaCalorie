/*
  Vista "Il Tuo Frigo" — inventario alimenti + gap nutrizionali del giorno +
  suggerimenti intelligenti + score giornaliero.

  Si integra con il resto dell'app SENZA nuove dipendenze:
  - dati frigo via storage.js (store `fridge`, DB v8)
  - macro via nutritionEngine.calculateMacrosForAmount
  - gap dal summary già calcolato da nutritionEngine.aggregateDailySummary
  - ricerca alimenti via nutritionDataProvider.searchFoods
  - modale aggiunta pasto = quello esistente (callback onAddFoodToMeal da app.js)
  - modali/conferme = sistema condiviso ui/modal.js

  app.js cabla la vista con callback (come per dashboard), quindi NESSUN import
  circolare verso app.js.
*/

import { escapeHtml } from '../utils.js';
import { showModal, closeModal, showConfirm } from './modal.js';
import { searchFoods } from '../nutritionDataProvider.js';
import { calculateMacrosForAmount, aggregateDailySummary } from '../nutritionEngine.js';
import { loadFridgeItems, saveFridgeItem, deleteFridgeItem, loadMealsByDate } from '../storage.js';

const SOON_MS = 72 * 60 * 60 * 1000;          // soglia "in scadenza": 72h
const MACROS = ['proteine', 'carboidrati', 'grassi']; // gap macro mostrati (kcal a parte)
const DEFAULT_PORTION_G = 150;                 // porzione ragionevole di default (g/ml)

// ───────────────────────── PURO: GAP ─────────────────────────

/**
 * Carenze del giorno a partire da pasti + target.
 * Ritorna { kcal, proteine, carboidrati, grassi } con i RIMANENTI (>=0),
 * più `pct` (0..1 di completamento) per ogni voce. Usa il confronto già
 * calcolato dall'engine (difference = actual - target), così la logica resta
 * una sola in tutta l'app.
 * @param {Array} meals  pasti del giorno (con macroCalcolate)
 * @param {Object|null} targets  { calorie, proteine, carboidrati, grassi }
 */
export function computeGaps(meals, targets) {
  if (!targets) return null;
  const s = aggregateDailySummary(meals || [], targets).confrontoConTarget;
  const gap = (cmp, target) => {
    const remaining = Math.max(0, -(cmp?.difference ?? -target)); // -(actual-target) = target-actual
    return { remaining: Number(remaining.toFixed(1)), pct: target ? Math.min(1, (cmp?.actual ?? 0) / target) : 0 };
  };
  return {
    kcal: gap(s.calorie, targets.calorie),
    proteine: gap(s.proteine, targets.proteine),
    carboidrati: gap(s.carboidrati, targets.carboidrati),
    grassi: gap(s.grassi, targets.grassi)
  };
}

// ───────────────── PURO: SUGGERIMENTI (cuore) ─────────────────
/*
  PSEUDOCODICE
  ------------
  input: gaps = { proteine:{remaining}, carboidrati:{remaining}, grassi:{remaining}, kcal:{remaining} }
         fridgeItems = [{ nome, quantity, unit, expiresAt, per100g:{proteine,carboidrati,grassi,kcal} }]

  prioritàGap = macro con remaining>0, ordinate per remaining DESC, prime 3
  se prioritàGap è vuoto -> return []           # giornata completa: niente da suggerire

  per ogni item nel frigo:
      se item non ha per100g utile (tutti 0) o quantity<=0 -> salta lo scoring macro
      porzione_g = porzione ragionevole:
          unit in {g,ml}: min(quantity, DEFAULT_PORTION_G)   # non suggerire più di quanto c'è
          unit pz:        non calcolabile in g -> porzione_g = 0 (score solo da scadenza)
      macro_porzione = per100g * porzione_g/100
      copertura = media( min(macro_porzione[m]/gap[m].remaining, 1) ) sui macro prioritari con remaining>0
      urgenza = f(expiresAt):  scaduto/<24h -> 1 ; <72h -> rampa 0.5..1 ; nessuna scadenza -> 0
      score = copertura*0.6 + urgenza*0.4
      scarta item con score==0  (non copre nulla e non scade)

  ordina per score DESC, ritorna top 5 con { item, porzione_g, copertura, urgenza, soon, contrib }
  Complessità O(n): <50ms per 100 item.
*/

function expiryUrgency(expiresAt, now) {
  if (!expiresAt) return 0;
  const left = expiresAt - now;
  if (left <= 24 * 60 * 60 * 1000) return 1;           // scaduto o entro 24h
  if (left >= SOON_MS) return 0;                        // oltre 72h: nessuna urgenza
  // rampa lineare 0.5 (a 72h) → 1 (a 24h)
  return 0.5 + 0.5 * (SOON_MS - left) / (SOON_MS - 24 * 60 * 60 * 1000);
}

/**
 * Funzione PURA: nessun I/O, nessuna dipendenza esterna. < 50ms con 100 item.
 * @param {Object} gaps  output di computeGaps (o null)
 * @param {Array}  fridgeItems
 * @param {number} [now] timestamp (iniettabile per i test)
 * @returns {Array} top 5 suggerimenti
 */
export function computeFridgeSuggestions(gaps, fridgeItems, now = Date.now()) {
  if (!Array.isArray(fridgeItems) || fridgeItems.length === 0) return [];

  // Macro prioritari: remaining>0, ordinati per urgenza relativa (remaining DESC), max 3.
  const priority = gaps
    ? MACROS.filter(m => gaps[m]?.remaining > 0).sort((a, b) => gaps[b].remaining - gaps[a].remaining).slice(0, 3)
    : [];

  const out = [];
  for (const item of fridgeItems) {
    if (!item || (item.quantity ?? 0) <= 0) continue;
    const p = item.per100g || {};
    const hasMacros = (p.kcal || p.proteine || p.carboidrati || p.grassi) > 0;

    const portionG = (item.unit === 'pz' || !hasMacros)
      ? 0
      : Math.min(item.quantity, DEFAULT_PORTION_G);

    // Copertura media sui macro prioritari (0 se porzione non calcolabile o nessun gap).
    let coverage = 0;
    const contrib = {};
    if (portionG > 0 && priority.length) {
      let sum = 0;
      for (const m of priority) {
        const amount = (p[m] || 0) * portionG / 100;
        contrib[m] = Number(amount.toFixed(1));
        sum += Math.min(amount / gaps[m].remaining, 1);
      }
      coverage = sum / priority.length;
    }

    const urgency = expiryUrgency(item.expiresAt, now);
    const score = coverage * 0.6 + urgency * 0.4;
    if (score <= 0) continue; // non copre nulla e non scade: niente da suggerire

    out.push({
      item,
      portionG,
      coverage: Number(coverage.toFixed(3)),
      urgency: Number(urgency.toFixed(3)),
      soon: urgency > 0,
      score: Number(score.toFixed(4)),
      contrib
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ──────────────── PURO: SCORE GIORNALIERO (0..100) ────────────────

/**
 * score = completezza_macro*0.5 + varietà_alimenti*0.3 + utilizzo_scadenze*0.2
 * @param {Object|null} gaps
 * @param {Array} meals  pasti del giorno
 * @param {Array} fridgeItems
 */
export function computeDailyScore(gaps, meals, fridgeItems, now = Date.now()) {
  // completezza: media pct di kcal+3 macro (cap a 1)
  const parts = gaps ? [gaps.kcal.pct, gaps.proteine.pct, gaps.carboidrati.pct, gaps.grassi.pct] : [0];
  const completeness = parts.reduce((a, b) => a + b, 0) / parts.length;

  // varietà: alimenti distinti loggati oggi, saturazione a 5
  const distinct = new Set((meals || []).map(m => m.foodRef?.id || m.foodRef?.name || m.note)).size;
  const variety = Math.min(distinct / 5, 1);

  // utilizzo scadenze: 1 se nulla scade a breve; altrimenti quota di item in
  // scadenza che NON sono più nel frigo per intero (proxy: niente da fare qui senza
  // storico → premia chi non ha sprechi imminenti, penalizza chi ne accumula).
  const soon = expiringSoon(fridgeItems, now);
  const expired = soon.filter(i => i.expiresAt - now <= 0).length;
  const usage = soon.length === 0 ? 1 : Math.max(0, 1 - expired / soon.length);

  return Math.round((completeness * 0.5 + variety * 0.3 + usage * 0.2) * 100);
}

/** Item con scadenza entro 72h e scorta >0. Puro, riusato da score e notifiche. */
export function expiringSoon(fridgeItems, now = Date.now()) {
  return (fridgeItems || []).filter(i => i.expiresAt && (i.expiresAt - now) < SOON_MS && (i.quantity ?? 0) > 0);
}

// ───────────────── NOTIFICHE DI SCADENZA (PWA) ─────────────────
// Note: su iOS le notifiche web richiedono PWA installata + iOS 16.4+.

const NOTIFIED_KEY = 'fridgeExpiryNotified';

export function notificationsState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestExpiryNotifications() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

/**
 * Notifica gli item in scadenza, max 1 volta al giorno (flag in localStorage).
 * No-op se permesso non concesso o niente in scadenza. Ritorna true se ha notificato.
 */
export function maybeNotifyExpiring(fridgeItems, now = Date.now()) {
  if (notificationsState() !== 'granted') return false;
  const today = new Date(now).toISOString().slice(0, 10);
  if (localStorage.getItem(NOTIFIED_KEY) === today) return false;
  const soon = expiringSoon(fridgeItems, now);
  if (!soon.length) return false;
  const names = soon.slice(0, 3).map(i => i.nome).join(', ');
  const extra = soon.length > 3 ? ` +${soon.length - 3}` : '';
  try {
    new Notification('🧊 Frigo: in scadenza', { body: `${names}${extra} — usali entro 72h`, tag: 'fridge-expiry' });
    localStorage.setItem(NOTIFIED_KEY, today);
    return true;
  } catch { return false; }
}

/**
 * Insight testuale dopo ≥7 giorni di dati: trova il macro mediamente più carente
 * e, se nel frigo c'è qualcosa che aiuta, lo suggerisce.
 * @param {Array} last7Summaries  [{ pct:{proteine,carboidrati,grassi} }] ultimi 7 giorni
 * @param {Array} fridgeItems
 */
/**
 * Macro mediamente più carente su ≥7 giorni di dati reali. null se dati
 * insufficienti o nessuna carenza ricorrente (>=90% del target in media).
 * Condiviso tra insight testuale e lista della spesa.
 */
export function weakestMacro(last7Summaries) {
  if (!Array.isArray(last7Summaries) || last7Summaries.length < 7) return null;
  const avg = {};
  for (const m of MACROS) avg[m] = last7Summaries.reduce((a, s) => a + (s.pct?.[m] ?? 1), 0) / last7Summaries.length;
  const weakest = MACROS.reduce((a, b) => (avg[a] <= avg[b] ? a : b));
  return avg[weakest] >= 0.9 ? null : { macro: weakest, avg: avg[weakest] };
}

export function computeWeeklyInsight(last7Summaries, fridgeItems) {
  const weak = weakestMacro(last7Summaries);
  if (!weak) return null;
  const label = { proteine: 'le proteine', carboidrati: 'i carboidrati', grassi: 'i grassi' }[weak.macro];
  const helper = (fridgeItems || [])
    .filter(i => (i.quantity ?? 0) > 0 && (i.per100g?.[weak.macro] || 0) > 0)
    .sort((a, b) => (b.per100g[weak.macro] || 0) - (a.per100g[weak.macro] || 0))[0];
  return helper
    ? `Di solito non raggiungi ${label}. Nel frigo hai ${helper.nome}: può aiutarti.`
    : `Di solito non raggiungi ${label}. Tienine conto nella spesa.`;
}

// ───────────── PURO: LISTA DELLA SPESA DAI GAP RICORRENTI ─────────────

/**
 * Alimenti da comprare per colmare la carenza cronica: i più ricchi del macro
 * debole, esclusi quelli già nel frigo. L'inverso del frigo.
 * @param {{macro:string}|null} weak  output di weakestMacro
 * @param {Array} allFoods  da getAllFoods() — { id, nome, source, per100g }
 * @param {Array} fridgeItems
 * @param {number} [limit]
 */
export function computeShoppingList(weak, allFoods, fridgeItems, limit = 5) {
  if (!weak || !Array.isArray(allFoods) || !allFoods.length) return [];
  const m = weak.macro;
  const haveIds = new Set();
  const haveNames = new Set();
  for (const it of (fridgeItems || [])) {
    if ((it.quantity ?? 0) <= 0) continue;
    if (it.foodId) haveIds.add(it.foodId);
    haveNames.add(normName(it.nome));
  }
  return allFoods
    .filter(f => (f.per100g?.[m] || 0) > 0 && !haveIds.has(f.id) && !haveNames.has(normName(f.nome)))
    .sort((a, b) => (b.per100g[m] || 0) - (a.per100g[m] || 0))
    .slice(0, limit)
    .map(f => ({ food: f, macro: m, value: Number((f.per100g[m] || 0).toFixed(1)) }));
}

// ───────────── PURO: RICETTE CUCINABILI DAL FRIGO ─────────────

function normName(s) { return (s || '').toLowerCase().trim(); }

/**
 * Quali ricette salvate puoi (quasi) cucinare con le scorte attuali.
 * Match per foodRef.id (===fridge.foodId) o, in mancanza, per nome normalizzato:
 * il form ricette salva alcuni ingredienti col solo `name`, senza id.
 * @param {Array} recipes  da loadRecipes() — { nome, porzioniBase, ingredients:[{foodRef:{id?,name},grammi}] }
 * @param {Array} fridgeItems
 * @returns {Array} ricette con ratio>=0.5, ordinate, top 3
 */
export function computeCookableRecipes(recipes, fridgeItems) {
  if (!Array.isArray(recipes) || !recipes.length || !Array.isArray(fridgeItems) || !fridgeItems.length) return [];
  const byId = new Map();
  const byName = new Map();
  for (const it of fridgeItems) {
    if ((it.quantity ?? 0) <= 0) continue;
    if (it.foodId) byId.set(it.foodId, it);
    byName.set(normName(it.nome), it);
  }

  const out = [];
  for (const r of recipes) {
    const ings = r.ingredients || [];
    if (!ings.length) continue;
    let have = 0, enough = 0;
    const missing = [];
    for (const ing of ings) {
      const fr = ing.foodRef || {};
      const item = (fr.id && byId.get(fr.id)) || byName.get(normName(fr.name));
      if (!item) { missing.push(fr.name || 'ingrediente'); continue; }
      have++;
      const need = (ing.grammi || 0) * (r.porzioniBase || 1);
      if (item.unit === 'pz' || (item.quantity || 0) >= need) enough++;
    }
    const total = ings.length;
    const ratio = have / total;
    if (ratio >= 0.5) out.push({ recipe: r, have, enough, total, missing, ratio });
  }
  return out.sort((a, b) => b.ratio - a.ratio || b.enough - a.enough).slice(0, 3);
}

// ───────────────── EFFETTO COLLATERALE: DECREMENTO ─────────────────

/**
 * Quando l'utente logga un pasto, scala la quantità dell'alimento corrispondente
 * nel frigo. Match per foodId (===foodRef.id). Solo unità g/ml (grammi loggati).
 * Chiamata da app.js dopo ogni saveMealEntries del flusso "aggiungi alimento".
 * @param {{id:string}} foodRef
 * @param {number} grams
 */
export async function applyMealToFridge(foodRef, grams) {
  if (!foodRef?.id || !grams) return;
  const items = await loadFridgeItems();
  const match = items.find(i => i.foodId === foodRef.id && (i.unit === 'g' || i.unit === 'ml'));
  if (!match) return;
  const next = Math.max(0, (match.quantity || 0) - grams);
  if (next <= 0) await deleteFridgeItem(match.id);     // esaurito: esce dal frigo
  else await saveFridgeItem({ ...match, quantity: Math.round(next) });
}

/**
 * PURO: grammi da scalare per ogni item del frigo cucinando una ricetta.
 * Match per foodRef.id o nome (come computeCookableRecipes). Solo g/ml; gli `pz`
 * non sono confrontabili in grammi e vengono ignorati. Ingredienti ripetuti si
 * sommano sullo stesso item.
 * @returns {Map<string,number>} fridgeItemId → grammi
 */
export function planRecipeDecrements(ingredients, portions, fridgeItems) {
  const byId = new Map();
  const byName = new Map();
  for (const it of (fridgeItems || [])) {
    if (it.foodId) byId.set(it.foodId, it);
    byName.set(normName(it.nome), it);
  }
  const plan = new Map();
  for (const ing of (ingredients || [])) {
    const fr = ing.foodRef || {};
    const item = (fr.id && byId.get(fr.id)) || byName.get(normName(fr.name));
    if (!item || (item.unit !== 'g' && item.unit !== 'ml')) continue;
    plan.set(item.id, (plan.get(item.id) || 0) + (ing.grammi || 0) * (portions || 1));
  }
  return plan;
}

/** Applica al frigo i decrementi di una ricetta cucinata. Chiamata da app.js. */
export async function applyRecipeToFridge(ingredients, portions = 1) {
  if (!Array.isArray(ingredients) || !ingredients.length) return;
  const items = await loadFridgeItems();
  if (!items.length) return;
  const plan = planRecipeDecrements(ingredients, portions, items);
  for (const [id, grams] of plan) {
    const item = items.find(i => i.id === id);
    if (!item) continue;
    const next = Math.max(0, (item.quantity || 0) - grams);
    if (next <= 0) await deleteFridgeItem(id);
    else await saveFridgeItem({ ...item, quantity: Math.round(next) });
  }
}

// ───────────────────────── RENDER ─────────────────────────

function macroBarColor(pct) {
  if (pct >= 1) return 'var(--success)';
  if (pct >= 0.7) return 'var(--accent-orange, #ff9f0a)';
  return 'var(--primary)';
}

function fmtExpiry(expiresAt, now = Date.now()) {
  if (!expiresAt) return '';
  const days = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));
  if (days < 0) return '⚠️ scaduto';
  if (days === 0) return '⚠️ scade oggi';
  if (days === 1) return '⚠️ scade domani';
  return `scade tra ${days}g`;
}

function gapsHtml(gaps) {
  if (!gaps) {
    return `<div class="empty-state"><span class="empty-state-emoji">🎯</span>
      <div class="empty-state-title">Obiettivi non impostati</div>
      <div class="empty-state-hint">Completa il profilo per vedere le carenze del giorno.</div></div>`;
  }
  const rows = [['kcal', 'Calorie', 'kcal'], ['proteine', 'Proteine', 'g'], ['carboidrati', 'Carboidrati', 'g'], ['grassi', 'Grassi', 'g']]
    .map(([key, label, u]) => {
      const g = gaps[key];
      const pct = Math.round(g.pct * 100);
      return `<div class="fridge-macro">
        <div class="fridge-macro-head"><span>${label}</span>
          <span class="small-muted">${g.remaining > 0 ? `mancano ${g.remaining}${u}` : '✓ raggiunto'}</span></div>
        <div class="fridge-bar"><div class="fridge-bar-fill" style="width:${Math.min(pct, 100)}%;background:${macroBarColor(g.pct)}"></div></div>
      </div>`;
    }).join('');
  return rows;
}

function suggestionCardHtml(sug, i) {
  const it = sug.item;
  const badge = sug.soon ? `<span class="fridge-badge">${fmtExpiry(it.expiresAt)}</span>` : '';
  const preview = MACROS.filter(m => sug.contrib[m] > 0)
    .map(m => `<span class="fridge-mini">${m[0].toUpperCase()} +${sug.contrib[m]}g</span>`).join('');
  const portion = sug.portionG > 0 ? `${sug.portionG} ${it.unit}` : `${it.quantity} ${it.unit}`;
  return `<button class="fridge-sug" data-sug="${i}" type="button" style="animation-delay:${i * 70}ms">
      <div class="fridge-sug-head"><strong>${escapeHtml(it.nome)}</strong>${badge}</div>
      <div class="small-muted">Suggerito: ${portion}</div>
      <div class="fridge-mini-row">${preview || '<span class="small-muted">in scadenza</span>'}</div>
    </button>`;
}

function macroLabel(m) {
  return { proteine: 'proteine', carboidrati: 'carboidrati', grassi: 'grassi' }[m] || m;
}

function shoppingItemHtml(s) {
  return `<li class="fridge-shop-item">
      <div><div class="list-item-title">${escapeHtml(s.food.nome)}</div>
        <div class="small-muted">${s.value}g ${macroLabel(s.macro)} / 100g</div></div>
      <button class="secondary small-action" data-buy="${escapeHtml(s.food.id)}" type="button">+ Frigo</button>
    </li>`;
}

function recipeCardHtml(c, i) {
  const r = c.recipe;
  const complete = c.have === c.total;
  const missTxt = c.missing.length
    ? `ti manca: ${c.missing.slice(0, 3).map(escapeHtml).join(', ')}`
    : (c.enough === c.total ? 'hai tutto ✓' : 'quantità da verificare');
  return `<button class="fridge-sug fridge-recipe" data-recipe="${escapeHtml(r.id)}" type="button" style="animation-delay:${i * 70}ms">
      <div class="fridge-sug-head"><strong>${escapeHtml(r.nome)}</strong>
        <span class="fridge-mini">${c.have}/${c.total}${complete ? ' 🍳' : ''}</span></div>
      <div class="small-muted">${missTxt}</div>
    </button>`;
}

function inventoryItemHtml(it, now) {
  const exp = fmtExpiry(it.expiresAt, now);
  const soon = it.expiresAt && (it.expiresAt - now) < SOON_MS;
  return `<li class="fridge-item${soon ? ' fridge-item-soon' : ''}" data-id="${it.id}">
      <div class="fridge-item-main">
        <div class="list-item-title">${escapeHtml(it.nome)}</div>
        <div class="small-muted">${it.quantity} ${it.unit}${exp ? ` · ${exp}` : ''}</div>
      </div>
      <div class="fridge-item-actions">
        <button class="secondary small-action" data-act="dec" data-id="${it.id}" type="button" aria-label="Riduci">−</button>
        <button class="secondary small-action" data-act="inc" data-id="${it.id}" type="button" aria-label="Aumenta">+</button>
        <button class="secondary small-action" data-act="del" data-id="${it.id}" type="button" aria-label="Elimina">🗑</button>
      </div>
    </li>`;
}

/**
 * Render della vista. I dati arrivano già caricati da app.js (renderFridgeViewPage),
 * per coerenza con le altre viste che ricevono lo stato.
 * @param {Object} data { fridgeItems, gaps, meals, score, insight }
 */
export function renderFridgeView(data) {
  const { fridgeItems = [], gaps = null, meals = [], score = 0, insight = null, recipes = [], allFoods = [], weak = null } = data || {};
  const now = Date.now();
  const suggestions = computeFridgeSuggestions(gaps, fridgeItems, now);
  const cookable = computeCookableRecipes(recipes, fridgeItems);
  const shopping = computeShoppingList(weak, allFoods, fridgeItems);

  const inventory = fridgeItems.length
    ? `<ul class="list-group fridge-list">${fridgeItems
        .slice().sort((a, b) => (a.expiresAt || Infinity) - (b.expiresAt || Infinity))
        .map(it => inventoryItemHtml(it, now)).join('')}</ul>`
    : `<div class="empty-state"><span class="empty-state-emoji">🧊</span>
        <div class="empty-state-title">Frigo vuoto</div>
        <div class="empty-state-hint">Aggiungi un alimento con “+ Aggiungi” per ricevere suggerimenti.</div></div>`;

  let suggestionsBlock;
  if (!gaps) {
    suggestionsBlock = ''; // gap-block già mostra "obiettivi non impostati"
  } else if (suggestions.length) {
    suggestionsBlock = `<section class="section card">
        <h2>Suggeriti per le tue carenze</h2>
        <div class="fridge-sug-grid">${suggestions.map(suggestionCardHtml).join('')}</div>
      </section>`;
  } else if (fridgeItems.length) {
    suggestionsBlock = `<section class="section card">
        <h2>Suggeriti per le tue carenze</h2>
        <div class="empty-state"><span class="empty-state-emoji">✅</span>
          <div class="empty-state-title">Giornata completa</div>
          <div class="empty-state-hint">Nessuna carenza da colmare. Ottimo lavoro!</div></div>
      </section>`;
  } else {
    suggestionsBlock = '';
  }

  return `
    <section class="section card">
      <div class="card-head"><h1>Il Tuo Frigo</h1>
        <div class="fridge-score" data-score="${score}"><span class="fridge-score-num">${score}</span><span class="fridge-score-max">/100</span></div>
      </div>
      ${insight ? `<p class="fridge-insight">💡 ${escapeHtml(insight)}</p>` : ''}
    </section>

    <section class="section card">
      <h2>Carenze di oggi</h2>
      ${gapsHtml(gaps)}
    </section>

    ${suggestionsBlock}

    ${cookable.length ? `<section class="section card">
        <h2>Cosa puoi cucinare</h2>
        <div class="fridge-sug-grid">${cookable.map(recipeCardHtml).join('')}</div>
      </section>` : ''}

    ${shopping.length ? `<section class="section card">
        <h2>Lista della spesa</h2>
        <p class="small-muted">Di solito ti mancano ${macroLabel(weak.macro)}. Da comprare:</p>
        <ul class="list-group fridge-shop">${shopping.map(shoppingItemHtml).join('')}</ul>
      </section>` : ''}

    <section class="section card">
      <div class="card-head"><h2>Inventario</h2>
        <div style="display:flex;gap:.4rem">${notifyButtonHtml()}
          <button id="fridgeAdd" class="primary small-action" type="button">+ Aggiungi</button></div></div>
      ${inventory}
    </section>
  `;
}

function notifyButtonHtml() {
  const state = notificationsState();
  if (state === 'unsupported' || state === 'granted') return '';
  if (state === 'denied') return `<button class="secondary small-action" disabled title="Notifiche bloccate dal browser">🔕</button>`;
  return `<button id="fridgeNotify" class="secondary small-action" type="button" title="Promemoria scadenze">🔔</button>`;
}

// ───────────────────────── EVENTI ─────────────────────────

/**
 * @param {HTMLElement} container
 * @param {Object} callbacks { onChanged, onAddFoodToMeal }
 *   onChanged() -> app.js ricarica i dati e ri-renderizza la vista
 *   onAddFoodToMeal(food, grams) -> apre il modale pasto ESISTENTE pre-compilato
 * @param {Object} data { fridgeItems, gaps }
 */
export function bindFridgeViewEvents(container, callbacks, data) {
  const { fridgeItems = [], gaps = null, allFoods = [], weak = null } = data || {};
  const now = Date.now();
  const suggestions = computeFridgeSuggestions(gaps, fridgeItems, now);
  const shopping = computeShoppingList(weak, allFoods, fridgeItems);

  // Animazione contatore score 0 → valore (800ms, ease-out).
  animateScore(container.querySelector('.fridge-score'));

  // Tap su suggerimento → modale pasto esistente, pre-compilato.
  container.querySelectorAll('.fridge-sug').forEach(btn => {
    btn.addEventListener('click', () => {
      const sug = suggestions[Number(btn.dataset.sug)];
      if (!sug) return;
      const it = sug.item;
      const food = { id: it.foodId || it.id, source: it.source || 'USER_CUSTOM', nome: it.nome, porzioneBase: '100 g', per100g: it.per100g || {} };
      const grams = sug.portionG > 0 ? sug.portionG : it.quantity;
      callbacks.onAddFoodToMeal?.(food, grams);
    });
  });

  // Tap su ricetta cucinabile → flusso "aggiungi ricetta" ESISTENTE.
  container.querySelectorAll('.fridge-recipe').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onCookRecipe?.(btn.dataset.recipe));
  });

  // Lista della spesa → un tap aggiunge l'alimento al frigo (default 500g), poi
  // si regola da inventario. Chiude il loop: compra → è nel frigo → suggerito.
  container.querySelectorAll('[data-buy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const f = shopping.find(s => s.food.id === btn.dataset.buy)?.food;
      if (!f) return;
      await saveFridgeItem({ foodId: f.id, source: f.source, nome: f.nome, quantity: 500, unit: 'g', expiresAt: null, per100g: f.per100g || {} });
      callbacks.onChanged?.();
    });
  });

  // Attiva promemoria scadenze: chiede il permesso, poi notifica subito se serve.
  container.querySelector('#fridgeNotify')?.addEventListener('click', async () => {
    await requestExpiryNotifications();
    maybeNotifyExpiring(fridgeItems);
    callbacks.onChanged?.(); // aggiorna il bottone (granted → sparisce)
  });

  // Aggiungi alimento al frigo (ricerca nel DB esistente).
  container.querySelector('#fridgeAdd')?.addEventListener('click', () => openAddToFridgeModal(callbacks.onChanged));

  // Azioni per item: −10% / +10% / elimina.
  container.querySelectorAll('.fridge-item-actions [data-act]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const item = fridgeItems.find(i => i.id === id);
      if (!item) return;
      if (btn.dataset.act === 'del') {
        if (await showConfirm(`Rimuovere ${item.nome} dal frigo?`, { danger: true, confirmLabel: 'Rimuovi' })) {
          await deleteFridgeItem(id);
          callbacks.onChanged?.();
        }
        return;
      }
      const step = item.unit === 'pz' ? 1 : 50;
      const delta = btn.dataset.act === 'inc' ? step : -step;
      const next = Math.max(0, (item.quantity || 0) + delta);
      if (next <= 0) await deleteFridgeItem(id);
      else await saveFridgeItem({ ...item, quantity: next });
      callbacks.onChanged?.();
    });
  });
}

function animateScore(el) {
  if (!el) return;
  const target = Number(el.dataset.score) || 0;
  const numEl = el.querySelector('.fridge-score-num');
  numEl.textContent = target; // default sempre corretto: l'animazione è solo enhancement
  // Salta il count-up se reduced-motion o pagina non visibile: su tab nascosti e
  // renderer headless rAF è in pausa e il numero resterebbe a 0. Il valore reale
  // è già a schermo, quindi non animare è sicuro.
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || document.hidden || target === 0) return;
  numEl.textContent = '0'; // parte il conteggio
  const start = performance.now();
  function tick(t) {
    const k = Math.min(1, (t - start) / 800);
    const eased = 1 - Math.pow(1 - k, 3); // ease-out cubic
    numEl.textContent = Math.round(target * eased);
    if (k < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/** Modale "+ Aggiungi": cerca nel DB alimenti, scegli quantità/unità/scadenza. */
function openAddToFridgeModal(onChanged) {
  const html = `
    <div class="fridge-add">
      <h1>Aggiungi al frigo</h1>
      <input id="fridgeSearch" type="search" placeholder="Cerca alimento…" autocomplete="off" style="font-size:16px;width:100%">
      <ul id="fridgeResults" class="list-group"></ul>
      <div id="fridgeForm" hidden>
        <p><strong id="fridgePicked"></strong></p>
        <div class="field-grid">
          <label>Quantità<input id="fridgeQty" type="number" min="1" value="500" style="font-size:16px"></label>
          <label>Unità<select id="fridgeUnit"><option value="g">g</option><option value="ml">ml</option><option value="pz">pz</option></select></label>
        </div>
        <label>Scadenza (opzionale)<input id="fridgeExp" type="date"></label>
        <div class="field-grid">
          <button id="fridgeSave" class="primary" type="button">Salva nel frigo</button>
          <button id="fridgeCancelPick" class="secondary" type="button">Indietro</button>
        </div>
      </div>
    </div>`;
  showModal(html, root => {
    const search = root.querySelector('#fridgeSearch');
    const results = root.querySelector('#fridgeResults');
    const form = root.querySelector('#fridgeForm');
    let picked = null;
    let timer;

    search.addEventListener('input', () => {
      clearTimeout(timer);
      const q = search.value.trim();
      timer = setTimeout(async () => {
        if (q.length < 2) { results.innerHTML = ''; return; }
        const found = await searchFoods(q);
        results.innerHTML = found.slice(0, 8).map((f, i) =>
          `<li><button class="secondary small-action" data-i="${i}" type="button">${escapeHtml(f.nome)}</button></li>`).join('')
          || '<li class="small-muted" style="list-style:none">Nessun risultato</li>';
        results.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => {
          picked = found[Number(b.dataset.i)];
          root.querySelector('#fridgePicked').textContent = picked.nome;
          results.innerHTML = '';
          search.hidden = true;
          form.hidden = false;
        }));
      }, 200);
    });

    root.querySelector('#fridgeCancelPick').addEventListener('click', () => {
      form.hidden = true; search.hidden = false; search.focus();
    });

    root.querySelector('#fridgeSave').addEventListener('click', async () => {
      if (!picked) return;
      const qty = Number(root.querySelector('#fridgeQty').value);
      if (!qty || qty < 1) return;
      const expVal = root.querySelector('#fridgeExp').value;
      await saveFridgeItem({
        foodId: picked.id,
        source: picked.source,
        nome: picked.nome,
        quantity: Math.round(qty),
        unit: root.querySelector('#fridgeUnit').value,
        expiresAt: expVal ? new Date(expVal).getTime() : null,
        per100g: picked.per100g || {}
      });
      closeModal();
      onChanged?.();
    });
  });
}
