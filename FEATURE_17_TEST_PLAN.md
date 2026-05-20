# Feature 17 — Test Plan & Verification

## Prerequisites
- Live Preview server running on http://localhost:3000 (or configured port)
- Browser DevTools console open for debug logging
- Data files present: data/*.json

## Manual Test Cases

### Test Suite 1: Data Pack Loading

#### T1.1 — Load Italian Foods CREA Database
**Steps:**
1. Open app → navigate to "Aggiungi" tab
2. Click "Stima senza dati precisi"
3. Open browser Console (F12)
4. Look for log: `📦 Caricati XXX alimenti italiani`

**Expected:** Log shows `516` alimenti loaded  
**Result:** ⬜ NOT YET TESTED

#### T1.2 — Load Fast Food Database
**Steps:**
1. (Same as T1.1)
2. Check console for: `📦 Caricati X item fast food`

**Expected:** Log shows `18` fast food items  
**Result:** ⬜ NOT YET TESTED

#### T1.3 — Load Foreign Dishes Database
**Steps:**
1. (Same as T1.1)
2. Check console for: `📦 Caricati X piatti esteri`

**Expected:** Log shows `7` foreign dishes  
**Result:** ⬜ NOT YET TESTED

---

### Test Suite 2: Fuzzy Search

#### T2.1 — Exact Match Search
**Steps:**
1. Type food name: `Spaghetti alla Carbonara`
2. Enter weight: `400`
3. Click "Vedi stima"
4. Check console for: `✅ Trovato ITALIANO`

**Expected:** Found in CREA database with badge "CREA" + region "Lazio (Roma)"  
**Result:** ⬜ NOT YET TESTED

#### T2.2 — Fuzzy Match (Typo Tolerance)
**Steps:**
1. Type (with typo): `carbonarra` (vs. carbonara)
2. Weight: `400`
3. Click "Vedi stima"

**Expected:** Still found (Levenshtein distance ≤ 30%)  
**Result:** ⬜ NOT YET TESTED

#### T2.3 — Substring Match
**Steps:**
1. Type: `spaghetti` (partial of "Spaghetti alla Carbonara")
2. Weight: `100`
3. Click "Vedi stima"

**Expected:** Match found (substring match)  
**Result:** ⬜ NOT YET TESTED

#### T2.4 — Case Insensitive
**Steps:**
1. Type: `SPAGHETTI ALLA CARBONARA` (all caps)
2. Weight: `400`

**Expected:** Found (normalizeName handles case)  
**Result:** ⬜ NOT YET TESTED

---

### Test Suite 3: Fast Food Search

#### T3.1 — McDonald's Big Mac
**Steps:**
1. Type: `Big Mac`
2. Weight: `215`
3. Click "Vedi stima"
4. Check: badge, calories (~550), macros

**Expected:**
- Badge: "McDonald's"
- Calories: 550 kcal
- Protein: ~25.8g
- Carbs: ~45.2g
- Fats: ~28.5g

**Result:** ⬜ NOT YET TESTED

#### T3.2 — Burger King Whopper
**Steps:**
1. Type: `Whopper`
2. Weight: `218`

**Expected:**
- Badge: "Burger King"
- Calories: 580 kcal

**Result:** ⬜ NOT YET TESTED

#### T3.3 — KFC Original Recipe
**Steps:**
1. Type: `KFC original` or `original recipe`
2. Weight: `52`

**Expected:**
- Badge: "KFC"
- Calories: 160 kcal

**Result:** ⬜ NOT YET TESTED

---

### Test Suite 4: Foreign Dishes

#### T4.1 — California Roll
**Steps:**
1. Type: `California roll`
2. Weight: `140`

**Expected:**
- Badge: "EuroFIR/USDA"
- Cuisine badge: "Giapponese"
- Calories: ~196 kcal

**Result:** ⬜ NOT YET TESTED

#### T4.2 — Pad Thai
**Steps:**
1. Type: `Pad thai`
2. Weight: `320`

**Expected:**
- Source: "EuroFIR/USDA"
- Calories: ~528 kcal

**Result:** ⬜ NOT YET TESTED

---

### Test Suite 5: Fallback Behavior

#### T5.1 — Not Found → Fallback to TypeicalValues
**Steps:**
1. Type: `xyz-non-existent-food-12345`
2. Weight: `100`
3. Check console: `❌ Non trovato nei data pack`
4. Verify category dropdown appears

**Expected:**
- Data pack not found log message
- Fallback to typicalValues system
- Category dropdown visible
- No data pack badges

**Result:** ⬜ NOT YET TESTED

#### T5.2 — Graceful Degradation if JSON Fails
**Steps:**
1. (Simulate: edit data/*.json to be invalid)
2. Reload app, try search
3. Check console: `⚠️ Errore caricamento`

**Expected:**
- Warning logged
- Graceful fallback to typicalValues
- App doesn't crash

**Result:** ⬜ NOT YET TESTED

---

### Test Suite 6: Macro Calculation

#### T6.1 — Gram-based Calorie Scaling
**Steps:**
1. Search "Big Mac" (215g = 550 kcal)
2. Try different weights: 100g, 150g, 300g
3. Verify calculations:
   - 100g → ~255 kcal
   - 150g → ~383 kcal
   - 300g → ~766 kcal

**Expected:** Linear scaling: (kcal_per_portion / portionSize) * grams  
**Result:** ⬜ NOT YET TESTED

#### T6.2 — Macro Precision
**Steps:**
1. Search "Spaghetti alla Carbonara" 250g
2. Check macro values have appropriate decimal places
3. Protein: 1 decimal (e.g., 15.5g)
4. Carbs/fats: 1 decimal

**Expected:** Rounding to 1 decimal place (Math.round(...*10)/10)  
**Result:** ⬜ NOT YET TESTED

---

### Test Suite 7: UI/UX

#### T7.1 — Badge Display
**Steps:**
1. Search "Carbonara"
2. Verify 3 badges display:
   - "CREA" (source) — blue
   - "Tipico: Lazio (Roma)" (region) — pink
   - Quality badge (🎯 Specifico) — top

**Expected:** All badges visible with proper spacing  
**Result:** ⬜ NOT YET TESTED

#### T7.2 — Disclaimer Update
**Steps:**
1. Search in data pack vs. typicalValues
2. Compare disclaimers

**Expected:**
- Data pack: "Valori medi stimati per piatto standard..."
- TypeicalValues: "Valori stimati: questi sono valori medi..."

**Result:** ⬜ NOT YET TESTED

#### T7.3 — Add to Meal
**Steps:**
1. Search "carbonara" 400g
2. Click "Aggiungi al pasto"
3. Check dashboard for entry

**Expected:**
- Entry appears with correct macros
- Source marked as "data_pack_italian_crea"
- Can edit/delete normally

**Result:** ⬜ NOT YET TESTED

---

### Test Suite 8: Performance

#### T8.1 — First Load Time
**Steps:**
1. Clear browser cache
2. Open app → "Aggiungi" tab
3. Measure time to first search (data pack loading)
4. Check console timestamps

**Expected:** < 500ms (lazy load + JSON parse)  
**Result:** ⬜ NOT YET TESTED

#### T8.2 — Subsequent Searches
**Steps:**
1. Search "carbonara" (first time)
2. Search "pizza" (second time)
3. Compare console logs

**Expected:** Second search faster (data cached in memory)  
**Result:** ⬜ NOT YET TESTED

#### T8.3 — Large Input List
**Steps:**
1. Verify Levenshtein distance has 50-char limit
2. Try search with very long food name
3. Should not hang/freeze

**Expected:** O(n) complexity, n = number of foods (~540)  
**Result:** ⬜ NOT YET TESTED

---

## Regression Tests

### R1 — IndexedDB Unaffected
**Steps:**
1. Before feature 17: Add meal "pasta" to today
2. After feature 17: Check meal still there

**Expected:** Data persists, no IndexedDB changes  
**Result:** ⬜ NOT YET TESTED

### R2 — TypeicalValues Still Works
**Steps:**
1. Search "pizza" → should find in CREA (will use data pack)
2. Search "random-unknown-food" → should fallback to typicalValues
3. Verify both flows work

**Expected:** Both systems coexist  
**Result:** ⬜ NOT YET TESTED

### R3 — Service Worker Unaffected
**Steps:**
1. Offline mode (DevTools → Network → Offline)
2. Try to search food (should fail gracefully)
3. Go back online
4. Search should work again

**Expected:** SW continues to serve UI, data pack loading fails gracefully offline  
**Result:** ⬜ NOT YET TESTED

---

## Debug Commands

Open browser console and try:

```javascript
// Check if data is loading
const { searchInDataPacks } = await import('/js/dataPackLoader.js');
const result = await searchInDataPacks('carbonara', 400);
console.log(result);

// Manual fuzzy test
const { fuzzyMatch } = await import('/js/dataPackLoader.js');
console.log(fuzzyMatch('carbonarra', 'Spaghetti alla Carbonara')); // true
console.log(fuzzyMatch('pizza', 'Spaghetti')); // false
```

---

## Acceptance Criteria

✅ **PASS** if:
1. All 516 Italian foods load correctly
2. All 18 fast food items searchable
3. All 7 foreign dishes searchable
4. Fuzzy matching works with ~30% typo tolerance
5. Fallback to typicalValues works
6. Macro calculations accurate (within 1g)
7. Badge UI displays correctly
8. No regression in existing features
9. Performance < 500ms first load
10. Data persists to IndexedDB correctly

---

**TEST STATUS:** 🔄 READY FOR MANUAL TESTING
