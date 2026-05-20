# Task 1 — Settings UI con Export/Import — Test Plan

**Status:** ✅ IMPLEMENTAZIONE COMPLETA  
**Componenti:** settings.js, backupService.js, app.js, index.html  
**Data Test:** 2026-05-20

---

## File Verificati

| File | Status | Note |
|------|--------|------|
| js/ui/settings.js | ✅ OK | 420+ righe, sintassi verificata |
| js/sync/backupService.js | ✅ OK | Creato, 3 funzioni principali |
| js/app.js | ✅ OK | Integrazione verificata (riga 752-760) |
| index.html | ✅ OK | Pulsante settings aggiunto |
| js/db/indexedDbClient.js | ✅ OK | Tutte le funzioni necessarie presenti |

---

## Test Manual Cases

### Test Suite 1: Rendering Settings UI

#### T1.1 — Settings Tab Visible
**Steps:**
1. Avvia app su http://localhost:3000
2. Completa onboarding (profilo utente)
3. Guarda bottom nav

**Expected:** Pulsante "⚙️ Impostazioni" visibile tra gli altri tab  
**Result:** ⬜ NOT YET TESTED

#### T1.2 — Click Settings Tab
**Steps:**
1. Click "⚙️ Impostazioni"
2. Osserva mainContent

**Expected:** 6 sezioni visibili:
- 🎨 Tema
- 👤 Profilo
- 💾 Backup & Recupero Dati
- ℹ️ Informazioni
- 🔧 Debug Info (collapsible)

**Result:** ⬜ NOT YET TESTED

#### T1.3 — Sezione Tema Funzionante
**Steps:**
1. Click "Cambia a Modalità Scura" button
2. Observe page theme changes

**Expected:**
- Page goes dark
- Current theme shows "Scuro"
- Next button says "Cambia a Modalità Chiara"

**Result:** ⬜ NOT YET TESTED

#### T1.4 — Profilo Info Display
**Steps:**
1. Settings tab → look at "👤 Profilo" section
2. Verify shown data matches what you entered

**Expected:**
- Nome: (from onboarding)
- Altezza: X cm
- Peso: X kg
- Sesso: (from onboarding)

**Result:** ⬜ NOT YET TESTED

#### T1.5 — Storage Info Display
**Steps:**
1. Settings tab → look at "ℹ️ Informazioni"
2. Check "💾 Storage:" line

**Expected:** `XX.XX MB / YYY.Y MB (ZZ% usato)`  
**Result:** ⬜ NOT YET TESTED

---

### Test Suite 2: Export Functionality

#### T2.1 — Export Button Click
**Steps:**
1. Settings tab → "💾 Backup & Recupero Dati" section
2. Click "📥 Esporta Dati" button
3. Open browser DevTools → Console
4. Check for logs

**Expected:**
- Button shows "⏳ Esportando..."
- Console shows: `📊 IndexedDB Statistics:` and `✅ File scaricato...`
- Status message appears: "✅ Backup completato!"

**Result:** ⬜ NOT YET TESTED

#### T2.2 — File Download
**Steps:**
1. (After T2.1) Check Downloads folder
2. Open downloaded JSON file

**Expected:**
- File named: `conta-calorie-backup-YYYY-MM-DD.json`
- Contains JSON with structure:
  ```json
  {
    "version": 1,
    "exportedAt": "2026-05-20T...",
    "userProfile": { ... },
    "meals": [ ... ],
    "workouts": [ ... ],
    "bodyComp": [ ... ],
    "settings": [ ... ]
  }
  ```

**Result:** ⬜ NOT YET TESTED

#### T2.3 — Export Data Completeness
**Steps:**
1. Add some meals to today
2. Add some weights/cardio workout
3. Export data
4. Inspect JSON

**Expected:**
- userProfile has nome, altezza, pesoKg, sesso
- meals array contains entries with nome, grammi, data, macroCalcolate
- workouts array not empty
- All arrays properly formatted

**Result:** ⬜ NOT YET TESTED

#### T2.4 — Multiple Exports
**Steps:**
1. Export once (T2.1)
2. Wait 1 minute
3. Add new meal
4. Export again
5. Compare files

**Expected:**
- Second file has newer timestamp
- Second file has more meals
- Files are different in content

**Result:** ⬜ NOT YET TESTED

---

### Test Suite 3: Import Functionality

#### T3.1 — Import Button Click
**Steps:**
1. Settings tab → "📤 Importa Dati" button
2. Click it
3. File picker should appear

**Expected:** Browser file picker opens with `.json` filter  
**Result:** ⬜ NOT YET TESTED

#### T3.2 — Valid JSON Import
**Steps:**
1. Click "📤 Importa Dati"
2. Select a valid backup JSON file
3. Confirmation dialog appears
4. Click "Continua"
5. Check console and status message

**Expected:**
- Dialog shows: "⚠️ Attenzione" with backup date
- Status shows: "✅ Import completato!"
- Console shows: `✅ Import completato (replace mode)`
- Suggestion to reload page

**Result:** ⬜ NOT YET TESTED

#### T3.3 — Page Reload After Import
**Steps:**
1. (After T3.2 import completes)
2. Click "Ricaricare la pagina ora?" confirmation (if appears)
3. Page reloads

