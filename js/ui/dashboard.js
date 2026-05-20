/*
  Dashboard principale con riepilogo giornaliero e liste dei pasti.
*/

import { MealMoments } from '../models.js';
import { MealMoments as Moments } from '../models.js';
import { getRecents, isFavorite, toggleFavorite } from '../recentFoodsTracker.js';

export function renderDashboard(state, summary, warnings, bodyCompData, activityData) {
  const grouped = MealMoments.reduce((acc, momento) => {
    acc[momento] = state.meals.filter(item => item.momento === momento);
    return acc;
  }, {});

  return `
    ${renderHeader(state.currentDate)}

    ${renderCardOggi(state, summary, warnings)}

    ${renderCardAttivita(activityData)}

    ${renderCardPeso(bodyCompData)}

    ${renderCardTrendRapido(state, summary)}

    ${renderCardPastiOggi(grouped)}
  `;
}

function renderHeader(currentDate) {
  return `
    <section class="section" style="padding-bottom: 0.5rem;">
      <div style="padding: 1rem; background: var(--surface-strong); border-radius: 12px;">
        <h1 style="font-size: 1.3rem; margin-bottom: 1rem; font-weight: 700;">Oggi: ${currentDate}</h1>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
          <button id="quickAddMealBtn" class="primary" style="padding: 0.875rem; font-size: 0.95rem; font-weight: 700; border-radius: 10px;">+ Pasto</button>
          <button id="quickAddActivityBtn" class="primary" style="padding: 0.875rem; font-size: 0.95rem; font-weight: 700; border-radius: 10px; background: #22c55e; border-color: #22c55e;">+ Attività</button>
          <button id="quickAddWeightBtn" class="primary" style="padding: 0.875rem; font-size: 0.95rem; font-weight: 700; border-radius: 10px; background: #8b5cf6; border-color: #8b5cf6;">+ Peso</button>
        </div>
      </div>
    </section>
  `;
}

function renderCardOggi(state, summary, warnings) {
  if (!state.userProfile) return '';

  const caloTarget = summary.confrontoConTarget.calorie;
  const protTarget = summary.confrontoConTarget.proteine;
  const carbTarget = summary.confrontoConTarget.carboidrati;
  const fatTarget = summary.confrontoConTarget.grassi;

  const tdeeBase = Math.round(summary.tdee || 0);
  const intakeKcal = Math.round(summary.totaleCalorie || 0);
  const balance = intakeKcal - tdeeBase;
  const balanceColor = balance < -500 ? '#ef4444' : balance < 0 ? '#f97316' : balance > 500 ? '#22c55e' : '#3b82f6';
  const balanceLabel = balance < -500 ? 'Deficit Significativo' : balance < 0 ? 'Deficit Leggero' : balance > 500 ? 'Surplus' : 'Equilibrio';

  return `
    <section class="section card">
      <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">📊 Oggi</h2>

      <!-- MACRONUTRIENTI -->
      <div style="margin-bottom: 1.5rem;">
        <div class="small-muted" style="font-size: 0.8rem; margin-bottom: 0.75rem; text-transform: uppercase;">Macronutrienti</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          ${renderTargetCard('Calorie', caloTarget, 'primary')}
          ${renderTargetCard('Proteine', protTarget, 'accent')}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem;">
          ${renderTargetCard('Carboidrati', carbTarget, 'success')}
          ${renderTargetCard('Grassi', fatTarget, 'accent-light')}
        </div>
      </div>

      <!-- BILANCIO ENERGETICO SEMPLIFICATO -->
      <div style="padding: 1rem; background: var(--glass-secondary); border-radius: 8px; margin-bottom: 1rem;">
        <div class="small-muted" style="font-size: 0.8rem; margin-bottom: 0.75rem;">Spesa Energetica</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
          <div style="text-align: center;">
            <div style="font-size: 1.1rem; font-weight: 700; color: #f97316;">${tdeeBase}</div>
            <div class="small-muted" style="font-size: 0.75rem;">TDEE base</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 1.1rem; font-weight: 700; color: ${balanceColor};">${balance >= 0 ? '+' : ''}${balance}</div>
            <div class="small-muted" style="font-size: 0.75rem;">${balanceLabel}</div>
          </div>
        </div>
      </div>

      ${warnings.length ? `<div class="alert warning">${warnings.join('<br>')}</div>` : ''}
      <div class="alert">L'app non sostituisce un medico o un nutrizionista. Controlla sempre le quantità e i valori personali.</div>
    </section>
  `;
}

