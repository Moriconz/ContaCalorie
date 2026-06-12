/**
 * Settings UI — Gestione impostazioni app + backup/import dati
 *
 * Funzionalità:
 * - Export backup (download JSON)
 * - Import backup (file picker + validazione)
 * - Gestione tema (dark/light)
 * - Reset dati (opzionale)
 */

import * as backup from '../sync/backupService.js';
import { loadUserProfile, getDbStats } from '../storage.js';
import { escapeHtml } from '../utils.js';
import { showConfirm } from './modal.js';

export function renderSettings() {
  return `
    <div class="settings-container" style="padding: 1rem; max-width: 600px; margin: 0 auto;">
      <h2>⚙️ Impostazioni</h2>

      <!-- SEZIONE DATI PROFILO -->
      <div class="settings-section" style="margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--color-border);">
        <h3 style="margin-bottom: 1rem;">👤 Profilo</h3>
        <div id="profileInfo" style="padding: 1rem; background: rgba(0,0,0,0.05); border-radius: 8px; margin-bottom: 1rem;">
          <!-- Riempito dinamicamente -->
        </div>
        <button id="editProfileBtn" class="button-secondary" style="width: 100%;">
          Modifica Profilo
        </button>
      </div>

      <!-- SEZIONE IMPOSTAZIONI ATTIVITÀ -->
      <div class="settings-section" style="margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--color-border);">
        <h3 style="margin-bottom: 1rem;">💪 Impostazioni Attività</h3>

        <!-- Energy Model -->
        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 0.75rem;">Modello Energetico</label>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
              <input type="radio" name="energyModel" value="tdee_plus_extras" class="activity-pref" style="cursor: pointer;">
              <span><strong>TDEE Base + Attività Extra</strong></span>
            </label>
            <div class="small-muted" style="margin-left: 1.75rem; margin-bottom: 0.5rem; font-size: 0.8rem;">Calorie baseline sedentarie + aggiunte dalle attività</div>

            <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
              <input type="radio" name="energyModel" value="tdee_with_factor" class="activity-pref" style="cursor: pointer;">
              <span><strong>TDEE con Activity Factor</strong></span>
            </label>
            <div class="small-muted" style="margin-left: 1.75rem; margin-bottom: 0.5rem; font-size: 0.8rem;">TDEE calcolato moltiplicando baseline × fattore attività</div>
          </div>
        </div>

        <!-- Activity Factor (shown only if tdee_with_factor) -->
        <div id="activityFactorSection" style="display: none; margin-bottom: 1.5rem; padding: 1rem; background: var(--glass-secondary); border-radius: 8px;">
          <label style="display: block; font-weight: 600; margin-bottom: 0.75rem;">Activity Factor</label>
          <div style="display: grid; grid-template-columns: 1fr 0.5fr; gap: 0.75rem;">
            <input type="range" id="activityFactor" min="1.2" max="1.9" step="0.025" style="width: 100%;" class="activity-pref">
            <div style="text-align: center; padding: 0.5rem; background: var(--surface-strong); border-radius: 6px; font-weight: 600;" id="activityFactorValue">1.375</div>
          </div>
          <div class="small-muted" style="margin-top: 0.5rem; font-size: 0.8rem;">
            1.2=Sedentario | 1.375=Moderato | 1.55=Attivo | 1.725=Molto attivo
          </div>
        </div>

        <!-- Double Counting Prevention -->
        <div style="margin-bottom: 1.5rem;">
          <label style="display: flex; align-items: center; gap: 1rem; cursor: pointer;">
            <input id="avoidDoubleCountingWalking" type="checkbox" class="activity-pref" style="cursor: pointer;">
            <span><strong>Evita doppio conteggio cardio "a piedi" + passi</strong></span>
          </label>
          <div class="small-muted" style="margin-left: 2rem; margin-top: 0.5rem; font-size: 0.8rem;">
            Se attivato, dai passi del giorno vengono sottratti quelli generati dal cardio a piedi (corsa, camminata, treadmill, hiking), così non vengono contati due volte. I cardio non a piedi (bici, nuoto…) non toccano i passi.
          </div>
        </div>

        <!-- Include Steps in Expenditure -->
        <div style="margin-bottom: 1.5rem;">
          <label style="display: flex; align-items: center; gap: 1rem; cursor: pointer;">
            <input id="includeStepsInTdee" type="checkbox" class="activity-pref" style="cursor: pointer;">
            <span><strong>Includi passi nel calcolo TDEE</strong></span>
          </label>
        </div>

        <!-- Step Goal -->
        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Target Passi Giornalieri</label>
          <div style="display: grid; grid-template-columns: 1fr 0.4fr; gap: 0.75rem;">
            <input type="range" id="stepGoal" min="3000" max="20000" step="1000" style="width: 100%;" class="activity-pref">
            <div style="text-align: center; padding: 0.5rem; background: var(--surface-strong); border-radius: 6px; font-weight: 600;" id="stepGoalValue">10000</div>
          </div>
        </div>

        <!-- Eat Back Mode -->
        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 0.75rem;">Modalità Eat-Back</label>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
              <input type="radio" name="eatBackMode" value="none" class="activity-pref" style="cursor: pointer;">
              <span>Non mangiare indietro</span>
            </label>
            <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
              <input type="radio" name="eatBackMode" value="partial" class="activity-pref" style="cursor: pointer;">
              <span>Parziale</span>
            </label>
            <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
              <input type="radio" name="eatBackMode" value="full" class="activity-pref" style="cursor: pointer;">
              <span>Completo</span>
            </label>
          </div>
        </div>

        <!-- Eat Back Ratio (shown only if partial) -->
        <div id="eatBackRatioSection" style="display: none; margin-bottom: 1.5rem; padding: 1rem; background: var(--glass-secondary); border-radius: 8px;">
          <label style="display: block; font-weight: 600; margin-bottom: 0.75rem;">Percentuale da Mangiare Indietro</label>
          <div style="display: grid; grid-template-columns: 1fr 0.4fr; gap: 0.75rem;">
            <input type="range" id="eatBackRatio" min="0" max="1" step="0.05" style="width: 100%;" class="activity-pref">
            <div style="text-align: center; padding: 0.5rem; background: var(--surface-strong); border-radius: 6px; font-weight: 600;" id="eatBackRatioValue">30%</div>
          </div>
          <div class="small-muted" style="margin-top: 0.5rem; font-size: 0.8rem;">
            0% = Non mangiare indietro | 100% = Mangiare tutte le kcal bruciate
          </div>
        </div>
      </div>

      <!-- SEZIONE BACKUP & RECOVERY -->
      <div class="settings-section" style="margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--color-border);">
        <h3 style="margin-bottom: 1rem;">💾 Backup & Recupero Dati</h3>

        <div class="backup-info" style="background: rgba(52, 211, 153, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #34D399;">
          <p style="margin: 0; font-size: 0.9rem; color: var(--color-text-secondary);">
            💡 <strong>Backup:</strong> Scarica un file JSON con tutti i tuoi dati (profilo, pasti, allenamenti, body comp).
            Puoi usarlo per ripristinare su questo device o per trasferire su un altro.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <button id="exportBtn" class="button-primary" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            📥 Esporta Dati
          </button>
          <button id="importBtn" class="button-primary" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            📤 Importa Dati
          </button>
        </div>

        <input
          id="backupFileInput"
          type="file"
          accept=".json"
          style="display: none;"
        />

        <!-- Status message -->
        <div id="backupStatusMsg" style="display: none; padding: 1rem; border-radius: 8px; margin-top: 1rem;"></div>
      </div>

      <!-- SEZIONE MODALITÀ AVANZATA -->
      <div class="settings-section" style="margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--color-border);">
        <h3 style="margin-bottom: 1rem;">🔬 Modalità Avanzata</h3>
        
        <label style="display: flex; align-items: center; gap: 1rem; cursor: pointer; margin-bottom: 1rem;">
          <input id="advancedModeToggle" type="checkbox" style="width: 18px; height: 18px; cursor: pointer;">
          <span><strong>Abilita tracking composizione corporea</strong></span>
        </label>

        <div id="advancedModeInfo" style="background: rgba(100, 150, 255, 0.1); padding: 1rem; border-radius: 8px; border-left: 4px solid #6496FF; color: var(--color-text-secondary); font-size: 0.9rem; line-height: 1.6; display: none;">
          <p style="margin: 0.5rem 0;"><strong>⚠️ SPERIMENTALE</strong></p>
          <p style="margin: 0.5rem 0;">Questa feature usa stima algoritmica, NON è equivalente a DEXA/BIA.</p>
          <p style="margin: 0.5rem 0;"><strong>Cosa misura:</strong></p>
          <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>Bilancio calorico (intake - TDEE)</li>
            <li>Intake proteico medio</li>
            <li>Sessioni pesi registrate (RPE)</li>
          </ul>
          <p style="margin: 0.5rem 0;"><strong>Limitazioni:</strong></p>
          <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>Variabilità ±1-2 kg per ritenzione idrica/glicogeno</li>
            <li>Richiede aderenza costante ai dati</li>
            <li>Usa come TENDENZA, non valore assoluto</li>
          </ul>
          <p style="margin: 0.5rem 0;"><strong>💡 Consiglio:</strong> Calibra con DEXA/BIA ogni 4-8 settimane.</p>
        </div>
      </div>

      <!-- SEZIONE INFORMAZIONI -->
      <div class="settings-section" style="padding-bottom: 1.5rem;">
        <h3 style="margin-bottom: 1rem;">ℹ️ Informazioni</h3>
        <div style="font-size: 0.9rem; color: var(--color-text-secondary); line-height: 1.6;">
          <p style="margin: 0.5rem 0;">
            📦 <strong>App Version:</strong> 0.1.0 (Beta)
          </p>
          <p style="margin: 0.5rem 0;">
            🗄️ <strong>Database:</strong> IndexedDB (ContaCalorieDB v6)
          </p>
          <p style="margin: 0.5rem 0;">
            🌐 <strong>Type:</strong> Progressive Web App (Local-First)
          </p>
          <p style="margin: 0.5rem 0;">
            💾 <strong>Storage:</strong> <span id="storageInfo">--</span>
          </p>
        </div>
      </div>

      <!-- SEZIONE DEBUG (Solo in development) -->
      <div class="settings-section" style="padding-top: 1.5rem; border-top: 1px solid var(--color-border);">
        <details style="cursor: pointer;">
          <summary style="color: var(--color-text-secondary); font-size: 0.9rem;">
            🔧 Debug Info (sviluppatori)
          </summary>
          <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.05); border-radius: 8px; font-family: monospace; font-size: 0.85rem;">
            <button id="logDbStatsBtn" class="button-secondary" style="width: 100%; margin-bottom: 0.5rem;">
              Log IndexedDB Stats
            </button>
            <button id="logStorageInfoBtn" class="button-secondary" style="width: 100%; margin-bottom: 0.5rem;">
              Log Storage Info
            </button>
            <button id="logBootstrapBtn" class="button-secondary" style="width: 100%;">
              Log Bootstrap State
            </button>
            <pre id="debugOutput" style="margin-top: 1rem; overflow-x: auto; max-height: 300px; background: white; padding: 0.5rem; border-radius: 4px; display: none;"></pre>
          </div>
        </details>
      </div>
    </div>
  `;
}

