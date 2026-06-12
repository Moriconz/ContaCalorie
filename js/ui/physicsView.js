/*
  Tab Fisica — Attività (strength/cardio/passi)
  Visione unificata della performance fisica
*/

import { showConfirm } from './modal.js';

export function renderPhysicsView(state) {
  const {
    userProfile,
    last7Days,
    todayStrength,
    todayCardio,
    todaySteps,
    prefs,
    activitySyncStatus
  } = state;

  if (!userProfile) {
    return `<div class="section card"><p>Completa il profilo.</p></div>`;
  }

  return `
    <section class="section">
      <h1>💪 Fisica</h1>
      <p class="small-muted">Attività e composizione corporea</p>
    </section>

    <!-- ATTIVITÀ -->
    <section class="section">
      <h2 style="margin-bottom: 1rem;">🏋️ Attività</h2>

      <!-- Ultimi 7 giorni summary -->
      ${renderLast7DaysSummary(last7Days)}

      <!-- Riepilogo oggi -->
      ${renderTodaySummary(todayStrength, todayCardio, todaySteps, userProfile, prefs)}

      <!-- Aggiungi attività -->
      <section class="section card">
        <h3>➕ Aggiungi Oggi</h3>
        <div class="grid-2">
          <button id="openAddStrengthBtn" class="primary" style="width: 100%;">💪 Pesi</button>
          <button id="openAddCardioBtn" class="primary" style="width: 100%;">🏃 Cardio</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem;">
          <button id="openAddStepsBtn" class="secondary" style="width: 100%;">👣 Passi</button>
          <button id="openSyncStepsBtn" class="secondary" style="width: 100%;">🔗 Sincronizza</button>
        </div>
      </section>

      <!-- Sync status -->
      ${renderStepsSyncStatus(activitySyncStatus)}

      <!-- Sessioni recenti -->
      ${renderRecentStrengthSessions(last7Days)}
      ${renderRecentCardioSessions(last7Days)}
      ${renderStepsHistory(last7Days)}
    </section>
  `;
}

function renderLast7DaysSummary(last7Days) {
  if (!last7Days || last7Days.length === 0) {
    return `<section class="section card"><p class="small-muted">Nessun dato ancora.</p></section>`;
  }

  const totalSessions = last7Days.filter(d => d.strengthCount + d.cardioCount > 0).length;
  const totalStrengthMin = last7Days.reduce((sum, d) => sum + (d.strengthMin || 0), 0);
  const totalCardioMin = last7Days.reduce((sum, d) => sum + (d.cardioMin || 0), 0);
  const avgSteps = Math.round(last7Days.reduce((sum, d) => sum + (d.steps || 0), 0) / last7Days.length);
  const totalActivityKcal = last7Days.reduce((sum, d) => sum + (d.activityKcal || 0), 0);

  return `
    <section class="section card">
      <h3>📊 Ultimi 7 Giorni</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted">Sessioni</div>
          <div style="font-size: 1.3rem; font-weight: 700;">${totalSessions}</div>
          <div class="small-muted" style="font-size: 0.8rem;">giorni con attività</div>
        </div>
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted">Tempo Totale</div>
          <div style="font-size: 1.3rem; font-weight: 700;">${totalStrengthMin + totalCardioMin} min</div>
          <div class="small-muted" style="font-size: 0.8rem;">pesi + cardio</div>
        </div>
      </div>
      <div class="grid-2">
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted">Passi Medi</div>
          <div style="font-size: 1.3rem; font-weight: 700;">${avgSteps.toLocaleString('it-IT')}</div>
          <div class="small-muted" style="font-size: 0.8rem;">al giorno</div>
        </div>
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted">Kcal Attività</div>
          <div style="font-size: 1.3rem; font-weight: 700;">${Math.round(totalActivityKcal)}</div>
          <div class="small-muted" style="font-size: 0.8rem;">stimate</div>
        </div>
      </div>
    </section>
  `;
}