function renderCardAttivita(activityData) {
  if (!activityData || (activityData.strengthCount === 0 && activityData.cardioCount === 0 && activityData.steps === 0)) {
    return `
      <section class="section card">
        <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">💪 Attività di Oggi</h2>
        <div class="small-muted" style="margin-bottom: 1rem;">Nessuna attività oggi. Aggiungi un allenamento con il bottone + Attività in alto.</div>
        <button id="goToActivitiesBtn" style="width: 100%; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">Vedi dettagli attività</button>
      </section>
    `;
  }

  const stepGoal = activityData.prefs?.stepGoal || 10000;
  const stepsPercent = activityData.steps ? Math.round((activityData.steps / stepGoal) * 100) : 0;

  return `
    <section class="section card">
      <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">💪 Attività di Oggi</h2>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted" style="font-size: 0.8rem;">Passi</div>
          <div style="font-size: 1.3rem; font-weight: 700; color: #3b82f6;">${activityData.steps || 0}</div>
          <div class="small-muted" style="font-size: 0.7rem;">/ ${stepGoal}</div>
        </div>
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted" style="font-size: 0.8rem;">Sessioni</div>
          <div style="font-size: 1.3rem; font-weight: 700; color: #f97316;">${activityData.strengthCount + activityData.cardioCount}</div>
          <div class="small-muted" style="font-size: 0.7rem;">💪${activityData.strengthCount} 🏃${activityData.cardioCount}</div>
        </div>
      </div>

      <div style="padding: 0.75rem; background: rgba(34, 197, 94, 0.15); border-left: 3px solid #22c55e; border-radius: 8px; text-align: center; margin-bottom: 1rem;">
        <div class="small-muted" style="font-size: 0.8rem;">Kcal Attività</div>
        <div style="font-size: 1.3rem; font-weight: 700; color: #22c55e;">+${Math.round(activityData.activityKcal || 0)}</div>
      </div>

      <button id="goToActivitiesBtn" style="width: 100%; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">Vedi dettagli attività</button>
    </section>
  `;
}

function renderCardPeso(bodyCompData) {
  if (!bodyCompData) {
    return `
      <section class="section card">
        <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">⚖️ Peso e Composizione</h2>
        <div class="small-muted" style="margin-bottom: 1rem;">Composizione non calibrata. Inserisci il tuo body fat % per iniziare il tracking.</div>
        <button id="addBodyCompBtn" class="primary" style="width: 100%;">+ Calibra Composizione</button>
      </section>
    `;
  }

  if (bodyCompData.error) {
    return `
      <section class="section card">
        <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">⚖️ Peso e Composizione</h2>
        <div class="small-muted">Non disponibile: ${bodyCompData.error}</div>
        <button id="addBodyCompBtn" class="primary" style="width: 100%; margin-top: 0.5rem;">+ Calibra Composizione</button>
      </section>
    `;
  }

  return `
    <section class="section card">
      <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">⚖️ Peso e Composizione</h2>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; text-align: center;">
          <div class="small-muted" style="font-size: 0.8rem;">Peso</div>
          <div style="font-size: 1.2rem; font-weight: 700; color: #3b82f6;">${bodyCompData.weightMeasuredToday}</div>
          <div class="small-muted" style="font-size: 0.75rem;">kg</div>
        </div>
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; text-align: center;">
          <div class="small-muted" style="font-size: 0.8rem;">Massa Grassa</div>
          <div style="font-size: 1.2rem; font-weight: 700; color: #ffc107;">${bodyCompData.fatKgToday}</div>
          <div class="small-muted" style="font-size: 0.75rem;">${bodyCompData.bfPercentToday}%</div>
        </div>
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; text-align: center;">
          <div class="small-muted" style="font-size: 0.8rem;">Massa Magra</div>
          <div style="font-size: 1.2rem; font-weight: 700; color: #4caf50;">${bodyCompData.leanKgToday}</div>
          <div class="small-muted" style="font-size: 0.75rem;">kg</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <button id="updateWeightBtn" style="padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">Aggiorna peso</button>
        <button id="viewWeightDetailsBtn" style="padding: 0.75rem; background: var(--surface-strong); color: var(--primary); border: 1px solid var(--primary); border-radius: 8px; cursor: pointer;">Dettagli</button>
      </div>
    </section>
  `;
}

