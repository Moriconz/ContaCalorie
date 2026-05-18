/*
  Dashboard principale con riepilogo giornaliero e liste dei pasti.
*/

import { MealMoments } from '../models.js';
import { MealMoments as Moments } from '../models.js';

export function renderDashboard(state, summary, warnings) {
  const grouped = MealMoments.reduce((acc, momento) => {
    acc[momento] = state.meals.filter(item => item.momento === momento);
    return acc;
  }, {});

  return `
    <section class="section">
      <div class="card">
        <h1>Oggi: ${state.currentDate}</h1>
        <div class="badge-row">
          ${renderTargetCard('Calorie', summary.confrontoConTarget.calorie, '#1565c0')}
          ${renderTargetCard('Proteine', summary.confrontoConTarget.proteine, '#ffb300')}
        </div>
        <div class="badge-row" style="margin-top:0.75rem;">
          ${renderTargetCard('Carboidrati', summary.confrontoConTarget.carboidrati, '#43a047')}
          ${renderTargetCard('Grassi', summary.confrontoConTarget.grassi, '#8e24aa')}
        </div>
        ${warnings.length ? `<div class="alert warning">${warnings.join('<br>')}</div>` : ''}
        <div class="alert">L’app non sostituisce un medico o un nutrizionista. Controlla sempre le quantità e i valori personali.</div>
      </div>
    </section>
    <section class="section card">
      <div class="field-grid">
        <button id="addManual" class="primary">+ Aggiungi alimento</button>
        <button id="addPhoto" class="primary">+ Aggiungi da foto</button>
      </div>
    </section>
    ${MealMoments.map(moment => renderMealSection(moment, grouped[moment])).join('')}
  `;
}

function renderTargetCard(label, data, color) {
  const ratio = Math.min(100, Math.max(0, data.percent));
  return `
    <div class="card summary-card">
      <strong>${label}</strong>
      <span>${data.actual}/${data.target} ${label === 'Calorie' ? 'kcal' : 'g'}</span>
      <div class="bar-visual"><div class="bar-fill" style="width:${ratio}%;background:${color};"></div></div>
      <span class="small-muted">${data.percent.toFixed(0)}% del target</span>
    </div>
  `;
}

function renderMealSection(moment, items) {
  return `
    <section class="section card">
      <h2>${moment}</h2>
      <p class="small-muted">Totale: ${items.reduce((sum, meal) => sum + (meal.macroCalcolate.kcal || 0), 0)} kcal</p>
      <ul class="list-group">
        ${items.length ? items.map(item => `
          <li>
            <div class="list-item-title">${item.foodRef.name || item.foodRef.id} - ${item.grammi} g</div>
            <div class="small-muted">${item.macroCalcolate.kcal} kcal, ${item.macroCalcolate.proteine} g prot.</div>
          </li>
        `).join('') : '<li>Nessun alimento ancora.</li>'}
      </ul>
    </section>
  `;
}

export function bindDashboardEvents(container, onAddManual, onAddPhoto, onInstallClick) {
  const manual = container.querySelector('#addManual');
  const photo = container.querySelector('#addPhoto');
  const installBtn = container.querySelector('#installAppBtn');
  
  if (manual) manual.addEventListener('click', () => onAddManual());
  if (photo) photo.addEventListener('click', () => onAddPhoto());
  if (installBtn && onInstallClick) {
    installBtn.addEventListener('click', () => onInstallClick());
  }
}
