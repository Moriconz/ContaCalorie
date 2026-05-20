# Testing Checklist — Conta Calorie PWA

**Date:** 2026-05-20  
**Status:** In Progress  
**Server:** http://127.0.0.1:3000

---

## Task 1: Settings UI + Backup/Import

### Theme Toggle
- [ ] Click "Cambia a Modalità Scura" button
- [ ] Verify page switches to dark theme
- [ ] Verify button text changes to "Cambia a Modalità Chiara"
- [ ] Verify "Attuale: Scuro" displays correctly
- [ ] Toggle back to light mode
- [ ] Verify persistence across page reload

### Profile Section
- [ ] Profile info displays correctly (name, height, weight, gender)
- [ ] Click "Modifica Profilo" button (opens profile form if implemented)

### Export Backup
- [ ] Click "📥 Esporta Dati" button
- [ ] Verify status message shows "⏳ Esportando..."
- [ ] Verify file downloads: `conta-calorie-backup-YYYY-MM-DD.json`
- [ ] Open downloaded file, verify JSON structure:
  - `version`, `exportedAt`, `appVersion`
  - `userProfile`, `meals`, `workouts`, `bodyComp`, `settings`, `syncQueue`
- [ ] Verify status message changes to "✅ Backup completato!"

### Import Backup
- [ ] Add some test meal data first (quick add via home tab)
- [ ] Click "📤 Importa Dati" button
- [ ] Select previously downloaded backup file
- [ ] Verify confirmation dialog appears
- [ ] Click "Continua" on confirmation
- [ ] Verify status message shows "⏳ Import in corso..."
- [ ] Verify success message appears: "✅ Import completato!"
- [ ] Click "Ricaricare la pagina" when prompted
- [ ] Verify data is restored correctly

### Storage Info (Debug)
- [ ] Expand "🔧 Debug Info" section
- [ ] Click "Log Storage Info" button
- [ ] Verify output shows quota, usage, percentUsed, persisted status
- [ ] Verify format: "X.XX MB / Y.Y MB (Z% usato)"

### IndexedDB Stats (Debug)
- [ ] Click "Log IndexedDB Stats" button
- [ ] Verify output shows store sizes and record counts
- [ ] Verify all 6 stores present: meals, workouts, bodyComp, settings, syncQueue, userProfile

### Bootstrap State (Debug)
- [ ] Click "Log Bootstrap State" button
- [ ] Verify output shows bootstrap sequence status

---

## Task 2: PWA Persistence Hardening

### Storage Persistence Request
- [ ] Open browser DevTools → Console
- [ ] Verify no errors on page load
- [ ] Check localStorage: verify theme setting persisted
- [ ] Check IndexedDB: open "conta-calorie-db" → verify all stores exist
- [ ] Open DevTools → Application → Storage → Persistent Storage
- [ ] Verify app has requested persistent storage (may show "Ask" or "Allow")

### Service Worker Update Flow
- [ ] Open DevTools → Application → Service Workers
- [ ] Verify "sw.js" is registered and "activated and running"
- [ ] Check cache name: should be "calorie-pwa-v4"
- [ ] Verify these caches exist:
  - calorie-pwa-v4 (main cache)
  - calorie-data-packs (optional if data packs cached)
- [ ] Open DevTools → Console
- [ ] Verify no ServiceWorker errors

### IndexedDB Versioning
- [ ] Open DevTools → Application → IndexedDB → conta-calorie-db
- [ ] Verify version number displayed (should be 3 or higher)
- [ ] Expand and verify these object stores exist:
  - userProfile (keyPath: none)
  - meals (keyPath: id)
  - workouts (keyPath: id)
  - bodyComp (keyPath: id)
  - settings (keyPath: key)
  - syncQueue (keyPath: id)
- [ ] Click on "meals" store
- [ ] Verify indices exist:
  - dateCreated
  - dateConsumed
  - userId (if implemented)