function renderTodaySummary(todayStrength, todayCardio, todaySteps, userProfile, prefs) {
  return `
    <section class="section card">
      <h3>📅 Oggi</h3>
      <div class="grid-2">
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted">Sessioni</div>
          <div style="font-size: 1.3rem; font-weight: 700;">${(todayStrength?.length || 0) + (todayCardio?.length || 0)}</div>
          <div class="small-muted" style="font-size: 0.8rem;">💪 ${todayStrength?.length || 0} | 🏃 ${todayCardio?.length || 0}</div>
        </div>
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted">Passi</div>
          <div style="font-size: 1.3rem; font-weight: 700;">${(todaySteps?.steps || 0).toLocaleString('it-IT')}</div>
          <div class="small-muted" style="font-size: 0.8rem;">goal: ${(prefs?.stepGoal || 10000).toLocaleString('it-IT')}</div>
        </div>
      </div>
    </section>
  `;
}

function renderStepsSyncStatus(activitySyncStatus) {
  if (!activitySyncStatus) return '';

  const connectedProvider = activitySyncStatus.connectedProvider;
  const lastSync = activitySyncStatus.lastSyncDate;

  return `
    <section class="section card">
      <h3>🔗 Sincronizzazione Passi</h3>
      ${connectedProvider ? `
        <div style="padding: 1rem; background: rgba(34,197,94,0.1); border-radius: 8px; border-left: 3px solid #22c55e;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <div style="font-weight: 700;">✅ Collegato a ${connectedProvider}</div>
            <button id="disconnectProviderBtn" class="secondary" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">Scollega</button>
          </div>
          ${lastSync ? `<div class="small-muted">Ultimo sync: ${new Date(lastSync).toLocaleDateString('it-IT')}</div>` : ''}
        </div>
      ` : `
        <div style="padding: 1rem; background: rgba(168,85,247,0.1); border-radius: 8px; border-left: 3px solid #a855f7;">
          <div style="font-weight: 700; margin-bottom: 0.5rem;">📁 Non collegato</div>
          <p class="small-muted" style="margin: 0 0 0.75rem 0;">Importa passi da Google Fit, Health Connect, Apple Health o file CSV/JSON</p>
          <button id="openSyncStepsBtn" class="primary" style="width: 100%;">🔗 Sincronizza Passi</button>
        </div>
      `}
    </section>
  `;
}

