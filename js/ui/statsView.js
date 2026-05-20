/*
  UI per visualizzare statistiche settimanali/mensili senza dipendenze esterne.
  Usa HTML/CSS per semplici visualizzazioni.
*/

import { getWeeklyStats, getMonthlyStats, getWeightTrend } from '../statisticsEngine.js';
import { generateCoachingInsights } from '../coachingRules.js';

export function renderStatsView(meals, dailyWeights, nutritionTargets, userProfile) {
  const weeklyData = getWeeklyStats(meals, nutritionTargets);
  const insights = generateCoachingInsights(meals, dailyWeights, nutritionTargets, userProfile);
  const weightTrend = getWeightTrend(dailyWeights, 30);

  return `
    <section class="section">
      <h1>Statistiche & Insight</h1>
    </section>

    <!-- Insights -->
    <section class="section card">
      <h2 style="margin-bottom: 1rem;">💡 Insight Personali</h2>
      ${insights.length > 0 ? insights.map(insight => `
        <div style="padding: 1rem; background: ${
          insight.priority === 'high' ? 'rgba(239,68,68,0.1)' :
          insight.priority === 'medium' ? 'rgba(168,85,247,0.1)' :
          'rgba(34,197,94,0.1)'
        }; border-left: 3px solid ${
          insight.priority === 'high' ? '#ef4444' :
          insight.priority === 'medium' ? '#a855f7' :
          '#22c55e'
        }; border-radius: 8px; margin-bottom: 0.75rem;">
          <div style="font-size: 1rem; margin-bottom: 0.5rem;"><strong>${insight.title}</strong></div>
          <div style="color: var(--text-muted); font-size: 0.9rem;">${insight.message}</div>
        </div>
      `).join('') : '<p class="small-muted">Nessun insight disponibile ancora.</p>'}
    </section>

    <!-- Weekly Overview -->
    <section class="section card">
      <h2 style="margin-bottom: 1rem;">📊 Ultima Settimana</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; font-size: 0.9rem; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid var(--glass-border);">
              <th style="text-align: left; padding: 0.5rem;">Giorno</th>
              <th style="text-align: right; padding: 0.5rem;">Kcal</th>
              <th style="text-align: right; padding: 0.5rem;">Prot.</th>
              <th style="text-align: right; padding: 0.5rem;">Carbo</th>
              <th style="text-align: right; padding: 0.5rem;">Grassi</th>
              <th style="text-align: center; padding: 0.5rem;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${weeklyData.map(day => `
              <tr style="border-bottom: 1px solid var(--glass-border);">
                <td style="text-align: left; padding: 0.5rem;"><strong>${day.label}</strong><br><span class="small-muted">${day.data}</span></td>
                <td style="text-align: right; padding: 0.5rem;">${day.totaleCalorie}</td>
                <td style="text-align: right; padding: 0.5rem;">${day.proteine}g</td>
                <td style="text-align: right; padding: 0.5rem;">${day.carboidrati}g</td>
                <td style="text-align: right; padding: 0.5rem;">${day.grassi}g</td>
                <td style="text-align: center; padding: 0.5rem;">
                  ${day.status === 'ok' ? '✅' : day.status === 'basso' ? '↓' : '↑'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 1rem; padding: 1rem; background: var(--glass-secondary); border-radius: 8px;">
        <strong>Media Settimanale:</strong>
        <div style="margin-top: 0.5rem; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.5rem; font-size: 0.9rem;">
          <div>Kcal: ${Math.round(weeklyData.reduce((s, d) => s + d.totaleCalorie, 0) / weeklyData.filter(d => d.totaleCalorie > 0).length)}</div>
          <div>Prot: ${Math.round(weeklyData.reduce((s, d) => s + d.proteine, 0) / weeklyData.length)}g</div>
          <div>Carbo: ${Math.round(weeklyData.reduce((s, d) => s + d.carboidrati, 0) / weeklyData.length)}g</div>
          <div>Grassi: ${Math.round(weeklyData.reduce((s, d) => s + d.grassi, 0) / weeklyData.length)}g</div>
        </div>
      </div>
    </section>

    <!-- Weight Trend -->
    <section class="section card">
      <h2 style="margin-bottom: 1rem;">⚖️ Trend Peso</h2>
      ${weightTrend.trend !== 'no-data' && weightTrend.trend !== 'insufficient-data' ? `
        <div style="padding: 1rem; background: var(--glass-secondary); border-radius: 8px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <div class="small-muted">Variazione</div>
              <div style="font-size: 1.3rem; font-weight: 700; color: ${weightTrend.deltaKg < 0 ? '#22c55e' : '#ef4444'};">
                ${weightTrend.deltaKg > 0 ? '+' : ''}${weightTrend.deltaKg} kg
              </div>
            </div>
            <div>
              <div class="small-muted">Ritmo</div>
              <div style="font-size: 1.3rem; font-weight: 700;">
                ${weightTrend.velocita > 0 ? '+' : ''}${weightTrend.velocita} kg/sett.
              </div>
            </div>
          </div>
          <div style="font-size: 0.9rem; color: var(--text-muted);">
            ${weightTrend.trend === 'down' ? '📉 Peso in diminuzione' :
              weightTrend.trend === 'up' ? '📈 Peso in aumento' :
              '➡️ Peso stabile'}
          </div>
          <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto;">
            ${weightTrend.dataPoints.slice(-14).map((point, idx) => {
              const isLast = idx === weightTrend.dataPoints.length - 1;
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                  <span>${point.data}</span>
                  <span style="font-weight: ${isLast ? '700' : '400'};">${point.pesoKg} kg</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : '<p class="small-muted">Dati peso insufficienti per il trend.</p>'}
    </section>

    <!-- Simple Sparkline -->
    <section class="section card">
      <h2 style="margin-bottom: 1rem;">📈 Visualizzazione Calorie</h2>
      <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 150px; gap: 0.25rem; padding: 1rem 0; border-bottom: 2px solid var(--glass-border);">
        ${weeklyData.map(day => {
          const maxCalories = 3000;
          const height = (day.totaleCalorie / maxCalories) * 100;
          const color = day.status === 'ok' ? '#22c55e' : day.status === 'basso' ? '#3b82f6' : '#f59e0b';
          return `
            <div style="display: flex; flex-direction: column; align-items: center; flex: 1; gap: 0.5rem;">
              <div style="width: 100%; height: ${Math.max(height, 5)}%; background: ${color}; border-radius: 4px 4px 0 0; opacity: 0.8;"></div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${day.label}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted);">
        <strong>Legenda:</strong> 🟢 = OK | 🔵 = Basso | 🟠 = Alto
      </div>
    </section>
  `;
}

export function bindStatsViewEvents(container, callbacks) {
  // No interactive elements yet - could add date selectors or export buttons
}
