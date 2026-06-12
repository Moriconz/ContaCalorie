/*
  Estimation Engine - CREA Data Only

  Flusso:
  1. Search food by name (query text input)
  2. Select from search results (alimentoBase from CREA database)
  3. Select cooking method (only those available in CREA for that food)
  4. Input quantity in grams
  5. Return meal entry with verified CREA nutritional data (confidenceLevel: 100%)

  All data is 100% from CREA database - no fallbacks, no approximations.
*/

import { getFoodDetails } from './nutritionDataProvider.js';
import { searchBases, getOptions, isLeaf } from './creaHierarchy.js';
import { calculateMacrosForAmount } from './nutritionEngine.js';
import { escapeHtml } from './utils.js';

// ═══════════════════════════════════════════════════════════════
// DEFINIZIONE DELLE MACRO CATEGORIE DI STIMA
// ═══════════════════════════════════════════════════════════════

const ESTIMATION_CATEGORIES = {
  cereali_pasta_riso: {
    icon: '🍝',
    label: 'Cereali & Pasta',
    description: 'Pasta, riso, pane, cereali colazione',
    sourceCategory: 'cereali_pasta_riso'
  },
  carni_rosse: {
    icon: '🥩',
    label: 'Carni Rosse',
    description: 'Manzo, maiale, agnello, vitello',
    sourceCategory: 'carni_rosse'
  },
  pollame: {
    icon: '🍗',
    label: 'Pollame',
    description: 'Pollo, tacchino, anatra',
    sourceCategory: 'pollame'
  },
  pesce_frutti_mare: {
    icon: '🐟',
    label: 'Pesce & Frutti di Mare',
    description: 'Pesce bianco, azzurro, molluschi, crostacei',
    sourceCategory: 'pesce_frutti_mare'
  },
  uova: {
    icon: '🥚',
    label: 'Uova',
    description: 'Uova intere, albume, tuorlo',
    sourceCategory: 'uova'
  },
  latticini: {
    icon: '🧀',
    label: 'Latticini',
    description: 'Latte, yogurt, formaggi, ricotta, burro',
    sourceCategory: 'latticini'
  },
  verdure: {
    icon: '🥬',
    label: 'Verdure & Ortaggi',
    description: 'Verdure, patate, insalate',
    sourceCategory: 'verdure'
  },
  frutta: {
    icon: '🍎',
    label: 'Frutta',
    description: 'Frutta fresca, secca, acida',
    sourceCategory: 'frutta'
  },
  legumi: {
    icon: '🫘',
    label: 'Legumi',
    description: 'Lenticchie, ceci, fagioli',
    sourceCategory: 'legumi'
  },
  dolci_snack: {
    icon: '🍫',
    label: 'Dolci & Snack',
    description: 'Biscotti, cioccolato, snack',
    sourceCategory: 'dolci_snack'
  },
  condimenti_salse: {
    icon: '🍶',
    label: 'Condimenti & Salse',
    description: 'Olio, burro, salse',
    sourceCategory: 'condimenti_salse'
  }
};

// ═══════════════════════════════════════════════════════════════
// EXTRA CONDIMENTI (Aggiunte che cambiano i macro)
// ═══════════════════════════════════════════════════════════════

const CONDIMENTI_EXTRAS = {
  olio: { kcal: 90, grassi: 10, carboidrati: 0, proteine: 0, label: 'Olio (1 cucchiaio ~10g)' },
  burro: { kcal: 72, grassi: 8, carboidrati: 0, proteine: 0, label: 'Burro (1 cucchiaio ~10g)' },
  formaggio: { kcal: 43, grassi: 3.4, carboidrati: 0.4, proteine: 3.8, label: 'Formaggio grattugiato (1 cucchiaio ~10g)' },
  salsa_pomodoro: { kcal: 2, grassi: 0, carboidrati: 0.4, proteine: 0.1, label: 'Salsa pomodoro (1 cucchiaio ~15g)' },
  maionese: { kcal: 68, grassi: 7.5, carboidrati: 0.06, proteine: 0.1, label: 'Maionese (1 cucchiaio ~15g)' },
  panna: { kcal: 34, grassi: 3.5, carboidrati: 0.3, proteine: 0.2, label: 'Panna fresca (1 cucchiaio ~10g)' },
  miele: { kcal: 26, grassi: 0, carboidrati: 7, proteine: 0, label: 'Miele (1 cucchiaino ~5g)' },
  sale: { kcal: 0, grassi: 0, carboidrati: 0, proteine: 0, label: 'Sale' }
};

// ═══════════════════════════════════════════════════════════════
// FUNZIONE PRINCIPALE: Avvia il flusso di stima
// ═══════════════════════════════════════════════════════════════

