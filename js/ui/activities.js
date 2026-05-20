/*
  Sezione Allenamenti & Attività - vista dedicata e completa
  Gestisce: sessioni pesi, sessioni cardio, passi, import, sync provider
*/

export function renderActivitiesView(state) {
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
      <h1>💪 Allenamenti & Attività</h1>
    </section>

    <!-- RIEPILOGO ULTIMI 7 GIORNI -->
    ${renderLast7DaysSummary(last7Days)}

    <!-- RIEPILOGO OGGI -->
    ${renderTodaySummary(todayStrength, todayCardio, todaySteps, userProfile, prefs)}

    <!-- SEZIONE AGGIUNGI ALLENAMENTI -->
    <section class="section card">
      <h2>➕ Aggiungi Attività Oggi</h2>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <button id="openAddStrengthBtn" class="primary" style="width: 100%;">💪 Allenamento Pesi</button>
        <button id="openAddCardioBtn" class="primary" style="width: 100%;">🏃 Cardio</button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem;">
        <button id="openAddStepsBtn" class="secondary" style="width: 100%;">👣 Passi Manuali</button>
        <button id="openSyncStepsBtn" class="secondary" style="width: 100%;">🔗 Sincronizza Passi</button>
      </div>
    </section>

    <!-- SINCRONIZZAZIONE PASSI STATUS -->
    ${renderStepsSyncStatus(activitySyncStatus)}

    <!-- SESSIONI RECENTI PESI -->
    ${renderRecentStrengthSessions(last7Days)}

    <!-- SESSIONI RECENTI CARDIO -->
    ${renderRecentCardioSessions(last7Days)}

    <!-- STORICO PASSI ULTIMI 7 GIORNI -->
    ${renderStepsHistory(last7Days)}
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
      <h2>📊 Ultimi 7 Giorni</h2>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted">Sessioni Allenamento</div>
          <div style="font-size: 1.3rem; font-weight: 700;">${totalSessions}</div>
          <div class="small-muted" style="font-size: 0.8rem;">Giorni con attività</div>
        </div>
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted">Tempo Totale</div>
          <div style="font-size: 1.3rem; font-weight: 700;">${totalStrengthMin + totalCardioMin} min</div>
          <div class="small-muted" style="font-size: 0.8rem;">Pesi + Cardio</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted">Passi Medi</div>
          <div style="font-size: 1.3rem; font-weight: 700;">${avgSteps.toLocaleString('it-IT')}</div>
          <div class="small-muted" style="font-size: 0.8rem;">al giorno</div>
        </div>
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div class="small-muted">Kcal Attività</div>
          <div style="font-size: 1.3rem; font-weight: 700;">${Math.round(totalActivityKcal)}</div>
          <div class="small-muted" style="font-size: 0.8rem;">totale stimato</div>
        </div>
      </div>
    </section>
  `;
}

function renderTodaySummary(todayStrength, todayCardio, todaySteps, userProfile, prefs) {
  const strengthKcal = todayStrength.reduce((sum, s) => sum + (s.estimatedKcal || 0), 0);
  const cardioKcal = todayCardio.reduce((sum, c) => sum + (c.estimatedKcal || 0), 0);
  const stepsKcal = todaySteps ? (todaySteps.estimatedKcal || 0) : 0;
  const totalActivityKcal = strengthKcal + cardioKcal + stepsKcal;

  const stepGoal = prefs?.stepGoal || 10000;
  const stepsPercent = todaySteps ? Math.round((todaySteps.steps / stepGoal) * 100) : 0;

  return `
    <section class="section card">
      <h2>📅 Oggi</h2>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
        <div style="padding: 0.75rem; background: rgba(99, 102, 241, 0.1); border-left: 3px solid var(--primary); border-radius: 8px;">
          <div class="small-muted">Attività Totale</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">${Math.round(totalActivityKcal)} kcal</div>
        </div>
        <div style="padding: 0.75rem; background: rgba(76, 175, 80, 0.1); border-left: 3px solid #4caf50; border-radius: 8px;">
          <div class="small-muted">Passi</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #4caf50;">${(todaySteps?.steps || 0).toLocaleString('it-IT')}</div>
          <div class="small-muted" style="font-size: 0.8rem;">${stepsPercent}% di ${stepGoal.toLocaleString('it-IT')}</div>
        </div>
      </div>

      ${todayStrength.length > 0 ? `
        <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
          <h3 style="margin-bottom: 0.5rem; font-size: 1rem;">💪 Sessioni Pesi (${todayStrength.length})</h3>
          ${todayStrength.map((s, idx) => `
            <div style="padding: 0.5rem; background: var(--glass-secondary); border-radius: 6px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${s.title || s.category}</strong>
                <div class="small-muted" style="font-size: 0.8rem;">${s.durationMin} min • RPE ${s.intensityRpe || '?'} • ${s.estimatedKcal || 0} kcal</div>
              </div>
              <button class="edit-strength-btn" data-id="${s.id}" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0.5rem;">✎</button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${todayCardio.length > 0 ? `
        <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
          <h3 style="margin-bottom: 0.5rem; font-size: 1rem;">🏃 Sessioni Cardio (${todayCardio.length})</h3>
          ${todayCardio.map(c => `
            <div style="padding: 0.5rem; background: var(--glass-secondary); border-radius: 6px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${c.cardioType}</strong>
                <div class="small-muted" style="font-size: 0.8rem;">${c.durationMin} min • ${c.intensityLevel || '?'} • ${c.estimatedKcal || 0} kcal</div>
              </div>
              <button class="edit-cardio-btn" data-id="${c.id}" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0.5rem;">✎</button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${todaySteps ? `
        <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>Passi: ${todaySteps.steps.toLocaleString('it-IT')}</strong>
            <button class="edit-steps-btn" data-date="${todaySteps.date}" style="background: none; border: none; cursor: pointer; color: var(--text-muted);">✎</button>
          </div>
          <div class="small-muted" style="font-size: 0.8rem;">
            Fonte: ${todaySteps.source} ${todaySteps.distanceKm ? `• ${todaySteps.distanceKm.toFixed(1)} km` : ''} • ${todaySteps.estimatedKcal || 0} kcal
          </div>
        </div>
      ` : ''}
    </section>
  `;
}

function renderStepsSyncStatus(syncStatus) {
  if (!syncStatus || !syncStatus.connectedProvider) {
    return `
      <section class="section card">
        <h2>🔗 Sincronizzazione Passi</h2>
        <div style="padding: 1rem; background: rgba(99, 102, 241, 0.1); border-left: 3px solid var(--primary); border-radius: 8px;">
          <div class="small-muted">Nessun provider collegato</div>
          <p class="small-muted" style="font-size: 0.85rem; margin-top: 0.5rem;">
            Aggiungi i passi manualmente oppure collega un'app di salute per import automatico.
          </p>
        </div>
      </section>
    `;
  }

  return `
    <section class="section card">
      <h2>🔗 Sincronizzazione Passi</h2>
      <div style="padding: 1rem; background: rgba(76, 175, 80, 0.1); border-left: 3px solid #4caf50; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <strong>📱 ${syncStatus.connectedProvider}</strong>
          <button id="disconnectProviderBtn" class="secondary small" style="padding: 0.4rem 0.75rem; font-size: 0.8rem;">Scollega</button>
        </div>
        <div class="small-muted" style="font-size: 0.8rem;">
          Ultimo sync: ${syncStatus.lastSyncTime || 'mai'}<br>
          Giorni importati: ${syncStatus.importedDaysCount || 0}
        </div>
      </div>
    </section>
  `;
}

function renderRecentStrengthSessions(last7Days) {
  const allSessions = [];
  last7Days.forEach(day => {
    if (day.strength) {
      day.strength.forEach(s => {
        allSessions.push({ ...s, date: day.date });
      });
    }
  });

  if (allSessions.length === 0) {
    return '';
  }

  const recent = allSessions.slice(-10).reverse();

  return `
    <section class="section card">
      <h2>💪 Sessioni Pesi Recenti</h2>
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${recent.map(s => `
          <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <div><strong>${s.title || s.category}</strong> <span class="small-muted" style="font-size: 0.8rem;">${s.date}</span></div>
              <div class="small-muted" style="font-size: 0.85rem;">${s.durationMin} min • RPE ${s.intensityRpe || '?'} • ${s.estimatedKcal || 0} kcal</div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="edit-strength-btn" data-id="${s.id}" style="background: none; border: none; cursor: pointer; color: var(--text-muted);">✎</button>
              <button class="delete-strength-btn" data-id="${s.id}" style="background: none; border: none; cursor: pointer; color: var(--danger);">✕</button>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderRecentCardioSessions(last7Days) {
  const allSessions = [];
  last7Days.forEach(day => {
    if (day.cardio) {
      day.cardio.forEach(c => {
        allSessions.push({ ...c, date: day.date });
      });
    }
  });

  if (allSessions.length === 0) {
    return '';
  }

  const recent = allSessions.slice(-10).reverse();

  return `
    <section class="section card">
      <h2>🏃 Sessioni Cardio Recenti</h2>
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${recent.map(c => `
          <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <div><strong>${c.cardioType}</strong> <span class="small-muted" style="font-size: 0.8rem;">${c.date}</span></div>
              <div class="small-muted" style="font-size: 0.85rem;">${c.durationMin} min • ${c.intensityLevel || '?'} ${c.distanceKm ? `• ${c.distanceKm.toFixed(1)} km` : ''} • ${c.estimatedKcal || 0} kcal</div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="edit-cardio-btn" data-id="${c.id}" style="background: none; border: none; cursor: pointer; color: var(--text-muted);">✎</button>
              <button class="delete-cardio-btn" data-id="${c.id}" style="background: none; border: none; cursor: pointer; color: var(--danger);">✕</button>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderStepsHistory(last7Days) {
  if (!last7Days || last7Days.length === 0) {
    return '';
  }

  return `
    <section class="section card">
      <h2>👣 Storico Passi (ultimi 7 giorni)</h2>
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

export function bindActivitiesEvents(container, callbacks) {
  // Buttons aggiungi attività
  const addStrengthBtn = container.querySelector('#openAddStrengthBtn');
  const addCardioBtn = container.querySelector('#openAddCardioBtn');
  const addStepsBtn = container.querySelector('#openAddStepsBtn');
  const syncStepsBtn = container.querySelector('#openSyncStepsBtn');
  const disconnectBtn = container.querySelector('#disconnectProviderBtn');

  if (addStrengthBtn) addStrengthBtn.addEventListener('click', () => callbacks.onAddStrength?.());
  if (addCardioBtn) addCardioBtn.addEventListener('click', () => callbacks.onAddCardio?.());
  if (addStepsBtn) addStepsBtn.addEventListener('click', () => callbacks.onAddSteps?.());
  if (syncStepsBtn) syncStepsBtn.addEventListener('click', () => callbacks.onSyncSteps?.());
  if (disconnectBtn) disconnectBtn.addEventListener('click', () => callbacks.onDisconnectProvider?.());

  // Edit buttons
  container.querySelectorAll('.edit-strength-btn').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onEditStrength?.(btn.dataset.id));
  });
  container.querySelectorAll('.edit-cardio-btn').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onEditCardio?.(btn.dataset.id));
  });
  container.querySelectorAll('.edit-steps-btn').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onEditSteps?.(btn.dataset.date));
  });

  // Delete buttons
  container.querySelectorAll('.delete-strength-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sessionTitle = btn.closest('[class*="session"]')?.querySelector('strong')?.textContent || 'questa sessione';
      if (confirm(`Elimina "${sessionTitle}"?\n\nQuesta azione non può essere annullata.`)) {
        callbacks.onDeleteStrength?.(btn.dataset.id);
      }
    });
  });
  container.querySelectorAll('.delete-cardio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sessionTitle = btn.closest('[class*="session"]')?.querySelector('strong')?.textContent || 'questa sessione';
      if (confirm(`Elimina "${sessionTitle}"?\n\nQuesta azione non può essere annullata.`)) {
        callbacks.onDeleteCardio?.(btn.dataset.id);
      }
    });
  });
}

// ===== MODAL FUNCTIONS =====

export function showAddStrengthModal(onSave) {
  const today = new Date().toISOString().split('T')[0];
  const muscleGroupOptions = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'legs', 'glutes', 'hamstrings', 'calves', 'core', 'neck'];
  const categoryOptions = ['gym', 'home_strength', 'calisthenics', 'cross_training'];

  const modalHTML = `
    <div class="modal" style="display: flex;">
      <div class="modal-content" style="width: 100%; max-width: 500px;">
        <div class="modal-header">
          <h2>💪 Nuovo Allenamento Pesi</h2>
          <button class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <form id="addStrengthForm">
            <div class="form-group">
              <label>Data</label>
              <input type="date" id="strengthDate" value="${today}" required>
            </div>

            <div class="form-group">
              <label>Titolo (es. "Push Day", "Leg Day")</label>
              <input type="text" id="strengthTitle" placeholder="Descrizione sessione" required>
            </div>

            <div class="form-group">
              <label>Categoria</label>
              <select id="strengthCategory" required>
                <option value="">-- Seleziona --</option>
                ${categoryOptions.map(c => `<option value="${c}">${c === 'gym' ? '🏋️ Palestra' : c === 'home_strength' ? '🏠 Casa' : c === 'calisthenics' ? '🤸 Calistenia' : '⛹️ Cross Training'}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Durata (minuti)</label>
              <input type="number" id="strengthDuration" min="1" max="480" placeholder="60" required>
            </div>

            <div class="form-group">
              <label>Intensità RPE (1-10, dove 10 è massimo sforzo)</label>
              <input type="number" id="strengthRPE" min="1" max="10" placeholder="7" required>
            </div>

            <div class="form-group">
              <label>Gruppi Muscolari Allenati</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; max-height: 200px; overflow-y: auto; padding: 0.5rem; background: var(--glass-secondary); border-radius: 6px;">
                ${muscleGroupOptions.map(group => `
                  <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0;">
                    <input type="checkbox" class="strengthMuscleGroup" value="${group}">
                    <span style="font-size: 0.9rem;">${group.charAt(0).toUpperCase() + group.slice(1)}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <div class="form-group">
              <label>Note (opzionale)</label>
              <textarea id="strengthNotes" placeholder="Es. Mi sono sentito bene, mi stancai di petto" style="height: 80px; resize: vertical;"></textarea>
            </div>

            <div style="padding: 1rem; background: rgba(99, 102, 241, 0.1); border-radius: 6px; margin-bottom: 1rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0;">
                <input type="checkbox" id="strengthDetailedMode">
                <span style="font-size: 0.9rem;">Modalità dettagliata (aggiungi esercizi specifici)</span>
              </label>
            </div>

            <div id="detailedExercisesContainer" style="display: none;">
              <hr>
              <h3 style="margin-top: 1rem; margin-bottom: 0.5rem;">Esercizi Dettagliati</h3>
              <div id="exercisesList" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 300px; overflow-y: auto; margin-bottom: 1rem;"></div>
              <button type="button" id="addExerciseBtn" class="secondary" style="width: 100%; margin-bottom: 1rem;">+ Aggiungi Esercizio</button>
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <button type="submit" class="primary" style="flex: 1;">Salva Allenamento</button>
              <button type="button" class="secondary" style="flex: 1;" id="cancelBtn">Annulla</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.innerHTML = modalHTML;
  document.body.appendChild(modal);

  const form = modal.querySelector('#addStrengthForm');
  const detailedToggle = modal.querySelector('#strengthDetailedMode');
  const detailedContainer = modal.querySelector('#detailedExercisesContainer');
  const exercisesList = modal.querySelector('#exercisesList');
  const addExerciseBtn = modal.querySelector('#addExerciseBtn');
  let exercisesCount = 0;

  detailedToggle.addEventListener('change', () => {
    detailedContainer.style.display = detailedToggle.checked ? 'block' : 'none';
  });

  addExerciseBtn.addEventListener('click', () => {
    exercisesCount++;
    const exerciseHTML = `
      <div class="exercise-item" data-index="${exercisesCount}" style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <strong>Esercizio ${exercisesCount}</strong>
          <button type="button" class="remove-exercise-btn" style="background: none; border: none; cursor: pointer; color: var(--danger);">✕</button>
        </div>
        <input type="text" class="exerciseName" placeholder="Nome esercizio" style="width: 100%; margin-bottom: 0.5rem; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
          <input type="number" class="exerciseSets" placeholder="Serie" min="1" max="20" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
          <input type="number" class="exerciseReps" placeholder="Ripetizioni" min="1" max="100" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
          <input type="number" class="exerciseLoad" placeholder="Peso (kg)" min="0" step="0.5" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
          <select class="exerciseMuscle" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
            <option value="">-- Gruppo muscolare --</option>
            ${muscleGroupOptions.map(g => `<option value="${g}">${g}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
    exercisesList.innerHTML += exerciseHTML;

    // Bind remove button
    const removeBtn = exercisesList.querySelector(`[data-index="${exercisesCount}"] .remove-exercise-btn`);
    removeBtn.addEventListener('click', () => {
      exercisesList.querySelector(`[data-index="${exercisesCount}"]`).remove();
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Validate form
    const title = modal.querySelector('#strengthTitle').value.trim();
    const category = modal.querySelector('#strengthCategory').value;
    const duration = parseInt(modal.querySelector('#strengthDuration').value);
    const rpe = parseInt(modal.querySelector('#strengthRPE').value);

    if (!title) {
      showFormError(form, 'Inserisci un titolo per la sessione');
      return;
    }
    if (!category) {
      showFormError(form, 'Seleziona una categoria');
      return;
    }
    if (!duration || duration < 1 || duration > 480) {
      showFormError(form, 'Durata deve essere tra 1 e 480 minuti');
      return;
    }
    if (!rpe || rpe < 1 || rpe > 10) {
      showFormError(form, 'RPE deve essere tra 1 e 10');
      return;
    }

    const muscleGroups = Array.from(modal.querySelectorAll('.strengthMuscleGroup:checked')).map(cb => cb.value);

    const formData = {
      date: modal.querySelector('#strengthDate').value,
      title,
      category,
      durationMin: duration,
      intensityRpe: rpe,
      muscleGroups,
      notes: modal.querySelector('#strengthNotes').value || undefined,
      source: 'manual'
    };

    if (detailedToggle.checked) {
      formData.exercises = Array.from(exercisesList.querySelectorAll('.exercise-item')).map(item => ({
        name: item.querySelector('.exerciseName').value.trim(),
        sets: parseInt(item.querySelector('.exerciseSets').value) || 0,
        reps: parseInt(item.querySelector('.exerciseReps').value) || 0,
        loadKg: parseFloat(item.querySelector('.exerciseLoad').value) || 0,
        muscleGroup: item.querySelector('.exerciseMuscle').value
      })).filter(e => e.name);
    }

    onSave(formData);
    modal.remove();
  });

  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#cancelBtn').addEventListener('click', () => modal.remove());
}

export function showAddCardioModal(onSave) {
  const today = new Date().toISOString().split('T')[0];
  const cardioTypes = ['running', 'walking', 'cycling', 'rowing', 'hiit', 'swimming', 'hiking', 'treadmill', 'elliptical', 'stair_climber', 'other'];
  const intensityLevels = ['low', 'medium', 'high'];

  const modalHTML = `
    <div class="modal" style="display: flex;">
      <div class="modal-content" style="width: 100%; max-width: 500px;">
        <div class="modal-header">
          <h2>🏃 Nuovo Cardio</h2>
          <button class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <form id="addCardioForm">
            <div class="form-group">
              <label>Data</label>
              <input type="date" id="cardioDate" value="${today}" required>
            </div>

            <div class="form-group">
              <label>Tipo di Cardio</label>
              <select id="cardioType" required>
                <option value="">-- Seleziona --</option>
                ${cardioTypes.map(t => {
                  const labels = {
                    running: '🏃 Corsa',
                    walking: '🚶 Camminata',
                    cycling: '🚴 Ciclismo',
                    rowing: '🚣 Canottaggio',
                    hiit: '⚡ HIIT',
                    swimming: '🏊 Nuoto',
                    hiking: '🥾 Trekking',
                    treadmill: '🏃 Treadmill',
                    elliptical: '🏋️ Ellittica',
                    stair_climber: '⛰️ Scalini',
                    other: '❓ Altro'
                  };
                  return `<option value="${t}">${labels[t] || t}</option>`;
                }).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Durata (minuti)</label>
              <input type="number" id="cardioDuration" min="1" max="480" placeholder="30" required>
            </div>

            <div class="form-group">
              <label>Intensità</label>
              <select id="cardioIntensity" required>
                <option value="">-- Seleziona --</option>
                <option value="low">🟢 Bassa (conversazione facile)</option>
                <option value="medium">🟡 Media (respiro accelerato)</option>
                <option value="high">🔴 Alta (respiro difficile)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Distanza (km, opzionale)</label>
              <input type="number" id="cardioDistance" min="0" step="0.1" placeholder="5.0">
            </div>

            <div class="form-group">
              <label>Frequenza Cardiaca Media (bpm, opzionale)</label>
              <input type="number" id="cardioHR" min="40" max="220" placeholder="150">
            </div>

            <div class="form-group">
              <label>RPE Soggettivo (1-10, opzionale)</label>
              <input type="number" id="cardioRPE" min="1" max="10" placeholder="7">
            </div>

            <div class="form-group">
              <label>Note (opzionale)</label>
              <textarea id="cardioNotes" placeholder="Es. Buon ritmo, gambe leggere" style="height: 80px; resize: vertical;"></textarea>
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <button type="submit" class="primary" style="flex: 1;">Salva Cardio</button>
              <button type="button" class="secondary" style="flex: 1;" id="cancelBtn">Annulla</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.innerHTML = modalHTML;
  document.body.appendChild(modal);

  const form = modal.querySelector('#addCardioForm');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Validate form
    const cardioType = modal.querySelector('#cardioType').value;
    const duration = parseInt(modal.querySelector('#cardioDuration').value);
    const intensity = modal.querySelector('#cardioIntensity').value;
    const distance = modal.querySelector('#cardioDistance').value ? parseFloat(modal.querySelector('#cardioDistance').value) : null;
    const hr = modal.querySelector('#cardioHR').value ? parseInt(modal.querySelector('#cardioHR').value) : null;

    if (!cardioType) {
      showFormError(form, 'Seleziona un tipo di cardio');
      return;
    }
    if (!duration || duration < 1 || duration > 480) {
      showFormError(form, 'Durata deve essere tra 1 e 480 minuti');
      return;
    }
    if (!intensity) {
      showFormError(form, 'Seleziona un livello di intensità');
      return;
    }
    if (distance !== null && (distance < 0 || distance > 200)) {
      showFormError(form, 'Distanza deve essere tra 0 e 200 km');
      return;
    }
    if (hr !== null && (hr < 40 || hr > 220)) {
      showFormError(form, 'Frequenza cardiaca deve essere tra 40 e 220 bpm');
      return;
    }

    const formData = {
      data: modal.querySelector('#cardioDate').value,
      cardioType,
      durationMin: duration,
      intensityLevel: intensity,
      distanceKm: distance,
      avgHeartRate: hr,
      intensityRpe: modal.querySelector('#cardioRPE').value ? parseInt(modal.querySelector('#cardioRPE').value) : undefined,
      notes: modal.querySelector('#cardioNotes').value || undefined,
      source: 'manual'
    };

    onSave(formData);
    modal.remove();
  });

  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#cancelBtn').addEventListener('click', () => modal.remove());
}

export function showAddStepsModal(onSave, existingData) {
  const date = existingData?.date || new Date().toISOString().split('T')[0];
  const isEdit = !!existingData;

  const modalHTML = `
    <div class="modal" style="display: flex;">
      <div class="modal-content" style="width: 100%; max-width: 450px;">
        <div class="modal-header">
          <h2>👣 ${isEdit ? 'Modifica' : 'Aggiungi'} Passi</h2>
          <button class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <form id="addStepsForm">
            <div class="form-group">
              <label>Data</label>
              <input type="date" id="stepsDate" value="${date}" required ${isEdit ? 'disabled' : ''}>
            </div>

            <div class="form-group">
              <label>Numero Passi</label>
              <input type="number" id="stepsCount" min="0" step="100" placeholder="10000" value="${existingData?.steps || ''}" required>
            </div>

            <div class="form-group">
              <label>Distanza (km, opzionale)</label>
              <input type="number" id="stepsDistance" min="0" step="0.1" placeholder="6.5" value="${existingData?.distanceKm || ''}">
            </div>

            <div class="form-group">
              <label>Minuti Attivi (opzionale)</label>
              <input type="number" id="stepsActiveMinutes" min="0" step="5" placeholder="120" value="${existingData?.activeMinutes || ''}">
            </div>

            <div class="form-group">
              <label>Fonte</label>
              <select id="stepsSource">
                <option value="manual" ${(!existingData || existingData.source === 'manual') ? 'selected' : ''}>📝 Manuale</option>
                <option value="imported_file">📁 File Importato</option>
              </select>
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <button type="submit" class="primary" style="flex: 1;">Salva Passi</button>
              <button type="button" class="secondary" style="flex: 1;" id="cancelBtn">Annulla</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.innerHTML = modalHTML;
  document.body.appendChild(modal);

  const form = modal.querySelector('#addStepsForm');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Validate form
    const steps = parseInt(modal.querySelector('#stepsCount').value);
    const distance = modal.querySelector('#stepsDistance').value ? parseFloat(modal.querySelector('#stepsDistance').value) : null;
    const activeMin = modal.querySelector('#stepsActiveMinutes').value ? parseInt(modal.querySelector('#stepsActiveMinutes').value) : null;

    if (!steps || steps < 0 || steps > 50000) {
      showFormError(form, 'Passi deve essere tra 0 e 50000');
      return;
    }
    if (distance !== null && (distance < 0 || distance > 50)) {
      showFormError(form, 'Distanza deve essere tra 0 e 50 km');
      return;
    }
    if (activeMin !== null && (activeMin < 0 || activeMin > 1440)) {
      showFormError(form, 'Minuti attivi deve essere tra 0 e 1440');
      return;
    }

    const formData = {
      date,
      steps,
      distanceKm: distance,
      activeMinutes: activeMin,
      source: modal.querySelector('#stepsSource').value
    };

    onSave(formData);
    modal.remove();
  });

  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#cancelBtn').addEventListener('click', () => modal.remove());
}

export function showEditStrengthModal(existingSession, onSave) {
  const muscleGroupOptions = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'legs', 'glutes', 'hamstrings', 'calves', 'core', 'neck'];
  const categoryOptions = ['gym', 'home_strength', 'calisthenics', 'cross_training'];

  const modalHTML = `
    <div class="modal" style="display: flex;">
      <div class="modal-content" style="width: 100%; max-width: 500px;">
        <div class="modal-header">
          <h2>✏️ Modifica Allenamento Pesi</h2>
          <button class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <form id="editStrengthForm">
            <div class="form-group">
              <label>Data</label>
              <input type="date" id="strengthDate" value="${existingSession.date}" required>
            </div>

            <div class="form-group">
              <label>Titolo</label>
              <input type="text" id="strengthTitle" value="${existingSession.title || ''}" required>
            </div>

            <div class="form-group">
              <label>Categoria</label>
              <select id="strengthCategory" required>
                <option value="">-- Seleziona --</option>
                ${categoryOptions.map(c => `<option value="${c}" ${existingSession.category === c ? 'selected' : ''}>${c === 'gym' ? '🏋️ Palestra' : c === 'home_strength' ? '🏠 Casa' : c === 'calisthenics' ? '🤸 Calistenia' : '⛹️ Cross Training'}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Durata (minuti)</label>
              <input type="number" id="strengthDuration" min="1" max="480" value="${existingSession.durationMin}" required>
            </div>

            <div class="form-group">
              <label>Intensità RPE (1-10)</label>
              <input type="number" id="strengthRPE" min="1" max="10" value="${existingSession.intensityRpe || 7}" required>
            </div>

            <div class="form-group">
              <label>Gruppi Muscolari</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; max-height: 200px; overflow-y: auto; padding: 0.5rem; background: var(--glass-secondary); border-radius: 6px;">
                ${muscleGroupOptions.map(group => `
                  <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0;">
                    <input type="checkbox" class="strengthMuscleGroup" value="${group}" ${(existingSession.muscleGroups || []).includes(group) ? 'checked' : ''}>
                    <span style="font-size: 0.9rem;">${group.charAt(0).toUpperCase() + group.slice(1)}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <div class="form-group">
              <label>Note</label>
              <textarea id="strengthNotes" style="height: 80px; resize: vertical;">${existingSession.notes || ''}</textarea>
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <button type="submit" class="primary" style="flex: 1;">Salva Modifiche</button>
              <button type="button" class="secondary" style="flex: 1;" id="cancelBtn">Annulla</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.innerHTML = modalHTML;
  document.body.appendChild(modal);

  const form = modal.querySelector('#editStrengthForm');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Validate form
    const title = modal.querySelector('#strengthTitle').value.trim();
    const category = modal.querySelector('#strengthCategory').value;
    const duration = parseInt(modal.querySelector('#strengthDuration').value);
    const rpe = parseInt(modal.querySelector('#strengthRPE').value);

    if (!title) {
      showFormError(form, 'Inserisci un titolo per la sessione');
      return;
    }
    if (!category) {
      showFormError(form, 'Seleziona una categoria');
      return;
    }
    if (!duration || duration < 1 || duration > 480) {
      showFormError(form, 'Durata deve essere tra 1 e 480 minuti');
      return;
    }
    if (!rpe || rpe < 1 || rpe > 10) {
      showFormError(form, 'RPE deve essere tra 1 e 10');
      return;
    }

    const muscleGroups = Array.from(modal.querySelectorAll('.strengthMuscleGroup:checked')).map(cb => cb.value);

    const formData = {
      id: existingSession.id,
      date: modal.querySelector('#strengthDate').value,
      title,
      category,
      durationMin: duration,
      intensityRpe: rpe,
      muscleGroups,
      notes: modal.querySelector('#strengthNotes').value || undefined
    };

    onSave(formData);
    modal.remove();
  });

  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#cancelBtn').addEventListener('click', () => modal.remove());
}

export function showEditCardioModal(existingSession, onSave) {
  const cardioTypes = ['running', 'walking', 'cycling', 'rowing', 'hiit', 'swimming', 'hiking', 'treadmill', 'elliptical', 'stair_climber', 'other'];
  const intensityLevels = ['low', 'medium', 'high'];

  const modalHTML = `
    <div class="modal" style="display: flex;">
      <div class="modal-content" style="width: 100%; max-width: 500px;">
        <div class="modal-header">
          <h2>✏️ Modifica Cardio</h2>
          <button class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <form id="editCardioForm">
            <div class="form-group">
              <label>Data</label>
              <input type="date" id="cardioDate" value="${existingSession.data}" required>
            </div>

            <div class="form-group">
              <label>Tipo di Cardio</label>
              <select id="cardioType" required>
                <option value="">-- Seleziona --</option>
                ${cardioTypes.map(t => {
                  const labels = {
                    running: '🏃 Corsa',
                    walking: '🚶 Camminata',
                    cycling: '🚴 Ciclismo',
                    rowing: '🚣 Canottaggio',
                    hiit: '⚡ HIIT',
                    swimming: '🏊 Nuoto',
                    hiking: '🥾 Trekking',
                    treadmill: '🏃 Treadmill',
                    elliptical: '🏋️ Ellittica',
                    stair_climber: '⛰️ Scalini',
                    other: '❓ Altro'
                  };
                  return `<option value="${t}" ${existingSession.cardioType === t ? 'selected' : ''}>${labels[t] || t}</option>`;
                }).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Durata (minuti)</label>
              <input type="number" id="cardioDuration" min="1" max="480" value="${existingSession.durationMin}" required>
            </div>

            <div class="form-group">
              <label>Intensità</label>
              <select id="cardioIntensity" required>
                <option value="">-- Seleziona --</option>
                <option value="low" ${existingSession.intensityLevel === 'low' ? 'selected' : ''}>🟢 Bassa</option>
                <option value="medium" ${existingSession.intensityLevel === 'medium' ? 'selected' : ''}>🟡 Media</option>
                <option value="high" ${existingSession.intensityLevel === 'high' ? 'selected' : ''}>🔴 Alta</option>
              </select>
            </div>

            <div class="form-group">
              <label>Distanza (km, opzionale)</label>
              <input type="number" id="cardioDistance" min="0" step="0.1" value="${existingSession.distanceKm || ''}">
            </div>

            <div class="form-group">
              <label>Frequenza Cardiaca Media (bpm, opzionale)</label>
              <input type="number" id="cardioHR" min="40" max="220" value="${existingSession.avgHeartRate || ''}">
            </div>

            <div class="form-group">
              <label>RPE Soggettivo (1-10, opzionale)</label>
              <input type="number" id="cardioRPE" min="1" max="10" value="${existingSession.intensityRpe || ''}">
            </div>

            <div class="form-group">
              <label>Note</label>
              <textarea id="cardioNotes" style="height: 80px; resize: vertical;">${existingSession.notes || ''}</textarea>
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <button type="submit" class="primary" style="flex: 1;">Salva Modifiche</button>
              <button type="button" class="secondary" style="flex: 1;" id="cancelBtn">Annulla</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.innerHTML = modalHTML;
  document.body.appendChild(modal);

  const form = modal.querySelector('#editCardioForm');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Validate form
    const cardioType = modal.querySelector('#cardioType').value;
    const duration = parseInt(modal.querySelector('#cardioDuration').value);
    const intensity = modal.querySelector('#cardioIntensity').value;
    const distance = modal.querySelector('#cardioDistance').value ? parseFloat(modal.querySelector('#cardioDistance').value) : null;
    const hr = modal.querySelector('#cardioHR').value ? parseInt(modal.querySelector('#cardioHR').value) : null;

    if (!cardioType) {
      showFormError(form, 'Seleziona un tipo di cardio');
      return;
    }
    if (!duration || duration < 1 || duration > 480) {
      showFormError(form, 'Durata deve essere tra 1 e 480 minuti');
      return;
    }
    if (!intensity) {
      showFormError(form, 'Seleziona un livello di intensità');
      return;
    }
    if (distance !== null && (distance < 0 || distance > 200)) {
      showFormError(form, 'Distanza deve essere tra 0 e 200 km');
      return;
    }
    if (hr !== null && (hr < 40 || hr > 220)) {
      showFormError(form, 'Frequenza cardiaca deve essere tra 40 e 220 bpm');
      return;
    }

    const formData = {
      id: existingSession.id,
      data: modal.querySelector('#cardioDate').value,
      cardioType,
      durationMin: duration,
      intensityLevel: intensity,
      distanceKm: distance,
      avgHeartRate: hr,
      intensityRpe: modal.querySelector('#cardioRPE').value ? parseInt(modal.querySelector('#cardioRPE').value) : undefined,
      notes: modal.querySelector('#cardioNotes').value || undefined
    };

    onSave(formData);
    modal.remove();
  });

  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#cancelBtn').addEventListener('click', () => modal.remove());
}

export function showProviderSelectionModal(onSelectProvider, { PROVIDERS, getAvailableProviders }) {
  const availableProviders = getAvailableProviders();

  const modalHTML = `
    <div class="modal" style="display: flex;">
      <div class="modal-content" style="width: 100%; max-width: 500px;">
        <div class="modal-header">
          <h2>🔗 Sincronizza Passi</h2>
          <button class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <p class="small-muted" style="margin-bottom: 1rem;">Scegli una fonte per importare i tuoi passi.</p>

          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${availableProviders.map(p => `
              <div style="padding: 1rem; background: var(--glass-secondary); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">${p.emoji}</div>
                  <div><strong>${p.name}</strong></div>
                </div>
                <button type="button" class="provider-import-btn" data-provider="${p.id}" style="padding: 0.5rem 1rem; white-space: nowrap; margin-left: 1rem;">
                  Importa
                </button>
              </div>
            `).join('')}
          </div>

          <hr style="margin: 1rem 0;">
          <p class="small-muted" style="font-size: 0.85rem;">
            💡 Seleziona il provider che usi normalmente e importa i tuoi dati passi.
          </p>
        </div>
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.innerHTML = modalHTML;
  document.body.appendChild(modal);

  modal.querySelectorAll('.provider-import-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const providerId = btn.dataset.provider;
      const provider = PROVIDERS[providerId];
      modal.remove();
      onSelectProvider(providerId, provider);
    });
  });

  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
}

export function showFileImportModal(provider, onImport, { parseStepsFile }) {
  let previewData = null;
  let parsedRecords = [];

  const modalHTML = `
    <div class="modal" style="display: flex;">
      <div class="modal-content" style="width: 100%; max-width: 550px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h2>📥 Importa Passi — ${provider.name}</h2>
          <button class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <!-- GUIDA EXPORT -->
          <div style="padding: 1rem; background: rgba(99, 102, 241, 0.1); border-left: 3px solid var(--primary); border-radius: 8px; margin-bottom: 1.5rem;">
            <h3 style="margin-top: 0; margin-bottom: 0.75rem; font-size: 1rem;">📖 Come esportare da ${provider.name}</h3>
            <ol style="margin: 0; padding-left: 1.5rem; line-height: 1.6;">
              ${provider.exportGuide.map(step => `
                <li class="small-muted">${step}</li>
              `).join('')}
            </ol>
          </div>

          <!-- FILE INPUT -->
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.75rem;"><strong>Seleziona il file</strong></label>
            <div id="dropZone" style="padding: 2rem; border: 2px dashed var(--border); border-radius: 8px; text-align: center; background: var(--glass-secondary); cursor: pointer; transition: all 0.2s;">
              <div style="font-size: 2rem; margin-bottom: 0.5rem;">📁</div>
              <div class="small-muted">Trascina il file qui oppure</div>
              <input type="file" id="fileInput" accept=".csv,.json" style="display: none;">
              <button type="button" id="browseBtn" class="primary small" style="margin-top: 0.5rem;">Sfoglia File</button>
              <div id="fileName" class="small-muted" style="margin-top: 0.5rem; font-size: 0.85rem;"></div>
            </div>
          </div>

          <!-- ANTEPRIMA -->
          <div id="previewContainer" style="display: none; margin-bottom: 1.5rem;">
            <h3 style="margin: 0 0 0.75rem 0; font-size: 1rem;">👀 Anteprima Dati</h3>
            <div id="previewTable" style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
              <!-- filled dynamically -->
            </div>
            <div id="previewInfo" class="small-muted" style="margin-top: 0.5rem; font-size: 0.85rem;"></div>
          </div>

          <!-- ERRORI -->
          <div id="errorContainer" style="display: none; margin-bottom: 1.5rem;">
            <div style="padding: 1rem; background: rgba(244, 63, 94, 0.1); border-left: 3px solid #f43f5e; border-radius: 8px;">
              <strong style="color: #f43f5e;">⚠️ Errore nel parsing:</strong>
              <div id="errorMessage" class="small-muted" style="margin-top: 0.5rem; font-size: 0.9rem;"></div>
            </div>
          </div>

          <!-- BUTTONS -->
          <div style="display: flex; gap: 0.75rem;">
            <button type="button" id="importBtn" class="primary" style="flex: 1; opacity: 0.5; cursor: not-allowed;" disabled>
              Importa <span id="importCount">0</span> record
            </button>
            <button type="button" id="cancelBtn" class="secondary" style="flex: 1;">Annulla</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.innerHTML = modalHTML;
  document.body.appendChild(modal);

  const dropZone = modal.querySelector('#dropZone');
  const fileInput = modal.querySelector('#fileInput');
  const browseBtn = modal.querySelector('#browseBtn');
  const fileNameEl = modal.querySelector('#fileName');
  const previewContainer = modal.querySelector('#previewContainer');
  const previewTable = modal.querySelector('#previewTable');
  const previewInfo = modal.querySelector('#previewInfo');
  const errorContainer = modal.querySelector('#errorContainer');
  const errorMessage = modal.querySelector('#errorMessage');
  const importBtn = modal.querySelector('#importBtn');
  const importCount = modal.querySelector('#importCount');
  const cancelBtn = modal.querySelector('#cancelBtn');

  let selectedFile = null;

  const handleFile = async (file) => {
    selectedFile = file;
    fileNameEl.textContent = `✅ ${file.name}`;
    errorContainer.style.display = 'none';

    try {
      const text = await file.text();
      const { records, errors } = parseStepsFile(text, provider.csvFormat);

      if (errors.length > 0) {
        errorContainer.style.display = 'block';
        errorMessage.textContent = errors.join(', ');
        previewContainer.style.display = 'none';
        importBtn.disabled = true;
        importBtn.style.opacity = '0.5';
        importBtn.style.cursor = 'not-allowed';
        return;
      }

      parsedRecords = records;
      previewData = records.slice(0, 5);

      // Build preview table
      previewTable.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.75rem; padding: 1rem; background: var(--glass-secondary); border-radius: 8px;">
          <div><strong style="font-size: 0.85rem;">Data</strong></div>
          <div><strong style="font-size: 0.85rem;">Passi</strong></div>
          <div><strong style="font-size: 0.85rem;">Distanza (km)</strong></div>
          <div><strong style="font-size: 0.85rem;">Min Attivi</strong></div>
          ${previewData.map(r => `
            <div class="small-muted" style="font-size: 0.85rem;">${r.date}</div>
            <div class="small-muted" style="font-size: 0.85rem;">${r.steps.toLocaleString('it-IT')}</div>
            <div class="small-muted" style="font-size: 0.85rem;">${r.distanceKm ? r.distanceKm.toFixed(1) : '—'}</div>
            <div class="small-muted" style="font-size: 0.85rem;">${r.activeMinutes || '—'}</div>
          `).join('')}
        </div>
      `;

      previewInfo.innerHTML = `
        Visualizzando <strong>${previewData.length}</strong> di <strong>${records.length}</strong> record.
        ${records.length > 5 ? ' I dati verranno importati completamente.' : ''}
      `;

      previewContainer.style.display = 'block';
      importBtn.disabled = false;
      importBtn.style.opacity = '1';
      importBtn.style.cursor = 'pointer';
      importCount.textContent = records.length;
    } catch (err) {
      errorContainer.style.display = 'block';
      errorMessage.textContent = err.message;
      previewContainer.style.display = 'none';
      importBtn.disabled = true;
      importBtn.style.opacity = '0.5';
      importBtn.style.cursor = 'not-allowed';
    }
  };

  browseBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.backgroundColor = 'rgba(99, 102, 241, 0.05)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.backgroundColor = 'var(--glass-secondary)';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.backgroundColor = 'var(--glass-secondary)';
    if (e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  importBtn.addEventListener('click', async () => {
    if (!selectedFile || parsedRecords.length === 0) return;

    importBtn.disabled = true;
    importBtn.textContent = 'Importando...';

    try {
      const result = await onImport(parsedRecords, provider);
      if (result.success) {
        modal.remove();
      } else {
        errorContainer.style.display = 'block';
        errorMessage.textContent = result.error || 'Errore durante l\'importazione';
        importBtn.disabled = false;
        importBtn.textContent = `Importa ${parsedRecords.length} record`;
      }
    } catch (err) {
      errorContainer.style.display = 'block';
      errorMessage.textContent = err.message;
      importBtn.disabled = false;
      importBtn.textContent = `Importa ${parsedRecords.length} record`;
    }
  });

  cancelBtn.addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
}

function showFormError(form, message) {
  let errorDiv = form.querySelector('.form-error-message');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.className = 'form-error-message';
    errorDiv.style.cssText = `
      padding: 0.75rem;
      background: rgba(244, 63, 94, 0.1);
      border-left: 3px solid #f43f5e;
      border-radius: 8px;
      margin-bottom: 1rem;
      color: #f43f5e;
      font-weight: 500;
      animation: slideDown 0.3s ease-out;
    `;
    form.insertBefore(errorDiv, form.firstChild);
  }
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}
