/*
  Dashboard principale — Home Page
  Mostra riassunto operativo giornaliero in 6 card essenziali.

  ARCHITETTURA:
  - Header con data e 3 quick actions
  - Card 1: Macros (4-box)
  - Card 2: Bilancio Energetico (4-box)
  - Card 3: Attività di Oggi (snapshot)
  - Card 4: Peso e Composizione (snapshot)
  - Card 5: Pasti di Oggi (4 righe semplici)
  - Card 6: Status Rapido (3 righe mini)

  CTA chiari verso tab di dettaglio in ogni card.
*/

import { MealMoments } from '../models.js';
import { formatDateIT, capitalize, escapeHtml } from '../utils.js';

export function renderDashboard(state, summary, warnings, bodyCompData, activityData, microData) {
  const grouped = MealMoments.reduce((acc, momento) => {
    acc[momento] = state.meals.filter(item => item.momento === momento);
    return acc;
  }, {});

  return `
    ${renderHeader(state.currentDate)}

    ${renderCardOggi(state, summary, warnings)}

    ${renderCardBilancio(summary)}

    ${renderCardMicronutrienti(microData)}

    ${renderCardAttivitaOggi(activityData)}

    ${renderCardStoricoPeso(state.dailyWeights || [], state.userProfile)}

    ${renderCardPastiOggi(grouped)}

    ${renderCardStatusRapido(state, summary)}
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  CARD: MICRONUTRIENTI (carenze + raccomandazioni)
  ═══════════════════════════════════════════════════════════════
*/
function renderCardMicronutrienti(microData) {
  if (!microData || !microData.hasMeals) {
    return `
      <section class="section card">
        <h2 style="font-size: 1rem; margin-bottom: 0.5rem; font-weight: 700;">🧪 Micronutrienti</h2>
        <div class="small-muted">Aggiungi pasti per analizzare vitamine e minerali della giornata.</div>
      </section>
    `;
  }

  const lows = microData.analysis.filter(m => m.status === 'low' || m.status === 'medium');
  const okCount = microData.analysis.filter(m => m.status === 'ok').length;

  if (lows.length === 0) {
    return `
      <section class="section card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 1rem; margin: 0; font-weight: 700;">🧪 Micronutrienti</h2>
          <a href="#" id="microDetailLink" style="font-size: 0.85rem; color: var(--primary); text-decoration: none; cursor: pointer; font-weight: 600;">Dettaglio ↗</a>
        </div>
        <div style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(34,197,94,0.1); border-left: 3px solid #22c55e; border-radius: 8px; font-size: 0.9rem;">
          ✅ Nessuna carenza rilevata: ${okCount} micronutrienti sopra l'80% del fabbisogno.
        </div>
      </section>
    `;
  }

  const color = (s) => s === 'low' ? '#ef4444' : '#f59e0b';
  const rows = lows.slice(0, 4).map(m => {
    const suggestions = (microData.suggestions && microData.suggestions[m.key]) || [];
    const best = suggestions[0];
    const tip = best
      ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.35rem;">💡 Aggiungi <strong>${escapeHtml(best.name)}</strong> (${best.grams}g · ${best.kcal} kcal) → +${best.amount} ${m.unit}</div>`
      : '';
    return `
      <div style="padding: 0.7rem; background: var(--glass-secondary); border-radius: 8px; margin-bottom: 0.5rem; border-left: 3px solid ${color(m.status)};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; font-size: 0.9rem;">${m.label}</span>
          <span style="font-size: 0.85rem; font-weight: 700; color: ${color(m.status)};">${m.pct}% <span style="color: var(--text-muted); font-weight: 400;">(${m.actual}/${m.rda} ${m.unit})</span></span>
        </div>
        <div style="height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; margin-top: 0.4rem;">
          <div style="height: 100%; width: ${Math.min(100, m.pct)}%; background: ${color(m.status)};"></div>
        </div>
        ${tip}
      </div>
    `;
  }).join('');

  return `
    <section class="section card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h2 style="font-size: 1rem; margin: 0; font-weight: 700;">🧪 Micronutrienti da integrare</h2>
        ${microData.remainingKcal > 0 ? `<span class="small-muted" style="font-size: 0.75rem;">${Math.round(microData.remainingKcal)} kcal disponibili</span>` : ''}
      </div>
      ${rows}
      <div style="text-align: center; padding-top: 0.5rem;">
        <a href="#" id="microDetailLink" style="font-size: 0.85rem; color: var(--primary); text-decoration: none; cursor: pointer; font-weight: 600;">Vedi tutti i micronutrienti ↗</a>
      </div>
      <div class="small-muted" style="font-size: 0.72rem; margin-top: 0.5rem;">Stima indicativa su base CREA · suggerimenti entro le calorie rimanenti</div>
    </section>
  `;
}