export async function openEstimationWizard(moment, onComplete) {
  let state = { moment, food: null, quantity: null, extras: [] };
  await creaStep1_searchFood(state, onComplete);
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 (CREA): SEARCH FOOD BY NAME
// ═══════════════════════════════════════════════════════════════

async function creaStep1_searchFood(state, onComplete) {
  const html = `
    <div style="min-width: 320px;">
      <h2 style="text-align: center; margin-bottom: 1.5rem;">🔍 Che cosa stai mangiando?</h2>
      <p style="text-align: center; color: var(--text-muted); margin-bottom: 1rem;">Digita il nome dell'alimento (es: pasta, pollo, mela)</p>

      <input id="foodSearchInput" type="text" placeholder="Cerca alimento..."
        style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 1rem; font-size: 16px;">

      <div id="searchResults" style="max-height: 300px; overflow-y: auto; display: grid; grid-template-columns: 1fr; gap: 0.5rem;">
        <p style="text-align: center; color: var(--text-muted); padding: 1rem;">Inizia a digitare per cercare...</p>
      </div>
    </div>
  `;

  showModal(html, (container) => {
    const searchInput = container.querySelector('#foodSearchInput');
    const resultsContainer = container.querySelector('#searchResults');
    let searchToken = 0;

    searchInput.addEventListener('input', async (e) => {
      const query = e.target.value.trim();

      if (query.length < 2) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Inizia a digitare per cercare...</p>';
        return;
      }

      const myToken = ++searchToken;
      const results = await searchBases(query);
      if (myToken !== searchToken) return; // ignora risultati obsoleti

      if (results.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Nessun alimento trovato nel database CREA</p>';
        return;
      }

      resultsContainer.innerHTML = results.slice(0, 20).map((result, idx) => `
        <button class="crea-search-result" data-idx="${idx}"
          style="padding: 0.75rem; background: var(--glass-secondary); border: 1px solid transparent; border-radius: 6px; cursor: pointer; text-align: left; transition: all 0.2s;">
          <div style="font-weight: 500;">${result.base}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${result.variantCount > 1 ? result.variantCount + ' varianti' : 'voce singola'}</div>
        </button>
      `).join('');

      container.querySelectorAll('.crea-search-result').forEach(btn => {
        btn.addEventListener('click', async () => {
          const sel = results[Number(btn.dataset.idx)];
          closeModal();
          await creaStep2_navigate(state, sel.base, sel.node, [sel.base], onComplete);
        });
        btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = 'var(--glass-primary)'; });
        btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = 'var(--glass-secondary)'; });
      });
    });

    searchInput.focus();
  });
}

// ═══════════════════════════════════════════════════════════════
// STEP 2 (CREA): NAVIGA SOTTOCATEGORIE (taglio → variante → cottura)
// ═══════════════════════════════════════════════════════════════

async function creaStep2_navigate(state, base, node, path, onComplete) {
  // riapre questo stesso livello di navigazione (usato dal tasto "Indietro")
  const reopen = () => creaStep2_navigate(state, base, node, path, onComplete);
  const backToSearch = () => creaStep1_searchFood(state, onComplete);

  // Nodo foglia diretto (alimento senza varianti) → vai alla quantità.
  // Qui "indietro" torna alla ricerca, perché non c'è un livello di scelta intermedio.
  if (isLeaf(node)) {
    await _resolveAndGoToQuantity(state, node.f, path, onComplete, backToSearch);
    return;
  }

  const options = getOptions(node);

  // Se il nodo è anche un alimento valido di per sé, offri di usarlo direttamente
  const selfFood = node.f
    ? `<button class="crea-nav-self" style="padding: 0.7rem; background: var(--glass-primary); border: 1px solid var(--accent-cyan); border-radius: 6px; cursor: pointer; text-align: left; font-weight: 600; margin-bottom: 0.75rem; width: 100%;">✓ Usa "${path.join(', ')}"</button>`
    : '';

  const html = `
    <div style="min-width: 340px;">
      <h2 style="text-align: center; margin-bottom: 0.25rem;">${base}</h2>
      <p style="text-align: center; color: var(--text-muted); margin-bottom: 1rem; font-size: 0.85rem;">${path.join(' › ')}</p>
      ${selfFood}
      <div id="navOptions" style="max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;">
        ${options.map((opt, idx) => `
          <button class="crea-nav-opt" data-idx="${idx}"
            style="padding: 0.75rem; background: var(--glass-secondary); border: 1px solid var(--glass-border); border-radius: 6px; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 500;">${opt.label}</span>
            <span style="color: var(--text-muted); font-size: 1.1rem;">${opt.hasChildren ? '›' : '•'}</span>
          </button>
        `).join('')}
      </div>
      <button id="navBack" class="secondary" style="margin-top: 1rem; width: 100%;">← Indietro</button>
    </div>
  `;

  showModal(html, (container) => {
    const selfBtn = container.querySelector('.crea-nav-self');
    if (selfBtn) {
      selfBtn.addEventListener('click', async () => {
        closeModal();
        await _resolveAndGoToQuantity(state, node.f, path, onComplete, reopen);
      });
    }

    container.querySelectorAll('.crea-nav-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const opt = options[Number(btn.dataset.idx)];
        const newPath = [...path, opt.label];
        closeModal();
        if (opt.hasChildren) {
          await creaStep2_navigate(state, base, opt.node, newPath, onComplete);
        } else {
          await _resolveAndGoToQuantity(state, opt.foodId, newPath, onComplete, reopen);
        }
      });
    });

    const backBtn = container.querySelector('#navBack');
    backBtn.addEventListener('click', async () => {
      closeModal();
      await creaStep1_searchFood(state, onComplete);
    });
  });
}

