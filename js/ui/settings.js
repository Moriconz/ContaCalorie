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
import * as db from '../../db/indexedDbClient.js';

export function renderSettings() {
  return `
    <div class="settings-container" style="padding: 1rem; max-width: 600px; margin: 0 auto;">
      <h2>⚙️ Impostazioni</h2>

      <!-- SEZIONE TEMA -->
      <div class="settings-section" style="margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--color-border);">
        <h3 style="margin-bottom: 1rem;">🎨 Tema</h3>
        <div style="display: flex; gap: 1rem; align-items: center;">
          <button id="themeToggleBtn" class="button-secondary" style="flex: 1;">
            Cambia a <span id="themeLabel">Modalità Scura</span>
          </button>
          <span style="font-size: 0.9rem; color: var(--color-text-secondary);">
            Attuale: <strong id="currentTheme">Chiaro</strong>
          </span>
        </div>
      </div>

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

      <!-- SEZIONE INFORMAZIONI -->
      <div class="settings-section" style="padding-bottom: 1.5rem;">
        <h3 style="margin-bottom: 1rem;">ℹ️ Informazioni</h3>
        <div style="font-size: 0.9rem; color: var(--color-text-secondary); line-height: 1.6;">
          <p style="margin: 0.5rem 0;">
            📦 <strong>App Version:</strong> 0.1.0 (Beta)
          </p>
          <p style="margin: 0.5rem 0;">
            🗄️ <strong>Database:</strong> IndexedDB v3 (conta-calorie-db)
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

  // Theme toggle
  const themeToggleBtn = container.querySelector('#themeToggleBtn');
  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeLabel(container);
  });

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

  // Debug buttons
  const logDbStatsBtn = container.querySelector('#logDbStatsBtn');
  logDbStatsBtn?.addEventListener('click', async () => {
    const output = container.querySelector('#debugOutput');
    output.style.display = 'block';
    output.textContent = 'Caricando...\n';
    await db.logDbStats();
    const stats = await db.getDbStats();
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
}

/**
 * Aggiorna info profilo
 */
async function updateProfileInfo(container) {
  try {
    const profile = await db.getUserProfile();
    const infoDiv = container.querySelector('#profileInfo');

    if (profile && profile.nome) {
      infoDiv.innerHTML = `
        <p style="margin: 0.5rem 0;">👤 <strong>${profile.nome}</strong></p>
        <p style="margin: 0.5rem 0;">📏 ${profile.altezza || '--'} cm</p>
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
 * Aggiorna label tema
 */
function updateThemeLabel(container) {
  const isDark = document.documentElement.classList.contains('dark');
  const label = container.querySelector('#themeLabel');
  const current = container.querySelector('#currentTheme');

  if (isDark) {
    label.textContent = 'Modalità Chiara';
    current.textContent = 'Scuro';
  } else {
    label.textContent = 'Modalità Scura';
    current.textContent = 'Chiaro';
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
    setTimeout(() => {
      const reloadConfirmed = confirm('Ricaricare la pagina ora?');
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
