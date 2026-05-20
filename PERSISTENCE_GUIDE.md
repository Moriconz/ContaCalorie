# Guida Persistenza Dati PWA — Conta Calorie

## 🎯 Panoramica

Questa PWA implementa un sistema di persistenza **local-first** con IndexedDB che sopravvive a:
- ✅ Aggiornamenti del codice (nuovi deploy su Vercel)
- ✅ Aggiornamenti del service worker
- ✅ Chiusure e riaperture dell'app (giorni/settimane dopo)

I dati utente vengono persi SOLO se:
- ❌ L'utente disinstalla esplicitamente la PWA
- ❌ L'utente cancella i dati del sito dalle impostazioni del browser

---

## 📁 Architettura

### 1. **IndexedDB Client** (`db/indexedDbClient.js`)

Astrazione completa su IndexedDB con migrazioni di schema sicure.

**Struttura Database:**
```
Database: "conta-calorie-db" (versione 3)

Object Stores:
├── userProfile (keyPath: "id")
│   └── Dati profilo utente, preferenze personali
├── meals (keyPath: "id", indice: "date")
│   └── Log giornaliero pasti e alimenti
├── workouts (keyPath: "id", indice: "date")
│   └── Allenamenti (pesi, cardio)
├── bodyComp (keyPath: "id", indice: "date")
│   └── Composizione corporea, baselines
├── settings (keyPath: "key")
│   └── Preferenze app (tema, unità, ecc.)
└── syncQueue (keyPath: "id", autoIncrement)
    └── Coda per future sincronizzazioni con backend
```

**API Principale:**
```javascript
// Inizializzazione
await initDb() // Deve essere chiamato una sola volta all'avvio

// Operazioni generiche
await getItem(storeName, key)
await putItem(storeName, value)
await deleteItem(storeName, key)
await getAllItems(storeName)
await clearStore(storeName)

// Helper specifici
await getMealsByDate(date)        // Pasti per data
await saveMeals(date, entries)
await getWorkoutsByDate(date)
await saveWorkout(workout)
await getBodyCompData()
await saveBodyCompData(data)
await getUserProfile()
await saveUserProfile(profile)
await getSetting(key) / setSetting(key, value)
```

**Migrazioni di Schema:**

- **Version 1 (baseline)**: Store di base (userProfile, meals, workouts, bodyComp, settings)
- **Version 2**: Aggiunta store `syncQueue` per futuri backend sync
- **Version 3**: Aggiunta indici su "date" per query efficienti

Ogni upgrade è gestito come MIGRAZIONE (non reset). I dati esistenti NON vengono mai persi.

---

### 2. **Persistent Storage API** (`storage/persistence.js`)

Richiede al browser di NON svuotare IndexedDB in caso di memoria bassa.

**Funzioni:**
```javascript
// Richiedi persistenza (chiamare UNA SOLA VOLTA all'avvio)
const granted = await ensurePersistentStorage()
// → Logga se granted, ma non è critico se false

// Controlla stato attuale
const isPersistent = await isPersistentStorageGranted()

// Ottieni quota storage
const info = await getStorageInfo()
// → { quota: bytes, usage: bytes, percentUsed: % }

// Log informazioni
await logStorageInfo()
```

**Supporto Browser:**
- ✅ Chrome 55+, Edge 55+
- ✅ Firefox 57+
- ✅ Android (dipende dal browser)
- ❌ Safari (API non supportata, ma IndexedDB funziona comunque)

**Feature Detection:** Se l'API non esiste, il codice fallisce in modo sicuro (nessun errore).

---

### 3. **Backup & Export/Import** (`sync/backupService.js`)

Esporta/importa TUTTI i dati come JSON per backup manuale e future sincronizzazioni.

**Funzioni:**
```javascript
// Esporta tutto come oggetto
const data = await exportAllUserData()

// Esporta come stringa JSON
const json = await exportAsJson()

// Scarica file .json nel browser
await downloadBackupFile()
// → scarica `conta-calorie-backup-2026-05-18.json`

// Importa da oggetto (merge o replace)
await importAllUserData(data, 'merge')    // Unisce con dati locali
await importAllUserData(data, 'replace')  // Sostituisce tutto

// Importa da stringa JSON
await importFromJson(jsonString, 'merge')

// Importa da file HTML5
await importFromFile(fileElement.files[0], 'merge')

// Valida struttura esportata
const validation = validateExportData(data)
// → { valid: true|false, error: string }

// Confronta backup per vedere differenze
const diff = await compareBackups(importedData)
// → { meals: {current, imported}, workouts: {...}, ... }
```

