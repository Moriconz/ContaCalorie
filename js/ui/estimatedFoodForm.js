/*
  UI per il flusso di stima alimenti senza informazioni nutrizionali precise.

  Flusso:
  1. Step 1: inserimento nome + peso
  2. Step 2: mostrerà categoria stimata e valori medi
  3. Opzione di cambiare categoria manualmente
  4. Creazione del mealEntry con origin "estimated_typical_value"
*/

import { guessTypicalCategoryFromName, getTypicalValuesForCategory, listAvailableCategories } from '../typicalValues.js';
import { calculateMacrosForAmount } from '../nutritionEngine.js';

export function renderEstimatedFoodForm() {
  return `
    <div class="estimated-food-form">
      <h2>Aggiungi alimento senza dati precisi</h2>
      <p class="form-hint">Inserisci il nome e il peso, lasceremo che l'app stimi i valori nutrizionali.</p>

      <form id="estimatedFoodFormElem">
        <div class="form-group">
          <label for="estimFoodName">Nome alimento</label>
          <input
            type="text"
            id="estimFoodName"
            placeholder="es: pasta col sugo, pane dal forno, insalata mista"
            required
            autocomplete="off"
          />
        </div>

        <div class="form-group">
          <label for="estimFoodGrams">Peso (grammi)</label>
          <input
            type="number"
            id="estimFoodGrams"
            min="1"
            max="1000"
            value="100"
            required
          />
          <span class="input-hint">Inserisci solo il peso, es: 200</span>
        </div>

        <button type="button" id="estimFoodPreview" class="button-primary">
          Vedi stima
        </button>
      </form>

      <div id="estimPreviewContainer" style="display: none;" class="estimated-preview">
        <!-- Riempito dinamicamente -->
      </div>
    </div>
  `;
}

export function bindEstimatedFoodFormEvents(container, callbacks) {
  const form = container.querySelector('#estimatedFoodFormElem');
  const previewBtn = container.querySelector('#estimFoodPreview');
  const previewContainer = container.querySelector('#estimPreviewContainer');

  previewBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const foodName = form.querySelector('#estimFoodName').value.trim();
    const grams = parseInt(form.querySelector('#estimFoodGrams').value) || 100;

    if (!foodName) {
      alert('Inserisci il nome dell\'alimento');
      return;
    }

    if (grams < 1 || grams > 1000) {
      alert('Inserisci un peso tra 1 e 1000 grammi');
      return;
    }

    await showEstimatedPreview(previewContainer, foodName, grams, callbacks);
  });
}

