/*
  Pulsante di dettatura vocale riutilizzabile (Web Speech API).
  Collega un pulsante 🎤 a un <input>: il testo riconosciuto riempie l'input
  e ne scatena l'evento 'input' così i listener di ricerca esistenti reagiscono.
  Se il browser non supporta lo speech, il pulsante non viene mostrato (fallback: digitazione).
*/

import { isSpeechRecognitionAvailable, startVoiceRecognition } from '../utils.js';

/**
 * @param {HTMLElement} btn - il pulsante microfono (già nel DOM)
 * @param {HTMLInputElement} input - l'input da riempire
 */
export function wireVoiceButton(btn, input) {
  if (!btn || !input) return;
  if (!isSpeechRecognitionAvailable()) {
    btn.style.display = 'none';
    return;
  }
  let rec = null;
  const reset = () => {
    rec = null;
    btn.textContent = '🎤';
    btn.removeAttribute('data-listening');
  };
  btn.addEventListener('click', () => {
    if (rec) { try { rec.stop(); } catch {} reset(); return; }
    btn.textContent = '🔴';
    btn.setAttribute('data-listening', 'true');
    input.focus();
    rec = startVoiceRecognition({
      onResult: (text) => {
        if (text) {
          input.value = text;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      onEnd: reset,
      onError: reset
    });
    if (!rec) reset();
  });
}

/** Markup del pulsante microfono (da inserire accanto a un input). */
export function voiceButtonHtml(id) {
  return `<button id="${id}" type="button" class="voice-btn" aria-label="Dettatura vocale" title="Dettatura vocale" style="flex-shrink:0; width:44px; height:44px; padding:0; border-radius:10px; border:1px solid var(--glass-border); background:var(--glass-secondary); color:var(--text); cursor:pointer; font-size:1.1rem;">🎤</button>`;
}