### Offline Functionality
- [ ] Add a test meal while online
- [ ] Open DevTools → Network tab
- [ ] Click "Offline" checkbox to simulate offline
- [ ] Navigate to home tab, verify meals display correctly
- [ ] Try adding another meal while offline
- [ ] Verify no network errors in console
- [ ] Uncheck "Offline" to go back online
- [ ] Verify data persists and syncs (if sync queue visible in debug)

### Data Persistence After Reload
- [ ] Add 2-3 test meals
- [ ] Hard reload page (Cmd+Shift+R on Mac)
- [ ] Verify all meals still display
- [ ] Verify user profile data intact
- [ ] Verify settings (theme preference) retained

---

## Feature 17: Data Pack Alimenti

### Setup
- [ ] Navigate to "Aggiungi alimento" tab
- [ ] Should see two buttons: "⭐ Cibo personalizzato" and "🔍 Stima senza dati precisi"
- [ ] Personal foods list below (should be empty initially)

### Test 1: Search "carbonara"
- [ ] Click "🔍 Stima senza dati precisi"
- [ ] Type in food search field: "carbonara"
- [ ] Verify result shows:
  - Dish name: "Spaghetti Carbonara" or similar
  - Source badge: "CREA" (green/blue badge)
  - Region badge: "Tipico: Lazio" or "Tipico: Lazio (Roma)"
  - Macro values populated (kcal, protein, carb, fat, etc.)
  - Note: "Valori medi stimati per piatto standard..."
  - NO category dropdown (pre-filled from data pack)

### Test 2: Search "Big Mac"
- [ ] Clear search field
- [ ] Type: "Big Mac"
- [ ] Verify result shows:
  - Item name: "Big Mac"
  - Source badge: "McDonald's" or chain name
  - Macro values: ~563 kcal, ~26g protein, ~45g carbs, ~30g fat
  - Note about standard portion

### Test 3: Search "ossobuco"
- [ ] Clear search field
- [ ] Type: "ossobuco"
- [ ] Verify result shows:
  - Dish name: "Ossobuco" or "Ossobuco alla Milanese"
  - Source badge: "CREA" (Italian dish)
  - Region badge: "Tipico: Lombardia" or "Tipico: Milano"
  - Macro values populated

### Test 4: Search "pizza"
- [ ] Clear search field
- [ ] Type: "pizza"
- [ ] Verify result shows:
  - Item name: "Pizza Margherita" or similar
  - Source badge: "CREA" or "Napoli"
  - Region badge if applicable
  - Macro values

### Test 5: Search non-existent food
- [ ] Clear search field
- [ ] Type: "xyzabc12345nonsense"
- [ ] Verify fallback to category dropdown appears
- [ ] Verify user can manually select category and enter macros

### Test 6: Fuzzy Matching
- [ ] Type: "carbnara" (typo version of "carbonara")
- [ ] Verify it still finds "Carbonara" (fuzzy match within 30% tolerance)
- [ ] Type: "ossbuco" (missing 'o')
- [ ] Verify it finds "ossobuco"
- [ ] Type: "pizza margherita" (full name)
- [ ] Verify exact match works

### Test 7: Add food to meal
- [ ] After finding "carbonara", click "Seleziona" or confirm button
- [ ] Verify food is added to meal
- [ ] Verify portion size defaults or prompts
- [ ] Navigate to home to see meal with food added

---

## Summary

**Total Checks:** 50+  
**Priority:** All tests should pass before production

### Known Issues to Monitor
- [ ] Fuzzy matching edge cases (accents, abbreviations)
- [ ] Mobile compatibility (responsive layout in narrow viewports)
- [ ] Data pack loading performance (first load may be slow)
- [ ] Storage quota warnings (if approaching limit)
- [ ] SW update notifications (verify banner appears on new version)

---

## Notes

- DevTools location: F12 or Cmd+Option+I
- To test offline: DevTools → Network → Offline checkbox
- To inspect IndexedDB: DevTools → Application → IndexedDB
- To check Service Worker: DevTools → Application → Service Workers
- Server running at: http://127.0.0.1:3000
