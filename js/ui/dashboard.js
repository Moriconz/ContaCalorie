/*
  Dashboard principale con riepilogo giornaliero e liste dei pasti.
*/

import { MealMoments } from '../models.js';
import { MealMoments as Moments } from '../models.js';

export function renderDashboard(state, summary, warnings, bodyCompData) {
  const grouped = MealMoments.reduce((acc, momento) => {
    acc[momento] = state.meals.filter(item => item.momento === momento);
    return acc;
  }, {});

  return `
    <section class="section">
      <div class="card">
        <h1>Oggi: ${state.currentDate}</h1>
        <div class="badge-row">
          ${renderTargetCard('Calorie', summary.confrontoConTarget.calorie, 'primary')}
          ${renderTargetCard('Proteine', summary.confrontoConTarget.proteine, 'accent')}
        </div>
        <div class="badge-row" style="margin-top:0.75rem;">
          ${renderTargetCard('Carboidrati', summary.confrontoConTarget.carboidrati, 'success')}
          ${renderTargetCard('Grassi', summary.confrontoConTarget.grassi, 'accent-light')}
        </div>
        ${warnings.length ? `<div class="alert warning">${warnings.join('<br>')}</div>` : ''}
        <div class="alert">L'app non sostituisce un medico o un nutrizionista. Controlla sempre le quantità e i valori personali.</div>
      </div>
    </section>

    ${renderBodyCompWidget(bodyCompData)}

    <section class="section card">
      <div class="field-grid">
        <button id="addManual" class="primary">+ Aggiungi alimento</button>
        <button id="addPhoto" class="primary">+ Aggiungi da foto</button>
      </div>
    </section>
    ${MealMoments.map(moment => renderMealSection(moment, grouped[moment])).join('')}
  `;
}

function renderTargetCard(label, data, colorVar) {
  const ratio = Math.min(100, Math.max(0, data.percent));
  return `
    <div class="card summary-card">
      <strong>${label}</strong>
      <span>${data.actual}/${data.target} ${label === 'Calorie' ? 'kcal' : 'g'}</span>
      <div class="bar-visual"><div class="bar-fill" style="width:${ratio}%;background:var(--${colorVar});"></div></div>
      <span class="small-muted">${data.percent.toFixed(0)}% del target</span>
    </div>
  `;
}

function renderBodyCompWidget(bodyCompData) {
  if (!bodyCompData) {
    return `
      <section class="section">
        <div class="card" style="background: linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(99,102,241,0.08) 100%); border: 1px solid var(--border);">
          <h2 style="font-size: 1.1rem; margin-bottom: 1rem;">📊 Composizione Corporea</h2>
          <div class="small-muted" style="margin-bottom: 0.75rem;">Per tracciare la tua composizione corporea (massa grassa e magra), inserisci una misurazione iniziale di body fat % da DEXA, BIA o plicometria.</div>
          <button id="addBodyCompBtn" class="primary" style="width: 100%;">+ Calibra Composizione</button>
        </div>
      </section>
    `;
  }

  if (bodyCompData.error) {
    return `
      <section class="section">
        <div class="card" style="background: rgba(239,68,68,0.1); border-left: 3px solid var(--danger);">
          <h2 style="font-size: 1rem;">📊 Composizione Corporea</h2>
          <div class="small-muted">Non disponibile: ${bodyCompData.error}</div>
          <button id="addBodyCompBtn" class="primary" style="width: 100%; margin-top: 0.5rem;">+ Calibra Composizione</button>
        </div>
      </section>
    `;
  }

  return `
    <section class="section">
      <div class="card" style="background: linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(99,102,241,0.08) 100%); border: 1px solid var(--border);">
        <h2 style="font-size: 1.1rem; margin-bottom: 1rem;">📊 Composizione Corporea Stimata</h2>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
          <div style="padding: 0.75rem; background: var(--surface-strong); border-radius: 10px; text-align: center;">
            <div class="small-muted">Peso</div>
            <strong style="font-size: 1.3rem; color: var(--primary);">${bodyCompData.weightMeasuredToday} kg</strong>
          </div>
          <div style="padding: 0.75rem; background: rgba(255,193,7,0.15); border-radius: 10px; text-align: center;">
            <div class="small-muted">Massa Grassa</div>
            <strong style="font-size: 1.3rem; color: #ffc107;">${bodyCompData.fatKgToday} kg</strong>
            <div class="small-muted" style="font-size: 0.8rem;">${bodyCompData.bfPercentToday}%</div>
          </div>
          <div style="padding: 0.75rem; background: rgba(76,175,80,0.15); border-radius: 10px; text-align: center;">
            <div class="small-muted">Massa Magra</div>
            <strong style="font-size: 1.3rem; color: #4caf50;">${bodyCompData.leanKgToday} kg</strong>
          </div>
        </div>

        ${bodyCompData.driftWarning ? `
          <div style="padding: 0.75rem; background: rgba(239,68,68,0.1); border-left: 3px solid var(--danger); border-radius: 8px; margin-bottom: 1rem;">
            <div class="small-muted">⚠️ Scarto tra stima e peso misurato: ${bodyCompData.drift} kg</div>
            <div class="small-muted" style="font-size: 0.75rem;">Se lo scarto persiste, valuta di aggiornare la calibrazione BF%.</div>
          </div>
        ` : ''}

        <div class="small-muted" style="font-size: 0.75rem; line-height: 1.5; padding: 0.75rem; background: var(--surface-strong); border-radius: 8px;">
          ⓘ <strong>Stima basata su:</strong> body fat % iniziale (${bodyCompData.baseline.bodyFatPercentBaseline}% del ${bodyCompData.baseline.dateBaseline}), peso attuale, trend calorico, allenamenti e proteine.
          <strong>Non è una misura clinica.</strong>
          <button id="updateBodyCompBtn" style="display: block; width: 100%; margin-top: 0.5rem; padding: 0.5rem; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">Aggiorna Calibrazione</button>
        </div>
      </div>
    </section>
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

export function bindDashboardEvents(container, onAddManual, onAddPhoto, onInstallClick, onBodyComp) {
  const manual = container.querySelector('#addManual');
  const photo = container.querySelector('#addPhoto');
  const installBtn = container.querySelector('#installAppBtn');
  const addBodyCompBtn = container.querySelector('#addBodyCompBtn');
  const updateBodyCompBtn = container.querySelector('#updateBodyCompBtn');

  if (manual) manual.addEventListener('click', () => onAddManual());
  if (photo) photo.addEventListener('click', () => onAddPhoto());
  if (installBtn && onInstallClick) {
    installBtn.addEventListener('click', () => onInstallClick());
  }
  if (addBodyCompBtn && onBodyComp) {
    addBodyCompBtn.addEventListener('click', () => onBodyComp());
  }
  if (updateBodyCompBtn && onBodyComp) {
    updateBodyCompBtn.addEventListener('click', () => onBodyComp());
  }
}
