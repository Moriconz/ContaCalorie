/*
  Scheda Stima Perdita Peso - 3 blocchi: Oggi, Andamento, Obiettivo
  Integrazione con activityEnergyEngine.js e weightLossEstimator.js
*/

export function renderWeightLoss(state) {
  const {
    userProfile,
    todayMeals,
    todayExercise,
    tdee,
    todayWeightsSessions,
    todayCardioSessions,
    allWeightsSessions,
    allCardioSessions,
    dailyWeights,
    last7DaysBalances,
    tdeeAdaptive
  } = state;

  if (!userProfile || !tdee) {
    return `<div class="card"><p>Completa il profilo prima di visualizzare la stima.</p></div>`;
  }

  // Calcola intake oggi
  const todayIntake = todayMeals.reduce((sum, meal) => sum + (meal.macroCalcolate?.kcal || 0), 0);
  const todayExerciseCalories = todayExercise.totalExerciseCalories || 0;
  const todayTotalExpenditure = tdee + todayExerciseCalories;
  const todayNetDeficit = todayIntake - todayTotalExpenditure;

  return `
    <section class="section weight-loss-section">
      <!-- BLOCCO 1: OGGI -->
      <div class="card weight-loss-card">
        <h2>📅 Oggi</h2>

        <div class="grid-2">
          <div class="summary-box">
            <div class="summary-label">Intake Calorico</div>
            <div class="summary-value">${Math.round(todayIntake)}</div>
            <div class="summary-unit">kcal</div>
          </div>
          <div class="summary-box">
            <div class="summary-label">TDEE</div>
            <div class="summary-value">${tdee}</div>
            <div class="summary-unit">kcal</div>
          </div>
        </div>

        <div class="grid-2" style="margin-top: 1rem;">
          <div class="summary-box">
            <div class="summary-label">Esercizio</div>
            <div class="summary-value">${todayExerciseCalories}</div>
            <div class="summary-unit">kcal</div>
          </div>
          <div class="summary-box" style="border-left-color: ${todayNetDeficit < 0 ? 'var(--success)' : 'var(--danger)'};">
            <div class="summary-label">Deficit/Surplus Netto</div>
            <div class="summary-value" style="color: ${todayNetDeficit < 0 ? 'var(--success)' : 'var(--danger)'};">
              ${todayNetDeficit < 0 ? '−' : '+'}${Math.abs(todayNetDeficit)}
            </div>
            <div class="summary-unit">kcal</div>
          </div>
        </div>

        <!-- Sessioni odierne -->
        ${renderTodaysSessions(todayWeightsSessions, todayCardioSessions, todayExercise)}

        <!-- Form aggiungi sessione pesi -->
        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
          <h3 style="margin-bottom: 1rem;">💪 Aggiungi Sessione Pesi</h3>
          <form class="weight-session-form" id="weightsSessionForm">
            <label>
              <span class="label-text">Tipo</span>
              <select name="tipoSplit" required>
                <option value="">Seleziona...</option>
                <option value="push">Push (Petto, Spalle, Tricipiti)</option>
                <option value="pull">Pull (Schiena, Bicipiti)</option>
                <option value="legs">Legs (Gambe, Glutei)</option>
                <option value="upper">Upper (Braccia, Spalle)</option>
                <option value="lower">Lower (Gambe, Glutei)</option>
                <option value="full_body">Full Body</option>
              </select>
            </label>
            <label>
              <span class="label-text">Durata (min)</span>
              <input type="number" name="durataMin" min="1" max="300" value="60" required>
            </label>
            <label>
              <span class="label-text">Intensità</span>
              <select name="intensita" required>
                <option value="">Seleziona...</option>
                <option value="leggero">Leggero (RPE 1-4)</option>
                <option value="moderato">Moderato (RPE 5-7)</option>
                <option value="intenso">Intenso (RPE 8-10)</option>
              </select>
            </label>
            <button type="submit" class="primary" style="width: 100%; margin-top: 0.75rem;">Aggiungi Sessione Pesi</button>
          </form>
        </div>

        <!-- Form aggiungi sessione cardio -->
        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
          <h3 style="margin-bottom: 1rem;">🏃 Aggiungi Sessione Cardio</h3>
          <form class="cardio-session-form" id="cardioSessionForm">
            <label>
              <span class="label-text">Tipo</span>
              <select name="tipo" required>
                <option value="">Seleziona...</option>
                <option value="treadmill">Treadmill</option>
                <option value="corsa_outdoor">Corsa Outdoor</option>
                <option value="camminata">Camminata</option>
                <option value="bike">Bike</option>
                <option value="ellittica">Ellittica</option>
                <option value="altro">Altro</option>
              </select>
            </label>
            <label>
              <span class="label-text">Durata (min)</span>
              <input type="number" name="durataMin" min="1" max="300" value="30" required>
            </label>
            <label>
              <span class="label-text">Intensità</span>
              <select name="intensita" required>
                <option value="">Seleziona...</option>
                <option value="lento">Lento</option>
                <option value="moderato">Moderato</option>
                <option value="intenso">Intenso</option>
              </select>
            </label>
            <label id="treadmillVelocityLabel" style="display:none;">
              <span class="label-text">Velocità (km/h)</span>
              <input type="number" name="velocitaKmh" min="0.5" max="30" step="0.5" value="8">
            </label>
            <label id="treadmillInclineLabel" style="display:none;">
              <span class="label-text">Inclinazione (%)</span>
              <input type="number" name="inclinazioneGrade" min="0" max="30" step="0.5" value="0">
            </label>
            <button type="submit" class="primary" style="width: 100%; margin-top: 0.75rem;">Aggiungi Sessione Cardio</button>
          </form>
        </div>

        <!-- Form peso mattutino -->
        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
          <h3 style="margin-bottom: 1rem;">⚖️ Registra Peso</h3>
          <form class="weight-entry-form" id="weightEntryForm">
            <label>
              <span class="label-text">Peso (kg)</span>
              <input type="number" name="pesoKg" min="30" max="300" step="0.1" value="${userProfile.pesoKg || 70}" required>
            </label>
            <button type="submit" class="primary" style="width: 100%; margin-top: 0.75rem;">Registra Peso</button>
          </form>
        </div>
      </div>

      <!-- BLOCCO 2: ANDAMENTO -->
      <div class="card weight-loss-card">
        <h2>📊 Andamento</h2>

        <!-- Grafico barre ultimi 7 giorni -->
        ${renderLast7DaysChart(last7DaysBalances)}

        <!-- Grafico peso -->
        ${renderWeightTrendChart(dailyWeights)}

        <!-- Summary box -->
        ${renderProgressSummary(last7DaysBalances, dailyWeights, tdee, tdeeAdaptive, state.bodyCompositionEstimate)}
      </div>

      <!-- BLOCCO 2b: PROIEZIONE AUTOMATICA -->
      ${renderAutoProjection(state.projections, state.userProfile)}
    </section>
  `;
}