async function showEstimatedPreview(container, foodName, grams, callbacks) {
  // Step 1: indovina la categoria
  const { category, quality } = guessTypicalCategoryFromName(foodName);
  const values = getTypicalValuesForCategory(category);

  if (!values) {
    alert('Categoria non riconosciuta, prova un nome diverso.');
    return;
  }

  // Step 2: calcola i macro stimati
  const foodItem = { per100g: values };
  const estimatedMacros = calculateMacrosForAmount(foodItem, grams);

  // Step 3: renderizza l'anteprima con opzione di cambio categoria
  const categories = listAvailableCategories();
  const qualityLabel = quality === 'specific' ? '🎯 Specifico' : quality === 'generic' ? '📦 Generico' : '❓ Approssimativo';

  let html = `
    <div class="preview-header">
      <h3>Anteprima stima nutritiva</h3>
      <p class="quality-badge">${qualityLabel} per "${foodName}"</p>
    </div>

    <div class="preview-content">
      <div class="form-group">
        <label for="estimCategorySelect">Categoria riconosciuta</label>
        <select id="estimCategorySelect">
  `;

  categories.forEach(cat => {
    const selected = cat === category ? 'selected' : '';
    html += `<option value="${cat}" ${selected}>${formatCategoryLabel(cat)}</option>`;
  });

  html += `
        </select>
        <p class="input-hint">Se la categoria non è corretta, selezionane un'altra dalla lista.</p>
      </div>

      <div class="nutrition-preview">
        <h4>Valori stimati per ${grams}g</h4>
        <div class="nutrition-grid">
          <div class="nutrition-item">
            <span class="label">Calorie</span>
            <span class="value">${estimatedMacros.kcal} kcal</span>
          </div>
          <div class="nutrition-item">
            <span class="label">Proteine</span>
            <span class="value">${estimatedMacros.proteine}g</span>
          </div>
          <div class="nutrition-item">
            <span class="label">Carbo</span>
            <span class="value">${estimatedMacros.carboidrati}g</span>
          </div>
          <div class="nutrition-item">
            <span class="label">Grassi</span>
            <span class="value">${estimatedMacros.grassi}g</span>
          </div>
          <div class="nutrition-item">
            <span class="label">Fibra</span>
            <span class="value">${estimatedMacros.fibra}g</span>
          </div>
          <div class="nutrition-item">
            <span class="label">Zuccheri</span>
            <span class="value">${estimatedMacros.zuccheri}g</span>
          </div>
        </div>
      </div>

      <div class="disclaimer">
        ⚠️ <strong>Valori stimati:</strong> Questi sono valori medi per questa categoria di alimento. Se conosci i dati nutrizionali precisi (da etichetta), usali al posto di questa stima.
      </div>

      <div class="form-actions">
        <button type="button" id="estimConfirmBtn" class="button-primary">Aggiungi al pasto</button>
        <button type="button" id="estimCancelBtn" class="button-secondary">Annulla</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
  container.style.display = 'block';

  // Aggiorna l'anteprima se cambia la categoria
  const categorySelect = container.querySelector('#estimCategorySelect');
  categorySelect.addEventListener('change', () => {
    const newCategory = categorySelect.value;
    const newValues = getTypicalValuesForCategory(newCategory);
    if (newValues) {
      const newFoodItem = { per100g: newValues };
      const newMacros = calculateMacrosForAmount(newFoodItem, grams);
      updateNutritionPreview(container, newMacros);
    }
  });

  // Conferma
  const confirmBtn = container.querySelector('#estimConfirmBtn');
  confirmBtn.addEventListener('click', async () => {
    const finalCategory = categorySelect.value;
    const finalValues = getTypicalValuesForCategory(finalCategory);
    if (!finalValues) {
      alert('Categoria non valida');
      return;
    }

    const finalFoodItem = { per100g: finalValues };
    const finalMacros = calculateMacrosForAmount(finalFoodItem, grams);

    // Crea il payload per la callback
    const estimatedFood = {
      nome: foodName,
      categoria: finalCategory,
      grammi: grams,
      macroCalcolate: finalMacros,
      origin: 'estimated_typical_value',
      source: 'TYPICAL_ESTIMATE'
    };

    if (callbacks.onConfirm) {
      await callbacks.onConfirm(estimatedFood);
    }
  });

  // Annulla
  const cancelBtn = container.querySelector('#estimCancelBtn');
  cancelBtn.addEventListener('click', () => {
    container.style.display = 'none';
    container.innerHTML = '';
  });
}

function updateNutritionPreview(container, macros) {
  const grid = container.querySelector('.nutrition-grid');
  const items = [
    { label: 'Calorie', value: `${macros.kcal} kcal` },
    { label: 'Proteine', value: `${macros.proteine}g` },
    { label: 'Carbo', value: `${macros.carboidrati}g` },
    { label: 'Grassi', value: `${macros.grassi}g` },
    { label: 'Fibra', value: `${macros.fibra}g` },
    { label: 'Zuccheri', value: `${macros.zuccheri}g` }
  ];

  grid.innerHTML = items
    .map(item => `
      <div class="nutrition-item">
        <span class="label">${item.label}</span>
        <span class="value">${item.value}</span>
      </div>
    `)
    .join('');
}

function formatCategoryLabel(category) {
  return category
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