function renderRecentStrengthSessions(last7Days) {
  const sessions = last7Days?.flatMap(d => (d.strengthSessions || []).map(s => ({ ...s, data: d.date }))) || [];
  if (sessions.length === 0) return '';

  return `
    <section class="section card">
      <h3>💪 Sessioni Pesi Recenti</h3>
      <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 300px; overflow-y: auto;">
        ${sessions.slice(-10).map((s, i) => `
          <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
              <div>
                <strong>${s.title || 'Sessione'}</strong>
                <div class="small-muted" style="font-size: 0.8rem;">${new Date(s.data).toLocaleDateString('it-IT')} • ${s.durationMin} min</div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="edit-strength-btn" data-id="${s.id}" style="background: none; border: none; cursor: pointer; color: var(--primary);">✏️</button>
                <button class="delete-strength-btn" data-id="${s.id}" style="background: none; border: none; cursor: pointer; color: var(--danger);">🗑️</button>
              </div>
            </div>
            <div class="small-muted" style="font-size: 0.85rem;">${s.muscleGroups?.join(', ') || 'no muscle groups'}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderRecentCardioSessions(last7Days) {
  const sessions = last7Days?.flatMap(d => (d.cardioSessions || []).map(s => ({ ...s, data: d.date }))) || [];
  if (sessions.length === 0) return '';

  return `
    <section class="section card">
      <h3>🏃 Sessioni Cardio Recenti</h3>
      <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 300px; overflow-y: auto;">
        ${sessions.slice(-10).map((s, i) => `
          <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
              <div>
                <strong>${s.cardioType || 'Cardio'}</strong>
                <div class="small-muted" style="font-size: 0.8rem;">${new Date(s.data).toLocaleDateString('it-IT')} • ${s.durationMin} min</div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="edit-cardio-btn" data-id="${s.id}" style="background: none; border: none; cursor: pointer; color: var(--primary);">✏️</button>
                <button class="delete-cardio-btn" data-id="${s.id}" style="background: none; border: none; cursor: pointer; color: var(--danger);">🗑️</button>
              </div>
            </div>
            <div class="small-muted" style="font-size: 0.85rem;">${s.distanceKm ? s.distanceKm + ' km • ' : ''}Intensità: ${s.intensityLevel || 'n/a'}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderStepsHistory(last7Days) {
  if (!last7Days || last7Days.length === 0) return '';

  return `
    <section class="section card">
      <h3>👣 Passi (ultimi 7 giorni)</h3>
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem;">
        ${last7Days.map(day => {
          const steps = day.steps || 0;
          const percent = Math.min(100, (steps / 10000) * 100);
          const dayLabel = new Date(day.date).toLocaleDateString('it-IT', { weekday: 'short' });
          return `
            <div style="text-align: center;">
              <div style="height: 100px; background: var(--glass-secondary); border-radius: 8px; position: relative; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 0.5rem; padding: 0.5rem;">
                <div style="width: 100%; height: ${Math.max(percent, 5)}%; background: var(--primary); border-radius: 4px 4px 0 0;"></div>
              </div>
              <div class="small-muted" style="font-size: 0.75rem;">${dayLabel}</div>
              <div style="font-size: 0.8rem; font-weight: 700;">${(steps / 1000).toFixed(1)}k</div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

export function bindPhysicsViewEvents(container, callbacks) {
  // Activity buttons
  const addStrengthBtn = container.querySelector('#openAddStrengthBtn');
  const addCardioBtn = container.querySelector('#openAddCardioBtn');
  const addStepsBtn = container.querySelector('#openAddStepsBtn');
  const syncStepsBtn = container.querySelectorAll('#openSyncStepsBtn');
  const disconnectBtn = container.querySelector('#disconnectProviderBtn');

  if (addStrengthBtn) addStrengthBtn.addEventListener('click', () => callbacks.onAddStrength?.());
  if (addCardioBtn) addCardioBtn.addEventListener('click', () => callbacks.onAddCardio?.());
  if (addStepsBtn) addStepsBtn.addEventListener('click', () => callbacks.onAddSteps?.());
  syncStepsBtn.forEach(btn => {
    if (btn) btn.addEventListener('click', () => callbacks.onSyncSteps?.());
  });
  if (disconnectBtn) disconnectBtn.addEventListener('click', () => callbacks.onDisconnectProvider?.());

  // Edit buttons
  container.querySelectorAll('.edit-strength-btn').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onEditStrength?.(btn.dataset.id));
  });
  container.querySelectorAll('.edit-cardio-btn').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onEditCardio?.(btn.dataset.id));
  });

  // Delete buttons
  container.querySelectorAll('.delete-strength-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sessionTitle = btn.closest('[style*="background"]')?.querySelector('strong')?.textContent || 'questa sessione';
      if (await showConfirm(`Eliminare "${sessionTitle}"?`, { confirmLabel: 'Elimina', danger: true })) {
        callbacks.onDeleteStrength?.(btn.dataset.id);
      }
    });
  });
  container.querySelectorAll('.delete-cardio-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sessionTitle = btn.closest('[style*="background"]')?.querySelector('strong')?.textContent || 'questa sessione';
      if (await showConfirm(`Eliminare "${sessionTitle}"?`, { confirmLabel: 'Elimina', danger: true })) {
        callbacks.onDeleteCardio?.(btn.dataset.id);
      }
    });
  });
}
