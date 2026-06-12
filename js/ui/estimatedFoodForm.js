/*
  UI per il flusso di stima alimenti senza informazioni nutrizionali precise.

  Flusso:
  1. Step 1: inserimento nome + peso
  2. Step 2: mostrerà categoria stimata e valori medi
  3. Opzione di cambiare categoria manualmente
  4. Creazione del mealEntry con origin "estimated_typical_value"
*/

import { calculateMacrosForAmount } from '../nutritionEngine.js';
import { searchInDataPacks } from '../dataPackLoader.js';
import * as composedFoodForm from './composedFoodForm.js';

export function renderEstimatedFoodForm() {
  return `
    <div class="estimated-food-form">
      <h2>Aggiungi alimento senza dati precisi</h2>
      <p class="form-hint">Inserisci il nome e il peso, lasceremo che l'app stimi i valori nutrizionali.</p>

      <form id="estimatedFoodFormElem">
        <div class="form-grid-2">
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

  console.log('🔌 bindEstimatedFoodFormEvents: binding click handler to preview button');

  previewBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const foodName = form.querySelector('#estimFoodName').value.trim();
    const grams = parseInt(form.querySelector('#estimFoodGrams').value) || 100;

    console.log(`🖱️  Preview button clicked: "${foodName}" ${grams}g`);

    if (!foodName) {
      alert('Inserisci il nome dell\'alimento');
      return;
    }

    if (grams < 1 || grams > 1000) {
      alert('Inserisci un peso tra 1 e 1000 grammi');
      return;
    }

    console.log('✅ Validation passed, calling showEstimatedPreview...');
    await showEstimatedPreview(previewContainer, foodName, grams, callbacks);
  });
}

async function showEstimatedPreview(container, foodName, grams, callbacks) {
  console.log(`📋 showEstimatedPreview called: "${foodName}" ${grams}g`);

  // Ricerca nel database ufficiale CREA
  let estimatedMacros = null;
  let dataPackInfo = null;

  try {
    console.log('🔎 Calling searchInDataPacks...');
    const dataPackResult = await searchInDataPacks(foodName, grams);
    console.log('📦 Risultato CREA:', dataPackResult);
    if (dataPackResult.found) {
      estimatedMacros = {
        kcal: dataPackResult.kcal,
        proteine: dataPackResult.protein,
        carboidrati: dataPackResult.carb,
        grassi: dataPackResult.fat,
        fibra: dataPackResult.fiber || 0,
        zuccheri: dataPackResult.sugar || 0
      };
      dataPackInfo = { type: dataPackResult.dataPackType, source: dataPackResult.source };
      console.log('✅ Trovato nel database CREA!', dataPackInfo);
    }
  } catch (error) {
    console.warn('⚠️ Errore ricerca CREA:', error);
  }

  // Nessun fallback: solo dati CREA verificati
  if (!estimatedMacros) {
    container.innerHTML = `
      <div class="preview-header">
        <h3>Alimento non trovato</h3>
        <p class="quality-badge">❌ "${foodName}" non è presente nel database CREA</p>
        <p class="input-hint" style="margin-top:0.5rem;">Prova un nome diverso (es. "pollo, petto, crudo") oppure inserisci i valori da etichetta.</p>
        <div class="form-actions" style="margin-top:1rem;">
          <button type="button" id="estimCancelBtn" class="button-secondary">Chiudi</button>
        </div>
      </div>
    `;
    container.style.display = 'block';
    const cancelBtn = container.querySelector('#estimCancelBtn');
    cancelBtn.addEventListener('click', () => { container.style.display = 'none'; container.innerHTML = ''; });
    return;
  }

  // Renderizza l'anteprima (dati CREA)
  const foundInDataPack = true;
  let html = `
    <div class="preview-header">
      <h3>Anteprima nutritiva</h3>
      <p class="quality-badge">🎯 CREA per "${foodName}"</p>
      <div class="data-pack-badges" style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <span class="badge" style="background: #6366f1; color: white; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.85rem;">${dataPackInfo.source}</span>
      </div>
    </div>

    <div class="preview-content">
  `;

  html += `
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
        ${foundInDataPack
          ? `ℹ️ <strong>Valori medi stimati</strong> per piatto standard. Ristoranti e porzioni reali possono variare. Se conosci i dati precisi, usali al posto di questa stima.`
          : `⚠️ <strong>Valori stimati:</strong> Questi sono valori medi per questa categoria di alimento. Se conosci i dati nutrizionali precisi (da etichetta), usali al posto di questa stima.`
        }
      </div>

      <div class="form-actions">
        ${foundInDataPack ? `
          <button type="button" id="estimComposeBtn" class="button-secondary">🍝 Componi il piatto</button>
          <button type="button" id="estimConfirmBtn" class="button-primary">Aggiungi al pasto</button>
        ` : `
          <button type="button" id="estimConfirmBtn" class="button-primary">Aggiungi al pasto</button>
        `}
        <button type="button" id="estimCancelBtn" class="button-secondary">Annulla</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
  container.style.display = 'block';

  // Componi il piatto
  const composeBtn = container.querySelector('#estimComposeBtn');
  if (composeBtn) {
    composeBtn.addEventListener('click', () => {
      console.log('🍝 Switching to composed food form...');
      container.innerHTML = composedFoodForm.renderComposedFoodForm();
      composedFoodForm.bindComposedFoodEvents(container, {
        onComposedFoodConfirm: async (composedData) => {
          const composedFood = {
            nome: foodName,
            categoria: 'composed',
            grammi: composedData.totals.totalGrams,
            macroCalcolate: {
              kcal: Math.round(composedData.totals.totalKcal),
              proteine: Math.round(composedData.totals.totalProtein * 10) / 10,
              carboidrati: Math.round(composedData.totals.totalCarb * 10) / 10,
              grassi: Math.round(composedData.totals.totalFat * 10) / 10,
              fibra: Math.round(composedData.totals.totalFiber * 10) / 10,
              zuccheri: Math.round(composedData.totals.totalSugar * 10) / 10
            },
            origin: 'composed_from_ingredients',
            source: 'COMPOSED',
            ingredients: composedData.ingredients
          };

          if (callbacks.onConfirm) {
            await callbacks.onConfirm(composedFood);
          }
        },
        onCancel: () => {
          console.log('🔙 Returning to estimated preview...');
          showEstimatedPreview(container, foodName, grams, callbacks);
        }
      });
    });
  }

  // Conferma
  const confirmBtn = container.querySelector('#estimConfirmBtn');
  confirmBtn.addEventListener('click', async () => {
    const estimatedFood = {
      nome: foodName,
      categoria: `${dataPackInfo.type}_${foodName.toLowerCase().replace(/\s+/g, '_')}`,
      grammi: grams,
      macroCalcolate: estimatedMacros,
      origin: `data_pack_${dataPackInfo.type}`,
      source: dataPackInfo.source
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