function renderTodaysSessions(weightsSessions, cardioSessions, exerciseData) {
  if (weightsSessions.length === 0 && cardioSessions.length === 0) {
    return `<div class="small-muted" style="margin-top: 1rem;">Nessuna sessione registrata oggi</div>`;
  }

  let html = '<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">';
  html += '<h3 style="margin-bottom: 0.75rem;">Sessioni Odierne</h3>';

  if (exerciseData.sessions && exerciseData.sessions.length > 0) {
    exerciseData.sessions.forEach(session => {
      html += `
        <div class="session-item">
          <div class="session-label">${session.label}</div>
          <div class="session-calories">${session.calories} kcal</div>
          <button class="delete-session-btn" data-id="${session.id}" data-type="${session.type}" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.9rem;">✕</button>
        </div>
      `;
    });
  }

  html += '</div>';
  return html;
}

function renderLast7DaysChart(dailyBalances) {
  if (!dailyBalances || dailyBalances.length === 0) {
    return `<div class="small-muted">Dati insufficienti per il grafico</div>`;
  }

  // Calcola max/min per scalare i bar
  const maxDeficit = Math.max(...dailyBalances.map(b => Math.abs(b.netDeficitOrSurplus)), 500);

  let html = '<div style="margin: 1.5rem 0;">';
  html += '<div class="small-muted" style="margin-bottom: 0.75rem;">Ultimi 7 giorni</div>';
  html += '<div class="chart-bars">';

  dailyBalances.forEach((balance, idx) => {
    const deficit = balance.netDeficitOrSurplus;
    const isDeficit = deficit < 0;
    const percentage = Math.abs(deficit) / maxDeficit * 100;
    const color = isDeficit ? 'var(--success)' : 'var(--danger)';
    const date = new Date(balance.data);
    const day = date.toLocaleDateString('it-IT', { weekday: 'short' });

    html += `
      <div class="bar-wrapper" title="${balance.data}: ${isDeficit ? '−' : '+'}${Math.abs(deficit)} kcal">
        <div class="bar" style="height: ${Math.max(percentage, 5)}%; background: ${color};"></div>
        <div class="bar-label">${day}</div>
      </div>
    `;
  });

  html += '</div>';
  html += '<div class="small-muted" style="margin-top: 0.75rem; text-align: center;">Verde = Deficit | Rosso = Surplus</div>';
  html += '</div>';
  return html;
}

