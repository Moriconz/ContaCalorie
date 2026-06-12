/*
  Navigazione gerarchica del database CREA.
  Struttura: base alimento → taglio → variante (con/senza pelle) → cottura → foglia (id alimento)

  L'albero è generato da data/crea_hierarchy.json. Ogni nodo: { c: {figli}, f: idAlimento|null }.
*/

let _tree = null;

// Sinonimi di ricerca: il CREA usa termini anatomici (fuso/sovracoscia) per "coscia"
const SEARCH_ALIASES = {
  'coscia': ['fuso', 'sovracoscia', 'coscio'],
  'cosce': ['fuso', 'sovracoscia', 'coscio'],
  'ala': ['ala'],
  'ali': ['ala'],
  'fusello': ['fuso'],
};

export async function loadHierarchy() {
  if (_tree) return _tree;
  const res = await fetch('/data/crea_hierarchy.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  _tree = data.tree || {};
  console.log(`🌳 Gerarchia CREA: ${Object.keys(_tree).length} basi`);
  return _tree;
}

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Parole vuote da ignorare nella query (connettivi)
const STOPWORDS = new Set(['di','del','della','dei','degli','delle','da','a','ad','e','ed','la','il','lo','le','i','gli','un','uno','una','in','su','per']);

// Un token matcha una parola dell'haystack se è uguale o ne è prefisso (min 3 char)
function wordMatch(token, words) {
  for (const w of words) {
    if (w === token) return true;
    if (token.length >= 3 && w.startsWith(token)) return true;
  }
  return false;
}

/**
 * Cerca alimenti base per nome. Espande gli alias (coscia → fuso/sovracoscia).
 * @returns {Array<{base, node, variantCount}>}
 */
export async function searchBases(query) {
  const tree = await loadHierarchy();
  const q = norm(query);
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(t => t.length > 1 && !STOPWORDS.has(t));
  if (!tokens.length) return [];

  const matches = [];
  for (const [base, node] of Object.entries(tree)) {
    // insieme di parole cercabili = nome base + etichette dei segmenti interni
    const words = norm(base + ' ' + collectLabels(node).join(' ')).split(/\s+/);
    // ogni token deve matchare una parola, direttamente o tramite alias
    const ok = tokens.every(t => {
      if (wordMatch(t, words)) return true;
      const aliases = SEARCH_ALIASES[t];
      return aliases ? aliases.some(a => wordMatch(norm(a), words)) : false;
    });
    if (ok) matches.push({ base, node, variantCount: countLeaves(node) });
  }
  return matches.sort((a, b) => a.base.localeCompare(b.base));
}

function collectLabels(node, acc = []) {
  for (const [k, child] of Object.entries(node.c || {})) {
    acc.push(k);
    collectLabels(child, acc);
  }
  return acc;
}

function countLeaves(node) {
  let n = node.f ? 1 : 0;
  for (const ch of Object.values(node.c || {})) n += countLeaves(ch);
  return n;
}

/**
 * Restituisce le opzioni navigabili da un nodo, collassando le catene a figlio unico.
 * Es: "cotto" → (solo figlio "al forno") → opzione unica "cotto, al forno".
 * @returns {Array<{label, node, foodId, hasChildren}>}
 */
export function getOptions(node) {
  const options = [];
  for (const [key, child] of Object.entries(node.c || {})) {
    let label = key;
    let cur = child;
    // collassa catene: nodo senza cibo e con un solo figlio
    while (!cur.f && Object.keys(cur.c || {}).length === 1) {
      const [k, c] = Object.entries(cur.c)[0];
      label += ', ' + k;
      cur = c;
    }
    options.push({
      label,
      node: cur,
      foodId: cur.f || null,
      hasChildren: Object.keys(cur.c || {}).length > 0
    });
  }
  return options;
}

export function isLeaf(node) {
  return !!node.f && Object.keys(node.c || {}).length === 0;
}