export function bindSettingsEvents(container, callbacks) {
  console.log('🔌 bindSettingsEvents: binding events');

  // Update profile info
  updateProfileInfo(container);
  updateStorageInfo(container);

  // Export button
  const exportBtn = container.querySelector('#exportBtn');
  exportBtn.addEventListener('click', async () => {
    await handleExport(container);
  });

  // Import button
  const importBtn = container.querySelector('#importBtn');
  importBtn.addEventListener('click', () => {
    container.querySelector('#backupFileInput').click();
  });

  // File input change
  const fileInput = container.querySelector('#backupFileInput');
  fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await handleImport(container, e.target.files[0]);
      e.target.value = ''; // Reset input
    }
  });

  // Edit profile
  const editProfileBtn = container.querySelector('#editProfileBtn');
  if (editProfileBtn && callbacks?.onEditProfile) {
    editProfileBtn.addEventListener('click', callbacks.onEditProfile);
  }

  // Activity preferences binding
  bindActivityPreferences(container);

  // Debug buttons
  const logDbStatsBtn = container.querySelector('#logDbStatsBtn');
  logDbStatsBtn?.addEventListener('click', async () => {
    const output = container.querySelector('#debugOutput');
    output.style.display = 'block';
    output.textContent = 'Caricando...\n';
    const stats = await getDbStats();
    console.log('📊 IndexedDB (ContaCalorieDB):', stats);
    output.textContent = JSON.stringify(stats, null, 2);
  });

  const logStorageInfoBtn = container.querySelector('#logStorageInfoBtn');
  logStorageInfoBtn?.addEventListener('click', async () => {
    const output = container.querySelector('#debugOutput');
    output.style.display = 'block';
    output.textContent = 'Caricando...\n';
    const { logStorageInfo } = await import('../storage/persistence.js');
    await logStorageInfo();
    const info = await (await import('../storage/persistence.js')).getStorageInfo();
    output.textContent = JSON.stringify(info, null, 2);
  });

  const logBootstrapBtn = container.querySelector('#logBootstrapBtn');
  logBootstrapBtn?.addEventListener('click', async () => {
    const output = container.querySelector('#debugOutput');
    output.style.display = 'block';
    const { logBootstrapState } = await import('../appBootstrap.js');
    logBootstrapState();
    const state = (await import('../appBootstrap.js')).getBootstrapState();
    output.textContent = JSON.stringify(state, null, 2);
  });


  // Advanced mode toggle
  const advancedToggle = container.querySelector('#advancedModeToggle');
  const advancedInfo = container.querySelector('#advancedModeInfo');
  
  if (advancedToggle) {
    // Carica lo stato salvato
    const advancedEnabled = localStorage.getItem('advancedMode') === 'true';
    advancedToggle.checked = advancedEnabled;
    if (advancedEnabled) advancedInfo.style.display = 'block';
    
    // Toggle listener
    advancedToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      localStorage.setItem('advancedMode', isEnabled);
      advancedInfo.style.display = isEnabled ? 'block' : 'none';
      
      if (isEnabled) {
        showStatusMessage(container.querySelector('#backupStatusMsg'), '✅ Modalità avanzata abilitata', 'success');
      }
    });
  }
}