**Formato Export:**
```json
{
  "version": "1.0",
  "exportedAt": "2026-05-18T20:00:00Z",
  "userProfile": { ... },
  "meals": [ ... ],
  "workouts": [ ... ],
  "bodyComp": [ ... ],
  "settings": { ... },
  "syncQueue": [ ... ]
}
```

---

### 4. **Service Worker** (`sw.js`)

Gestisce cache di asset, NUNCA IndexedDB.

**Principi Critici:**
- 🔒 **NON tocca IndexedDB** — i dati utente rimangono intatti
- 📦 **Cache-first per asset** — HTML, JS, CSS, immagini
- 🔄 **Aggiornamento in background** — scarica nuove risorse silenziosamente
- 📢 **Notifica nuova versione** — mostra banner quando disponibile

**Flusso Update:**
1. **Install**: Scarica nuovi asset nel cache
2. **Activate**: Pulisce SOLO vecchi cache (non IndexedDB)
3. **Fetch**: Usa cache per asset, network per API data

**Comunicazione con App:**
```javascript
// Il SW invia messaggi quando viene aggiornato
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data.type === 'SW_UPDATED') {
      console.log('Nuova versione disponibile:', event.data.message);
      // Mostra banner all'utente
    }
  });
}
```

---

### 5. **App Bootstrap** (`js/appBootstrap.js`)

Orchestrazione dell'avvio della PWA.

