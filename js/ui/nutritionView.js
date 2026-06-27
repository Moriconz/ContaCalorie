/*
  Tab Nutrizione — Dettaglio completo pasti e macros

  Contiene:
  - Macro breakdown tabbed (Kcal/Proteine/Carbs/Grassi)
  - Pasti divisi per momento della giornata
  - Lista dettagli cibi con modifica/cancella
  - Sezione alimenti personalizzati
  - Mini analisi settimanale
*/

import { MealMoments } from '../models.js';
import { escapeHtml } from '../utils.js';
import { showConfirm } from './modal.js';

/**
 * FASE 9 - Helper per generare badge di qualità del dato
 */
function _getSourceBadge(item) {
  const sourceType = item.sourceType || 'A_DATABASE';
  const confidence = item.confidenceLevel || 85;

  let label = '';
  let bgColor = '';
  let borderColor = '';
  let icon = '';

  switch(sourceType) {
    case 'A_DATABASE':
      label = confidence >= 85 ? '✓ Preciso' : 'Database';
      bgColor = '#dcfce7';
      borderColor = '#22c55e';
      icon = '📊';
      break;
    case 'B_PERSONALIZZATO':
      label = 'Custom';
      bgColor = '#e0e7ff';
      borderColor = '#6366f1';
      icon = '⭐';
      break;
    case 'C_PASTO_COMPOSTO':
      label = 'Composto';
      bgColor = '#fef08a';
      borderColor = '#eab308';
      icon = '🍽️';
      break;
    case 'D_STIMA_RAPIDA':
      label = confidence >= 60 ? 'Stima' : '~ Stima';
      bgColor = '#fee2e2';
      borderColor = '#ef4444';
      icon = '📝';
      break;
    case 'E_RECENTI':
      label = 'Recente';
      bgColor = '#f3e8ff';
      borderColor = '#a855f7';
      icon = '⏱️';
      break;
    default:
      label = 'Dato';
      bgColor = '#f0f0f0';
      borderColor = '#999';
      icon = '?';
  }

  return `<span style="display: inline-block; font-size: 0.65rem; padding: 0.15rem 0.4rem; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 3px; font-weight: 600; color: #333; margin-top: 0.25rem;">${icon} ${label}</span>`;
}

function _getConfidenceIndicator(confidence) {
  if (!confidence && confidence !== 0) return '';

  if (confidence >= 85) {
    return `<span style="font-size: 0.7rem; color: #22c55e; margin-left: 0.5rem;">●●●</span>`;
  } else if (confidence >= 60) {
    return `<span style="font-size: 0.7rem; color: #f59e0b; margin-left: 0.5rem;">●●○</span>`;
  } else {
    return `<span style="font-size: 0.7rem; color: #ef4444; margin-left: 0.5rem;">●○○</span>`;
  }
}

