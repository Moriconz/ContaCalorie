/**
 * Backup Service — Export/Import di tutti i dati utente
 *
 * Questo modulo fornisce funzioni per esportare e importare
 * TUTTI i dati da IndexedDB in un formato JSON.
 *
 * Casi d'uso:
 * - Backup manuale per l'utente (scarica un file .json)
 * - Sincronizzazione con backend (POST il JSON a server)
 * - Migrazione tra device (importa su nuovo device)
 * - Ripristino dopo errore (importa da backup)
 *
 * STRUTTURA EXPORT:
 * {
 *   version: "1.0",
 *   exportedAt: "2026-05-18T20:00:00Z",
 *   userProfile: { ... },
 *   meals: [ ... ],
 *   workouts: [ ... ],
 *   bodyComp: [ ... ],
 *   settings: { ... },
 *   syncQueue: [ ... ]
 * }
 */

import * as db from '../db/indexedDbClient.js';

/**
 * Esporta TUTTI i dati utente come oggetto JSON
 */
export async function exportAllUserData() {
  console.log('📦 Esportazione dati in corso...');

  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    userProfile: null,
    meals: [],
    workouts: [],
    bodyComp: [],
    settings: {},
    syncQueue: []
  };

  try {
    // Profilo utente
    exportData.userProfile = await db.getUserProfile() || {};

    // Tutti i pasti
    exportData.meals = await db.getAllItems(db.STORES.MEALS);

    // Tutti gli allenamenti
    exportData.workouts = await db.getAllItems(db.STORES.WORKOUTS);

    // Tutta la composizione corporea
    exportData.bodyComp = await db.getAllItems(db.STORES.BODY_COMP);

    // Tutte le impostazioni
    const allSettings = await db.getAllItems(db.STORES.SETTINGS);
    allSettings.forEach(setting => {
      exportData.settings[setting.key] = setting.value;
    });

    // Sync queue (non salvare in backup, ma esportare per riferimento)
    exportData.syncQueue = await db.getAllItems(db.STORES.SYNC_QUEUE);

    console.log('✅ Esportazione completata');
    console.log(`   - Profilo: ${exportData.userProfile ? '1' : '0'} record`);
    console.log(`   - Pasti: ${exportData.meals.length} entry`);
    console.log(`   - Allenamenti: ${exportData.workouts.length} entry`);
    console.log(`   - Comp. corporea: ${exportData.bodyComp.length} entry`);
    console.log(`   - Impostazioni: ${Object.keys(exportData.settings).length} key`);

    return exportData;
  } catch (error) {
    console.error('❌ Errore esportazione:', error);
    throw new Error(`Errore esportazione dati: ${error.message}`);
  }
}

/**
 * Esporta come stringa JSON (pronta per download o API)
 */
export async function exportAsJson() {
  const data = await exportAllUserData();
  return JSON.stringify(data, null, 2);
}

/**
 * Scarica i dati come file .json nel browser
 * (richiede interfaccia browser, non disponibile in Node.js)
 */
export async function downloadBackupFile() {
  const jsonString = await exportAsJson();
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `conta-calorie-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log('📥 Backup scaricato');
}

/**
 * Importa dati da un oggetto esportato
 *
 * MODALITÀ:
 * - "merge": unisce con dati esistenti (default, non perde dati)
 * - "replace": sostituisce completamente (ATTENZIONE: cancella dati locali)
 */
export async function importAllUserData(exportData, mode = 'merge') {
  console.log(`📤 Importazione dati (mode: ${mode})...`);

  if (!exportData || typeof exportData !== 'object') {
    throw new Error('Dati di importazione non validi');
  }

  try {
    // Se modalità "replace", cancella tutto prima
    if (mode === 'replace') {
      console.log('   ⚠️ Cancellazione dati locali (modalità replace)');
      await db.clearStore(db.STORES.MEALS);
      await db.clearStore(db.STORES.WORKOUTS);
      await db.clearStore(db.STORES.BODY_COMP);
      await db.clearStore(db.STORES.SETTINGS);
      // NON cancellare userProfile, importeremo i nuovi dati
    }

    // Importa profilo
    if (exportData.userProfile) {
      await db.saveUserProfile(exportData.userProfile);
      console.log('   ✓ Profilo importato');
    }

    // Importa pasti
    if (exportData.meals && Array.isArray(exportData.meals)) {
      for (const meal of exportData.meals) {
        await db.putItem(db.STORES.MEALS, meal);
      }
      console.log(`   ✓ ${exportData.meals.length} pasti importati`);
    }

    // Importa allenamenti
    if (exportData.workouts && Array.isArray(exportData.workouts)) {
      for (const workout of exportData.workouts) {
        await db.putItem(db.STORES.WORKOUTS, workout);
      }
      console.log(`   ✓ ${exportData.workouts.length} allenamenti importati`);
    }

    // Importa composizione corporea
    if (exportData.bodyComp && Array.isArray(exportData.bodyComp)) {
      for (const record of exportData.bodyComp) {
        await db.putItem(db.STORES.BODY_COMP, record);
      }
      console.log(`   ✓ ${exportData.bodyComp.length} record comp. corporea importati`);
    }

    // Importa impostazioni
    if (exportData.settings && typeof exportData.settings === 'object') {
      for (const [key, value] of Object.entries(exportData.settings)) {
        await db.setSetting(key, value);
      }
      console.log(`   ✓ ${Object.keys(exportData.settings).length} impostazioni importate`);
    }

    console.log('✅ Importazione completata');
    return true;
  } catch (error) {
    console.error('❌ Errore importazione:', error);
    throw new Error(`Errore importazione dati: ${error.message}`);
  }
}

/**
 * Importa da una stringa JSON
 */
export async function importFromJson(jsonString, mode = 'merge') {
  try {
    const data = JSON.parse(jsonString);
    return await importAllUserData(data, mode);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('JSON non valido');
    }
    throw error;
  }
}

/**
 * Carica file .json dall'utente e importa
 * (richiede input file HTML)
 */
export async function importFromFile(file, mode = 'merge') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const jsonString = event.target.result;
        await importFromJson(jsonString, mode);
        resolve(true);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Errore lettura file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Valida che un JSON di esportazione abbia la struttura corretta
 */
export function validateExportData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Dati non validi' };
  }

  if (!data.version) {
    return { valid: false, error: 'Versione mancante' };
  }

  if (!data.exportedAt) {
    return { valid: false, error: 'Data export mancante' };
  }

  if (!Array.isArray(data.meals)) {
    return { valid: false, error: 'Campo meals non è un array' };
  }

  return { valid: true, error: null };
}

/**
 * Crea un report di differenze tra export locale e uno importato
 * Utile per mostrare all'utente cosa cambierà
 */
export async function compareBackups(importData) {
  const currentData = await exportAllUserData();

  const report = {
    meals: {
      current: currentData.meals.length,
      imported: (importData.meals || []).length
    },
    workouts: {
      current: currentData.workouts.length,
      imported: (importData.workouts || []).length
    },
    bodyComp: {
      current: currentData.bodyComp.length,
      imported: (importData.bodyComp || []).length
    },
    settings: {
      current: Object.keys(currentData.settings).length,
      imported: Object.keys(importData.settings || {}).length
    }
  };

  return report;
}
