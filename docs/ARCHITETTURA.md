# 📱 RIASSUNTO COMPLETO: CONTA CALORIE PWA

## **OVERVIEW GENERALE**

**Conta Calorie** è una Progressive Web App mobile-first per il monitoraggio nutrizionale giornaliero. Consente agli utenti di tracciare calorie, macronutrienti (proteine, carboidrati, grassi) e composizione corporea, con funzionalità avanzate di proiezione di peso e analisi dei trend.

---

## **ARCHITETTURA GLOBALE**

```
┌─────────────────────────────────────────────┐
│         index.html (Entry Point)            │
│  - Carica tema da localStorage              │
│  - Registra beforeinstallprompt listener    │
│  - Carica CSS (theme + glassmorphism)       │
└──────────────┬──────────────────────────────┘
               │
        ┌──────▼───────────────┐
        │   js/app.js (MAIN)   │ Orchestrazione principale
        │  - Routing viste     │
        │  - State management  │
        │  - Modal system      │
        └──────┬───────────────┘
               │
        ┌──────┴─────────────────────────┐
        │                                 │
   ┌────▼──────┐              ┌──────────▼────┐
   │  UI Layer │              │  Data Layer   │
   │ (js/ui/)  │              │               │
   └───────────┘              └───────────────┘
        │                           │
        ├─ dashboard.js            ├─ storage.js (IndexedDB)
        ├─ foodSearch.js           ├─ nutritionEngine.js
        ├─ estimatedFoodForm.js    ├─ nutritionDataProvider.js
        ├─ userFoods.js            ├─ typicalValues.js
        ├─ weekView.js             ├─ bodyCompTracker.js
        ├─ weightLoss.js           ├─ activityEnergyEngine.js
        ├─ settings.js             └─ weightLossEstimator.js
        └─ onboarding.js
```

---

## **1. FUNZIONALITÀ PRINCIPALI**

### **A) Dashboard (Vista Principale)**
**Cosa mostra:**
- Riepilogo nutrizionale del giorno (calorie, proteine, carboidrati, grassi vs target)
- Suddivisione per momento del pasto (colazione, pranzo, cena, spuntini)
- Widget composizione corporea (se baseline calibrato)
- Bottoni per aggiungere alimenti (manuale)
- Avvertenze nutrizionali (es: proteine basse)

**Come funziona:**
- Aggregazione giornaliera da `aggregateDailySummary()` (nutritionEngine.js)
- Calcolo %target con `buildNutritionWarning()` per avvisi
- Caricamento baselines e deltas da bodyCompTracker.js
- Rendering dinamico pasti raggruppati per momento

---

### **B) Ricerca Alimenti**
**Flusso:**
1. Utente digita termine di ricerca
2. `executeFoodSearch()` → `searchFoods()` (nutritionDataProvider.js)
3. Risultati mostrati con fonte (DB interno, USDA, custom)
4. Clic su alimento → modale di aggiunta con:
   - Selezione momento pasto
   - Input grammi (calcolo real-time macros)
   - Pulsanti aggiungi/annulla

**Come funziona:**
- Ricerca su database locale (caricato da nutritionDataProvider)
- Per ogni alimento: calcolo macros con `calculateMacrosForAmount()`
- Salvataggio in appState.meals + IndexedDB

---

### **C) Alimenti Personalizzati**
**Cosa è:**
- Alimenti custom creati dall'utente (es: "Pasta fatta in casa")
- Salvati in IndexedDB, riutilizzabili

**Operazioni:**
- ✅ Nuovo: Form modale con campi (nome, porzione, kcal/100g, proteine, carbo, grassi, zuccheri, fibra, sodio)
- ✅ Modifica: Pre-popola form con dati attuali
- ✅ Elimina: Con conferma

**Styling:**
- Card glassmorphic con label bold (font-weight 700)
- Input 48px min-height, padding 1rem, font-size 16px
- Spacing 1.5rem tra form groups

---

### **D) Stima Alimenti Senza Dati Precisi**
**Usa:**
- `typicalValues.js` → Database di piatti tipici con macros medi
- Dropdown categorie (pasta, carne, verdura, etc.)
- Real-time preview di calorie stimate

**Flusso:**
- Utente digita piatto (es "spaghetti")
- Sistema suggerisce categoria
- Mostra macros medi per quella categoria
- Calcola calorie per grammi inseriti
- Aggiunge pasto con nota "Stima categoria"

---

### **E) Tracking Peso & Composizione Corporea**
**Dashboard → Sezione Esercizio e Peso**

