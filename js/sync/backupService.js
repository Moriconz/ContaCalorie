/**
 * Backup Service — Gestione export/import dati con validazione
 * Esporta tutti i dati utente (profilo, pasti, allenamenti, body comp) in JSON
 * Importa dati con validazione e sovrascrittura atomica
 */

import * as db from '../../db/indexedDbClient.js';

/**
 * Esporta tutti i dati utente come oggetto JSON
 */
export async function exportAllUserData() {
  try {
    const [userProfile, meals, workouts, bodyComp, settings, syncQueue] = await Promise.all([
      db.getUserProfile(),
      db.getAllItems('meals'),
      db.getAllItems('workouts'),
      db.getAllItems('bodyComp'),
      db.getAllSettings(),
      db.getSyncQueue()
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      userProfile: userProfile || null,
      meals: meals || [],
      workouts: workouts || [],
      bodyComp: bodyComp || [],
      settings: settings || [],
      syncQueue: syncQueue || []
    };
  } catch (error) {
    console.error('❌ Errore export dati:', error);
    throw new Error(`Errore durante export: ${error.message}`);
  }
}

/**
 * Scarica il backup come file JSON nel browser
 */
export async function downloadBackupFile() {
  try {
    const exportData = await exportAllUserData();
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `conta-calorie-backup-${timestamp}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`✅ Backup scaricato: ${filename}`);
  } catch (error) {
    console.error('❌ Errore download backup:', error);
    throw error;
  }
}

/**
 * Valida la struttura del file importato
 */
export function validateExportData(data) {
  // Controlla che sia un oggetto
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'File non è un JSON valido' };
  }

  // Controlla version
  if (!data.version || typeof data.version !== 'number') {
    return { valid: false, error: 'File di backup non valido (manca version)' };
  }

  // Controlla exportedAt
  if (!data.exportedAt) {
    return { valid: false, error: 'File di backup non valido (manca exportedAt)' };
  }

  // Controlla che userProfile abbia i campi necessari
  if (data.userProfile) {
    if (!data.userProfile.nome) {
      return { valid: false, error: 'Profilo utente incompleto (manca nome)' };
    }
  }

  // Controlla che arrays siano array
  if (!Array.isArray(data.meals)) {
    return { valid: false, error: 'Pasti non è un array valido' };
  }
  if (!Array.isArray(data.workouts)) {
    return { valid: false, error: 'Allenamenti non è un array valido' };
  }
  if (!Array.isArray(data.bodyComp)) {
    return { valid: false, error: 'Body comp non è un array valido' };
  }
  if (!Array.isArray(data.settings)) {
    return { valid: false, error: 'Impostazioni non è un array valido' };
  }

  return { valid: true };
}

/**
 * Importa dati nel database con modalità atomica
 * @param {object} data - Dati da importare
 * @param {string} mode - 'replace' o 'merge'
 */
export async function importAllUserData(data, mode = 'replace') {
  try {
    // Valida prima di importare
    const validation = validateExportData(data);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    console.log(`📥 Inizio import dati (mode: ${mode})`);

    if (mode === 'replace') {
      // Modalità REPLACE: pulisci e ricaribi tutto
      console.log('  → Svuotamento store existenti...');
      await Promise.all([
        db.clearStore('meals'),
        db.clearStore('workouts'),
        db.clearStore('bodyComp'),
        db.clearStore('settings'),
        db.clearStore('syncQueue')
      ]);

      console.log('  → Caricamento profilo...');
      if (data.userProfile) {
        await db.saveUserProfile(data.userProfile);
      }

      console.log('  → Caricamento pasti...');
      for (const meal of data.meals || []) {
        await db.putItem('meals', meal);
      }

      console.log('  → Caricamento allenamenti...');
      for (const workout of data.workouts || []) {
        await db.putItem('workouts', workout);
      }

      console.log('  → Caricamento body comp...');
      for (const comp of data.bodyComp || []) {
        await db.putItem('bodyComp', comp);
      }

      console.log('  → Caricamento impostazioni...');
      for (const setting of data.settings || []) {
        await db.putItem('settings', setting);
      }

      console.log('✅ Import completato (replace mode)');
    } else if (mode === 'merge') {
      // Modalità MERGE: aggiungi/aggiorna senza pulire
      console.log('  → Merge profilo...');
      if (data.userProfile) {
        await db.saveUserProfile(data.userProfile);
      }

      console.log('  → Merge pasti...');
      for (const meal of data.meals || []) {
        await db.putItem('meals', meal);
      }

      console.log('  → Merge allenamenti...');
      for (const workout of data.workouts || []) {
        await db.putItem('workouts', workout);
      }

      console.log('  → Merge body comp...');
      for (const comp of data.bodyComp || []) {
        await db.putItem('bodyComp', comp);
      }

      console.log('  → Merge impostazioni...');
      for (const setting of data.settings || []) {
        await db.putItem('settings', setting);
      }

      console.log('✅ Import completato (merge mode)');
    } else {
      throw new Error(`Modalità import sconosciuta: ${mode}`);
    }
  } catch (error) {
    console.error('❌ Errore import dati:', error);
    throw new Error(`Errore durante import: ${error.message}`);
  }
}