async function _resolveAndGoToQuantity(state, foodId, path, onComplete, goBack) {
  const details = await getFoodDetails(foodId);
  if (!details) {
    showModal(`
      <div style="text-align: center; padding: 2rem;">
        <h2>⚠️ Dati non trovati</h2>
        <p>Nessun dato nutrizionale CREA per "${path.join(', ')}".</p>
        <button class="primary" onclick="closeModal()" style="margin-top: 1rem;">Chiudi</button>
      </div>
    `);
    return;
  }
  state.food = { id: details.id, nome: details.nome, per100g: details.per100g };
  await creaStep3_selectQuantity(state, onComplete, goBack);
}

// ═══════════════════════════════════════════════════════════════
// STEP 3 (CREA): SELECT QUANTITY
// ═══════════════════════════════════════════════════════════════

async function creaStep3_selectQuantity(state, onComplete, goBack) {
  // CREA data already selected in step 1
  const foodData = state.food ? state.food.per100g : null;

  if (!foodData) {
    showModal(`
      <div style="text-align: center; padding: 2rem;">
        <h2>⚠️ Dati non trovati</h2>
        <p>Non è stato possibile trovare i dati nutrizionali nel database CREA.</p>
        <button class="primary" onclick="closeModal()" style="margin-top: 1rem;">Indietro</button>
      </div>
    `);
    return;
  }

  const html = `
    <div style="min-width: 320px;">
      <h2 style="text-align: center; margin-bottom: 0.5rem;">⚖️ Quanto?</h2>
      <p style="text-align: center; color: var(--text-muted); margin-bottom: 1rem; font-size: 0.9rem;">${escapeHtml(state.food.nome)}</p>

      <label style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
        <span style="font-weight: 600;">Grammi</span>
        <input id="quantityInput" type="number" min="1" max="2000" value="100"
          style="padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px; font-size: 16px;">
      </label>

      <div id="resultPreview" style="padding: 1rem; background: var(--glass-secondary); border-radius: 6px; margin-bottom: 1.5rem;">
        <div style="font-size: 0.9rem; margin-bottom: 0.5rem;"><strong id="previewKcal">0</strong> kcal</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          <span id="previewProt">0</span>g prot • <span id="previewCarb">0</span>g carb • <span id="previewFat">0</span>g grassi
        </div>
      </div>

      <div class="field-grid">
        <button id="confirmEstimateBtn" class="primary">✓ Conferma Stima</button>
        <button id="cancelEstimateBtn" class="secondary">← Indietro</button>
      </div>
    </div>
  `;

  showModal(html, (container) => {
    const quantityInput = container.querySelector('#quantityInput');
    const confirmBtn = container.querySelector('#confirmEstimateBtn');
    const cancelBtn = container.querySelector('#cancelEstimateBtn');

    function updatePreview() {
      const quantity = Number(quantityInput.value) || 100;
      const macros = calculateMacrosForAmount(foodData, quantity);

      if (macros) {
        container.querySelector('#previewKcal').textContent = macros.kcal;
        container.querySelector('#previewProt').textContent = macros.proteine.toFixed(1);
        container.querySelector('#previewCarb').textContent = macros.carboidrati.toFixed(1);
        container.querySelector('#previewFat').textContent = macros.grassi.toFixed(1);
      }
    }

    quantityInput.addEventListener('input', updatePreview);
    quantityInput.focus();
    quantityInput.select();
    updatePreview();

    confirmBtn.addEventListener('click', async () => {
      state.quantity = Number(quantityInput.value);
      closeModal();

      const mealEntry = _creaCreaEstimation(state, foodData);
      if (onComplete) onComplete(mealEntry);
    });

    cancelBtn.addEventListener('click', async () => {
      closeModal();
      if (goBack) await goBack();
    });

    quantityInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click();
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// FUNZIONI HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * Create meal entry from CREA data
 */
function _creaCreaEstimation(state, foodData) {
  const macros = calculateMacrosForAmount(foodData, state.quantity);

  return {
    id: crypto.randomUUID(),
    userId: null,
    data: null,
    momento: state.moment,
    foodRef: {
      id: state.food.id,
      source: 'CREA',
      name: state.food.nome
    },
    grammi: state.quantity,
    macroCalcolate: macros,
    sourceType: 'A_DATABASE',
    confidenceLevel: 100,
    isEstimated: true,
    unitaSelezionata: 'grammi',
    origin: 'estimate',
    note: `Stima: ${state.food.nome}, ${state.quantity}g`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
