# Conta Calorie — Riassunto dell'app

> PWA mobile-first per il tracking di calorie, macronutrienti, attività fisica, peso e composizione corporea. Tutto in italiano, 100% client-side, dati salvati sul dispositivo. Nessun backend.

---

## 1. Cos'è e cosa fa

App single-page (PWA installabile) che permette di:

- **Nutrizione**: registrare i pasti del giorno (colazione, spuntino, pranzo, merenda, cena, altro) con calorie e macro, contro target personalizzati.
- **Database alimenti CREA**: 900 alimenti ufficiali (estratti da alimentinutrizione.it) con ricerca e navigazione gerarchica (base → taglio → con/senza pelle → cottura).
- **Alimenti personalizzati e ricette**: creazione di cibi propri (macro per 100 g) e ricette multi-ingrediente.
- **Piatti composti / stime**: wizard per stimare un piatto scomponendolo o partendo dal database CREA.
- **Attività fisica**: sessioni pesi, cardio e passi giornalieri, con stima calorie (MET / equazioni ACSM) e import passi da file (Google Fit / Apple Health / Health Connect).
- **Peso e composizione corporea**: registro peso, body fat %, baseline e stima ripartizione grasso/massa magra.
- **Stima dimagrimento**: TDEE teorico e adattivo, bilancio energetico, proiezioni peso.
- **Dashboard**: riepilogo giornaliero (macro, bilancio energetico, attività, peso, pasti, trend).

---

## 2. Stack tecnologico

| Aspetto | Scelta |
|---|---|
| Linguaggio | JavaScript vanilla (ES Modules), nessun framework |
| UI | Rendering manuale via template literal + `innerHTML` |
| Stato | Oggetto globale `appState` in `js/app.js` |
| Persistenza | IndexedDB (con fallback a localStorage) |
| Offline | Service Worker (`sw.js`) con pre-caching + PWA installabile |
| Stile | CSS puro (tema dark/light, glassmorphism), ~2.100 righe |
| Build | Nessuna (file statici serviti così come sono) |
| Deploy | Vercel (`vercel.json`), dev server locale `server.js` (porta 3000) |
| Dimensione | ~14.000 righe JS in ~50 moduli |

---

## 3. Architettura a livelli

```
index.html
  └── js/app.js  ← CONTROLLER monolitico (2.416 righe): stato, routing viste, modali
        ├── appBootstrap.js      → init DB, service worker, storage persistente
        ├── storage.js           → CRUD IndexedDB (DB "ContaCalorieDB" v6)
        ├── ENGINE (logica pura, ben isolata)
        │     ├── nutritionEngine.js        → BMR/TDEE, target, aggregati giornalieri
        │     ├── activityEnergyEngine.js   → calorie pesi/cardio/passi (MET, ACSM)
        │     ├── weightLossEstimator.js    → TDEE teorico/adattivo, proiezioni
        │     ├── bodyCompositionModel.js   → ripartizione grasso/massa magra
        │     ├── bodyCompTracker.js        → tracking composizione vs baseline
        │     └── trendProjection.js        → proiezioni da trend reale
        ├── DATI ALIMENTI
        │     ├── nutritionDataProvider.js  → ricerca piatta su CREA
        │     ├── dataPackLoader.js         → ricerca fuzzy su CREA
        │     └── creaHierarchy.js          → navigazione gerarchica + alias
        └── UI (js/ui/*.js) → render + bind eventi per ogni vista
```

**Pattern dei moduli UI**: ogni file espone `renderX()` (ritorna stringa HTML) e `bindXEvents(container, callbacks)` (collega i listener). Il controller `app.js` orchestra render → bind → callback → re-render.

---

## 4. Navigazione

Bottom nav a 4 voci: **🏠 Home (dashboard)**, **🍽️ Nutrizione**, **💪 Fisica**, **⚙️ Impostazioni**.
Esistono viste aggiuntive raggiunte via codice (`search`, `foods`, `week`, `weightLoss`) ma non tutte hanno un punto d'ingresso nella nav. Supporto a swipe tra tab.

---

## 5. Modello dati (IndexedDB "ContaCalorieDB" v6)

Store principali:

| Store | Contenuto | Campo data |
|---|---|---|
| `userProfile` | profilo (id fisso `current`) | — |
| `userFoods` | alimenti personalizzati | — |
| `mealEntries` | pasti registrati | `data` |
| `recipes` | ricette | — |
| `weightsSessions` | sessioni pesi (legacy) | `data` |
| `cardioSessions` | sessioni cardio | `data` |
| `strengthSessions` | sessioni pesi (v5 dettagliato) | `date` ⚠️ |
| `dailySteps` | passi giornalieri | `date` ⚠️ |
| `dailyWeights` | peso giornaliero + bodyfat | `data` |
| `bodyCompBaselines` | calibrazioni composizione | — |
| `activityPreferences` | preferenze attività (id `current`) | — |
| `remoteFoods` | cache (non più usata) | — |

Le entry pasto vengono **migrate al volo** in lettura/scrittura (`_migrateMealEntry`) per aggiungere `sourceType`, `confidenceLevel`, ecc.

---

## 6. Dati alimentari (CREA)

- **`data/italian_foods_full.json`** — 900 alimenti, formato piatto: `{id, name_it, category, kcal_100g, protein_100g, carb_100g, fat_100g, fiber_100g, sugars_100g, portion_g, ...}`.
- **`data/crea_hierarchy.json`** — albero gerarchico (549 basi → tagli → varianti → cotture) per il drill-down nel wizard di stima.
- Fonte unica e autorevole: CREA – alimentinutrizione.it. Tutti i dataset legacy (Open Food Facts, fast food, piatti esteri, valori tipici) sono stati rimossi.

---

## 7. Motori di calcolo (qualità alta, ben documentati e con fonti)

- **Energia/macro**: BMR Mifflin-St Jeor → TDEE (fattori attività) → target con aggiustamento per obiettivo; macro da g/kg proteine + 25% grassi + resto carbo.
- **Attività**: MET (Compendium 2022), equazioni ACSM per treadmill, stima passi, anti-doppio-conteggio camminata, "eat-back" calorie.
- **Composizione corporea**: modello euristico (deficit score, training score, protein score → lean retention) basato su letteratura (Helms, Garthe, Phillips).
- **Dimagrimento**: modello lineare 7700 kcal/kg + TDEE adattivo dai dati reali di peso.

---

## 8. PWA / Offline

- Service worker con **pre-caching** degli asset critici (cache-first) e **network-first** per il resto (dati JSON sempre freschi).
- Installabile (`manifest.webmanifest`), tema chiaro/scuro, banner di aggiornamento quando esce una nuova versione del SW.
- Funziona completamente offline dopo la prima visita.

---

## 9. Stato attuale

App **funzionante e ricca di funzionalità**, con un livello di logica (engine) di buona qualità e un livello UI/controller più disordinato (monolite, stili inline, alcuni bug e codice morto). Vedi `CONSIDERAZIONI_E_MIGLIORIE.md` per l'analisi critica e le proposte.