export function renderNutritionView(state, summary) {
  if (!state.userProfile) {
    return `<div class="section card"><p>Completa il profilo per iniziare.</p></div>`;
  }

  const grouped = MealMoments.reduce((acc, momento) => {
    acc[momento] = state.meals.filter(item => item.momento === momento);
    return acc;
  }, {});

  return `
    ${renderHeader()}

    ${renderMacroBreakdown(summary)}

    ${renderMealsByMoment(grouped, state)}

    ${renderPersonalizedFoods(state.userFoods)}

    <section class="section card">
      <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">🍳 Ricette</h2>
      <div class="small-muted" style="margin-bottom: 1rem;">Crea ricette dai tuoi ingredienti e aggiungile come pasto (o cucinale dal Frigo).</div>
      <button id="manageRecipesBtn" style="width: 100%; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Gestisci ricette →</button>
    </section>

    ${renderWeeklyAnalysis(summary)}
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  HEADER
  ═══════════════════════════════════════════════════════════════
*/

function renderHeader() {
  return `
    <section class="section" style="padding-bottom: 0.5rem;">
      <h1 style="font-size: 1.3rem; font-weight: 700;">🍽️ Nutrizione</h1>
      <p class="small-muted">Dettaglio pasti e macronutrienti di oggi</p>
    </section>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  MACRO BREAKDOWN (Tabbed)
  ═══════════════════════════════════════════════════════════════
*/

function renderMacroBreakdown(summary) {
  const caloTarget = summary.confrontoConTarget.calorie;
  const protTarget = summary.confrontoConTarget.proteine;
  const carbTarget = summary.confrontoConTarget.carboidrati;
  const fatTarget = summary.confrontoConTarget.grassi;

  return `
    <section class="section card">
      <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">📊 Macronutrienti</h2>

      <div id="macroTabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); overflow-x: auto;">
        <button class="macro-tab active" data-macro="calorie" style="padding: 0.75rem 1rem; border: none; background: none; border-bottom: 2px solid var(--primary); color: var(--primary); cursor: pointer; font-weight: 600;">Calorie</button>
        <button class="macro-tab" data-macro="proteine" style="padding: 0.75rem 1rem; border: none; background: none; color: var(--text-muted); cursor: pointer; font-weight: 600;">Proteine</button>
        <button class="macro-tab" data-macro="carbs" style="padding: 0.75rem 1rem; border: none; background: none; color: var(--text-muted); cursor: pointer; font-weight: 600;">Carbs</button>
        <button class="macro-tab" data-macro="grassi" style="padding: 0.75rem 1rem; border: none; background: none; color: var(--text-muted); cursor: pointer; font-weight: 600;">Grassi</button>
      </div>

      <div id="macroContent">
        ${renderMacroTab('calorie', caloTarget, 'kcal', '#3b82f6')}
        ${renderMacroTab('proteine', protTarget, 'g', '#a855f7', 'display: none;')}
        ${renderMacroTab('carbs', carbTarget, 'g', '#22c55e', 'display: none;')}
        ${renderMacroTab('grassi', fatTarget, 'g', '#eab308', 'display: none;')}
      </div>
    </section>
  `;
}

function renderMacroTab(key, data, unit, color, style = '') {
  const ratio = Math.min(100, Math.max(0, data.percent));
  const mancano = Math.max(0, data.target - data.actual);

  const mainMacro = key === 'calorie' ? 'Calorie' : key === 'proteine' ? 'Proteine' : key === 'carbs' ? 'Carboidrati' : 'Grassi';

  return `
    <div class="macro-tab-content" data-macro="${key}" style="${style}">
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
          <div>
            <div class="small-muted" style="font-size: 0.8rem;">${mainMacro}</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: ${color};">${data.actual}/${data.target} ${unit}</div>
          </div>
          <div style="text-align: right;">
            <div class="small-muted" style="font-size: 0.8rem;">${data.percent.toFixed(0)}%</div>
            <div class="small-muted" style="font-size: 0.8rem;">Mancano: ${mancano} ${unit}</div>
          </div>
        </div>
        <div style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; margin-bottom: 1rem;">
          <div style="height: 100%; width: ${ratio}%; background: ${color}; transition: width 0.3s;"></div>
        </div>
      </div>
    </div>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  PASTI PER MOMENTO
  ═══════════════════════════════════════════════════════════════
*/

function renderMealsByMoment(grouped, state) {
  return `
    <section class="section card">
      <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">🥗 Pasti di Oggi</h2>

      ${MealMoments.map(moment => renderMealMoment(moment, grouped[moment] || [], state)).join('')}
    </section>
  `;
}

function renderMealMoment(moment, items, state) {
  const totalKcal = items.reduce((sum, meal) => sum + (meal.macroCalcolate.kcal || 0), 0);
  const totalProt = items.reduce((sum, meal) => sum + (meal.macroCalcolate.proteine || 0), 0);
  const emoji = moment === 'Colazione' ? '🌅' : moment === 'Pranzo' ? '☀️' : moment === 'Merenda' ? '🕐' : '🌙';

  return `
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--glass-secondary); border-radius: 8px;">
      <h3 style="margin-top: 0; margin-bottom: 0.75rem; font-size: 1rem; font-weight: 700;">${emoji} ${moment}</h3>

      ${items.length ? `
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
          ${items.map((item, idx) => {
            const foodName = escapeHtml(item.foodRef.name || item.foodRef.id);
            const badge = _getSourceBadge(item);
            const confidence = _getConfidenceIndicator(item.confidenceLevel);
            return `
              <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 0.75rem; background: var(--surface); border-radius: 6px;">
                <div style="flex: 1;">
                  <div style="font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">
                    ${foodName}
                    ${confidence}
                  </div>
                  <div class="small-muted" style="font-size: 0.8rem; margin-bottom: 0.25rem;">
                    ${item.grammi} g • ${item.macroCalcolate.kcal} kcal • ${item.macroCalcolate.proteine} g prot
                  </div>
                  ${badge}
                </div>
                <div style="display: flex; gap: 0.5rem; margin-left: 0.5rem;">
                  <button class="meal-edit-btn icon-action edit" data-moment="${moment}" data-meal-index="${idx}" aria-label="Modifica pasto">✎</button>
                  <button class="meal-delete-btn icon-action delete" data-moment="${moment}" data-meal-index="${idx}" aria-label="Elimina pasto">✕</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `<div class="small-muted" style="margin-bottom: 1rem; text-align: center; padding: 0.5rem;">— Nessun pasto qui —</div>`}

      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--surface); border-radius: 6px; margin-bottom: 0.75rem;">
        <span class="small-muted" style="font-weight: 600;">Totale</span>
        <span style="font-weight: 700; color: var(--primary);">${totalKcal} kcal • ${totalProt.toFixed(1)} g prot</span>
      </div>

      <button class="add-to-moment-btn" data-moment="${moment}" style="width: 100%; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">+ Aggiungi Cibo</button>
    </div>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  ALIMENTI PERSONALIZZATI
  ═══════════════════════════════════════════════════════════════
*/