**Flusso Bootstrap (nell'ordine):**

1. **Aspetta il DOM** (`waitForDOM()`)
   - Assicura che il HTML sia parsato

2. **Inizializza IndexedDB** (`initializeDatabase()`) — **CRITICO**
   - Crea/aggiorna schema
   - Deve completarsi prima che la UI venga mostrata
   - Se fallisce, mostra errore e blocca l'app

3. **Richiedi Persistent Storage** (`requestPersistentStorage()`) — **Background**
   - Non blocca l'UI
   - Riduce il rischio di perdita dati

4. **Registra Service Worker** (`registerServiceWorker()`) — **Background**
   - Non blocca l'UI
   - Controlla periodicamente (ogni ora) per aggiornamenti

5. **Ascolta messaggi SW** (`listenToServiceWorkerMessages()`)
   - Rileva quando il SW ha aggiornamenti

6. **Mostra UI**
   - Solo dopo che IndexedDB è pronto

**Uso in app.js:**
```javascript
import { bootstrapApp } from './appBootstrap.js';

async function init() {
  const bootstrapOk = await bootstrapApp();
  if (!bootstrapOk) return; // Errore critico

  // Continua con caricamento normale
  attachBottomNav();
  await loadState();
  renderCurrentView();
}

init();
```

---

## 🔄 Ciclo di Vita Completo

### Utente installa la PWA

1. Browser registra service worker
2. App chiama `initDb()` → crea IndexedDB con schema v1
3. App richiede persistenza storage
4. UI appare

### Utente usa l'app

- Tutti i dati (pasti, allenamenti, composizione) vengono salvati in IndexedDB
- Nessun dato viene mandato al server (local-first)
- Funziona completamente offline

### Deploy nuovo codice su Vercel

1. GitHub → Vercel → deploy automatico
2. Service worker scarica nuovo codice in background
3. Vecchio SW viene rimosso, nuovo installato
4. **IndexedDB rimane intatto** ← CRITICO
5. App si aggiorna automaticamente alla prossima visita
6. Utente vede banner "Nuova versione disponibile"
7. Utente clicca "Ricarica" (o ricarica manualmente)
8. Nuova versione si apre con TUTTI i dati preservati

### Upgrade schema (versione DB aumenta)

1. App rileva versione nuova in `indexedDbClient.js`
2. Chiama `onupgradeneeded`
3. Esegue migrazioni (crea nuovi store, indici, etc.)
4. **Dati esistenti non vengono toccati**
5. App continua normalmente

### Utente disinstalla la PWA

- Android/Desktop: Disinstallazione esplicita → elimina tutto
- iOS: Cancella home screen icon (dati rimangono in Safari)
- Browser: Impostazioni → Cancella dati sito → elimina tutto

---

## 💡 Casi d'Uso Comuni

### Salvare un pasto
```javascript
import * as db from './db/indexedDbClient.js';

const meal = {
  id: 'meal-' + Date.now(),
  date: '2026-05-18',
  name: 'Pasta alla carbonara',
  kcal: 450,
  // ...
};

await db.putItem(db.STORES.MEALS, meal);
console.log('✅ Pasto salvato');
```

### Recuperare pasti di un giorno
```javascript
const meals = await db.getMealsByDate('2026-05-18');
console.log('Pasti oggi:', meals.length);
```

### Esportare backup manuale
```javascript
import * as backup from './sync/backupService.js';

// Download nel browser
await backup.downloadBackupFile();

// O ottieni come JSON
const json = await backup.exportAsJson();
// Manda a server, salva su cloud, etc.
```

### Importare da backup
```javascript
// Da file HTML5
const file = document.getElementById('backupInput').files[0];
await backup.importFromFile(file, 'merge');

// O da stringa JSON
const json = localStorage.getItem('lastBackup');
await backup.importFromJson(json, 'replace');
```

---

## ⚠️ Considerazioni Importanti

### 1. **Browser Compatibility**

| Browser | IndexedDB | Service Worker | Persistent | Support |
|---------|-----------|----------------|-----------|---------|
| Chrome  | ✅        | ✅             | ✅        | FULL    |
| Firefox | ✅        | ✅             | ✅        | FULL    |
| Safari  | ✅        | ✅             | ❌        | GOOD    |
| Edge    | ✅        | ✅             | ✅        | FULL    |
| IE 11   | ❌        | ❌             | ❌        | NO      |

App funziona in tutte i browser moderni. IE 11 non è supportato.

### 2. **Quota Storage**

IndexedDB ha quota per origin:
- Desktop: 50 MB - 1 GB (dipende da browser)
- Mobile: 10 - 50 MB

Monitorare con:
```javascript
const info = await getStorageInfo();
console.log(`${info.percentUsed}% storage usato`);
if (info.percentUsed > 90) {
  console.warn('Storage quasi pieno!');
}
```

### 3. **Sicurezza Dati**

- ✅ IndexedDB è per-origin (solo questo sito può leggere)
- ✅ Dati NON vengono mai mandati al server (local-first)
- ⚠️ Se browser hackato, dati IndexedDB possono essere letti
- 🔒 Per backup cloud, criptare prima di mandare

### 4. **Sincronizzazione Futura**

`syncQueue` store è pronto per:
```javascript
// Quando backend API disponibile:
const queue = await db.getAllItems(db.STORES.SYNC_QUEUE);
queue.forEach(async action => {
  const result = await fetch('/api/sync', {
    method: 'POST',
    body: JSON.stringify(action)
  });
  if (result.ok) {
    await db.removeFromSyncQueue(action.id);
  }
});
```

---

## 🐛 Debugging

### Controllare stato bootstrap
```javascript
import { getBootstrapState, logBootstrapState } from './appBootstrap.js';

logBootstrapState();
// Output: { dbReady: true, swRegistered: true, persistenceGranted: false, error: null }
```

### Statistiche IndexedDB
```javascript
import * as db from './db/indexedDbClient.js';

await db.logDbStats();
// Output:
// 📊 IndexedDB Statistics: { meals: 45, workouts: 12, bodyComp: 8, ... }
```

### Statistiche Storage
```javascript
import { logStorageInfo } from './storage/persistence.js';

await logStorageInfo();
// Output:
// 📦 Storage Info:
//    Persistent: YES
//    Usage: 2 MB / 1024 MB
//    % Used: 0%
```

### Aprire DevTools
**Chrome/Edge:**
- F12 → Application → Storage → IndexedDB → conta-calorie-db
- Vedi tutti gli object store e i dati

**Firefox:**
- F12 → Storage → Indexed DB
- Seleziona il database

---

## 📋 Checklist Integrazione

- [x] IndexedDB client creato con schema versioning
- [x] Persistent storage API integrata
- [x] Backup/export/import implementato
- [x] Service worker NON tocca IndexedDB
- [x] App bootstrap orchestrazione
- [x] Integrazione in app.js
- [ ] UI per backup manuale (opzionale)
- [ ] UI per import da file (opzionale)
- [ ] Storage quota monitoring (opzionale)
- [ ] Analytics su sync failures (opzionale)

---

## 🚀 Prossimi Passi

1. **Testare persistenza**: Disinstalla/reinstalla PWA, verifica dati rimangono
2. **Testare aggiornamenti**: Deploy nuovo codice, verifica dati rimangono
3. **Aggiungere UI backup**: Pulsante "Scarica backup" nelle impostazioni
4. **Implementare backend sync**: Quando API disponibile, aggiungere sync nel syncQueue
5. **Cloud backup**: Opzionale: permettere sincronizzazione con Google Drive / OneDrive

---

**Versione**: 1.0  
**Data**: 2026-05-18  
**Status**: ✅ Implementazione completa
