/*
  Vista settimanale con scroll orizzontale (mobile-first).
*/

export function renderWeekView(weekData) {
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
  `;
}

export function bindWeekViewEvents(container, callbacks) {
  container.querySelectorAll('[data-day]').forEach(button => {
    button.addEventListener('click', () => callbacks.onSelectDay(button.dataset.day));
  });
}