**Expected:**
- Page refreshes
- Data from backup is now visible in app
- Meals from backup shown in dashboard

**Result:** ⬜ NOT YET TESTED

#### T3.4 — Data Persistence After Import
**Steps:**
1. Import a backup with 5 meals
2. Page reloads
3. Go to Dashboard
4. Check meals list

**Expected:**
- All 5 meals from backup visible
- Dates and macros correct
- Weight readings visible if in backup

**Result:** ⬜ NOT YET TESTED

#### T3.5 — Invalid JSON Handling
**Steps:**
1. Create invalid file: `{ "invalid json"`
2. Try to import
3. Check status message

**Expected:**
- Error message: "❌ Errore: File JSON non valido"
- No data overwritten
- App still functional

**Result:** ⬜ NOT YET TESTED

#### T3.6 — Missing Fields Handling
**Steps:**
1. Create JSON missing required fields:
   ```json
   {
     "version": 1,
     "exportedAt": "...",
     "userProfile": null
   }
   ```
2. Try to import

**Expected:**
- Error message: "❌ Errore: Profilo utente incompleto"
- Import rejected
- Existing data preserved

**Result:** ⬜ NOT YET TESTED

#### T3.7 — Cancel Import
**Steps:**
1. Click "📤 Importa Dati"
2. Select file
3. Confirmation dialog appears
4. Click "Annulla"

**Expected:**
- Dialog closes
- No data imported
- Status shows: "Import annullato"

**Result:** ⬜ NOT YET TESTED

---

### Test Suite 4: Edit Profile

#### T4.1 — Edit Profile Button
**Steps:**
1. Settings tab → "👤 Profilo" section
2. Click "Modifica Profilo" button

**Expected:**
- Page shows onboarding form with current data
- Fields pre-filled with existing profile

**Result:** ⬜ NOT YET TESTED

#### T4.2 — Update Profile
**Steps:**
1. (After T4.1)
2. Change some fields (e.g., weight: 75 → 80 kg)
3. Click "Salva profilo"
4. Return to settings

**Expected:**
- Data saved
- Settings page shows new weight (80 kg)
- Toast message: "Profilo salvato"

**Result:** ⬜ NOT YET TESTED

---

### Test Suite 5: Debug Info

#### T5.1 — Debug Section Collapsible
**Steps:**
1. Settings tab → scroll to bottom
2. See "🔧 Debug Info (sviluppatori)" section
3. It's collapsed by default
4. Click to expand

**Expected:**
- Section expands
- Three buttons appear:
  - "Log IndexedDB Stats"
  - "Log Storage Info"
  - "Log Bootstrap State"

**Result:** ⬜ NOT YET TESTED

#### T5.2 — Log IndexedDB Stats
**Steps:**
1. Expand debug section
2. Click "Log IndexedDB Stats"
3. Check console and <pre> output

**Expected:**
- Console shows: `📊 IndexedDB Statistics: { ... }`
- <pre> element shows JSON with store counts:
  - userProfile: 1
  - meals: N
  - workouts: M
  - etc.

**Result:** ⬜ NOT YET TESTED

#### T5.3 — Log Storage Info
**Steps:**
1. Expand debug section
2. Click "Log Storage Info"

**Expected:**
- <pre> element shows:
  - quota: bytes
  - usage: bytes
  - percentUsed: percentage
  - persisted: boolean

**Result:** ⬜ NOT YET TESTED

#### T5.4 — Log Bootstrap State
**Steps:**
1. Expand debug section
2. Click "Log Bootstrap State"

**Expected:**
- <pre> element shows bootstrap state object with:
  - dbInitOk
  - persistenceChecked
  - swRegistered
  - etc.

**Result:** ⬜ NOT YET TESTED

---

### Test Suite 6: Regression Tests

#### R6.1 — Data Integrity After Settings Change
**Steps:**
1. Add 3 meals to dashboard
2. Go to settings
3. Toggle theme
4. Toggle theme again
5. Return to dashboard

**Expected:**
- All 3 meals still there
- No data lost
- Dashboard displays correctly

**Result:** ⬜ NOT YET TESTED

#### R6.2 — Index ↔ Settings Navigation
**Steps:**
1. Dashboard view
2. Click settings
3. Click dashboard again
4. Click settings again

**Expected:**
- Navigation smooth
- No console errors
- Data consistent each time

**Result:** ⬜ NOT YET TESTED

#### R6.3 — Other Tabs Still Work
**Steps:**
1. After settings testing
2. Try all other tabs:
   - Dashboard
   - Settimana
   - Aggiungi
   - Personali
   - Peso

**Expected:** All tabs function normally  
**Result:** ⬜ NOT YET TESTED

---

## Acceptance Criteria

✅ **PASS** if ALL of:
1. Settings tab visible and clickable
2. All 6 sections render correctly
3. Theme toggle works bidirectionally
4. Profile info displays correctly
5. Storage info displays correctly
6. Export downloads valid JSON with all data
7. Import validates JSON structure
8. Import shows confirmation dialog
9. Import replaces data atomically
10. Invalid JSON rejected with clear error
11. Edit profile works and persists
12. Debug buttons work and show correct data
13. No regression in other features
14. No console errors during any test
15. IndexedDB data remains consistent

---

**READY FOR LIVE PREVIEW TESTING**
