# Quick Start — Persistenza PWA

## 🚀 Come Usare IndexedDB

### Salvare un Pasto
```javascript
import * as db from './db/indexedDbClient.js';

const meal = {
  id: 'meal-' + Date.now(),
  date: '2026-05-18',
  nome: 'Pasta alla carbonara',
  kcal: 450,
  proteine: 20,
  // ... altre proprietà
};

await db.putItem(db.STORES.MEALS, meal);
console.log('✅ Pasto salvato');
```

### Recuperare Pasti di un Giorno
```javascript
const meals = await db.getMealsByDate('2026-05-18');
console.log(`${meals.length} pasti oggi`);
meals.forEach(m => console.log(`  - ${m.nome}: ${m.kcal} kcal`));
```

### Salvare Profilo Utente
```javascript
const profile = {
  nome: 'Mario',
  pesoKg: 75,
  altezza: 180,
  // ... altre proprietà
};

await db.saveUserProfile(profile);
```

### Recuperare Profilo
```javascript
const profile = await db.getUserProfile();
console.log(`${profile.nome} pesa ${profile.pesoKg} kg`);
```

### Salvare Setting
```javascript
// Tema
await db.setSetting('theme', 'dark');

// Unità di misura
await db.setSetting('unit', 'metric');

// Macro target
await db.setSetting('macroTarget', JSON.stringify({
  proteine: 150,
  carbs: 200,
  fats: 70
}));
```

### Recuperare Setting
```javascript
const theme = await db.getSetting('theme');
console.log('Tema attuale:', theme);
```

### Salvare Allenamento
```javascript
const workout = {
  id: 'workout-' + Date.now(),
  date: '2026-05-18',
  tipo: 'pesistica',
  esercizio: 'Panca',
  peso: 80,
  ripetizioni: 8
};

await db.saveWorkout(workout);
```

### Ottenere Allenamenti di un Giorno
```javascript
const workouts = await db.getWorkoutsByDate('2026-05-18');
console.log(`${workouts.length} allenamenti oggi`);
```

### Salvare Composizione Corporea
```javascript
const bodyCompData = {
  id: 'bodycomp-' + Date.now(),
  date: '2026-05-18',
  bf_percent: 18.5,
  peso: 75,
  metodo: 'DEXA'
};

await db.saveBodyCompData(bodyCompData);
```

---

## 💾 Come Fare Backup

### Download Manuale (nel Browser)
```javascript
import * as backup from './sync/backupService.js';

// Pulsante "Scarica Backup"
async function downloadBackup() {
  await backup.downloadBackupFile();
  // → scarica conta-calorie-backup-2026-05-18.json
}
```

### Esportare come JSON (per API)
```javascript
const jsonString = await backup.exportAsJson();

// Invia a server
const response = await fetch('/api/backup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: jsonString
});

if (response.ok) {
  console.log('✅ Backup caricato sul server');
}
```

### Importare da File HTML5
```html
<input id="backupInput" type="file" accept=".json">
<button id="importBtn">Importa Backup</button>
```

```javascript
import * as backup from './sync/backupService.js';

document.getElementById('importBtn').addEventListener('click', async () => {
  const file = document.getElementById('backupInput').files[0];
  if (!file) {
    alert('Seleziona un file');
    return;
  }

  try {
    // Modalità merge (non cancella dati locali)
    await backup.importFromFile(file, 'merge');
    alert('✅ Backup importato');
  } catch (error) {
    alert('❌ Errore: ' + error.message);
  }
});
```

### Importare da Stringa JSON
```javascript
const jsonString = localStorage.getItem('lastBackup');
await backup.importFromJson(jsonString, 'merge');
```

---

## 🔍 Debugging

### Vedere Tutti i Dati Salvati
```javascript
import * as db from './db/indexedDbClient.js';

await db.logDbStats();
// Output:
// 📊 IndexedDB Statistics: { meals: 45, workouts: 12, ... }
// Total items: 89
```

### Vedere Storage Info
```javascript
import { logStorageInfo } from './storage/persistence.js';

await logStorageInfo();
// Output:
// 📦 Storage Info:
//    Persistent: YES
//    Usage: 2 MB / 1024 MB
//    % Used: 0%
```

### Vedere Bootstrap State
```javascript
import { logBootstrapState } from './js/appBootstrap.js';

logBootstrapState();
// Output:
// 📊 Bootstrap State: {
//   dbReady: true,
//   swRegistered: true,
//   persistenceGranted: false,
//   error: null
// }
```

### Aprire DevTools in Chrome/Edge
1. Premi **F12**
2. Vai a **Application** tab
3. **Storage** → **Indexed DB** → **conta-calorie-db**
4. Vedi tutti gli object store e i dati

### Aprire DevTools in Firefox
1. Premi **F12**
2. Vai a **Storage** tab
3. **Indexed DB** → espandi
4. Vedi tutti i database

---

## ⚠️ Situazioni Comuni

### L'app non mostra i dati dopo aggiornamento

**Causa:** Probabile carica cache/stale

**Soluzione:**
1. Hard refresh: **Ctrl+Shift+R** (Windows) o **Cmd+Shift+R** (Mac)
2. Svuota cache: **DevTools → Application → Clear Storage → Clear site data**

### IndexedDB è pieno

**Causa:** Troppi dati accumulati

**Soluzione:**
1. Esporta backup: `await backup.downloadBackupFile()`
2. Cancella dati vecchi (es. pasti di 1 anno fa)
3. Monitor quota: `await getStorageInfo()`

