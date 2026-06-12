/*
  Utility condivise (pure, senza side-effect).
  Centralizzano funzioni ripetute in più moduli: escaping HTML, formattazione date, ecc.
*/

/**
 * Esegue l'escape dei caratteri HTML pericolosi.
 * Da usare su QUALSIASI stringa controllata dall'utente prima di inserirla in innerHTML.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Data odierna in formato ISO YYYY-MM-DD (ora locale).
 */
/**
 * Empty state coerente: emoji + titolo + suggerimento.
 * Usalo al posto dei vari "Nessun..." sparsi nei template.
 */
export function emptyStateHtml(emoji, title, hint = '') {
  return `
    <div class="empty-state">
      <span class="empty-state-emoji" aria-hidden="true">${emoji}</span>
      <div class="empty-state-title">${title}</div>
      ${hint ? `<div class="empty-state-hint">${hint}</div>` : ''}
    </div>
  `;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formatta una data ISO (YYYY-MM-DD) in italiano leggibile.
 * @param {string} iso - es. "2026-05-22"
 * @param {Object} [opts] - { weekday: boolean } per includere il giorno della settimana
 * @returns {string} es. "giovedì 22 maggio 2026" oppure "22 maggio 2026"
 */
export function formatDateIT(iso, opts = {}) {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('it-IT', {
    weekday: opts.weekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Formato breve (es. "22 mag") utile per grafici/liste.
 */
export function formatDateShortIT(iso) {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/**
 * Prima lettera maiuscola.
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Genera un array di N date ISO consecutive che termina a `endDateISO` (inclusa).
 * Es. buildLastNDates('2026-05-22', 7) → [...16,17,18,19,20,21,22].
 * @param {string} endDateISO - data finale YYYY-MM-DD
 * @param {number} n - numero di giorni
 * @returns {string[]} date ISO ordinate dalla più vecchia alla più recente
 */
export function buildLastNDates(endDateISO, n) {
  const out = [];
  // UTC per coerenza con le date salvate dall'app (basate su toISOString)
  const end = new Date((endDateISO || todayISO()) + 'T00:00:00Z');
  const DAY = 86400000;
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(end.getTime() - i * DAY).toISOString().slice(0, 10));
  }
  return out;
}

// === DETTATURA VOCALE (Web Speech API) ===

/** True se il browser supporta il riconoscimento vocale. */
export function isSpeechRecognitionAvailable() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Avvia un riconoscimento vocale singolo (italiano di default).
 * @returns {object|null} l'istanza (per .stop()) o null se non supportato.
 */
export function startVoiceRecognition({ lang = 'it-IT', onResult, onError, onEnd } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { onError?.('not-supported'); return null; }
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  rec.onresult = (e) => onResult?.((e.results[0][0].transcript || '').trim());
  rec.onerror = (e) => onError?.(e.error);
  rec.onend = () => onEnd?.();
  try { rec.start(); } catch { onError?.('start-failed'); return null; }
  return rec;
}
