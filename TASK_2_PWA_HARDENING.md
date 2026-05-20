# Task 2 — PWA Persistence Hardening — COMPLETAMENTO

**Status:** ✅ IMPLEMENTAZIONE COMPLETA  
**Date:** 2026-05-20  
**Components:** appBootstrap.js, persistence.js, indexedDbClient.js, sw.js

---

## 📋 Componenti Verificati

### 1. **js/appBootstrap.js** ✅
**Stato:** Corretto, bien strutturato

**Flusso di bootstrap:**
```
1. Aspetta DOM → DOMContentLoaded
2. Inizializza IndexedDB (BLOCKING - critico)
3. Richiede storage persistente (background)
4. Registra service worker (background)
5. Ascolta messaggi SW (background)
```

**Funzioni chiave:**
- `bootstrapApp()` - orchestrazione startup
- `initializeDatabase()` - init IndexedDB bloccante
- `requestPersistentStorage()` - background non-blocking
- `registerServiceWorker()` - registra e ascolta aggiornamenti
- `notifyNewVersionAvailable()` - mostra banner quando nuova versione disponibile
- `getBootstrapState()` - debug state globale

**Update flow:**
- Registra listener per `updatefound` (riga 84-93)
- Controlla aggiornamenti ogni 1 ora (riga 96-98)
- Mostra banner quando `newWorker.state === 'installed'` (riga 88)
- Ascolta messaggi da SW con `message` event (riga 111-116)

### 2. **js/storage/persistence.js** ✅ (CREATO)
**Stato:** Nuovo file, implementa storage persistente

**Funzioni:**
- `ensurePersistentStorage()` - richiede storage permanente
- `getStorageInfo()` - quota, usage, percentuale
- `logStorageInfo()` - log nel console
- `isPersistenceSupported()` - feature detection
- `isEstimateSupported()` - feature detection

**Caratteristiche:**
- Feature detection (navigator.storage.persist)
- Fallback graceful se non supportato
- Ritorna `{quota, usage, percentUsed, persisted}`
- Integrato con appBootstrap.js
- Usato da settings.js per debug info

### 3. **db/indexedDbClient.js** ✅
**Stato:** Migrazioni ben documentate

**Schema versioning:**
- **v1 (baseline):** userProfile, meals, workouts, bodyComp, settings
- **v2:** aggiunta syncQueue
- **v3:** aggiunta indici su date per meals, workouts, bodyComp

**Principi implementati:**
- ✅ Mai droppare dati
- ✅ Migrazioni incrementali (oldVersion < X)
- ✅ Controllo per store existenti prima di creare
- ✅ Controllo per indici existenti prima di creare
- ✅ onversionchange listener (riga 105-107)

**Operazioni non-breaking:**
- Versione 2: aggiunge solo nuovo store (non tocca v1 data)
- Versione 3: aggiunge solo indici (non modifica dati)

### 4. **sw.js** ✅
**Stato:** Update flow corretto, niente tocca IndexedDB

**Principi implementati:**
```
1. NUNCA tocca IndexedDB
2. Usa skipWaiting() per attivazione immediata (riga 54)
3. Chiama clients.claim() per claim navigation (riga 75)
4. Pulisce SOLO cache (riga 81-86), non store IndexedDB
5. Notifica client via postMessage (riga 92-99)
```

