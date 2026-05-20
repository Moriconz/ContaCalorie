/*
  Modulo per import dati passi da file CSV/JSON.
  Supporta: Google Fit, Health Connect, Apple Health, formato generico.
  NON implementa OAuth — usa file import + localStorage preference.
*/

const PROVIDER_PREF_KEY = 'activitySyncProvider';

// Metadata provider per UI
export const PROVIDERS = {
  google_fit: {
    name: 'Google Fit',
    emoji: '📱',
    platform: 'android',
    exportGuide: [
      '1. Apri Google Fit app',
      '2. Vai al tuo profilo (angolo in basso a destra)',
      '3. Tocca Impostazioni',
      '4. Seleziona "Esporta dati" e scegli "Daily activity metrics.csv"',
      '5. Salva il file e importalo qui'
    ],
    csvFormat: 'google_fit'
  },
  health_connect: {
    name: 'Health Connect',
    emoji: '🏥',
    platform: 'android',
    exportGuide: [
      '1. Apri Health Connect (solo Android 14+)',
      '2. Vai a "Dati e privacy"',
      '3. Tocca "Backup dei dati"',
      '4. Seleziona Passi e scarica',
      '5. Importa il file CSV qui'
    ],
    csvFormat: 'health_connect'
  },
  apple_health: {
    name: 'Apple Health',
    emoji: '🍎',
    platform: 'ios',
    exportGuide: [
      '1. Apri app Salute su iPhone',
      '2. Profilo (angolo in basso a destra)',
      '3. "Esporta i tuoi dati di salute"',
      '4. Unzip il file e find "StepCount.csv"',
      '5. Importalo qui'
    ],
    csvFormat: 'apple_health'
  },
  file_import: {
    name: 'File CSV/JSON',
    emoji: '📁',
    platform: 'all',
    exportGuide: [
      'Formato CSV: data,passi,distanza_km',
      'Es: 2026-05-20,10500,7.2',
      '',
      'Formato JSON: [{date,steps,distanceKm}]',
      'Es: [{"date":"2026-05-20","steps":10500,"distanceKm":7.2}]'
    ],
    csvFormat: 'generic'
  }
};

// Provider preference — localStorage
export function getConnectedProvider() {
  return localStorage.getItem(PROVIDER_PREF_KEY) || null;
}

export function setConnectedProvider(providerId) {
  localStorage.setItem(PROVIDER_PREF_KEY, providerId);
}

export function clearConnectedProvider() {
  localStorage.removeItem(PROVIDER_PREF_KEY);
}

// Parse CSV/JSON per formati diversi
export function parseStepsFile(text, format) {
  const records = [];
  const errors = [];

  try {
    if (format === 'google_fit') {
      records.push(...parseGoogleFitCSV(text));
    } else if (format === 'health_connect') {
      records.push(...parseHealthConnectCSV(text));
    } else if (format === 'apple_health') {
      records.push(...parseAppleHealthCSV(text));
    } else {
      // Prova JSON prima, poi CSV generico
      try {
        records.push(...parseJSON(text));
      } catch {
        records.push(...parseGenericCSV(text));
      }
    }
  } catch (err) {
    errors.push(err.message);
  }

  return { records, errors };
}

// === PARSER SPECIFICI ===

function parseGoogleFitCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('Google Fit CSV vuoto o malformato');

  const records = [];
  const headers = lines[0].toLowerCase().split(',');
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const stepsIdx = headers.findIndex(h => h.includes('step'));
  const distIdx = headers.findIndex(h => h.includes('distance'));

  if (dateIdx === -1 || stepsIdx === -1) {
    throw new Error('Google Fit CSV: non trovati colonne Date e Step count');
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');

    const date = cols[dateIdx]?.trim();
    const steps = parseInt(cols[stepsIdx]?.trim()) || 0;
    const distanceM = parseInt(cols[distIdx]?.trim()) || 0;

    if (date && isValidDate(date)) {
      records.push({
        date: normalizeDate(date),
        steps: Math.max(0, steps),
        distanceKm: distanceM > 0 ? (distanceM / 1000).toFixed(2) : undefined,
        source: 'google_fit'
      });
    }
  }

  return records;
}

function parseHealthConnectCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('Health Connect CSV vuoto o malformato');

  const records = [];
  const headers = lines[0].toLowerCase().split(',');
  const startIdx = headers.findIndex(h => h.includes('start'));
  const stepsIdx = headers.findIndex(h => h.includes('step') || h.includes('value'));
  const distIdx = headers.findIndex(h => h.includes('distance'));

  if (startIdx === -1 || stepsIdx === -1) {
    throw new Error('Health Connect CSV: non trovati colonne Start time e Steps');
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');

    const startTime = cols[startIdx]?.trim();
    const date = startTime ? startTime.split('T')[0] : '';
    const steps = parseInt(cols[stepsIdx]?.trim()) || 0;
    const distance = cols[distIdx]?.trim() || '';

    if (date && isValidDate(date)) {
      records.push({
        date: normalizeDate(date),
        steps: Math.max(0, steps),
        distanceKm: distance ? parseFloat(distance) : undefined,
        source: 'health_connect'
      });
    }
  }

  return records;
}

function parseAppleHealthCSV(text) {
  // Apple Health CSV: Date,Value per tipo StepCount
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('Apple Health CSV vuoto o malformato');

  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [date, value] = line.split(',');

    if (date && isValidDate(date)) {
      const steps = parseInt(value) || 0;
      if (steps > 0) {
        records.push({
          date: normalizeDate(date),
          steps,
          source: 'apple_health'
        });
      }
    }
  }

  return records;
}

function parseGenericCSV(text) {
  // CSV generico: data,passi,distanza_km
  const lines = text.trim().split('\n');
  const records = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',').map(p => p.trim());
    const [date, stepsStr, distStr] = parts;

    if (isValidDate(date)) {
      const steps = parseInt(stepsStr) || 0;
      if (steps >= 0) {
        records.push({
          date: normalizeDate(date),
          steps,
          distanceKm: distStr ? parseFloat(distStr) : undefined,
          source: 'imported_file'
        });
      }
    }
  }

  return records;
}

function parseJSON(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('JSON non è un array');

  const records = [];
  for (const item of data) {
    if (item.date && isValidDate(item.date)) {
      const steps = parseInt(item.steps) || 0;
      if (steps >= 0) {
        records.push({
          date: normalizeDate(item.date),
          steps,
          distanceKm: item.distanceKm ? parseFloat(item.distanceKm) : undefined,
          activeMinutes: item.activeMinutes,
          source: 'imported_file'
        });
      }
    }
  }

  return records;
}

// === HELPER FUNZIONI ===

function isValidDate(dateStr) {
  // Accetta YYYY-MM-DD oppure ISO string
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function normalizeDate(dateStr) {
  // Ritorna YYYY-MM-DD
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

// === IMPORT PRINCIPALE ===

export async function importStepsFromFile(file, format, saveStepsFn) {
  const text = await file.text();
  const { records, errors } = parseStepsFile(text, format);

  if (errors.length > 0) {
    return { imported: 0, skipped: 0, errors };
  }

  let imported = 0;
  let skipped = 0;
  const importErrors = [];

  for (const record of records) {
    try {
      if (!record.date || record.steps < 0) {
        skipped++;
        continue;
      }
      await saveStepsFn(record);
      imported++;
    } catch (err) {
      skipped++;
      importErrors.push(`${record.date}: ${err.message}`);
    }
  }

  return { imported, skipped, errors: importErrors };
}

// Detect piattaforma (semplice UA check)
export function detectAvailablePlatforms() {
  const ua = navigator.userAgent.toLowerCase();
  const platforms = [];

  if (ua.includes('android')) platforms.push('android');
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('macos')) platforms.push('ios');

  // File import è sempre disponibile
  platforms.push('all');

  return platforms;
}

// Filter provider per platform disponibili
export function getAvailableProviders() {
  const available = detectAvailablePlatforms();
  return Object.entries(PROVIDERS)
    .filter(([id, p]) => p.platform === 'all' || available.includes(p.platform))
    .map(([id, p]) => ({ id, ...p }));
}
