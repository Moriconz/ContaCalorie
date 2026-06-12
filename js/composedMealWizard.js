/*
  Wizard per la stima di piatti composti (pasta al tonno, risotto, toast, etc).
  Consente di aggiungere componenti e aggregarne i macro.
*/

import { calculateMacrosForAmount } from './nutritionEngine.js';
import { showModal, closeModal } from './ui/modal.js';
import { searchFoods } from './nutritionDataProvider.js';
import { openEstimationWizard } from './estimationEngine.js';
import { todayISO, escapeHtml } from './utils.js';

const _showToast = (msg, duration = 2500) => showToast(msg, duration);
const _showToastError = (msg) => _showToast(msg, 4000);

export function openComposedMealWizard(moment, onComplete, {
  performSearch = null,
  openEstimate = null,
} = {}) {
  // Default: ricerca nel database CREA; stima tramite wizard CREA
  const doSearch = performSearch || ((q) => searchFoods(q));
  const doEstimate = openEstimate || ((m, cb) => openEstimationWizard(m, cb));

  let step = 1;
  let composedData = {
    nome: '',
    components: [],
    totalMacros: { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0, zuccheri: 0, fibra: 0 }
  };

  function showStep1() {
    const html = `
      <div style="min-width: 320px;">
        <h2 style="margin-top: 0;">🍝 Piatto Composto</h2>
        <p style="text-align: center; color: var(--muted); margin-bottom: 1.5rem;">Passo 1/3</p>

        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Nome del piatto</label>
          <input id="dishNameInput" type="text" placeholder="es: Pasta al tonno, Risotto ai funghi" style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--glass-secondary);">
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">Dai un nome al tuo piatto</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <button id="backBtn" class="secondary" style="padding: 0.75rem;">Annulla</button>
          <button id="nextBtn" class="primary" style="padding: 0.75rem;" disabled>Continua →</button>
        </div>
      </div>
    `;

    showModal(html, (container) => {
      const nameInput = container.querySelector('#dishNameInput');
      const nextBtn = container.querySelector('#nextBtn');
      const backBtn = container.querySelector('#backBtn');

      nameInput.addEventListener('input', () => {
        nextBtn.disabled = !nameInput.value.trim();
      });

      nameInput.focus();

      nextBtn.addEventListener('click', () => {
        composedData.nome = nameInput.value.trim();
        closeModal();
        step = 2;
        showStep2();
      });

      backBtn.addEventListener('click', closeModal);
    });
  }

  function showStep2() {
    const html = `
      <div style="min-width: 320px;">
        <h2 style="margin-top: 0;">🍝 ${composedData.nome}</h2>
        <p style="text-align: center; color: var(--muted); margin-bottom: 1.5rem;">Passo 2/3 - Componenti</p>

        <div id="componentsList" style="max-height: 300px; overflow-y: auto; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>

        <div style="padding: 1rem; background: var(--glass-tertiary); border-radius: 8px; margin-bottom: 1.5rem; text-align: center;">
          <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">
            <strong>Totale:</strong>
            <span id="totalKcal" style="color: var(--accent-primary); font-weight: 600;">0</span> kcal
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            P: <span id="totalProteine">0</span>g | C: <span id="totalCarbs">0</span>g | F: <span id="totalFats">0</span>g
          </div>
        </div>

        <button id="addComponentBtn" class="secondary" style="width: 100%; margin-bottom: 0.75rem; padding: 0.75rem;">+ Aggiungi Componente</button>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <button id="backBtn" class="secondary" style="padding: 0.75rem;">← Indietro</button>
          <button id="nextBtn" class="primary" style="padding: 0.75rem;" ${composedData.components.length === 0 ? 'disabled' : ''}>Continua →</button>
        </div>
      </div>
    `;

    showModal(html, (container) => {
      renderComponentsList(container);

      container.querySelector('#addComponentBtn').addEventListener('click', () => {
        closeModal();
        showComponentSelector();
      });

      container.querySelector('#backBtn').addEventListener('click', () => {
        closeModal();
        step = 1;
        showStep1();
      });

      container.querySelector('#nextBtn').addEventListener('click', () => {
        closeModal();
        step = 3;
        showStep3();
      });
    });
  }

  function renderComponentsList(container) {
    const list = container.querySelector('#componentsList');
    const totalKcal = container.querySelector('#totalKcal');
    const totalProteine = container.querySelector('#totalProteine');
    const totalCarbs = container.querySelector('#totalCarbs');
    const totalFats = container.querySelector('#totalFats');

    if (!composedData.components || composedData.components.length === 0) {
      list.innerHTML = '<div style="text-align: center; padding: 2rem 0; color: var(--text-muted);">Nessun componente. Aggiungi il primo!</div>';
      return;
    }

    list.innerHTML = composedData.components.map((comp, idx) => `
      <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; border: 1px solid var(--glass-border);">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; word-break: break-word;">${escapeHtml(comp.foodRef.name || comp.foodRef.nome)}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">${comp.grammi}g · ${comp.macroCalcolate.kcal} kcal</div>
        </div>
        <button data-delete-idx="${idx}" aria-label="Rimuovi" style="flex-shrink: 0; width: 36px; height: 36px; padding: 0; border-radius: 8px; border: 1px solid var(--glass-border); background: var(--glass-tertiary); color: var(--danger, #ef4444); cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-delete-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.deleteIdx);
        composedData.components.splice(idx, 1);
        updateTotals(container);
        renderComponentsList(container);
      });
    });

    updateTotals(container);
  }

  function updateTotals(container) {
    const totals = composedData.components.reduce((acc, comp) => ({
      kcal: acc.kcal + (comp.macroCalcolate.kcal || 0),
      proteine: acc.proteine + (comp.macroCalcolate.proteine || 0),
      carboidrati: acc.carboidrati + (comp.macroCalcolate.carboidrati || 0),
      grassi: acc.grassi + (comp.macroCalcolate.grassi || 0),
      zuccheri: acc.zuccheri + (comp.macroCalcolate.zuccheri || 0),
      fibra: acc.fibra + (comp.macroCalcolate.fibra || 0)
    }), { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0, zuccheri: 0, fibra: 0 });

    composedData.totalMacros = totals;

    container.querySelector('#totalKcal').textContent = Math.round(totals.kcal);
    container.querySelector('#totalProteine').textContent = Math.round(totals.proteine * 10) / 10;
    container.querySelector('#totalCarbs').textContent = Math.round(totals.carboidrati * 10) / 10;
    container.querySelector('#totalFats').textContent = Math.round(totals.grassi * 10) / 10;

    const nextBtn = container.querySelector('#nextBtn');
    if (nextBtn) {
      nextBtn.disabled = composedData.components.length === 0;
    }
  }

  function showComponentSelector() {
    const html = `
      <div style="min-width: 320px;">
        <h3 style="margin-top: 0;">Aggiungi Componente</h3>
        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Seleziona fonte</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <button id="searchComponentBtn" class="secondary" style="padding: 0.75rem; text-align: center;">🔍 Cerca</button>
            <button id="estimateComponentBtn" class="secondary" style="padding: 0.75rem; text-align: center;">📊 Stima</button>
          </div>
        </div>
        <button id="cancelBtn" class="secondary" style="width: 100%; padding: 0.75rem;">Annulla</button>
      </div>
    `;

    showModal(html, (container) => {
      container.querySelector('#searchComponentBtn').addEventListener('click', () => {
        closeModal();
        showComponentSearch();
      });

      container.querySelector('#estimateComponentBtn').addEventListener('click', () => {
        closeModal();
        // Il wizard di stima CREA gestisce ricerca→taglio→grammi e restituisce
        // un'entry completa: la aggiungiamo direttamente come componente.
        doEstimate(moment, (entry) => {
          if (entry && entry.macroCalcolate) {
            composedData.components.push({
              foodRef: entry.foodRef || { name: entry.nome || 'Stima' },
              grammi: entry.grammi || 0,
              macroCalcolate: entry.macroCalcolate
            });
          }
          showStep2();
        });
      });

      container.querySelector('#cancelBtn').addEventListener('click', () => {
        closeModal();
        showStep2();
      });
    });
  }

  function showComponentSearch() {
    const html = `
      <div style="min-width: 320px;">
        <h3 style="margin-top: 0;">Cerca Componente</h3>
        <input id="componentSearchInput" type="text" placeholder="es: pasta, tonno, olio" style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--glass-secondary); margin-bottom: 1rem;">
        <div id="componentSearchResults" style="max-height: 300px; overflow-y: auto; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
        <button id="backBtn" class="secondary" style="width: 100%; padding: 0.75rem;">← Indietro</button>
      </div>
    `;

    showModal(html, (container) => {
      const searchInput = container.querySelector('#componentSearchInput');
      const results = container.querySelector('#componentSearchResults');
      let searchTimeout;

      searchInput.addEventListener('input', async (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
          results.innerHTML = '';
          return;
        }

        results.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">Cercando...</div>';
        searchTimeout = setTimeout(async () => {
          const searchResults = await doSearch(query);
          renderComponentSearchResults(searchResults, container);
        }, 300);
      });

      searchInput.focus();

      container.querySelector('#backBtn').addEventListener('click', () => {
        closeModal();
        showComponentSelector();
      });
    });
  }

  function renderComponentSearchResults(results, container) {
    const resultsDiv = container.querySelector('#componentSearchResults');
    if (!results || results.length === 0) {
      resultsDiv.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">Nessun risultato</div>';
      return;
    }

    resultsDiv.innerHTML = results.map((food, idx) => `
      <button class="secondary" data-search-idx="${idx}" style="text-align: left; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--glass-border);">
        <div style="flex: 1;">
          <div><strong>${escapeHtml(food.name || food.nome)}</strong></div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(food.porzioneBase || '')}${food.brand ? ` · ${escapeHtml(food.brand)}` : ''}</div>
        </div>
        <div style="font-size: 1.25rem;">→</div>
      </button>
    `).join('');

    resultsDiv.querySelectorAll('button').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        const food = results[idx];
        closeModal();
        showComponentGrams(food);
      });
    });
  }

  function showComponentGrams(food, isEstimated = false) {
    const html = `
      <div style="min-width: 320px;">
        <h3 style="margin-top: 0;">${escapeHtml(food.name || food.nome)}</h3>
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--glass-secondary); border-radius: 8px;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Grammi</label>
          <input id="componentGramsInput" type="number" min="1" max="1000" value="100" style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 8px; font-size: 16px;">
          <div style="margin-top: 1rem; padding: 0.75rem; background: var(--glass-tertiary); border-radius: 8px; text-align: center;">
            <div style="font-size: 0.9rem; color: var(--text-muted);">
              <span id="previewKcal" style="font-weight: 600; color: var(--accent-primary);">0</span> kcal
            </div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <button id="backBtn" class="secondary" style="padding: 0.75rem;">Indietro</button>
          <button id="addBtn" class="primary" style="padding: 0.75rem;">Aggiungi</button>
        </div>
      </div>
    `;

    showModal(html, (container) => {
      const gramsInput = container.querySelector('#componentGramsInput');
      const previewKcal = container.querySelector('#previewKcal');

      function updatePreview() {
        const grams = Number(gramsInput.value) || 100;
        const macros = calculateMacrosForAmount(food, grams);
        previewKcal.textContent = Math.round(macros.kcal);
      }

      gramsInput.addEventListener('input', updatePreview);
      updatePreview();
      gramsInput.focus();
      gramsInput.select();

      container.querySelector('#addBtn').addEventListener('click', async () => {
        const grams = Number(gramsInput.value);
        if (!grams || grams < 1) {
          _showToastError('Inserisci grammi validi');
          return;
        }

        const macroCalcolate = calculateMacrosForAmount(food, grams);

        composedData.components.push({
          foodRef: food,
          grammi: grams,
          macroCalcolate
        });

        closeModal();
        showStep2();
      });

      container.querySelector('#backBtn').addEventListener('click', () => {
        closeModal();
        showComponentSelector();
      });
    });
  }

  function showStep3() {
    const html = `
      <div style="min-width: 320px;">
        <h2 style="margin-top: 0;">🍝 ${composedData.nome}</h2>
        <p style="text-align: center; color: var(--muted); margin-bottom: 1.5rem;">Passo 3/3 - Conferma</p>

        <div style="padding: 1rem; background: var(--glass-secondary); border-radius: 8px; margin-bottom: 1.5rem;">
          <div style="margin-bottom: 1rem; font-weight: 600;">Componenti:</div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
            ${composedData.components.map(comp => `
              <div style="padding: 0.5rem; background: var(--glass-tertiary); border-radius: 6px; font-size: 0.9rem;">
                ${escapeHtml(comp.foodRef.name || comp.foodRef.nome)} • <strong>${comp.grammi}g</strong>
              </div>
            `).join('')}
          </div>
          <div style="border-top: 1px solid var(--glass-border); padding-top: 1rem; padding-bottom: 0.5rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Totale:</span>
              <strong style="color: var(--accent-primary);">${Math.round(composedData.totalMacros.kcal)} kcal</strong>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              P: ${Math.round(composedData.totalMacros.proteine * 10) / 10}g | C: ${Math.round(composedData.totalMacros.carboidrati * 10) / 10}g | F: ${Math.round(composedData.totalMacros.grassi * 10) / 10}g
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <button id="backBtn" class="secondary" style="padding: 0.75rem;">← Indietro</button>
          <button id="confirmBtn" class="primary" style="padding: 0.75rem;">✓ Salva Pasto</button>
        </div>
      </div>
    `;

    showModal(html, (container) => {
      container.querySelector('#backBtn').addEventListener('click', () => {
        closeModal();
        showStep2();
      });

      container.querySelector('#confirmBtn').addEventListener('click', async () => {
        // Create meal entry with composed food
        const appState = getAppState();
        const entry = {
          data: appState.currentDate,
          momento: moment,
          foodRef: {
            id: crypto.randomUUID(),
            source: 'composed',
            name: composedData.nome,
            nome: composedData.nome,
            porzioneBase: `${composedData.components.length} componenti`,
            per100g: { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0, zuccheri: 0, fibra: 0 }
          },
          grammi: 1,
          macroCalcolate: composedData.totalMacros,
          sourceType: 'C_PASTO_COMPOSTO',
          confidenceLevel: 75,
          isComposed: true,
          components: composedData.components
        };

        if (onComplete) {
          onComplete(entry);
        }

        closeModal();
      });
    });
  }

  showStep1();
}

// ═══════════════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════════════

function showToast(message, duration = 2500) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

const getAppState = () => {
  return window.appState || { currentDate: todayISO() };
};
