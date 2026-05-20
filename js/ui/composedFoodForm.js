/**
 * Composed Food Form — Permet à l'utente di comporre un piatto con più ingredienti
 * Aggiunge ingredienti uno per uno, ricerca nel data pack, calcola totale macro
 */

import * as dataPackLoader from '../dataPackLoader.js';

let ingredientIdCounter = 0;

export function renderComposedFoodForm() {
  return `
    <div class="composed-food-form">
      <h2>Componi il piatto</h2>
      <p style="color: var(--muted); font-size: 0.9rem;">
        Aggiungi ogni ingrediente con la sua grammatura. Le macro verranno calcolate automaticamente.
      </p>

      <!-- Ingredients list -->
      <div id="ingredientsList" style="margin: 1.5rem 0;">
        <!-- Ingredients added dynamically -->
      </div>

      <!-- Add ingredient button -->
      <button id="addIngredientBtn" class="secondary" style="width: 100%; margin-bottom: 1rem;">
        ➕ Aggiungi ingrediente
      </button>

      <!-- Totals preview -->
      <div id="composedPreview" class="estimated-preview" style="display: none;">
        <h3>Totale piatto</h3>
        <div class="nutrition-grid">
          <div class="nutrition-item">
            <div class="label">kcal</div>
            <div class="value" id="totalKcal">0</div>
          </div>
          <div class="nutrition-item">
            <div class="label">Proteine</div>
            <div class="value" id="totalProtein">0g</div>
          </div>
          <div class="nutrition-item">
            <div class="label">Carb</div>
            <div class="value" id="totalCarb">0g</div>
          </div>
          <div class="nutrition-item">
            <div class="label">Grassi</div>
            <div class="value" id="totalFat">0g</div>
          </div>
          <div class="nutrition-item">
            <div class="label">Fibre</div>
            <div class="value" id="totalFiber">0g</div>
          </div>
          <div class="nutrition-item">
            <div class="label">Zuccheri</div>
            <div class="value" id="totalSugar">0g</div>
          </div>
        </div>

        <div class="disclaimer" style="margin-top: 1rem;">
          📋 Stima basata su ingredienti reali con grammature specifiche. Più precisa rispetto ai valori medi pre-calcolati.
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem;">
          <button id="composedCancel" class="secondary">Annulla</button>
          <button id="composedConfirm" class="primary">Aggiungi al pasto</button>
        </div>
      </div>
    </div>
  `;
}

export function bindComposedFoodEvents(container, callbacks) {
  ingredientIdCounter = 0;

  const addBtn = container.querySelector('#addIngredientBtn');
  const confirmBtn = container.querySelector('#composedConfirm');
  const cancelBtn = container.querySelector('#composedCancel');

  addBtn?.addEventListener('click', () => {
    addIngredientRow(container);
  });

  confirmBtn?.addEventListener('click', () => {
    const totals = calculateTotals(container);
    if (totals.totalGrams > 0 && callbacks?.onComposedFoodConfirm) {
      callbacks.onComposedFoodConfirm({
        type: 'composed',
        ingredients: getIngredients(container),
        totals
      });
    }
  });

  cancelBtn?.addEventListener('click', () => {
    if (callbacks?.onCancel) {
      callbacks.onCancel();
    }
  });

  // Add first ingredient row
  addIngredientRow(container);
}

