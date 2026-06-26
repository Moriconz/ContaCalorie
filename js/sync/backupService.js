/**
 * Backup Service — Export/Import dei dati utente (DB reale `ContaCalorieDB` via storage.js).
 *
 * NOTA: in precedenza questo modulo operava su `conta-calorie-db` (indexedDbClient),
 * un database che l'app non popola mai → backup vuoti. Ora usa direttamente storage.js,
 * la stessa fonte dei dati dell'app.
 */

import {
  loadUserProfile, saveUserProfile,
  loadUserFoods, saveUserFoods,
  loadAllMeals, saveMealEntries,
  loadAllCardioSessions, saveCardioSession,
  loadAllStrengthSessions, saveStrengthSession,
  loadDailyWeights, saveDailyWeight,
  loadAllDailySteps, saveDailySteps,
  loadBodyCompBaselines, saveBodyCompBaseline,
  loadRecipes, saveRecipe,
  loadActivityPreferences, saveActivityPreferences,
  loadFridgeItems, saveFridgeItem,
  clearStore
} from '../storage.js';

const EXPORT_VERSION = 2;

/**
 * Esporta tutti i dati utente come oggetto JSON serializzabile.
 */
export async function exportAllUserData() {
  try {
    const [
      userProfile, userFoods, meals, cardioSessions,
      strengthSessions, dailyWeights, dailySteps, bodyCompBaselines,
      recipes, activityPreferences, fridge
    ] = await Promise.all([
      loadUserProfile(),
      loadUserFoods(),
      loadAllMeals(),
      loadAllCardioSessions(),
      loadAllStrengthSessions(),
      loadDailyWeights(),
      loadAllDailySteps(),
      loadBodyCompBaselines(),
      loadRecipes(),
      loadActivityPreferences(),
      loadFridgeItems()
    ]);

    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: '0.2.0',
      userProfile: userProfile || null,
      userFoods: userFoods || [],
      meals: meals || [],
      cardioSessions: cardioSessions || [],
      strengthSessions: strengthSessions || [],
      dailyWeights: dailyWeights || [],
      dailySteps: dailySteps || [],
      bodyCompBaselines: bodyCompBaselines || [],
      recipes: recipes || [],
      activityPreferences: activityPreferences || null,
      fridge: fridge || []
    };
  } catch (error) {
    console.error('❌ Errore export dati:', error);
    throw new Error(`Errore durante export: ${error.message}`);
  }
}

/**
 * Scarica il backup come file JSON nel browser.
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
 * Valida la struttura del file importato. Accetta sia v2 (nuovo) che v1 (vecchio formato).
 */
export function validateExportData(data) {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'File non è un JSON valido' };
  }
  if (!data.version || typeof data.version !== 'number') {
    return { valid: false, error: 'File di backup non valido (manca version)' };
  }
  if (!data.exportedAt) {
    return { valid: false, error: 'File di backup non valido (manca exportedAt)' };
  }
  if (data.userProfile && !data.userProfile.nome) {
    return { valid: false, error: 'Profilo utente incompleto (manca nome)' };
  }
  // I campi array sono opzionali; se presenti devono essere array
  for (const key of ['meals', 'userFoods', 'weightsSessions', 'cardioSessions', 'strengthSessions', 'dailyWeights', 'dailySteps', 'bodyCompBaselines', 'recipes']) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      return { valid: false, error: `Campo "${key}" non è un array valido` };
    }
  }
  return { valid: true };
}

/**
 * Importa i dati nel DB reale.
 * @param {object} data - dati validati
 * @param {string} mode - 'replace' (svuota prima) o 'merge' (upsert)
 */
export async function importAllUserData(data, mode = 'replace') {
  const validation = validateExportData(data);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  console.log(`📥 Inizio import dati (mode: ${mode})`);

  try {
    if (mode === 'replace') {
      await Promise.all([
        clearStore('mealEntries'),
        clearStore('userFoods'),
        clearStore('cardioSessions'),
        clearStore('strengthSessions'),
        clearStore('dailyWeights'),
        clearStore('dailySteps'),
        clearStore('bodyCompBaselines'),
        clearStore('recipes'),
        clearStore('fridge')
      ]);
    }

    if (data.userProfile) await saveUserProfile(data.userProfile);
    if (Array.isArray(data.userFoods) && data.userFoods.length) await saveUserFoods(data.userFoods);
    if (Array.isArray(data.meals) && data.meals.length) await saveMealEntries(data.meals);

    // Back-compat: i vecchi backup avevano "weightsSessions" → ora confluiscono in strengthSessions
    for (const s of data.weightsSessions || []) await saveStrengthSession({ ...s, date: s.date || s.data });
    for (const s of data.cardioSessions || []) await saveCardioSession(s);
    for (const s of data.strengthSessions || []) await saveStrengthSession(s);
    for (const w of data.dailyWeights || []) await saveDailyWeight(w);
    for (const s of data.dailySteps || []) await saveDailySteps(s);
    for (const b of data.bodyCompBaselines || []) await saveBodyCompBaseline(b);
    for (const r of data.recipes || []) await saveRecipe(r);
    for (const f of data.fridge || []) await saveFridgeItem(f);
    if (data.activityPreferences) await saveActivityPreferences(data.activityPreferences);

    console.log(`✅ Import completato (${mode})`);
  } catch (error) {
    console.error('❌ Errore import dati:', error);
    throw new Error(`Errore durante import: ${error.message}`);
  }
}