### Service Worker non si aggiorna

**Causa:** Cache vecchia ancora attiva

**Soluzione:**
1. Vai a **DevTools → Application → Service Workers**
2. Clicca **Unregister**
3. Ricarica pagina
4. Dovrebbe registrare il nuovo SW

### Dati non sincronizzano con backend

**Causa:** Backend sync non ancora implementato

**Soluzione:**
1. Usa `syncQueue` store per queueing azioni
2. Implementa endpoint `/api/sync`
3. Processa queue quando online

---

## 🎯 Casi d'Uso Specifici

### Per il Modulo Pasti

```javascript
// Carica pasti di oggi
const meals = await db.getMealsByDate(currentDate);

// Aggiungi un nuovo pasto
const newMeal = { /* ... */ };
await db.putItem(db.STORES.MEALS, newMeal);

// Aggiorna un pasto
const meal = await db.getItem(db.STORES.MEALS, mealId);
meal.kcal = 500; // modifica
await db.putItem(db.STORES.MEALS, meal);

// Cancella un pasto
await db.deleteItem(db.STORES.MEALS, mealId);
```

### Per il Modulo Allenamenti

```javascript
// Salva allenamento
const workout = { /* ... */ };
await db.saveWorkout(workout);

// Carica allenamenti di una data
const workouts = await db.getWorkoutsByDate(date);

// Cancella allenamento
await db.deleteItem(db.STORES.WORKOUTS, workoutId);
```

### Per il Modulo Body Comp

```javascript
// Salva baseline
const baseline = {
  id: 'baseline-' + Date.now(),
  date: '2026-05-18',
  bf_percent: 18.5,
  peso: 75
};
await db.saveBodyCompData(baseline);

// Carica tutte le misurazioni
const data = await db.getBodyCompData();
```

---

## 📋 API Reference Rapida

### Operazioni Generiche
```javascript
await db.getItem(store, key)           // Ottieni singolo
await db.putItem(store, value)         // Salva/aggiorna
await db.deleteItem(store, key)        // Cancella
await db.getAllItems(store)            // Ottieni tutti
await db.clearStore(store)             // Svuota store
```

### Helper Meals
```javascript
await db.getMealsByDate(date)          // Pasti per data
await db.saveMeals(date, entries)      // Salva lista pasti
```

### Helper Workouts
```javascript
await db.getWorkoutsByDate(date)       // Allenamenti per data
await db.saveWorkout(workout)          // Salva allenamento
```

### Helper Settings
```javascript
await db.getSetting(key)               // Leggi impostazione
await db.setSetting(key, value)        // Scrivi impostazione
await db.getAllSettings()              // Leggi tutte
```

### Helper Backup
```javascript
await backup.exportAllUserData()       // Esporta come oggetto
await backup.exportAsJson()            // Esporta come stringa
await backup.downloadBackupFile()      // Scarica .json file
await backup.importAllUserData(data)   // Importa da oggetto
await backup.importFromJson(string)    // Importa da stringa
await backup.importFromFile(file)      // Importa da file
await backup.validateExportData(data)  // Valida struttura
await backup.compareBackups(data)      // Confronta backup
```

---

## ✨ Tips & Tricks

### Bulk Insert Veloce
```javascript
// Lento: insert uno per uno
meals.forEach(m => await db.putItem(db.STORES.MEALS, m));

// Veloce: usare transazione
const tx = db.transaction([db.STORES.MEALS], 'readwrite');
meals.forEach(m => tx.objectStore(db.STORES.MEALS).put(m));
await tx.complete;
```

### Cercare per Intervallo di Date
```javascript
// Se usi indice "date"
const db = getDb();
const tx = db.transaction([db.STORES.MEALS], 'readonly');
const index = tx.objectStore(db.STORES.MEALS).index('date');
const range = IDBKeyRange.bound('2026-05-01', '2026-05-31');
const meals = await index.getAll(range);
```

### Monitorare Cambimenti IndexedDB
```javascript
// Ascolta version change (da altra tab)
_db.addEventListener('versionchange', () => {
  console.warn('Schema aggiornato in un\'altra tab, ricarica consigliata');
});
```

---

## 🆘 Troubleshooting

| Problema | Causa | Soluzione |
|----------|-------|----------|
| IndexedDB non inizializza | Browser non supporta IndexedDB | Usa browser moderno |
| Dati non persistono | Cache non aggiornata | Hard refresh (Ctrl+Shift+R) |
| SW non si aggiorna | SW vecchio ancora attivo | Unregister in DevTools |
| Quota piena | Troppi dati accumulati | Esporta backup, cancella vecchi |
| Errore "NotAllowedError" | Private/Incognito mode | Usa mode normale |
| Import fallisce | JSON non valido | Valida con `validateExportData()` |
| Persistenza non concessa | Policy del browser | Non critico, IndexedDB funziona lo stesso |

---

## 📞 Contatti e Support

Per problemi o domande:
1. Consulta **PERSISTENCE_GUIDE.md** per documentazione completa
2. Guarda **PERSISTENCE_IMPLEMENTATION_SUMMARY.md** per architettura
3. Apri DevTools e verifica IndexedDB
4. Usa `logBootstrapState()` e `logDbStats()` per debugging

---

**Versione**: 1.0  
**Ultimo aggiornamento**: 2026-05-18