/**
 * Aggiorna info profilo
 */
async function updateProfileInfo(container) {
  try {
    const profile = await loadUserProfile();
    const infoDiv = container.querySelector('#profileInfo');

    if (profile && profile.nome) {
      infoDiv.innerHTML = `
        <p style="margin: 0.5rem 0;">👤 <strong>${escapeHtml(profile.nome)}</strong></p>
        <p style="margin: 0.5rem 0;">📏 ${profile.altezzaCm || '--'} cm</p>
        <p style="margin: 0.5rem 0;">⚖️ ${profile.pesoKg || '--'} kg</p>
        <p style="margin: 0.5rem 0;">🎯 Sesso: ${profile.sesso || '--'}</p>
      `;
    } else {
      infoDiv.innerHTML = '<p style="margin: 0; color: var(--color-text-secondary);">Profilo non configurato</p>';
    }
  } catch (error) {
    console.warn('⚠️ Errore caricamento profilo:', error);
  }
}

/**
 * Aggiorna info storage
 */
async function updateStorageInfo(container) {
  try {
    const { getStorageInfo } = await import('../storage/persistence.js');
    const info = await getStorageInfo();
    const storageSpan = container.querySelector('#storageInfo');

    if (info) {
      const usedMB = (info.usage / 1024 / 1024).toFixed(2);
      const quotaMB = (info.quota / 1024 / 1024).toFixed(1);
      storageSpan.textContent = `${usedMB} MB / ${quotaMB} MB (${info.percentUsed}% usato)`;
    }
  } catch (error) {
    console.warn('⚠️ Errore storage info:', error);
  }
}