**Peso giornaliero:**
- Input campo peso (kg)
- Salvato in dailyWeights (IndexedDB)
- Usato per proiezioni trend

**Composizione corporea (Feature 16):**
- Baseline: DEXA/BIA/plicometria (% body fat)
- Calibrazione: Modale form con data, peso, % fat
- Tracciamento: Algoritmo stima deltas usando:
  - Deficit/surplus calorico dei giorni
  - Sessioni pesi (volumi) vs cardio
  - Intake proteico

**Calcolo composizione corporea:**
```
Muscle gain/loss = (proteine intake/7) + sessioni pesi (RPE) - deficit calorico
Fat loss = deficit calorico - muscle loss
```

---

### **F) Vista Settimanale**
- Mostra ultimi 7 giorni
- Calorie totali vs target (%)
- Status: Ok/Basso/Alto
- Clic giorno → carica pasti di quel giorno nel dashboard

---

### **G) Analisi Peso & Perdita Grasso**
**"Analizza perdita peso" → Tab Weight Loss**

**Calcoli:**
- **TDEE Teorico** (Mifflin-St Jeor): basato su peso, età, sesso, attività
- **TDEE Adattivo**: regressione lineare su ultimi 30 giorni di dati reali
- **Bilancio energetico**: intake - TDEE
- **Trend 7 giorni**: media deficit/surplus ultimi 7 giorni
- **Proiezione 30 giorni**: stima peso finale + composizione corporea

**Metriche esercizio:**
- Sessioni pesi/settimana
- RPE medio (intensità)
- Proteine intake/kg peso

---

### **H) Onboarding**
**Primo avvio:**
- Form profilo: sesso, peso, altezza, età, attività
- Calcolo automatico TDEE target calorico
- Salvataggio in IndexedDB
- Redirect dashboard

---

### **I) Impostazioni**
- Edit profilo (redirect onboarding)
- (Espandibile per altre impostazioni)

---

## **2. SISTEMA DI STORAGE (Data Persistence)**

**Database: IndexedDB** (storage.js)

**Strutture dati:**
```
userProfile: { id, sesso, pesoKg, altezzaCm, età, nivelloAttivita }
meals: { id, data, momento, foodRef, grammi, macroCalcolate, origin, note }
userFoods: { id, nome, porzioneBase, per100g, source }
weightsSessions: { id, data, muscleGroup, reps, sets, peso, intensita }
cardioSessions: { id, data, durata, tipo, intensita }
dailyWeights: { id, data, pesoKg }
bodyCompBaselines: { id, data, pesoKg, bodyFatPercent }
```

**Salvataggio automatico:** Ogni modifica trigger `save*()` in IndexedDB

---

## **3. SISTEMA DI STYLING & TEMA**

### **A) Tema System (theme.css)**
**Dark Mode (Default):**
```css
--bg-main: #050716
--bg-secondary: #0a1023
--glass-primary: rgba(10, 16, 35, 0.60)    /* Glassmorphism */
--glass-border: rgba(255, 255, 255, 0.12)
--text-primary: #f8fbff
--accent-cyan: #4cc9f0
--accent-magenta: #ff6ec7
--accent-orange: #ff9a44
--accent-purple: #a855f7
--blur-glass: blur(24px)
```

**Light Mode:**
```css
--bg-main: #f0f4ff
--glass-primary: rgba(255, 255, 255, 0.65)
--text-primary: #182035
--blur-glass: blur(18px)
```

**Toggle tema:**
- Pulsante 🌙/☀️ in topbar
- `themeManager.js` gestisce toggle + localStorage

---

### **B) Glassmorphism (glassmorphism.css + background.css)**

**Effetto vetro:**
```css
background: var(--glass-primary);
backdrop-filter: blur(24px);
border: 1px solid var(--glass-border);
```

**Animated Background:**
- 4 blob neon che si muovono infinitamente
- Dark: magenta, orange, cyan, purple (mix-blend-mode: screen)
- Light: pastello soft (mix-blend-mode: multiply)
- Blur 8px per visualizzare i colori

**Z-index stacking:**
```
bg-container (z=0)    ← Blobs animati
  ↓
content-wrapper (z=1)  ← Contenuto app
  ↓
modal-overlay (z=50)   ← Modali
```

---

### **C) Componenti UI (styles.css)**

**Card glassmorphic:**
```css
.card {
  background: var(--glass-primary);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  padding: 1.75rem;
  margin-bottom: 2rem;
}
```

