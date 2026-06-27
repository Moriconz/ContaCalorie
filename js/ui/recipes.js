/*
  UI per gestione ricette e piatti salvati.
  Schema ricetta: { id, nome, descrizione?, porzioniBase, ingredients: [{foodRef, grammi, note?}], createdAt, updatedAt }
*/

import { escapeHtml } from '../utils.js';
import { searchFoods } from '../nutritionDataProvider.js';
import { calculateMacrosForAmount } from '../nutritionEngine.js';

export function renderRecipesSection(recipes) {
  return `
    <section class="section card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0;">Ricette Salvate</h2>
        <button id="newRecipeBtn" class="primary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">+ Nuova Ricetta</button>
      </div>
      ${recipes.length > 0 ? `
        <ul class="list-group">
          ${recipes.map(recipe => `
            <li>
              <div class="list-item-title">${escapeHtml(recipe.nome)}</div>
              <div class="small-muted">${recipe.ingredients.length} ingredienti • Porzioni: ${recipe.porzioniBase || 1}</div>
              ${recipe.descrizione ? `<div class="small-muted" style="font-size: 0.85rem;">${escapeHtml(recipe.descrizione)}</div>` : ''}
              <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <button class="secondary small-action" data-add-recipe-id="${recipe.id}" type="button">Aggiungi al giorno</button>
                <button class="secondary small-action" data-edit-recipe-id="${recipe.id}" type="button">Modifica</button>
                <button class="secondary small-action" data-delete-recipe-id="${recipe.id}" type="button">Elimina</button>
              </div>
            </li>
          `).join('')}
        </ul>
      ` : `<div class="empty-state"><span class="empty-state-emoji" aria-hidden="true">📖</span><div class="empty-state-title">Nessuna ricetta salvata</div><div class="empty-state-hint">Crea una ricetta con i tuoi ingredienti: la riusi in un tap.</div></div>`}
    </section>
  `;
}

export function bindRecipesEvents(container, callbacks) {
  const newRecipeBtn = container.querySelector('#newRecipeBtn');
  if (newRecipeBtn) newRecipeBtn.addEventListener('click', callbacks.onCreate);

  container.querySelectorAll('[data-add-recipe-id]').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onAdd(btn.dataset.addRecipeId));
  });

  container.querySelectorAll('[data-edit-recipe-id]').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onEdit(btn.dataset.editRecipeId));
  });

  container.querySelectorAll('[data-delete-recipe-id]').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onDelete(btn.dataset.deleteRecipeId));
  });
}

export function renderRecipeForm(recipe = null) {
  const isEditing = !!recipe;
  const safeRecipe = recipe || { nome: '', descrizione: '', porzioniBase: 1, ingredients: [] };

  return `
    <div style="min-width: 320px;">
      <h2 style="margin-top: 0;">${isEditing ? 'Modifica' : 'Nuova'} Ricetta</h2>

      <label style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
        <span class="label-text">Nome ricetta</span>
        <input id="recipeNameInput" type="text" value="${escapeHtml(safeRecipe.nome || '')}" placeholder="es: Spaghetti al Ragù">
      </label>

      <label style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
        <span class="label-text">Descrizione (opzionale)</span>
        <textarea id="recipeDescInput" placeholder="es: Ricetta tradizionale bolognese" style="min-height: 60px; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--glass-secondary); color: var(--text-primary);">${escapeHtml(safeRecipe.descrizione || '')}</textarea>
      </label>

      <label style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
        <span class="label-text">Porzioni base</span>
        <input id="recipePortionsInput" type="number" min="1" max="10" value="${safeRecipe.porzioniBase || 1}">
      </label>

      <div style="margin-bottom: 1.5rem;">
        <h3 style="margin-bottom: 1rem; font-size: 1rem;">Ingredienti</h3>

        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <input id="ingredientSearchInput" type="text" placeholder="Cerca ingrediente..." style="flex: 1; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--glass-secondary); color: var(--text-primary); font-size: 16px;">
          <button id="addIngredientBtn" class="primary" style="padding: 0.75rem 1rem;">Aggiungi</button>
        </div>

        <div id="ingredientSearchResults" style="display: none; max-height: 200px; overflow-y: auto; background: var(--glass-secondary); border: 1px solid var(--glass-border); border-radius: 8px; margin-bottom: 1rem; padding: 0.5rem;"></div>

        <div id="recipeIngredientsList" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 300px; overflow-y: auto;">
          ${safeRecipe.ingredients.length > 0 ? safeRecipe.ingredients.map((ing, idx) => `
            <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div><strong>${escapeHtml(ing.foodRef.name)}</strong></div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">${ing.grammi}g</div>
              </div>
              <button class="secondary small-action" data-remove-ing-idx="${idx}" type="button">Rimuovi</button>
            </div>
          `).join('') : '<p class="small-muted">Nessun ingrediente aggiunto. Cerca e aggiungi ingredienti.</p>'}
        </div>
      </div>

      <div id="recipeMacrosSummary" style="padding: 1rem; background: var(--glass-secondary); border: 1px solid var(--glass-border); border-radius: 8px; margin-bottom: 1.5rem;">
        <strong>Nutrienti per porzione:</strong>
        <div style="margin-top: 0.5rem; font-size: 0.9rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
          <div>Kcal: <span id="macroKcal">0</span></div>
          <div>Proteine: <span id="macroProt">0</span>g</div>
          <div>Carbo: <span id="macroCarb">0</span>g</div>
          <div>Grassi: <span id="macroFat">0</span>g</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <button id="saveRecipeBtn" class="primary" style="width: 100%;">Salva Ricetta</button>
        <button id="cancelRecipeBtn" class="secondary" style="width: 100%;">Annulla</button>
      </div>
    </div>
  `;
}

