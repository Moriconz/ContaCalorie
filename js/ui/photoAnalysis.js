/*
  Modale di analisi foto con elenco proposte AI.
*/

export function renderPhotoAnalysis(items) {
  return `
    <div>
      <h1>Analisi foto</h1>
      <p class="small-muted">Risultato stimato: modifica i grammi o disattiva elementi prima di confermare.</p>
      <form id="photoAnalysisForm">
        ${items.map((item, index) => `
          <div class="card" style="margin-bottom:0.75rem;">
            <div class="field-grid">
              <label>Nome<input data-index="${index}" class="photoItemName" value="${item.name}"></label>
              <label>Grammi<input data-index="${index}" class="photoItemGrams" type="number" min="1" max="3000" value="${item.estimateGrams}"></label>
            </div>
            <div class="field-grid">
              <label class="small-muted">Calorie: ${item.macro.kcal || 0}</label>
              <label class="small-muted">Proteine: ${item.macro.proteine || 0} g</label>
            </div>
            <label><input type="checkbox" data-index="${index}" class="photoItemEnabled" checked> Includi</label>
          </div>
        `).join('')}
        <div class="field-grid">
          <button id="confirmPhotoItems" class="primary" type="button">Conferma</button>
          <button id="cancelPhotoAnalysis" class="secondary" type="button">Annulla</button>
        </div>
      </form>
    </div>
  `;
}

export function bindPhotoAnalysisEvents(container, callbacks) {
  const confirm = container.querySelector('#confirmPhotoItems');
  const cancel = container.querySelector('#cancelPhotoAnalysis');
  if (confirm) confirm.addEventListener('click', () => {
    const items = Array.from(container.querySelectorAll('.photoItemName')).map(input => {
      const index = input.dataset.index;
      const grams = Number(container.querySelector(`.photoItemGrams[data-index="${index}"]`).value) || 0;
      const enabled = container.querySelector(`.photoItemEnabled[data-index="${index}"]`).checked;
      return { name: input.value.trim(), estimateGrams: grams, enabled, index };
    });
    callbacks.onConfirm(items);
  });
  if (cancel) cancel.addEventListener('click', callbacks.onCancel);
}