**Cache strategy:**
- Cache-first per asset statici (HTML, JS, CSS, icone)
- Network-first per data (data/*, API)
- Fallback a index.html se offline

**Caching aggiuntivo:**
- Casha data pack JSON files (riga 126-130)
- Consente accesso offline ai data pack

---

## 🔄 Flusso di aggiornamento PWA

```
┌─────────────────────────────────────────────┐
│ Nuova versione SW disponibile sul server    │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│ SW registra updatefound event (linea 84)    │
│ new worker inizia download                  │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│ newWorker.state === 'installed'             │
│ VECCHIO SW ancora attivo (riga 88)          │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│ appBootstrap.notifyNewVersionAvailable()    │
│ Mostra banner: "Una nuova versione è..."    │
│ + bottone "Ricarica per gli aggiornamenti" │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│ Utente clicca "Ricarica"                    │
│ window.location.reload()                    │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│ Activate event nel NUOVO SW                 │
│ - clients.claim() (prende controllo)        │
│ - Pulisce vecchie cache (SOLO cache!)       │
│ - Notifica client con postMessage           │
│ - IndexedDB INTATTO (non toccato)           │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│ App carica con nuovo SW + dati utente       │
│ = Zero data loss                            │
└─────────────────────────────────────────────┘
```

---

## ✅ Verifica Completata

| Aspetto | Status | Dettagli |
|---------|--------|----------|
| IndexedDB init | ✅ OK | initDb() blocking in appBootstrap |
| Persistenza storage | ✅ OK | ensurePersistentStorage() implementato |
| SW registration | ✅ OK | registerServiceWorker() con update listener |
| Update detection | ✅ OK | updatefound event handler |
| Banner notifica | ✅ OK | notifyNewVersionAvailable() |
| Data preservation | ✅ OK | SW non tocca IndexedDB |
| Cache cleanup | ✅ OK | Vecchie cache eliminate, dati preservati |
| Schema versioning | ✅ OK | v1, v2, v3 con migrazioni safe |
| Feature detection | ✅ OK | persistence.isPersistenceSupported() |
| Storage quota | ✅ OK | getStorageInfo() per monitoring |
| Debug info | ✅ OK | getBootstrapState(), logStorageInfo() |

---

## 🧪 Test Plan (Manual)

### Test Suite 1: Persistent Storage

#### T1.1 — Richiedere Storage Persistente
**Steps:**
1. Apri app (http://localhost:3000)
2. Apri Console (F12)
3. Guarda log durante bootstrap

**Expected:**
```
🔐 Richiesta storage persistente...
✅ Storage persistente garantito
📊 Storage quota: X.XX MB / YYY.Y MB (ZZ% usato)
```

**Result:** ⬜ NOT YET TESTED

#### T1.2 — Verifica Quota Storage
**Steps:**
1. Settings → Debug Info → "Log Storage Info"
2. Guarda output <pre>

**Expected:**
```
{
  "quota": 1234567890,
  "usage": 123456789,
  "percentUsed": 10,
  "persisted": true
}
```

**Result:** ⬜ NOT YET TESTED

#### T1.3 — Storage Estimate Accuracy
**Steps:**
1. Aggiungi molti pasti (10+)
2. Verifica percentuale aumenta in Settings

**Expected:** percentUsed aumenta proporzionalmente  
**Result:** ⬜ NOT YET TESTED

---

### Test Suite 2: IndexedDB Versioning

#### T2.1 — Initial Database Creation
**Steps:**
1. Fresh browser (no local data)
2. Apri app
3. Check console

**Expected:**
```
📦 Upgrade schema IndexedDB a versione 3
  → Creazione store di base (v1)
  → Aggiunta store syncQueue (v2)
  → Aggiunta indici per query (v3)
✅ IndexedDB inizializzato: conta-calorie-db v3
```

**Result:** ⬜ NOT YET TESTED

#### T2.2 — Database Already v3
**Steps:**
1. Reload page (same browser)
2. Check console

**Expected:**
```
✅ IndexedDB inizializzato: conta-calorie-db v3
(No "Upgrade schema" log - already at v3)
```

**Result:** ⬜ NOT YET TESTED

#### T2.3 — Log DB Stats
**Steps:**
1. Settings → Debug Info → "Log IndexedDB Stats"
2. Guarda <pre> output

**Expected:**
```
{
  "userProfile": 1,
  "meals": N,
  "workouts": M,
  "bodyComp": X,
  "settings": Y,
  "syncQueue": 0
}
```

**Result:** ⬜ NOT YET TESTED

---

### Test Suite 3: Service Worker Update Flow

#### T3.1 — SW Registration
**Steps:**
1. Apri app
2. Check console e DevTools → Application → Service Workers

**Expected:**
```
⚙️ Registrazione service worker...
✅ Service Worker registrato
Status: activated and running
Scope: /
```

**Result:** ⬜ NOT YET TESTED

#### T3.2 — Simulate SW Update
**Steps:**
1. Edit sw.js (cambiam commento o versione)
2. Hard refresh app (Ctrl+Shift+R)
3. Watch console

**Expected:**
```
📢 Nuovo service worker disponibile
(Banner appears: "Una nuova versione...")
```

**Result:** ⬜ NOT YET TESTED

#### T3.3 — Click Reload Button
**Steps:**
1. (After T3.2 banner appears)
2. Click "Ricarica per gli aggiornamenti"
3. Page reloads

**Expected:**
```
New SW activates
- Old cache deleted
- IndexedDB UNCHANGED
- App loads with new SW + old data intact
```

**Result:** ⬜ NOT YET TESTED

#### T3.4 — Verify Data Integrity After Update
**Steps:**
1. (After T3.3)
2. Check Dashboard for meals

**Expected:**
- All meals from before update still there
- No data loss
- Correct macros display

**Result:** ⬜ NOT YET TESTED

---

### Test Suite 4: Data Preservation During SW Update

#### T4.1 — Add Data Before Update
**Steps:**
1. Fresh app (clear all data)
2. Add 3 meals with specific macros
3. Add 1 workout
4. Verify data visible

**Expected:**
- 3 meals logged
- 1 workout logged
- Correct totals in dashboard

**Result:** ⬜ NOT YET TESTED

#### T4.2 — Trigger SW Update
**Steps:**
1. Edit sw.js (change version comment)
2. Hard refresh (Ctrl+Shift+R)
3. Wait for banner
4. Click reload

**Expected:**
- Banner appears
- Reload completes
- No console errors

**Result:** ⬜ NOT YET TESTED

#### T4.3 — Verify Data Still There
**Steps:**
1. After T4.2 reload completes
2. Go to Dashboard
3. Check meals and workout

**Expected:**
- Same 3 meals visible
- Same 1 workout visible
- Macros unchanged
- Dates correct
- **ZERO data loss**

**Result:** ⬜ NOT YET TESTED

#### T4.4 — Verify in IndexedDB
**Steps:**
1. Settings → Debug Info → "Log IndexedDB Stats"
2. Check meal count

**Expected:**
```
"meals": 3  (same as before update)
```

**Result:** ⬜ NOT YET TESTED

---

### Test Suite 5: Offline Functionality

#### T5.1 — Data Pack Available Offline
**Steps:**
1. DevTools → Network → set to "Offline"
2. Try search "Stima senza dati precisi"
3. Type "carbonara"

**Expected:**
- Offline mode active
- Data pack still loads (cached)
- Finds "Carbonara"

**Result:** ⬜ NOT YET TESTED

#### T5.2 — App UI Available Offline
**Steps:**
1. Still offline
2. Navigate between tabs
3. Try to add meal

**Expected:**
- All UI responsive
- Can view meals, workouts
- Can type in inputs
- IndexedDB operations work (local)

**Result:** ⬜ NOT YET TESTED

#### T5.3 — Go Online Again
**Steps:**
1. DevTools → Network → set back to "Online"
2. Try any operation

**Expected:**
- App reconnects
- Data syncs if needed
- No errors

**Result:** ⬜ NOT YET TESTED

---

## Acceptance Criteria

✅ **PASS** if ALL:
1. Storage persistente richiesto al bootstrap
2. IndexedDB v3 create correttamente in fresh install
3. Migrazioni non perdono dati
4. SW registra e ascolta aggiornamenti
5. Banner appare quando nuova versione disponibile
6. Reload button nel banner funziona
7. Vecchio cache eliminato after update
8. IndexedDB INTATTO after SW update
9. Tutti i dati preservati after update
10. App funziona offline con cached assets
11. Data pack JSON cachato per offline
12. No console errors durante update
13. Feature detection per storage.persist
14. Storage quota monitoring disponibile
15. Debug info funziona (getBootstrapState, logStorageInfo)

---

**TASK 2 è IMPLEMENTATO E PRONTO PER TESTING**