/**
 * Binding del form ricetta con gestione ingredienti completa e stato locale.
 * @param {HTMLElement} container
 * @param {Object} callbacks { onSave, onCancel }
 * @param {Array} [initialIngredients] ingredienti esistenti (modifica)
 */
export function bindRecipeFormEvents(container, callbacks, initialIngredients = []) {
  // Stato locale: ogni ingrediente = { foodRef:{id,source,name}, grammi, per100g }
  const ingredients = (initialIngredients || []).map(i => ({
    foodRef: i.foodRef || { name: i.nome || '' },
    grammi: i.grammi || 100,
    per100g: i.per100g || null
  }));

  const listEl = container.querySelector('#recipeIngredientsList');
  const resultsEl = container.querySelector('#ingredientSearchResults');
  const searchEl = container.querySelector('#ingredientSearchInput');
  const portionsEl = container.querySelector('#recipePortionsInput');

  function updateMacros() {
    const portions = Math.max(1, parseInt(portionsEl.value) || 1);
    const tot = { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 };
    for (const ing of ingredients) {
      if (!ing.per100g) continue;
      const m = calculateMacrosForAmount({ per100g: ing.per100g }, ing.grammi);
      tot.kcal += m.kcal; tot.proteine += m.proteine; tot.carboidrati += m.carboidrati; tot.grassi += m.grassi;
    }
    container.querySelector('#macroKcal').textContent = Math.round(tot.kcal / portions);
    container.querySelector('#macroProt').textContent = Math.round(tot.proteine / portions);
    container.querySelector('#macroCarb').textContent = Math.round(tot.carboidrati / portions);
    container.querySelector('#macroFat').textContent = Math.round(tot.grassi / portions);
  }

  function renderList() {
    listEl.innerHTML = ingredients.length
      ? ingredients.map((ing, idx) => `
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
          <div style="flex: 1; min-width: 0;"><strong>${escapeHtml(ing.foodRef.name)}</strong></div>
          <input type="number" min="1" max="3000" value="${ing.grammi}" data-ing-grams="${idx}" style="width: 4.5rem; padding: 0.4rem; font-size: 16px; border: 1px solid var(--glass-border); border-radius: 6px; background: var(--glass-secondary); color: var(--text-primary);"> g
          <button class="secondary small-action" data-remove-ing-idx="${idx}" type="button" style="margin-top:0;">Rimuovi</button>
        </div>`).join('')
      : '<p class="small-muted">Nessun ingrediente aggiunto. Cerca e aggiungi ingredienti.</p>';

    listEl.querySelectorAll('[data-remove-ing-idx]').forEach(btn =>
      btn.addEventListener('click', () => { ingredients.splice(Number(btn.dataset.removeIngIdx), 1); renderList(); updateMacros(); }));
    listEl.querySelectorAll('[data-ing-grams]').forEach(inp =>
      inp.addEventListener('input', () => { const g = Number(inp.value); if (g >= 1) { ingredients[Number(inp.dataset.ingGrams)].grammi = g; updateMacros(); } }));
  }

  async function runSearch() {
    const q = searchEl.value.trim();
    if (q.length < 2) { resultsEl.style.display = 'none'; return; }
    const found = await searchFoods(q);
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = found.length
      ? found.slice(0, 8).map((f, i) => `<button type="button" data-res="${i}" class="secondary" style="display:block; width:100%; text-align:left; margin-bottom:0.35rem; padding:0.5rem;">${escapeHtml(f.nome)} · ${f.per100g?.kcal || 0} kcal/100g</button>`).join('')
      : '<p class="small-muted" style="margin:0;">Nessun risultato</p>';
    resultsEl.querySelectorAll('[data-res]').forEach(btn => btn.addEventListener('click', () => {
      const f = found[Number(btn.dataset.res)];
      ingredients.push({ foodRef: { id: f.id, source: f.source, name: f.nome }, grammi: 100, per100g: f.per100g });
      resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; searchEl.value = '';
      renderList(); updateMacros();
    }));
  }

  container.querySelector('#addIngredientBtn')?.addEventListener('click', runSearch);
  searchEl?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
  portionsEl?.addEventListener('input', updateMacros);

  container.querySelector('#saveRecipeBtn')?.addEventListener('click', () => {
    const nome = container.querySelector('#recipeNameInput').value.trim();
    if (!nome) { alert('Inserisci il nome della ricetta'); return; }
    if (!ingredients.length) { alert('Aggiungi almeno un ingrediente'); return; }
    callbacks.onSave({
      nome,
      descrizione: container.querySelector('#recipeDescInput').value.trim() || null,
      porzioniBase: Math.max(1, parseInt(portionsEl.value) || 1),
      ingredients: ingredients.map(i => ({ foodRef: i.foodRef, grammi: i.grammi, per100g: i.per100g }))
    });
  });

  container.querySelector('#cancelRecipeBtn')?.addEventListener('click', callbacks.onCancel);

  renderList();
  updateMacros();
}
