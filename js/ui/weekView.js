/*
  Vista settimanale con scroll orizzontale (mobile-first).
*/

export function renderWeekView(weekData, weeklyActivityStats) {
  const statusBadges = {
    'Ok': 'status-ok',
    'Basso': 'status-low',
    'Alto': 'status-high'
  };

  return `
    <section class="section card">
      <h1>Settimana</h1>
      <p class="small-muted">Scorri per vedere gli altri giorni.</p>
      <div class="week-scroll">
        ${weekData.map(day => `
          <button class="week-day-card card" data-day="${day.data}">
            <div class="week-day-header">
              <strong class="week-day-label">${day.label}</strong>
              <div class="week-day-status ${statusBadges[day.status] || 'status-ok'}">${day.status}</div>
            </div>
            <div class="week-day-kcal">${day.totaleCalorie}</div>
            <div class="week-day-unit">kcal</div>
          </button>
        `).join('')}
      </div>
    </section>

    ${renderWeeklyActivityStats(weeklyActivityStats)}
  `;
}

function renderWeeklyActivityStats(stats) {
  if (!stats || (stats.strengthCount === 0 && stats.cardioCount === 0 && stats.totalSteps === 0)) {
    return '';
  }

  const weeklyBadges = generateWeeklyBadges(stats);

  return `
    <section class="section">
      <div class="card" style="background: linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(59,130,246,0.08) 100%); border: 1px solid var(--border);">
        <h2 style="font-size: 1.1rem; margin-bottom: 1rem;">💪 Attività Settimanale</h2>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
          <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
            <div class="small-muted">Kcal Totali</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #22c55e;">${Math.round(stats.totalActivityKcal)}</div>
          </div>
          <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
            <div class="small-muted">Sessioni</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #3b82f6;">${stats.strengthCount + stats.cardioCount}</div>
            <div class="small-muted" style="font-size: 0.8rem;">💪${stats.strengthCount} 🏃${stats.cardioCount}</div>
          </div>
          <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
            <div class="small-muted">Passi Totali</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #f59e0b;">${(stats.totalSteps || 0).toLocaleString('it-IT')}</div>
          </div>
          <div style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 8px;">
            <div class="small-muted">Media al Giorno</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #8b5cf6;">${(stats.avgStepsPerDay || 0).toLocaleString('it-IT')}</div>
          </div>
        </div>

        ${weeklyBadges.length > 0 ? `
          <div style="padding-top: 1rem; border-top: 1px solid var(--border);">
            <div class="small-muted" style="margin-bottom: 0.5rem; font-size: 0.85rem;">🏆 Achievement settimanali:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${weeklyBadges.map(b => `
                <span style="display: inline-block; padding: 0.4rem 0.75rem; background: rgba(251,191,36,0.2); border: 1px solid rgba(251,191,36,0.4); border-radius: 12px; font-size: 0.8rem; font-weight: 600; color: #fbbf24;">
                  ${b.emoji} ${b.label}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </section>
  `;
}

function generateWeeklyBadges(stats) {
  const badges = [];

  if (!stats) return badges;

  // Badge: High activity week
  if (stats.totalActivityKcal >= 2000) {
    badges.push({ emoji: '🔥', label: 'Settimana Fitta' });
  }

  // Badge: Consistency (some activities most days)
  const totalSessions = stats.strengthCount + stats.cardioCount;
  if (totalSessions >= 7) {
    badges.push({ emoji: '⭐', label: `${totalSessions} sessioni` });
  } else if (totalSessions >= 5) {
    badges.push({ emoji: '💪', label: `${totalSessions} sessioni` });
  }

  // Badge: Step achievement
  if (stats.totalSteps >= 70000) {
    badges.push({ emoji: '🎯', label: '70k+ passi' });
  } else if (stats.totalSteps >= 50000) {
    badges.push({ emoji: '⚡', label: '50k+ passi' });
  }

  // Badge: Avg steps high
  if (stats.avgStepsPerDay >= 10000) {
    badges.push({ emoji: '🚶', label: 'Mille passi al giorno' });
  }

  return badges.slice(0, 3);
}

export function bindWeekViewEvents(container, callbacks) {
  container.querySelectorAll('[data-day]').forEach(button => {
    button.addEventListener('click', () => callbacks.onSelectDay(button.dataset.day));
  });
}