**Form elements:**
```css
label {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1.5rem;
  font-weight: 700;
}

input, select, textarea {
  width: 100%;
  padding: 1rem;
  min-height: 48px;
  font-size: 16px;
  background: var(--glass-secondary);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
}
```

**Button:**
- Primary: cyan gradient (accent-cyan)
- Secondary: gray glassmorphic
- Min-height 44px, padding 1rem 1.25rem

**Modal:**
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal-card {
  width: min(100%, 620px);
  background: var(--glass-primary);
  backdrop-filter: var(--blur-glass);
  border-radius: 24px;
  padding: 2rem;
}
```

---

## **4. CALCOLI MATEMATICI**

### **A) Macronutrienti**
```js
// Per grammi specifici:
macro = (per100g / 100) * grammi

// Es: 100g pasta (70kcal/100g)
kcal = (70 / 100) * 100 = 70 kcal
```

### **B) TDEE (Total Daily Energy Expenditure)**
**Mifflin-St Jeor Formula:**
```
BMR = 10*peso + 6.25*altezza - 5*età ± 5 (M/F)
TDEE = BMR * fattore attività
```

**Fattori attività:**
- Sedentario: 1.2
- Poco attivo: 1.375
- Moderatamente attivo: 1.55
- Molto attivo: 1.725

### **C) Trend & Proiezioni**
**Bilancio energetico:**
```
Balance = intake - TDEE
Se balance < -500 kcal/day → ~0.5 kg grasso/settimana
Se balance > +500 kcal/day → ~0.5 kg muscle/settimana (se allena)
```

**Proiezione 30 giorni:**
```
avg_daily_balance = sum(last 7 days balance) / 7
fat_loss_30days = avg_daily_balance * 30 / 7700 (kcal per kg grasso)
projected_weight = current_weight - fat_loss_30days
```

---

## **5. ARCHITETTURA MODALE**

**Sistema modale centralizzato (app.js):**
```js
function showModal(contentHtml, bind) {
  // Clona template
  const fragment = modalTemplate.content.cloneNode(true);
  // Inserisce HTML in .modal-body
  body.innerHTML = contentHtml;
  // Chiama callback bind(modalRoot) per event binding
  if (bind) bind(modalRoot);
  // Appende a document.body
  document.body.appendChild(fragment);
}
```

**Modali attuali:**
1. Dettaglio alimento (aggiunta da ricerca)
2. Form alimento personalizzato (nuovo/modifica)
3. Analisi foto (disabilitato)
4. Selezione momento pasto
5. Calibrazione composizione corporea

---

## **6. PWA FEATURES**

**manifest.webmanifest:**
- Nome app: "Conta Calorie"
- Icon 192px, 512px
- Theme colors dark/light
- Installabile su home screen (Android)

**beforeinstallprompt Handler (pwaHandler.js):**
```js
// Cattura prompts
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  // Mostra pulsante 📲
});

// Quando accetta installazione
installPrompt.prompt();
installPrompt.userChoice.then(choice => {
  if (choice.outcome === 'accepted') {
    // Nascondi pulsante
    installBtn.style.display = 'none';
  }
});
```

---

## **7. ROUTING & NAVIGAZIONE**

**Bottom nav (5 viste):**
- 📊 Dashboard
- 📅 Settimana
- 🔍 Ricerca
- 🍽️ Alimenti personalizzati
- ⚖️ Peso/Perdita grasso
- ⚙️ Impostazioni

**Implementazione:** Switch case in `renderCurrentView()` → carica UI + binding

---

## **8. FUNZIONI DISABILITATE/MOCK**

- ❌ **Analisi foto**: `photoNutrition.js` ha API URL vuoto (ritorna mock data)
- ⏸️ **Service Worker**: Commentato in index.html per debug

---

## **FLUSSO UTENTE TIPICO**

```
1. Primo avvio
   → Onboarding (profilo) 
   → Salva in IndexedDB
   
2. Dashboard
   → Vede target calorico giornaliero
   → Clic "+ Aggiungi alimento"
   
3. Ricerca alimento
   → Digita termine
   → Seleziona da risultati
   → Scegli grammi
   → Pasto aggiunto a meals[]
   
4. Visualizzazione
   → Dashboard aggiorna totali
   → Vede progress vs target
   → Può navigare altre viste
   
5. Analisi peso
   → Inserisce peso giornaliero
   → Sistema calcola TDEE adattivo
   → Mostra proiezione 30 giorni
```

---

Questa è l'app completa: **uno strumento scientifico di monitoraggio nutrizionale con interfaccia glassmorphic moderna, basato su formule validated e tracciamento dettagliato** 📊🎨