/**
 * Gestisce export backup
 */
async function handleExport(container) {
  const exportBtn = container.querySelector('#exportBtn');
  const statusMsg = container.querySelector('#backupStatusMsg');

  try {
    exportBtn.disabled = true;
    exportBtn.textContent = '⏳ Esportando...';

    await backup.downloadBackupFile();

    showStatusMessage(statusMsg, '✅ Backup completato!', 'success');
    exportBtn.textContent = '📥 Esporta Dati';
  } catch (error) {
    console.error('❌ Errore export:', error);
    showStatusMessage(statusMsg, `❌ Errore: ${error.message}`, 'error');
    exportBtn.textContent = '📥 Esporta Dati';
  } finally {
    exportBtn.disabled = false;
  }
}

/**
 * Gestisce import backup
 */
async function handleImport(container, file) {
  const statusMsg = container.querySelector('#backupStatusMsg');

  try {
    showStatusMessage(statusMsg, '⏳ Validazione file...', 'info');

    // Leggi il file
    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });

    // Valida JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error('File JSON non valido');
    }

    // Valida struttura
    const validation = backup.validateExportData(data);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Mostra conferma
    const confirmed = await showConfirmDialog(
      '⚠️ Attenzione',
      `Questa operazione sovrascriverà i tuoi dati attuali con quelli dal backup (${new Date(data.exportedAt).toLocaleDateString()}).\n\nSei sicuro di voler continuare?`
    );

    if (!confirmed) {
      showStatusMessage(statusMsg, 'Import annullato', 'info');
      return;
    }

    showStatusMessage(statusMsg, '⏳ Import in corso...', 'info');

    // Import con modalità replace (atomico)
    await backup.importAllUserData(data, 'replace');

    showStatusMessage(
      statusMsg,
      '✅ Import completato! Ricarica la pagina per vedere i dati aggiornati.',
      'success'
    );

    // Offrì di ricaricare dopo 3 secondi
    setTimeout(async () => {
      const reloadConfirmed = await showConfirm('Ricaricare la pagina ora per vedere i dati importati?', { confirmLabel: 'Ricarica' });
      if (reloadConfirmed) {
        location.reload();
      }
    }, 2000);
  } catch (error) {
    console.error('❌ Errore import:', error);
    showStatusMessage(statusMsg, `❌ Errore: ${error.message}`, 'error');
  }
}

