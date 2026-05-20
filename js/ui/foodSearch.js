/*
  Schermata di ricerca alimenti e inserimento manuale rapido.
*/

export function renderFoodSearch(state, searchResults, userFoods) {
  return `
    <section class="section card">
      <h1>Aggiungi alimento</h1>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <button id="customFood" class="primary">⭐ Cibo personalizzato</button>
        <button id="estimatedFood" class="primary">🔍 Stima senza dati precisi</button>
      </div>
    </section>
    <section class="section card">
      <h2>Alimenti personali</h2>
      <ul class="list-group">
        ${userFoods.length ? userFoods.map(item => renderFoodResult(item, true)).join('') : '<li>Ancora nessun alimento salvato.</li>'}
      </ul>
    </section>
  `;
}

function renderFoodResult(item, isUser = false) {
  const subtitle = item.brand ? `${item.brand} · ${item.porzioneBase}` : item.porzioneBase;
  return `
    <li>
      <div class="list-item-title">${item.nome}</div>
      <div class="small-muted">${subtitle}</div>
      <button class="secondary small-action" data-food-id="${item.id}" data-food-source="${item.source}" type="button">Seleziona</button>
    </li>
  `;
}

export function bindFoodSearchEvents(container, callbacks) {
  const customButton = container.querySelector('#customFood');
  const estimatedButton = container.querySelector('#estimatedFood');

  if (customButton) {
    customButton.addEventListener('click', () => callbacks.onCustomFood());
  }

  if (estimatedButton && callbacks.onEstimatedFood) {
    estimatedButton.addEventListener('click', () => callbacks.onEstimatedFood());
  }

  container.querySelectorAll('[data-food-id]').forEach(button => {
    button.addEventListener('click', () => {
      callbacks.onSelectFood(button.dataset.foodId, button.dataset.foodSource);
    });
  });
}