function renderWeightTrendChart(dailyWeights) {
  if (!dailyWeights || dailyWeights.length < 2) {
    return `<div class="small-muted" style="margin: 1.5rem 0;">Aggiungi almeno 2 misurazioni di peso per visualizzare il trend</div>`;
  }

  const sorted = [...dailyWeights].sort((a, b) => new Date(a.data) - new Date(b.data));
  const lastWeek = sorted.slice(-7); // Ultime 7 misurazioni

  if (lastWeek.length < 2) {
    return `<div class="small-muted" style="margin: 1.5rem 0;">Occorrono almeno 2 misurazioni per il trend</div>`;
  }

  const minWeight = Math.min(...lastWeek.map(w => w.pesoKg)) - 0.5;
  const maxWeight = Math.max(...lastWeek.map(w => w.pesoKg)) + 0.5;
  const range = maxWeight - minWeight;
  const chartHeight = 120;
  const chartWidth = 100 / (lastWeek.length - 1);

  // Genera SVG semplice
  let points = '';
  lastWeek.forEach((weight, idx) => {
    const x = (idx / (lastWeek.length - 1)) * 100;
    const y = 100 - ((weight.pesoKg - minWeight) / range * 100);
    points += `${x},${y} `;
  });

  let html = `
    <div style="margin: 1.5rem 0;">
      <div class="small-muted" style="margin-bottom: 0.75rem;">Trend Peso (ultimi 7 giorni)</div>
      <svg viewBox="0 0 100 ${chartHeight}" style="width: 100%; height: 180px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface);">
        <polyline points="${points}" fill="none" stroke="var(--primary)" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg>
      <div style="margin-top: 0.75rem; display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--muted);">
        <span>${minWeight.toFixed(1)} kg</span>
        <span>${maxWeight.toFixed(1)} kg</span>
      </div>
    </div>
  `;
  return html;
}