function addIngredientRow(container) {
  const id = ingredientIdCounter++;
  const list = container.querySelector('#ingredientsList');

  const row = document.createElement('div');
  row.id = `ingredient-row-${id}`;
  row.style.cssText = 'padding: 1rem; background: var(--surface-strong); border-radius: 12px; margin-bottom: 0.75rem; position: relative;';

  row.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
      <div>
        <label style="font-size: 0.85rem; color: var(--muted);">Alimento</label>
        <input
          type="text"
          class="ingredient-food"
          placeholder="Es: pasta, guanciale, uova..."
          style="margin-bottom: 0;"
        />
      </div>
      <div>
        <label style="font-size: 0.85rem; color: var(--muted);">Grammatura (g)</label>
        <input
          type="number"
          class="ingredient-grams"
          placeholder="100"
          min="1"
          style="margin-bottom: 0;"
        />
      </div>
    </div>

    <div id="ingredient-result-${id}" style="display: none; padding: 0.75rem; background: rgba(99, 102, 241, 0.1); border-radius: 8px; border-left: 3px solid var(--primary); margin-bottom: 0.75rem; font-size: 0.9rem;">
      <!-- Found ingredient info -->
    </div>

    <div style="display: flex; gap: 0.5rem;">
      <button class="ingredient-search" type="button" style="flex: 1; padding: 0.7rem; background: var(--primary-light); color: white; border-radius: 8px; font-size: 0.9rem;">
        🔍 Cerca
      </button>
      <button class="ingredient-delete" type="button" style="flex: 0 0 auto; padding: 0.7rem 1rem; background: rgba(211, 47, 47, 0.2); color: var(--danger); border-radius: 8px; font-size: 0.9rem;">
        ❌
      </button>
    </div>
  `;

  list?.appendChild(row);

  // Bind events for this row
  const searchBtn = row.querySelector('.ingredient-search');
  const deleteBtn = row.querySelector('.ingredient-delete');
  const foodInput = row.querySelector('.ingredient-food');
  const gramsInput = row.querySelector('.ingredient-grams');

  searchBtn?.addEventListener('click', async () => {
    const foodName = foodInput.value.trim();
    const grams = parseInt(gramsInput.value) || 100;

    if (!foodName) {
      alert('Inserisci il nome dell\'alimento');
      return;
    }

    searchBtn.disabled = true;
    searchBtn.textContent = '⏳ Cercando...';

    try {
      const result = await dataPackLoader.searchInDataPacks(foodName, grams);

      if (result.found) {
        const resultDiv = row.querySelector(`#ingredient-result-${id}`);
        const macros = result;

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <strong>${result.item.nome || result.item.name || result.item.name_it}</strong><br/>
          <small>Fonte: ${result.source || 'Sconosciuta'}</small><br/>
          <strong style="color: var(--primary);">${macros.kcal || 0} kcal</strong> per ${grams}g
        `;

        foodInput.dataset.found = 'true';
        foodInput.dataset.macros = JSON.stringify({
          kcal: macros.kcal,
          protein: macros.protein,
          carb: macros.carb,
          fat: macros.fat,
          fiber: macros.fiber,
          sugar: macros.sugar,
          source: result.source,
          name: result.item.nome || result.item.name || result.item.name_it
        });
      } else {
        alert(`Alimento "${foodName}" non trovato nel database. Prova a cercare un altro nome o aggiungi manualmente.`);
        foodInput.dataset.found = 'false';
      }
    } catch (error) {
      console.error('❌ Errore ricerca:', error);
      alert('Errore durante la ricerca. Prova di nuovo.');
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = '🔍 Cerca';
    }

    updateComposedPreview(container);
  });

  deleteBtn?.addEventListener('click', () => {
    row.remove();
    updateComposedPreview(container);
  });

  gramsInput?.addEventListener('change', () => {
    updateComposedPreview(container);
  });
}

function getIngredients(container) {
  const rows = container.querySelectorAll('[id^="ingredient-row-"]');
  const ingredients = [];

  rows.forEach(row => {
    const foodInput = row.querySelector('.ingredient-food');
    const gramsInput = row.querySelector('.ingredient-grams');

    if (foodInput?.dataset.found === 'true' && foodInput?.dataset.macros) {
      const macros = JSON.parse(foodInput.dataset.macros);
      const grams = parseInt(gramsInput.value) || 0;

      if (grams > 0) {
        ingredients.push({
          name: macros.name,
          grams,
          macros
        });
      }
    }
  });

  return ingredients;
}

function calculateTotals(container) {
  const ingredients = getIngredients(container);
  let totals = {
    totalGrams: 0,
    totalKcal: 0,
    totalProtein: 0,
    totalCarb: 0,
    totalFat: 0,
    totalFiber: 0,
    totalSugar: 0
  };

  ingredients.forEach(ing => {
    const kcal = ing.macros.kcal || 0;
    const protein = ing.macros.protein || 0;
    const carb = ing.macros.carb || 0;
    const fat = ing.macros.fat || 0;
    const fiber = ing.macros.fiber || 0;
    const sugar = ing.macros.sugar || 0;

    totals.totalGrams += ing.grams;
    totals.totalKcal += kcal;
    totals.totalProtein += protein;
    totals.totalCarb += carb;
    totals.totalFat += fat;
    totals.totalFiber += fiber;
    totals.totalSugar += sugar;
  });

  return totals;
}

function updateComposedPreview(container) {
  const totals = calculateTotals(container);
  const preview = container.querySelector('#composedPreview');

  if (totals.totalGrams > 0) {
    preview.style.display = 'block';

    container.querySelector('#totalKcal').textContent = Math.round(totals.totalKcal);
    container.querySelector('#totalProtein').textContent = (Math.round(totals.totalProtein * 10) / 10) + 'g';
    container.querySelector('#totalCarb').textContent = (Math.round(totals.totalCarb * 10) / 10) + 'g';
    container.querySelector('#totalFat').textContent = (Math.round(totals.totalFat * 10) / 10) + 'g';
    container.querySelector('#totalFiber').textContent = (Math.round(totals.totalFiber * 10) / 10) + 'g';
    container.querySelector('#totalSugar').textContent = (Math.round(totals.totalSugar * 10) / 10) + 'g';
  } else {
    preview.style.display = 'none';
  }
}
