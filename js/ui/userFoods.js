/*
  Gestione degli alimenti personalizzati salvati dall'utente.
*/

import { escapeHtml } from '../utils.js';

export function renderUserFoods(userFoods) {
  return `
    <section class="section card">
      <h1>Alimenti personalizzati</h1>
      <button id="newUserFood" class="primary">Nuovo alimento</button>
    </section>
    <section class="section card">
      <ul class="list-group">
        ${userFoods.length ? userFoods.map(item => `
          <li>
            <div class="list-item-title">${escapeHtml(item.nome)}</div>
            <div class="small-muted">${item.porzioneBase}, ${item.per100g.kcal} kcal</div>
            <button class="secondary small-action" data-edit-id="${item.id}" type="button">Modifica</button>
            <button class="secondary small-action" data-delete-id="${item.id}" type="button">Elimina</button>
          </li>
        `).join('') : `<li style="list-style: none;"><div class="empty-state"><span class="empty-state-emoji" aria-hidden="true">⭐</span><div class="empty-state-title">Nessun alimento personalizzato</div><div class="empty-state-hint">Salva i prodotti che usi spesso per ritrovarli subito.</div></div></li>`}
      </ul>
    </section>
  `;
}

export function bindUserFoodsEvents(container, callbacks) {
  const newFoodBtn = container.querySelector('#newUserFood');
  if (newFoodBtn) newFoodBtn.addEventListener('click', callbacks.onCreate);
  container.querySelectorAll('[data-edit-id]').forEach(button => button.addEventListener('click', () => callbacks.onEdit(button.dataset.editId)));
  container.querySelectorAll('[data-delete-id]').forEach(button => button.addEventListener('click', () => callbacks.onDelete(button.dataset.deleteId)));
}

export function renderUserFoodForm(food = {}) {
  const safeFood = food || {};
  return `
    <section class="section">
          <h1>${safeFood.id ? 'Modifica' : 'Nuovo'} alimento</h1>
          <label>Nome<input id="userFoodName" value="${escapeHtml(safeFood.nome || '')}"></label>
          <label>Porzione base<input id="userFoodServing" value="${escapeHtml(safeFood.porzioneBase || '100 g')}"></label>
          <div class="field-grid">
            <label>Kcal per 100 g<input id="userFoodKcal" type="number" min="0" max="2000" value="${safeFood.per100g?.kcal || 0}"></label>
            <label>Proteine per 100 g<input id="userFoodProt" type="number" min="0" max="200" value="${safeFood.per100g?.proteine || 0}"></label>
          </div>
          <div class="field-grid">
            <label>Carboidrati per 100 g<input id="userFoodCarb" type="number" min="0" max="300" value="${safeFood.per100g?.carboidrati || 0}"></label>
            <label>Grassi per 100 g<input id="userFoodFat" type="number" min="0" max="200" value="${safeFood.per100g?.grassi || 0}"></label>
          </div>
          <div class="field-grid">
            <label>Zuccheri per 100 g<input id="userFoodSugar" type="number" min="0" max="200" value="${safeFood.per100g?.zuccheri || 0}"></label>
            <label>Fibra per 100 g<input id="userFoodFiber" type="number" min="0" max="100" value="${safeFood.per100g?.fibra || 0}"></label>
          </div>
          <div class="field-grid">
            <label>Grassi saturi<input id="userFoodSatFat" type="number" min="0" max="100" value="${safeFood.per100g?.grassi_saturi || 0}"></label>
            <label>Sodio (mg per 100 g)<input id="userFoodSodium" type="number" min="0" max="10000" value="${safeFood.per100g?.sodioMg || 0}"></label>
          </div>
          <div class="field-grid">
            <button id="saveUserFood" class="primary" type="button">Salva</button>
            <button id="cancelUserFood" class="secondary" type="button">Annulla</button>
          </div>
        </section>
  `;
}

export function bindUserFoodFormEvents(container, callbacks) {
  const save = container.querySelector('#saveUserFood');
  const cancel = container.querySelector('#cancelUserFood');
  if (save) save.addEventListener('click', () => callbacks.onSave(getFormData(container)));
  if (cancel) cancel.addEventListener('click', callbacks.onCancel);
}

function getFormData(container) {
  return {
    nome: container.querySelector('#userFoodName').value.trim(),
    porzioneBase: container.querySelector('#userFoodServing').value.trim(),
    per100g: {
      kcal: Number(container.querySelector('#userFoodKcal').value) || 0,
      proteine: Number(container.querySelector('#userFoodProt').value) || 0,
      carboidrati: Number(container.querySelector('#userFoodCarb').value) || 0,
      grassi: Number(container.querySelector('#userFoodFat').value) || 0,
      zuccheri: Number(container.querySelector('#userFoodSugar').value) || 0,
      fibra: Number(container.querySelector('#userFoodFiber').value) || 0,
      grassi_saturi: Number(container.querySelector('#userFoodSatFat').value) || 0,
      sodioMg: Number(container.querySelector('#userFoodSodium').value) || 0
    }
  };
}