function renderProgressSummary(dailyBalances, dailyWeights, tdee, tdeeAdaptive, bodyCompositionEstimate) {
  if (!dailyBalances || dailyBalances.length === 0) {
    return `<div class="small-muted">Dati insufficienti per il riepilogo</div>`;
  }

  const avgBalance = dailyBalances.reduce((sum, b) => sum + b.netDeficitOrSurplus, 0) / dailyBalances.length;
  const estimatedMonthlyWeightLoss = (avgBalance * 30) / 7700; // negativo = perdita

  const sorted = [...dailyWeights].sort((a, b) => new Date(a.data) - new Date(b.data));
  const actualWeightChange = sorted.length >= 2 ? sorted[sorted.length - 1].pesoKg - sorted[0].pesoKg : null;

  let html = `
    <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
      <div class="grid-2">
        <div class="summary-box">
          <div class="summary-label">Deficit Medio</div>
          <div class="summary-value" style="color: ${avgBalance < 0 ? 'var(--success)' : 'var(--danger)'};">
            ${avgBalance < 0 ? '−' : '+'}${Math.abs(Math.round(avgBalance))}
          </div>
          <div class="summary-unit">kcal/giorno</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Stima 30 Giorni</div>
          <div class="summary-value" style="color: ${estimatedMonthlyWeightLoss < 0 ? 'var(--success)' : 'var(--danger)'};">
            ${estimatedMonthlyWeightLoss < 0 ? '−' : '+'}${Math.abs(estimatedMonthlyWeightLoss.toFixed(1))}
          </div>
          <div class="summary-unit">kg</div>
        </div>
      </div>

      <!-- Composizione corporea -->
      ${bodyCompositionEstimate ? `
        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(168,85,247,0.08); border-radius: 8px; border-left: 3px solid var(--accent);">
          <div class="small-muted" style="margin-bottom: 0.5rem;">📊 Stima Composizione (30 giorni)</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
            <div style="padding: 0.5rem; background: rgba(255,193,7,0.15); border-radius: 6px;">
              <div class="small-muted">Massa Grassa</div>
              <strong style="font-size: 1rem; color: ${bodyCompositionEstimate.fatKgChange < 0 ? 'var(--success)' : 'var(--danger)'};">
                ${bodyCompositionEstimate.fatKgChange < 0 ? '−' : '+'}${Math.abs(bodyCompositionEstimate.fatKgChange)} kg
              </strong>
              <div class="small-muted" style="font-size: 0.7rem;">${bodyCompositionEstimate.fatPercent}%</div>
            </div>
            <div style="padding: 0.5rem; background: rgba(76,175,80,0.15); border-radius: 6px;">
              <div class="small-muted">Massa Magra</div>
              <strong style="font-size: 1rem; color: ${bodyCompositionEstimate.leanKgChange < 0 ? 'var(--danger)' : 'var(--success)'};">
                ${bodyCompositionEstimate.leanKgChange < 0 ? '−' : '+'}${Math.abs(bodyCompositionEstimate.leanKgChange)} kg
              </strong>
              <div class="small-muted" style="font-size: 0.7rem;">${bodyCompositionEstimate.leanPercent}%</div>
            </div>
          </div>
          <div class="small-muted" style="font-size: 0.75rem; line-height: 1.4;">
            ⓘ Stima basata su: allenamento (${(bodyCompositionEstimate.resistanceTrainingScore * 100).toFixed(0)}%), proteine (${(bodyCompositionEstimate.proteinScore * 100).toFixed(0)}%), deficit (${(bodyCompositionEstimate.deficitScore * 100).toFixed(0)}%). Non è una misura clinica.
          </div>
        </div>
      ` : ''}
  `;

  if (tdeeAdaptive !== null) {
    const diff = tdeeAdaptive - tdee;
    const diffPercent = ((diff / tdee) * 100).toFixed(1);
    html += `
      <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(99,102,241,0.1); border-radius: 8px;">
        <div class="small-muted">TDEE Teorico: ${tdee} kcal</div>
        <div class="small-muted">TDEE Adattivo: ${tdeeAdaptivo} kcal (${diff > 0 ? '+' : ''}${diff} kcal, ${diff > 0 ? '+' : ''}${diffPercent}%)</div>
      </div>
    `;
  }

  if (actualWeightChange !== null) {
    html += `
      <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(34,197,94,0.1); border-radius: 8px;">
        <div class="small-muted">Cambio Peso Effettivo: ${actualWeightChange > 0 ? '+' : ''}${actualWeightChange.toFixed(2)} kg</div>
      </div>
    `;
  }

  html += '</div>';
  return html;
}