/**
 * Mostra messaggio di status
 */
function showStatusMessage(element, message, type = 'info') {
  const colorMap = {
    success: '#34D399',
    error: '#EF4444',
    info: '#60A5FA',
    warning: '#F59E0B'
  };

  element.style.display = 'block';
  element.style.background = colorMap[type] + '20';
  element.style.borderLeft = `4px solid ${colorMap[type]}`;
  element.style.color = 'var(--color-text)';
  element.textContent = message;
}

/**
 * Mostra dialog di conferma
 */
async function bindActivityPreferences(container) {
  const { loadActivityPreferences, saveActivityPreferences } = await import('../storage.js');
  const prefs = await loadActivityPreferences() || getDefaultActivityPrefs();

  // Energy model radios
  const energyModelRadios = container.querySelectorAll('input[name="energyModel"]');
  const activityFactorSection = container.querySelector('#activityFactorSection');
  const activityFactor = container.querySelector('#activityFactor');
  const activityFactorValue = container.querySelector('#activityFactorValue');

  energyModelRadios.forEach(radio => {
    radio.checked = radio.value === prefs.energyModel;
    radio.addEventListener('change', async (e) => {
      prefs.energyModel = e.target.value;
      activityFactorSection.style.display = prefs.energyModel === 'tdee_with_factor' ? 'block' : 'none';
      await saveActivityPreferences(prefs);
    });
  });

  // Activity factor slider
  if (activityFactor) {
    activityFactor.value = prefs.activityFactor || 1.375;
    activityFactor.addEventListener('change', async (e) => {
      prefs.activityFactor = parseFloat(e.target.value);
      activityFactorValue.textContent = prefs.activityFactor.toFixed(3);
      await saveActivityPreferences(prefs);
    });
    activityFactorValue.textContent = (prefs.activityFactor || 1.375).toFixed(3);
    activityFactorSection.style.display = prefs.energyModel === 'tdee_with_factor' ? 'block' : 'none';
  }

  // Double counting prevention
  const avoidDoubleCountingWalking = container.querySelector('#avoidDoubleCountingWalking');
  if (avoidDoubleCountingWalking) {
    avoidDoubleCountingWalking.checked = prefs.avoidDoubleCountingWalking !== false;
    avoidDoubleCountingWalking.addEventListener('change', async (e) => {
      prefs.avoidDoubleCountingWalking = e.target.checked;
      await saveActivityPreferences(prefs);
    });
  }

  // Include steps in TDEE
  const includeStepsInTdee = container.querySelector('#includeStepsInTdee');
  if (includeStepsInTdee) {
    includeStepsInTdee.checked = prefs.includeStepsInTdee !== false;
    includeStepsInTdee.addEventListener('change', async (e) => {
      prefs.includeStepsInTdee = e.target.checked;
      await saveActivityPreferences(prefs);
    });
  }

  // Step goal slider
  const stepGoalSlider = container.querySelector('#stepGoal');
  const stepGoalValue = container.querySelector('#stepGoalValue');
  if (stepGoalSlider) {
    stepGoalSlider.value = prefs.stepGoal || 10000;
    stepGoalSlider.addEventListener('change', async (e) => {
      prefs.stepGoal = parseInt(e.target.value);
      stepGoalValue.textContent = prefs.stepGoal.toLocaleString('it-IT');
      await saveActivityPreferences(prefs);
    });
    stepGoalValue.textContent = (prefs.stepGoal || 10000).toLocaleString('it-IT');
  }

  // Eat back mode radios
  const eatBackModeRadios = container.querySelectorAll('input[name="eatBackMode"]');
  const eatBackRatioSection = container.querySelector('#eatBackRatioSection');
  const eatBackRatioSlider = container.querySelector('#eatBackRatio');
  const eatBackRatioValue = container.querySelector('#eatBackRatioValue');

  eatBackModeRadios.forEach(radio => {
    radio.checked = radio.value === prefs.eatBackMode;
    radio.addEventListener('change', async (e) => {
      prefs.eatBackMode = e.target.value;
      eatBackRatioSection.style.display = prefs.eatBackMode === 'partial' ? 'block' : 'none';
      await saveActivityPreferences(prefs);
    });
  });

  // Eat back ratio slider
  if (eatBackRatioSlider) {
    eatBackRatioSlider.value = (prefs.eatBackRatio || 0.3);
    eatBackRatioSlider.addEventListener('change', async (e) => {
      prefs.eatBackRatio = parseFloat(e.target.value);
      eatBackRatioValue.textContent = Math.round(prefs.eatBackRatio * 100) + '%';
      await saveActivityPreferences(prefs);
    });
    eatBackRatioValue.textContent = Math.round((prefs.eatBackRatio || 0.3) * 100) + '%';
    eatBackRatioSection.style.display = prefs.eatBackMode === 'partial' ? 'block' : 'none';
  }
}

function getDefaultActivityPrefs() {
  return {
    energyModel: 'tdee_plus_extras',
    activityFactor: 1.375,
    avoidDoubleCountingWalking: true,
    eatBackMode: 'partial',
    eatBackRatio: 0.3,
    includeStepsInTdee: true,
    stepGoal: 10000,
    includeStrengthInExpenditure: true,
    includeCardioInExpenditure: true
  };
}

function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    // Crea un modal semplice
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 2rem;
      border-radius: 12px;
      max-width: 400px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      color: var(--color-text);
    `;

    content.innerHTML = `
      <h3 style="margin-top: 0; margin-bottom: 1rem;">${title}</h3>
      <p style="margin-bottom: 2rem; white-space: pre-wrap;">${message}</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <button id="confirmNo" class="button-secondary" style="width: 100%;">Annulla</button>
        <button id="confirmYes" class="button-primary" style="width: 100%;">Continua</button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    content.querySelector('#confirmNo').addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });

    content.querySelector('#confirmYes').addEventListener('click', () => {
      modal.remove();
      resolve(true);
    });
  });
}