function renderCardTrendRapido(state, summary) {
  if (!state.userProfile || !summary.weeklyTrend) return '';

  const trend = summary.weeklyTrend;
  const deficitMedio = Math.round(trend.avgDeficit || 0);
  const estimaMensile = (Math.abs(deficitMedio) / 7700 * 30).toFixed(2);

  const days = ['GIO', 'VEN', 'SAB', 'DOM', 'LUN', 'MAR', 'MER'];
  const maxBalance = Math.max(...trend.dailyBalances.map(b => Math.abs(b)), 500);

  const bars = trend.dailyBalances.map((balance, idx) => {
    const color = balance < 0 ? '#22c55e' : '#ef4444';
    return `<div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
      <div style="height: 60px; width: 24px; background: ${color}; opacity: 0.7; border-radius: 4px;"></div>
      <div class="small-muted" style="font-size: 0.65rem;">${days[idx]}</div>
    </div>`;
  }).join('');

  return `
    <section class="section card">
      <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">📈 Trend Rapido</h2>

      <div style="display: flex; justify-content: space-around; align-items: flex-end; height: 100px; padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; margin-bottom: 1rem;">
        ${bars}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; text-align: center;">
          <div class="small-muted" style="font-size: 0.8rem;">Deficit Medio</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: #22c55e;">${deficitMedio}</div>
          <div class="small-muted" style="font-size: 0.7rem;">kcal/g</div>
        </div>
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; text-align: center;">
          <div class="small-muted" style="font-size: 0.8rem;">Stima 30gg</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: #8b5cf6;">${estimaMensile}</div>
          <div class="small-muted" style="font-size: 0.7rem;">kg</div>
        </div>
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; text-align: center;">
          <div class="small-muted" style="font-size: 0.8rem;">Trend</div>
          <div style="font-size: 1.3rem;">📉</div>
          <div class="small-muted" style="font-size: 0.7rem;">In corso</div>
        </div>
      </div>

      <button id="viewStatsBtn" style="width: 100%; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">Statistiche complete</button>
    </section>
  `;
}

function renderCardPastiOggi(grouped) {
  return `
    <section class="section card">
      <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">🍽️ Pasti di Oggi</h2>

      ${MealMoments.map(moment => renderMealSection(moment, grouped[moment])).join('')}

      <button id="viewNutritionBtn" style="width: 100%; padding: 0.75rem; margin-top: 1rem; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">Ricerca • Personalizzato</button>
    </section>
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

export function bindDashboardEvents(container, callbacks) {
  const {
    onAddMeal,
    onAddActivity,
    onAddWeight,
    onUpdateWeight,
    onGoToWeight,
    onGoToActivities,
    onGoToStats,
    onGoToNutrition,
    onBodyComp
  } = callbacks;

  // Quick Actions (Header)
  const quickAddMealBtn = container.querySelector('#quickAddMealBtn');
  const quickAddActivityBtn = container.querySelector('#quickAddActivityBtn');
  const quickAddWeightBtn = container.querySelector('#quickAddWeightBtn');

  if (quickAddMealBtn && onAddMeal) {
    quickAddMealBtn.addEventListener('click', onAddMeal);
  }
  if (quickAddActivityBtn && onAddActivity) {
    quickAddActivityBtn.addEventListener('click', onAddActivity);
  }
  if (quickAddWeightBtn && onAddWeight) {
    quickAddWeightBtn.addEventListener('click', onAddWeight);
  }

  // Card Peso e Composizione
  const addBodyCompBtn = container.querySelector('#addBodyCompBtn');
  const updateWeightBtn = container.querySelector('#updateWeightBtn');
  const viewWeightDetailsBtn = container.querySelector('#viewWeightDetailsBtn');

  if (addBodyCompBtn && onBodyComp) {
    addBodyCompBtn.addEventListener('click', onBodyComp);
  }
  if (updateWeightBtn && onUpdateWeight) {
    updateWeightBtn.addEventListener('click', onUpdateWeight);
  }
  if (viewWeightDetailsBtn && onGoToWeight) {
    viewWeightDetailsBtn.addEventListener('click', onGoToWeight);
  }

  // Card Attività
  const goToActivitiesBtn = container.querySelector('#goToActivitiesBtn');
  if (goToActivitiesBtn && onGoToActivities) {
    goToActivitiesBtn.addEventListener('click', onGoToActivities);
  }

  // Card Trend Rapido
  const viewStatsBtn = container.querySelector('#viewStatsBtn');
  if (viewStatsBtn && onGoToStats) {
    viewStatsBtn.addEventListener('click', onGoToStats);
  }

  // Card Pasti di Oggi
  const viewNutritionBtn = container.querySelector('#viewNutritionBtn');
  if (viewNutritionBtn && onGoToNutrition) {
    viewNutritionBtn.addEventListener('click', onGoToNutrition);
  }

  // Meal list edit/delete
  container.querySelectorAll('.meal-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const mealId = btn.dataset.mealId;
      // Open edit modal
    });
  });

  container.querySelectorAll('.meal-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const mealId = btn.dataset.mealId;
      // Open delete confirm
    });
  });
}