/**
 * HTML del modale con TUTTI i micronutrienti monitorati (per onMicroDetail).
 */
export function renderMicroDetail(analysis) {
  if (!analysis || analysis.length === 0) {
    return '<div style="padding:1rem;"><h2>Micronutrienti</h2><p class="small-muted">Nessun dato disponibile.</p></div>';
  }
  const color = (s) => s === 'low' ? '#ef4444' : s === 'medium' ? '#f59e0b' : s === 'ok' ? '#22c55e' : '#9ca3af';
  const rows = analysis.map(m => {
    if (m.status === 'unknown') {
      return `
        <div style="padding: 0.6rem 0; border-bottom: 1px solid var(--glass-border);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-muted);">${m.label}</span>
            <span style="font-size: 0.78rem; color: var(--text-muted);">dati insufficienti</span>
          </div>
        </div>
      `;
    }
    return `
      <div style="padding: 0.6rem 0; border-bottom: 1px solid var(--glass-border);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <span style="font-weight: 600; font-size: 0.9rem;">${m.label}</span>
          <span style="font-size: 0.85rem; font-weight: 700; color: ${color(m.status)};">${m.pct}% <span style="color: var(--text-muted); font-weight: 400;">(${m.actual}/${m.rda} ${m.unit})</span></span>
        </div>
        <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
          <div style="height: 100%; width: ${Math.min(100, m.pct)}%; background: ${color(m.status)};"></div>
        </div>
      </div>
    `;
  }).join('');
  return `
    <div style="min-width: 320px;">
      <h2 style="margin-top: 0;">🧪 Micronutrienti di oggi</h2>
      <p class="small-muted" style="font-size: 0.8rem; margin-bottom: 1rem;">Percentuale del fabbisogno giornaliero (LARN). Stima indicativa su base CREA.</p>
      ${rows}
    </div>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  HEADER — Data + 3 Quick Actions
  ═══════════════════════════════════════════════════════════════
*/

function renderHeader(currentDate) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = currentDate === today;
  return `
    <section class="section" style="padding-bottom: 0.5rem;">
      <div style="padding: 1rem; background: var(--glass-secondary); border: 1px solid var(--glass-border); border-radius: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 1rem;">
          <button id="dashPrevDay" class="icon-button" aria-label="Giorno precedente" style="min-width: 44px; min-height: 44px; font-size: 1.1rem;">‹</button>
          <div style="text-align: center; flex: 1; position: relative;">
            <h1 id="dashDateLabel" style="font-size: 1.15rem; margin: 0; font-weight: 700; cursor: pointer;">${capitalize(formatDateIT(currentDate, { weekday: true }))}</h1>
            ${isToday ? '' : `<button id="dashGoToday" style="background: none; border: none; color: var(--primary); font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 0.15rem 0; position: relative; z-index: 2;">Torna a oggi</button>`}
            <input id="dashDatePicker" type="date" value="${currentDate}" max="${today}" style="position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer;" aria-label="Scegli data" />
          </div>
          <button id="dashNextDay" class="icon-button" aria-label="Giorno successivo" ${isToday ? 'disabled style="min-width: 44px; min-height: 44px; font-size: 1.1rem; opacity: 0.3;"' : 'style="min-width: 44px; min-height: 44px; font-size: 1.1rem;"'}>›</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.6rem;">
          <button id="quickAddMealBtn" class="btn-tinted" style="--c: var(--primary);">+ Pasto</button>
          <button id="quickAddActivityBtn" class="btn-tinted" style="--c: var(--success);">+ Attività</button>
          <button id="quickAddWeightBtn" class="btn-tinted" style="--c: #bf5af2;">+ Peso</button>
        </div>
      </div>
    </section>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  CARD 1: MACROS DI OGGI
  ═══════════════════════════════════════════════════════════════
  Mostra 4 macro card semplici con barra progress.
*/

function renderCardOggi(state, summary, warnings) {
  if (!state.userProfile) return '';

  const targets = state.nutritionTargets || {
    calorie: 2000,
    proteine: 160,
    carboidrati: 250,
    grassi: 65
  };

  return renderMacroProgressCircles(summary, targets, warnings);
}

/*
  CIRCULAR PROGRESS INDICATORS FOR MACROS (2026 UI/UX)
*/
function renderMacroProgressCircles(summary, targets, warnings) {
  const calculateProgress = (current, target) => {
    if (target <= 0) return 0;
    return Math.min((current / target) * 100, 120);
  };
  
  const getProgressColor = (progress) => {
    if (progress < 75) return '#ef4444';     // Red - undershoot
    if (progress < 100) return '#f59e0b';    // Amber - close
    return '#10b981';                        // Green - on target
  };
  
  const kcalProg = calculateProgress(summary.totaleCalorie, targets.calorie);
  const protProg = calculateProgress(summary.totaleProteine, targets.proteine);
  const carbProg = calculateProgress(summary.totaleCarbo, targets.carboidrati);
  const fatProg = calculateProgress(summary.totaleGrassi, targets.grassi);
  
  const renderCircle = (value, target, unit, label, progress) => `
    <div style="text-align: center;">
      <div style="
        position: relative;
        width: 110px;
        height: 110px;
        margin: 0 auto 0.75rem;
        background: conic-gradient(${getProgressColor(progress)} ${progress}%, var(--border) 0);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3px;
      ">
        <div style="
          width: 104px;
          height: 104px;
          background: var(--surface-strong);
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        ">
          <div style="font-size: 1.25rem; font-weight: 700; color: var(--text);">
            ${Math.round(value)}
          </div>
          <div style="font-size: 0.65rem; color: var(--muted); margin-top: 0.2rem;">${unit}</div>
        </div>
      </div>
      <div style="font-size: 0.75rem; color: var(--muted);">
        <strong>${Math.round(progress)}%</strong> di ${target}
      </div>
    </div>
  `;
  
  return `
    <section class="section card">
      <div style="margin-bottom: 1.5rem;">
        <h2 style="font-size: 1rem; margin: 0 0 0.5rem 0; font-weight: 700;">📊 Macros di Oggi</h2>
        <p style="margin: 0; font-size: 0.85rem; color: var(--muted);">Progress verso i target giornalieri</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 1.5rem;">
        ${renderCircle(summary.totaleCalorie, targets.calorie, 'kcal', 'Calorie', kcalProg)}
        ${renderCircle(summary.totaleProteine, targets.proteine, 'g proteina', 'Proteine', protProg)}
        ${renderCircle(summary.totaleCarbo, targets.carboidrati, 'g carbs', 'Carb', carbProg)}
        ${renderCircle(summary.totaleGrassi, targets.grassi, 'g grassi', 'Grassi', fatProg)}
      </div>

      <div style="text-align: center; padding-top: 1rem; border-top: 1px solid var(--border);">
        <a href="#" id="viewNutritionDetailLink" style="font-size: 0.9rem; color: var(--primary); text-decoration: none; cursor: pointer; font-weight: 600;">
          Dettagli Nutrizione ↗
        </a>
      </div>

      ${warnings.length ? `<div class="alert warning" style="margin-top: 1rem;">${warnings.join('<br>')}</div>` : ''}
    </section>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  CARD 2: BILANCIO ENERGETICO
  ═══════════════════════════════════════════════════════════════
  Mostra 4 box: Intake, TDEE, Esercizio, Bilancio (con colore dinamico).
*/

function renderCardBilancio(summary) {
  const tdeeBase = Math.round(summary.tdee || 0);
  const intakeKcal = Math.round(summary.totaleCalorie || 0);
  const exerciseKcal = Math.round(summary.activityKcal || 0);
  const balance = intakeKcal - tdeeBase - exerciseKcal;

  const balanceColor = balance < -500 ? '#ef4444' : balance < 0 ? '#f97316' : balance > 500 ? '#22c55e' : '#3b82f6';
  const balanceLabel = balance < -500 ? 'Deficit Significativo' : balance < 0 ? 'Deficit Leggero' : balance > 500 ? 'Surplus' : 'Equilibrio';

  return `
    <section class="section card">
      <h2 class="card-title" style="margin-bottom: 1rem;">⚡ Bilancio Energetico</h2>

      <div class="grid-2" style="margin-bottom: 0.75rem;">
        <div class="stat-box stat-box--accent" style="--c:#3b82f6;">
          <div class="stat-label">INTAKE</div>
          <div class="stat-value stat-value--accent">${intakeKcal} kcal</div>
        </div>
        <div class="stat-box stat-box--accent" style="--c:#f97316;">
          <div class="stat-label">TDEE</div>
          <div class="stat-value stat-value--accent">${tdeeBase} kcal</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="stat-box stat-box--accent" style="--c:#22c55e;">
          <div class="stat-label">ESERCIZIO</div>
          <div class="stat-value stat-value--accent">+${exerciseKcal} kcal</div>
        </div>
        <div class="stat-box stat-box--accent" style="--c:${balanceColor};">
          <div class="stat-label">BILANCIO</div>
          <div class="stat-value stat-value--accent">${balance >= 0 ? '+' : ''}${balance} kcal</div>
        </div>
      </div>

      <div class="stat-box" style="margin-top: 1rem;">
        <div style="font-size: 0.9rem; font-weight: 600; color: ${balanceColor};">${balanceLabel}</div>
      </div>
    </section>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  CARD 3: ATTIVITÀ DI OGGI (RIASSUNTO GIORNALIERO)
  ═══════════════════════════════════════════════════════════════
  Snapshot semplificato: passi, sessioni, kcal.
*/

function renderCardAttivitaOggi(activityData) {
  if (!activityData || (activityData.strengthCount === 0 && activityData.cardioCount === 0 && activityData.steps === 0)) {
    return `
      <section class="section card">
        <h2 class="card-title" style="margin-bottom: 1rem;">💪 Attività di Oggi</h2>
        <div class="small-muted">Nessuna attività registrata. Usa il bottone "+ Attività" per iniziare.</div>
      </section>
    `;
  }

  const stepGoal = activityData.prefs?.stepGoal || 10000;
  const sessionCount = (activityData.strengthCount || 0) + (activityData.cardioCount || 0);

  return `
    <section class="section card">
      <h2 class="card-title" style="margin-bottom: 1rem;">💪 Attività di Oggi</h2>

      <div class="grid-3">
        <div class="stat-box">
          <div class="stat-label">Passi</div>
          <div class="stat-value stat-value--accent" style="--c:#3b82f6;">${(activityData.steps || 0).toLocaleString('it-IT')}</div>
          <div class="stat-sub">/ ${stepGoal.toLocaleString('it-IT')}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Sessioni</div>
          <div class="stat-value stat-value--accent" style="--c:#f97316;">${sessionCount}</div>
          <div class="stat-sub">💪${activityData.strengthCount} 🏃${activityData.cardioCount}</div>
        </div>
        <div class="stat-box stat-box--accent" style="--c:#22c55e; text-align:center;">
          <div class="stat-label">Kcal</div>
          <div class="stat-value stat-value--accent">+${Math.round(activityData.activityKcal || 0)}</div>
        </div>
      </div>
    </section>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  CARD 4: STORICO PESO CON TREND
  ═══════════════════════════════════════════════════════════════
  Trend ultimi 30 giorni con stima bodyfat % e massa magra.
*/

function renderCardStoricoPeso(dailyWeights, userProfile) {
  if (!dailyWeights || dailyWeights.length === 0) {
    return `
      <section class="section card">
        <h2 style="font-size: 1rem; margin-bottom: 1rem; font-weight: 700;">⚖️ Storico Peso</h2>
        <div class="small-muted">Nessun peso registrato. Usa il bottone "+ Peso" per iniziare il tracking.</div>
      </section>
    `;
  }

  const sorted = [...dailyWeights].sort((a, b) => new Date(a.data) - new Date(b.data));
  const last30 = sorted.slice(-30);
  const current = sorted[sorted.length - 1];
  const thirtyDaysAgo = sorted.length > 30 ? sorted[0] : null;

  const trend = thirtyDaysAgo ? current.pesoKg - thirtyDaysAgo.pesoKg : 0;
  const trendText = trend < 0 ? '📉 in calo' : trend > 0 ? '📈 in aumento' : '➡️ stabile';

  const bodyFatPercent = current.bodyFatPercent || (userProfile?.bodyFatPercent || 20);
  const fatKg = (current.pesoKg * bodyFatPercent / 100).toFixed(1);
  const leanKg = (current.pesoKg - fatKg).toFixed(1);

  const minWeight = Math.min(...last30.map(w => w.pesoKg));
  const maxWeight = Math.max(...last30.map(w => w.pesoKg));
  const range = maxWeight - minWeight || 1;

  return `
    <section class="section card">
      <div class="card-head">
        <h2 class="card-title">⚖️ Storico Peso</h2>
        <a href="#" id="weightProjectionsLink" class="card-link">📉 Proiezioni ↗</a>
      </div>

      <div class="grid-3" style="margin-bottom: 1rem;">
        <div class="stat-box">
          <div class="stat-label">Peso Attuale</div>
          <div class="stat-value stat-value--lg stat-value--accent" style="--c:#3b82f6;">${current.pesoKg}</div>
          <div class="stat-sub">kg</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Grassa/Magra</div>
          <div style="font-size: 0.95rem; font-weight: 700;">
            <span style="color: #ffc107;">${fatKg}</span> /
            <span style="color: #4caf50;">${leanKg}</span>
          </div>
          <div class="stat-sub">${bodyFatPercent}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Trend 30gg</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: ${trend < 0 ? '#22c55e' : trend > 0 ? '#ef4444' : '#9ca3af'};">
            ${trend > 0 ? '+' : ''}${trend.toFixed(1)} kg
          </div>
          <div class="stat-sub">${trendText}</div>
        </div>
      </div>

      <!-- Mini grafico trend -->
      <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
        <div style="display: flex; align-items: flex-end; gap: 0.25rem; height: 60px; justify-content: space-around;">
          ${last30.map((w, i) => {
            const heightPercent = ((w.pesoKg - minWeight) / range) * 100;
            const isRecent = i === last30.length - 1;
            return `
              <div style="flex: 1; background: ${isRecent ? 'var(--primary)' : 'rgba(99, 102, 241, 0.4)'}; height: ${heightPercent}%; border-radius: 4px; transition: all 0.2s;" title="${w.pesoKg} kg (${new Date(w.data).toLocaleDateString('it-IT')})"></div>
            `;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  CARD 5: PASTI DI OGGI
  ═══════════════════════════════════════════════════════════════
  Semplice: 4 righe (colazione/pranzo/merenda/cena) con totale kcal.
*/

function renderCardPastiOggi(grouped) {
  return `
    <section class="section card">
      <div class="card-head">
        <h2 class="card-title">🍽️ Pasti</h2>
        <a href="#" id="viewNutritionDetailLink" class="card-link">Dettagli ↗</a>
      </div>

      <div class="stack">
        ${MealMoments.map(moment => {
          const items = grouped[moment] || [];
          const totalKcal = items.reduce((sum, meal) => sum + (meal.macroCalcolate.kcal || 0), 0);
          const emojiMap = { colazione: '🌅', spuntino: '🍎', pranzo: '☀️', merenda: '🕐', cena: '🌙', altro: '🍽️' };
          const emoji = emojiMap[moment] || '🍽️';
          const label = moment.charAt(0).toUpperCase() + moment.slice(1);
          return `
            <div class="list-row">
              <span style="font-size: 0.9rem; font-weight: 500;">${emoji} ${label}</span>
              <span style="font-size: 0.9rem; font-weight: 700; color: var(--primary);">${totalKcal} kcal</span>
            </div>
          `;
        }).join('')}
      </div>

      <div class="note-banner" style="--c: var(--primary); margin-top: 1rem; text-align: center;">
        <div style="font-size: 0.9rem; font-weight: 600; color: var(--primary);">
          Totale: ${MealMoments.reduce((sum, momento) => {
            const items = grouped[momento] || [];
            return sum + items.reduce((s, meal) => s + (meal.macroCalcolate.kcal || 0), 0);
          }, 0)} kcal
        </div>
      </div>
    </section>
  `;
}

/*
  ═══════════════════════════════════════════════════════════════
  CARD 6: STATUS RAPIDO
  ═══════════════════════════════════════════════════════════════
  Mini 3 righe: ieri, 2gg fa, trend direction.
*/

function renderCardStatusRapido(state, summary) {
  if (!state.userProfile || !summary.weeklyTrend) return '';

  const trend = summary.weeklyTrend;
  const dailyBalances = trend.dailyBalances || [];

  if (dailyBalances.length < 2) {
    return `
      <section class="section card">
        <h2 class="card-title" style="margin-bottom: 1rem;">📈 Trend</h2>
        <div class="small-muted">Dati insufficienti. Continua a tracciare.</div>
      </section>
    `;
  }

  const yesterday = dailyBalances[dailyBalances.length - 2] || 0;
  const twoDaysAgo = dailyBalances[dailyBalances.length - 3] || 0;
  const trendDirection = trend.avgDeficit > 0 ? '↓ Deficit positivo' : '↑ Surplus';
  const balCol = (v) => v < 0 ? '#22c55e' : '#ef4444';

  return `
    <section class="section card">
      <h2 class="card-title" style="margin-bottom: 1rem;">📈 Trend</h2>

      <div class="stack">
        <div class="list-row">
          <span class="small-muted" style="font-size: 0.85rem;">Ieri</span>
          <span style="font-size: 0.9rem; font-weight: 700; color: ${balCol(yesterday)};">${yesterday >= 0 ? '+' : ''}${Math.round(yesterday)} kcal</span>
        </div>
        <div class="list-row">
          <span class="small-muted" style="font-size: 0.85rem;">2 giorni fa</span>
          <span style="font-size: 0.9rem; font-weight: 700; color: ${balCol(twoDaysAgo)};">${twoDaysAgo >= 0 ? '+' : ''}${Math.round(twoDaysAgo)} kcal</span>
        </div>
        <div class="list-row">
          <span class="small-muted" style="font-size: 0.85rem;">Trend</span>
          <span style="font-size: 0.9rem; font-weight: 700; color: ${trend.avgDeficit > 0 ? '#22c55e' : '#ef4444'};">${trendDirection}</span>
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

export function bindDashboardEvents(container, callbacks) {
  const {
    onAddMeal,
    onAddActivity,
    onAddWeight,
    onUpdateWeight,
    onGoToWeight,
    onGoToActivities,
    onGoToNutrition,
    onBodyComp,
    onMicroDetail
  } = callbacks;

  // Navigazione data (giorno precedente/successivo, date picker, torna a oggi)
  if (callbacks.onChangeDate) {
    const shiftDay = (iso, delta) => {
      const d = new Date(iso + 'T12:00:00');
      d.setDate(d.getDate() + delta);
      return d.toISOString().slice(0, 10);
    };
    const currentDate = container.querySelector('#dashDatePicker')?.value;
    container.querySelector('#dashPrevDay')?.addEventListener('click', () => callbacks.onChangeDate(shiftDay(currentDate, -1)));
    container.querySelector('#dashNextDay')?.addEventListener('click', () => callbacks.onChangeDate(shiftDay(currentDate, 1)));
    container.querySelector('#dashGoToday')?.addEventListener('click', () => callbacks.onChangeDate(new Date().toISOString().slice(0, 10)));
    container.querySelector('#dashDatePicker')?.addEventListener('change', (e) => {
      if (e.target.value) callbacks.onChangeDate(e.target.value);
    });
  }

  const microDetailLink = container.querySelector('#microDetailLink');
  if (microDetailLink && onMicroDetail) {
    microDetailLink.addEventListener('click', (e) => {
      e.preventDefault();
      onMicroDetail();
    });
  }

  const weightProjectionsLink = container.querySelector('#weightProjectionsLink');
  if (weightProjectionsLink && callbacks.onGoToProjections) {
    weightProjectionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      callbacks.onGoToProjections();
    });
  }

  // Quick Actions (Header)
  const quickAddMealBtn = container.querySelector('#quickAddMealBtn');
  const quickAddActivityBtn = container.querySelector('#quickAddActivityBtn');
  const quickAddWeightBtn = container.querySelector('#quickAddWeightBtn');
  const quickAddWeightBtn2 = container.querySelector('#quickAddWeightBtn2');

  if (quickAddMealBtn && onAddMeal) {
    quickAddMealBtn.addEventListener('click', onAddMeal);
  }
  if (quickAddActivityBtn && onAddActivity) {
    quickAddActivityBtn.addEventListener('click', onAddActivity);
  }
  if (quickAddWeightBtn && onAddWeight) {
    quickAddWeightBtn.addEventListener('click', onAddWeight);
  }
  if (quickAddWeightBtn2 && onAddWeight) {
    quickAddWeightBtn2.addEventListener('click', onAddWeight);
  }

  // CTA Links in Cards
  const viewNutritionLink = container.querySelector('#viewNutritionLink');
  const viewNutritionDetailLink = container.querySelector('#viewNutritionDetailLink');
  const viewActivitiesLink = container.querySelector('#viewActivitiesLink');
  const viewWeightLink = container.querySelector('#viewWeightLink');
  const viewWeightDetailLink = container.querySelector('#viewWeightDetailLink');

  if (viewNutritionLink && onGoToNutrition) {
    viewNutritionLink.addEventListener('click', (e) => {
      e.preventDefault();
      onGoToNutrition();
    });
  }
  if (viewNutritionDetailLink && onGoToNutrition) {
    viewNutritionDetailLink.addEventListener('click', (e) => {
      e.preventDefault();
      onGoToNutrition();
    });
  }
  if (viewActivitiesLink && onGoToActivities) {
    viewActivitiesLink.addEventListener('click', (e) => {
      e.preventDefault();
      onGoToActivities();
    });
  }
  if (viewWeightLink && onGoToWeight) {
    viewWeightLink.addEventListener('click', (e) => {
      e.preventDefault();
      onGoToWeight();
    });
  }
  if (viewWeightDetailLink && onGoToWeight) {
    viewWeightDetailLink.addEventListener('click', (e) => {
      e.preventDefault();
      onGoToWeight();
    });
  }
  // Weight Management
  const addBodyCompBtn = container.querySelector('#addBodyCompBtn');
  const updateWeightBtn = container.querySelector('#updateWeightBtn');

  if (addBodyCompBtn && onBodyComp) {
    addBodyCompBtn.addEventListener('click', onBodyComp);
  }
  if (updateWeightBtn && onUpdateWeight) {
    updateWeightBtn.addEventListener('click', onUpdateWeight);
  }
}