function renderPersonalizedFoods(userFoods) {
  if (!userFoods || userFoods.length === 0) {
    return `
      <section class="section card">
        <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">⭐ Alimenti Personalizzati</h2>
        <div class="small-muted" style="margin-bottom: 1rem;">Non hai ancora creato alimenti personalizzati.</div>
        <button id="createCustomFoodBtn" style="width: 100%; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">+ Nuovo Alimento</button>
      </section>
    `;
  }

  return `
    <section class="section card">
      <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">⭐ Alimenti Personalizzati</h2>
      <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem;">
        ${userFoods.map(food => `
          <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <div style="font-weight: 500;">${escapeHtml(food.name)}</div>
              <div class="small-muted" style="font-size: 0.8rem;">
                ${food.kcalPer100 || 0} kcal • ${food.proteinPer100 || 0} g prot • ${food.carbsPer100 || 0} g carbs
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="custom-food-edit-btn" data-food-id="${food.id}" style="background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1rem;">✎</button>
              <button class="custom-food-delete-btn" data-food-id="${food.id}" style="background: none; border: none; cursor: pointer; color: var(--danger); font-size: 1rem;">✕</button>
            </div>
          </div>
        `).join('')}
      </div>
      <button id="createCustomFoodBtn" style="width: 100%; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">+ Nuovo Alimento</button>
    </section>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  ANALISI SETTIMANALE (Mini)
  ═══════════════════════════════════════════════════════════════
*/

function renderWeeklyAnalysis(summary) {
  if (!summary.weeklyTrend) {
    return '';
  }

  const intake = Math.round(summary.totaleCalorie || 0);
  const target = summary.nutritionTargets?.calorieTarget || 2200;

  return `
    <section class="section card">
      <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">📈 Analisi Settimanale</h2>

      <div style="padding: 1rem; background: var(--glass-secondary); border-radius: 8px;">
        <div style="display: flex; justify-content: space-around; margin-bottom: 1rem;">
          <div style="text-align: center;">
            <div class="small-muted" style="font-size: 0.75rem; margin-bottom: 0.25rem;">Intake Medio</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: var(--primary);">${summary.weeklyIntakeAvg || intake}</div>
            <div class="small-muted" style="font-size: 0.7rem;">kcal/giorno</div>
          </div>
          <div style="text-align: center;">
            <div class="small-muted" style="font-size: 0.75rem; margin-bottom: 0.25rem;">Target</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: #f97316;">${target}</div>
            <div class="small-muted" style="font-size: 0.7rem;">kcal/giorno</div>
          </div>
          <div style="text-align: center;">
            <div class="small-muted" style="font-size: 0.75rem; margin-bottom: 0.25rem;">Gap Medio</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: #22c55e;">${(summary.weeklyIntakeAvg || intake) - target}</div>
            <div class="small-muted" style="font-size: 0.7rem;">kcal/giorno</div>
          </div>
        </div>

      </div>
    </section>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  EVENT BINDING
  ═══════════════════════════════════════════════════════════════
*/

export function bindNutritionViewEvents(container, callbacks) {
  const {
    onAddMealToMoment,
    onEditMeal,
    onDeleteMeal,
    onCreateCustomFood,
    onEditCustomFood,
    onDeleteCustomFood,
    onManageRecipes,
  } = callbacks;

  // Ingresso alla gestione ricette (vista `foods`, altrimenti irraggiungibile)
  container.querySelector('#manageRecipesBtn')?.addEventListener('click', () => onManageRecipes?.());

  // Macro tabs switching
  container.querySelectorAll('.macro-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      container.querySelectorAll('.macro-tab').forEach(b => {
        b.style.borderBottom = b.dataset.macro === macro ? '2px solid var(--primary)' : 'none';
        b.style.color = b.dataset.macro === macro ? 'var(--primary)' : 'var(--text-muted)';
      });
      container.querySelectorAll('.macro-tab-content').forEach(content => {
        content.style.display = content.dataset.macro === macro ? 'block' : 'none';
      });
    });
  });

  // Add meal to moment
  container.querySelectorAll('.add-to-moment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const moment = btn.dataset.moment;
      if (onAddMealToMoment) onAddMealToMoment(moment);
    });
  });

  // Edit meal
  container.querySelectorAll('.meal-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const moment = btn.dataset.moment;
      const index = parseInt(btn.dataset.mealIndex);
      if (onEditMeal) onEditMeal(moment, index);
    });
  });

  // Delete meal
  container.querySelectorAll('.meal-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const moment = btn.dataset.moment;
      const index = parseInt(btn.dataset.mealIndex);
      // Niente conferma: l'eliminazione è immediata, con "Annulla" nel toast (undo)
      if (onDeleteMeal) onDeleteMeal(moment, index);
    });
  });

  // Custom food buttons
  const createCustomFoodBtns = container.querySelectorAll('#createCustomFoodBtn');
  createCustomFoodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (onCreateCustomFood) onCreateCustomFood();
    });
  });

  container.querySelectorAll('.custom-food-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const foodId = btn.dataset.foodId;
      if (onEditCustomFood) onEditCustomFood(foodId);
    });
  });

  container.querySelectorAll('.custom-food-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const foodId = btn.dataset.foodId;
      if (await showConfirm('Eliminare questo alimento personalizzato?', { confirmLabel: 'Elimina', danger: true })) {
        if (onDeleteCustomFood) onDeleteCustomFood(foodId);
      }
    });
  });


}