function renderAutoProjection(projections, userProfile) {
  if (!projections || projections.insufficientData) {
    return `
      <div class="card weight-loss-card">
        <h2>🔮 Se continui così...</h2>
        <div class="small-muted" style="padding: 1rem; background: rgba(99,102,241,0.08); border-radius: 8px;">
          ${projections?.reason || 'Dati insufficienti per la proiezione'}.
          ${projections?.daysAvailable ? `Attualmente: ${projections.daysAvailable} giorni disponibili.` : ''}
        </div>
      </div>
    `;
  }

  const renderProjectionBox = (projection, label) => {
    if (!projection || projection.error) return '';
    const totalChange = projection.futureWeight - projection.currentWeight;
    return `
      <div style="margin-bottom: 1rem; padding: 1rem; background: rgba(168,85,247,0.08); border-radius: 12px; border-left: 3px solid var(--accent);">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.75rem;">
          <div>
            <div class="small-muted">Peso Attuale</div>
            <strong style="font-size: 1.4rem; color: var(--primary);">${projection.currentWeight} kg</strong>
          </div>
          <div>
            <div class="small-muted">Peso Stimato (${label})</div>
            <strong style="font-size: 1.4rem; color: var(--accent);">${projection.futureWeight} kg</strong>
          </div>
        </div>
        <div style="padding: 0.75rem; background: var(--surface-strong); border-radius: 8px; margin-bottom: 0.75rem;">
          <div class="small-muted" style="margin-bottom: 0.5rem;">Cambiamento stimato</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
            <div>
              <strong style="color: var(--text); font-size: 1.1rem;">${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)} kg</strong>
              <div class="small-muted">Totale</div>
            </div>
            <div>
              <strong style="color: #ffc107; font-size: 1.1rem;">${projection.fatKgChange > 0 ? '+' : ''}${projection.fatKgChange.toFixed(2)} kg</strong>
              <div class="small-muted">Grasso</div>
            </div>
            <div>
              <strong style="color: #4caf50; font-size: 1.1rem;">${projection.leanKgChange > 0 ? '+' : ''}${projection.leanKgChange.toFixed(2)} kg</strong>
              <div class="small-muted">Massa magra</div>
            </div>
          </div>
        </div>
        <div class="small-muted" style="font-size: 0.75rem; line-height: 1.5;">
          ⓘ Basato su: media ultimi 30 giorni (${projection.avgIntakeKcal} kcal intake, ${projection.avgExerciseKcal} kcal esercizio, ${projection.avgProteinPerKg.toFixed(1)} g/kg proteine).
          Usa TDEE ${projection.isAdaptiveTDEETrusted ? 'adattivo' : 'teorico'} (${projection.adaptiveTDEEUsed} kcal).
        </div>
      </div>
    `;
  };

  return `
    <div class="card weight-loss-card">
      <h2>🔮 Se continui così...</h2>
      <div class="small-muted" style="margin-bottom: 1rem;">Proiezione basata sulla tua media degli ultimi 30 giorni.</div>

      ${renderProjectionBox(projections.projection30, '30gg')}
      ${renderProjectionBox(projections.projection60, '60gg')}
      ${renderProjectionBox(projections.projection90, '90gg')}

      <div style="padding: 1rem; background: rgba(239,68,68,0.08); border-left: 3px solid var(--danger); border-radius: 8px; margin-top: 1rem;">
        <div class="small-muted" style="margin-bottom: 0.5rem;">⚠️ Disclaimer importante</div>
        <div class="small-muted" style="font-size: 0.75rem; line-height: 1.5;">
          Questa proiezione NON tiene conto di: variazioni ormonali, cicli mestruali, malattie, ritenzione idrica, variazioni di stile di vita, sonno, stress.
          È basata su un modello semplificato per dare un ordine di grandezza, non una previsione clinica.
        </div>
      </div>
    </div>
  `;
}

export function bindWeightLossEvents(container, callbacks) {
  // Form sessione pesi
  const weightsForm = container.getElementById('weightsSessionForm');
  if (weightsForm) {
    weightsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(weightsForm);
      const session = {
        tipoSplit: formData.get('tipoSplit'),
        durataMin: parseInt(formData.get('durataMin')),
        intensita: formData.get('intensita')
      };
      if (session.tipoSplit && session.durataMin && session.intensita) {
        callbacks.onSaveWeightsSession(session);
        weightsForm.reset();
      }
    });
  }

  // Form sessione cardio
  const cardioForm = container.getElementById('cardioSessionForm');
  const treadmillVelocityLabel = container.getElementById('treadmillVelocityLabel');
  const treadmillInclineLabel = container.getElementById('treadmillInclineLabel');
  const cardioTipoSelect = cardioForm?.querySelector('select[name="tipo"]');

  if (cardioTipoSelect) {
    cardioTipoSelect.addEventListener('change', (e) => {
      const isTreadmill = e.target.value === 'treadmill';
      if (treadmillVelocityLabel) treadmillVelocityLabel.style.display = isTreadmill ? 'block' : 'none';
      if (treadmillInclineLabel) treadmillInclineLabel.style.display = isTreadmill ? 'block' : 'none';
    });
  }

  if (cardioForm) {
    cardioForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(cardioForm);
      const session = {
        tipo: formData.get('tipo'),
        durataMin: parseInt(formData.get('durataMin')),
        intensita: formData.get('intensita'),
        velocitaKmh: parseFloat(formData.get('velocitaKmh')) || 0,
        inclinazioneGrade: parseFloat(formData.get('inclinazioneGrade')) || 0
      };
      if (session.tipo && session.durataMin && session.intensita) {
        callbacks.onSaveCardioSession(session);
        cardioForm.reset();
      }
    });
  }

  // Form peso
  const weightForm = container.getElementById('weightEntryForm');
  if (weightForm) {
    weightForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pesoKg = parseFloat(container.querySelector('input[name="pesoKg"]').value);
      if (pesoKg && pesoKg > 0) {
        callbacks.onSaveDailyWeight(pesoKg);
        weightForm.reset();
      }
    });
  }


  // Bottoni elimina sessione
  container.querySelectorAll('.delete-session-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const type = e.target.dataset.type;
      if (id && type) {
        callbacks.onDeleteSession(type, id);
      }
    });
  });
}
