# 📱 CONTA CALORIE — GUIDA COMPLETA DELL'APP

**PWA mobile-first | Offline-first | Dark mode | Dark/Light theme**

---

## 🏗️ STRUTTURA GENERALE

### Architettura
- **Framework:** Vanilla JavaScript (NO framework)
- **Storage:** IndexedDB (dati persistenti) + localStorage (preferenze)
- **UI:** Componenti render function + event binding via callback
- **Navigation:** Bottom nav bar fisso (6 tab)
- **Modali:** Sistema modale universal con overlay

### Data Model

```
Utente: {
  id, nome, email, genere, età, altura (cm), peso iniziale (kg),
  bmr (calorie basali), tdee (consumo giornaliero),
  stepGoal, proteinTarget, carbTarget, fatTarget
}

Pasto: {
  id, date, meal (colazione/pranzo/merenda/cena),
  foods: [{name, kcal, protein, carbs, fat, grams}],
  totals: {kcal, protein, carbs, fat}
}

Attività - Strength: {
  id, date, title, category (gym/home_strength/calisthenics/cross),
  durationMin, intensityRPE (1-10), muscleGroups: [],
  exercises: [{name, sets, reps, weight, muscle}],
  estimatedKcal
}

Attività - Cardio: {
  id, date, cardioType, durationMin, intensityLevel,
  distanceKm, caloriesEstimated
}

Passi: {
  date, steps, distanceKm, activeMinutes, source, syncMeta
}

Peso: {
  date, weight (kg), bodyFatPercent (opzionale), notes
}

Body Composition: {
  date, weight, bodyFatPercent (%), massaGrassa (kg), massaMagra (kg),
  calibratedAt, method (DEXA/BIA/caliper)
}
```

---

## 📋 BOTTOM NAVIGATION (6 TAB FISSI)

### 1️⃣ 🏠 HOME (Dashboard)

**Posizione:** Prima tab, quella di default

#### Sezione Header (In alto)
```
┌─────────────────────────────────┐
│  Oggi: 21 Maggio 2026          │  ← Data corrente
│  + PASTO | + ATTIVITÀ | + PESO  │  ← 3 Quick Actions
└─────────────────────────────────┘
```

**Bottoni Quick Action:**
- **+ PASTO** → Apre modale quick add pasti (3 tab: Ricerca, Stima Foto, Personalizzato)
- **+ ATTIVITÀ** → Naviga a tab Allenamenti
- **+ PESO** → Apre modale aggiornamento peso giornaliero

#### Card 1: OGGI (Macronutrienti + Bilancio Energetico)
```
┌─ OGGI ────────────────────────┐
│  [CALORIE: 1850/2200 kcal]    │  ← Blu, barra progress
│  [PROTEINE: 120/150g]         │  ← Viola, barra progress
│  [CARBS: 200/250g]            │  ← Verde, barra progress
│  [GRASSI: 65/80g]             │  ← Giallo, barra progress
│                                │
│  ⚠️ Avviso: Proteine basse     │  ← Se c'è deficit
│  ℹ️ Disclaimer legale...       │  ← Box blu
│                                │
│  INTAKE: 1850 kcal (Blu)       │  ← Top-left
│  TDEE: 2000 kcal (Arancione)   │  ← Top-right
│  ESERCIZIO: +350 kcal (Verde)  │  ← Bottom-left
│  BILANCIO: -500 kcal (Rosso)   │  ← Bottom-right, colore dinamico
│    "Deficit Significativo"      │  ← Label descrittivo
└────────────────────────────────┘
```

**Calcoli:**
- INTAKE = Sum di tutti i pasti del giorno
- TDEE = BMR × Activity Factor (calcolato in Impostazioni)
- ESERCIZIO = Sum calorie da strength + cardio + passi
- BILANCIO = INTAKE - TDEE - ESERCIZIO

**Colori Bilancio:**
- 🔴 Rosso (#ef4444) se deficit > 500 → "Deficit Significativo"
- 🟠 Arancione (#f97316) se deficit leggero → "Deficit Leggero"
- 🔵 Blu (#3b82f6) se equilibrio ±500 → "Equilibrio"
- 🟢 Verde (#22c55e) se surplus > 500 → "Surplus"

**Azioni:**
- Click sul bottone "Vedi dettagli nutrizione" → Tab Nutrizione

#### Card 2: ATTIVITÀ DI OGGI
```
┌─ ATTIVITÀ DI OGGI ─────────────┐
│  [PASSI: 8500 / 10000] ████░  │  ← Barra progress verde
│  [SESSIONI: 💪 2 | 🏃 1]       │  ← Count strength + cardio
│  [KCAL ATTIVITÀ: 350 kcal]     │  ← Total da esercizio
│                                │
│ SE VUOTO:                      │
│  "Nessuna attività oggi"       │
│  [➕ Aggiungi Attività]        │
└────────────────────────────────┘
```

**Azioni:**
- Click sul card → Tab Allenamenti (dettagli full)
- Bottone "➕ Aggiungi Attività" → Tab Allenamenti

#### Card 3: PESO E COMPOSIZIONE
```
┌─ PESO E COMPOSIZIONE ──────────┐
│  [PESO: 75.2 kg] (Blu)         │
│  [MASSA GRASSA: 22.5% | 16.9kg]│  ← Giallo/Arancione
│  [MASSA MAGRA: 58.3 kg]        │  ← Verde
│                                │
│  [Aggiorna Composizione]       │  ← Bottone
│  [Vedi Dettagli]               │  ← Bottone
└────────────────────────────────┘
```

**Se NON calibrato:** "Non calibrata - Aggiungi baseline BF%"

**Azioni:**
- "Aggiorna Composizione" → Modale calibrazione body fat %
- "Vedi Dettagli" → Tab Peso

#### Card 4: TREND RAPIDO (Ultimi 7 giorni)
```
┌─ TREND RAPIDO ─────────────────┐
│  GIO  VEN  SAB  DOM  LUN  MAR   │
│   ▄    ▃    ▆    ▂    ▅    ▃   │  ← Mini bar chart
│  -200 -150 +100 -300 -250 -180  │  ← Valori sotto barre
│  🟢    🟢    🔴    🟢    🟢    🟢   │  ← Colori (verde=deficit, rosso=surplus)
│                                │
│  DEFICIT MEDIO: 200 kcal/giorno │
│  STIMA 30 GIORNI: -2.0 kg      │
│  COMPOSIZIONE: 22.5% → 21.8%   │  ← Se calibrato
│                                │
│  Trend: ↓ Miglioramento        │  ← Indicatore
└────────────────────────────────┘
```

**Azioni:**
- Click "Vedi Trend Completo" → Tab Statistiche

#### Card 5: PASTI DI OGGI
```
┌─ PASTI DI OGGI ────────────────┐
│  🌅 COLAZIONE                  │
│    • Pane tostato (50g) - 130kcal
│    • Burro (10g) - 72kcal      │
│    Totale: 202 kcal            │
│                                │
│  ☀️ PRANZO                      │
│    • Pasta (80g) - 280kcal     │
│    • Olio (15ml) - 135kcal     │
│    Totale: 415 kcal            │
│                                │
│  🕐 MERENDA                     │
│    "Nessun pasto"              │
│                                │
│  🌙 CENA                        │
│    • Petto pollo (150g) - 280kcal
│    Totale: 280 kcal            │
│                                │
│  TOTALE GIORNALIERO: 1397 kcal │
└────────────────────────────────┘
```

**Azioni per ogni pasto:**
- Click sul nome del pasto → Espande/contrae la lista
- Click sulla X accanto a ogni cibo → Cancella quel cibo
- Click sul + accanto a ogni cibo → Aggiungi altra porzione

#### Card 6: PASTO PRECEDENTE (Recenti)
```
┌─ PASTI RECENTI ────────────────┐
│  [Immagine] Pane Tostato       │  ← Scroll orizzontale
│             50g, 130 kcal      │
│  [Immagine] Pasta Carbonara    │
│             100g, 350 kcal     │
│  [Immagine] Olio Extra         │
│             15ml, 135 kcal     │
└────────────────────────────────┘
```

**Azioni:**
- Click su un cibo → Aggiunge al pasto corrente (chiede portata se la applica direttamente)

---

### 2️⃣ 🍽️ NUTRIZIONE

**Posizione:** Secondo tab

#### Sezione: Macronutrienti Dettagliati
```
┌─ CALORIE ──────────────────────┐
│  1850 / 2200 kcal              │  ← 84% completamento
│  [████████░] 84%               │
│  Mancano: 350 kcal             │
└────────────────────────────────┘

┌─ PROTEINE ─────────────────────┐
│  120 / 150g                    │  ← 80% completamento
│  [████████░] 80%               │
│  Mancano: 30g                  │
│  Fonte principale: Pollo 80g   │
└────────────────────────────────┘

┌─ CARBOIDRATI ──────────────────┐
│  200 / 250g                    │  ← 80%
│  [████████░] 80%               │
│  Mancano: 50g                  │
│  Fonte principale: Pasta 80g   │
└────────────────────────────────┘

┌─ GRASSI ───────────────────────┐
│  65 / 80g                      │  ← 81%
│  [████████░] 81%               │
│  Mancano: 15g                  │
│  Fonte principale: Olio 15ml   │
└────────────────────────────────┘
```

#### Sezione: Dettaglio Pasti per Momento
```
┌─ 🌅 COLAZIONE ─────────────────┐
│  Pane tostato (50g)           │
│    kcal: 130 | pro: 4g        │
│    carb: 25g | fat: 2g        │
│    [✎ Modifica] [✕ Cancella]  │
│                                │
│  Burro (10g)                  │
│    kcal: 72 | pro: 0.1g       │
│    carb: 0g | fat: 8g         │
│    [✎ Modifica] [✕ Cancella]  │
│                                │
│  [+ Aggiungi Cibo]            │
└────────────────────────────────┘
```

**Azioni per ogni cibo:**
- [✎] Modifica → Modale per cambiar porzione
- [✕] Cancella → Conferma e cancella
- [+ Aggiungi] → Quick add per questo pasto momento

#### Sezione: Analisi Settimanale Nutrizione
```
┌─ TREND 7 GIORNI ────────────────┐
│  Lunedì:   1950 kcal ↗         │
│  Martedì:  2100 kcal ↗         │
│  Mercoledì: 1850 kcal ↘        │
│  Giovedì:  2000 kcal →         │
│  Venerdì:  1900 kcal ↘         │
│  Sabato:   2200 kcal ↗         │
│  Domenica: 1980 kcal →         │
│                                │
│  Media: 2000 kcal/giorno       │
│  Min: 1850 | Max: 2200         │
│  Tendenza: Stabile             │
└────────────────────────────────┘
```

---

### 3️⃣ 💪 ALLENAMENTI

**Posizione:** Terzo tab

#### Sezione: Riepilogo Ultimi 7 Giorni
```
┌─ ULTIMI 7 GIORNI ──────────────┐
│  Sessioni Allenamento: 5 giorni│
│  Tempo Totale: 420 min         │  ← Pesi + Cardio
│  Passi Medi: 8500/giorno       │
│  Kcal Attività: 1850 totali    │
└────────────────────────────────┘
```

#### Sezione: Riepilogo Oggi
```
┌─ OGGI ─────────────────────────┐
│  Attività Totale: 350 kcal     │  ← Blu
│  Passi: 8500 / 10000 (85%)     │  ← Verde
│                                │
│  💪 Sessioni Pesi (2)          │
│    • Push Day (60 min)         │
│      RPE: 8 • 350 kcal         │
│      [✎ Modifica] [✕ Cancella] │
│    • Leg Day (45 min)          │
│      RPE: 7 • 280 kcal         │
│      [✎ Modifica] [✕ Cancella] │
│                                │
│  🏃 Sessioni Cardio (1)        │
│    • Corsa (30 min)            │
│      Intensità: Media • 5.2 km │
│      250 kcal                  │
│      [✎ Modifica] [✕ Cancella] │
└────────────────────────────────┘
```

#### Sezione: Aggiungere Attività
```
┌─ ➕ AGGIUNGI ATTIVITÀ ──────────┐
│  [💪 Allenamento Pesi]         │  ← Bottone
│  [🏃 Cardio]                   │  ← Bottone
│  [👣 Passi Manuali]            │  ← Bottone
│  [🔗 Sincronizza Passi]        │  ← Bottone per file import
└────────────────────────────────┘
```

**Bottoni:**

**💪 Allenamento Pesi:**
Apre modale con:
- Data (default oggi)
- Titolo sessione (es. "Push Day")
- Categoria: Palestra / Casa / Calistenia / Cross Training
- Durata in minuti
- Intensità RPE (1-10)
- Checkbox gruppi muscolari (Petto, Schiena, Spalle, Bicipiti, etc.)
- Note opzionali
- ☑️ Modalità dettagliata (aggiunge sezione esercizi specifici)

Se dettagliata: + Aggiungi Esercizio con Nome, Serie, Ripetizioni, Peso, Gruppo muscolare

**🏃 Cardio:**
Apre modale con:
- Data
- Tipo cardio: Corsa, Camminata, Ciclismo, Nuoto, Elliptical, Salto corda, etc.
- Durata in minuti
- Intensità: Bassa / Media / Alta
- Distanza in km (opzionale)
- Note

**👣 Passi Manuali:**
Apre modale con:
- Data
- Numero passi
- Distanza opzionale (km)
- Note

**🔗 Sincronizza Passi:** ← FASE 5
Apre modale selezione provider:
1. Scegli provider (Google Fit, Health Connect, Apple Health, File Generic)
2. Scarica dati da app
3. Upload file CSV
4. Verifica anteprima
5. Importa in IndexedDB

#### Sezione: Sincronizzazione Passi
```
SE NON COLLEGATO:
┌─ 🔗 SINCRONIZZAZIONE PASSI ────┐
│  Nessun provider collegato     │
│  Aggiungi i passi manualmente  │
│  oppure collega un'app di      │
│  salute per import automatico  │
└────────────────────────────────┘

SE COLLEGATO:
┌─ 🔗 SINCRONIZZAZIONE PASSI ────┐
│  📱 Google Fit  [Scollega]     │  ← Bottone
│                                │
│  Ultimo sync: 20 maggio 14:35  │
│  Giorni importati: 15          │
└────────────────────────────────┘
```

#### Sezione: Storico Sessioni
```
┌─ 💪 SESSIONI PESI RECENTI ─────┐
│  Push Day (20 mag)             │
│  60 min • RPE 8 • 350 kcal     │
│  [✎ Modifica] [✕ Cancella]    │
│                                │
│  Leg Day (19 mag)              │
│  45 min • RPE 7 • 280 kcal     │
│  [✎ Modifica] [✕ Cancella]    │
└────────────────────────────────┘

┌─ 🏃 SESSIONI CARDIO RECENTI ───┐
│  Corsa (20 mag)                │
│  30 min • Media • 5.2 km       │
│  [✎ Modifica] [✕ Cancella]    │
└────────────────────────────────┘

┌─ 📊 STORICO PASSI 7 GIORNI ────┐
│  20 mag: 8500 passi            │
│  19 mag: 9200 passi            │
│  18 mag: 7500 passi            │
│  (...)                         │
└────────────────────────────────┘
```

---

### 4️⃣ ⚖️ PESO (Nuovo Tab)

**Posizione:** Quarto tab

#### Sezione: Peso Corrente
```
┌─ PESO CORRENTE ────────────────┐
│  75.2 kg                       │  ← Numero grande
│  Cambiamento da oggi: —        │
│  Cambiamento da inizio: -3.5kg │
│  Trend: ↓ Calando              │
│  [Aggiorna Peso]               │  ← Bottone
└────────────────────────────────┘
```

#### Sezione: Body Composition (Se calibrato)
```
┌─ COMPOSIZIONE CORPOREA ────────┐
│  PESO: 75.2 kg (Blu)           │
│  MASSA GRASSA: 16.9 kg (22.5%) │  ← Giallo
│  MASSA MAGRA: 58.3 kg (77.5%)  │  ← Verde
│                                │
│  Scarto stima/misurato: 0.3 kg │  ← Se c'è scarto
│  ⚠️ Se scarto > 1kg: "Se       │
│  persiste, aggiorna calibrazione"
└────────────────────────────────┘

┌─ CALIBRAZIONE ─────────────────┐
│  Metodo: DEXA                  │
│  Baseline: 20 mag 2026         │
│  Body Fat Iniziale: 23.5%      │
│  [Aggiorna Calibrazione]       │  ← Bottone
│  [Informazioni...]             │  ← Info box
└────────────────────────────────┘
```

**Se NON calibrato:**
```
┌─ COMPOSIZIONE CORPOREA ────────┐
│  Per tracciare la composizione │
│  corporea, inserisci una       │
│  misurazione iniziale di       │
│  body fat % da DEXA, BIA o     │
│  plicometria.                  │
│                                │
│  [+ Calibra Composizione]      │  ← Bottone blu
└────────────────────────────────┘
```

#### Sezione: Storico Peso 30 Giorni
```
┌─ STORICO 30 GIORNI ────────────┐
│  20 mag: 75.2 kg               │
│  19 mag: 75.0 kg  ↓ -0.2kg     │
│  18 mag: 75.3 kg  ↑ +0.3kg     │
│  17 mag: 75.0 kg  ↓ -0.3kg     │
│  (...)                         │
│  Giorno iniziale: 78.7 kg      │
│  Perdita totale: -3.5 kg       │
│  Media cambio: -0.12 kg/giorno │
└────────────────────────────────┘
```

#### Sezione: Grafico Linea Peso
```
  kg
  80 ╮
  78 │ ╲
  76 │  ╲╲
  74 │    ╲╮╭╮
  72 │     ╰╯╰
     └─────────────
       ultimi 30gg
```

#### Sezione: Proiezioni
```
┌─ PROIEZIONI ───────────────────┐
│  Se mantieni il trend attuale: │
│  30 giorni: 74.1 kg (-1.1 kg)  │
│  90 giorni: 71.5 kg (-3.7 kg)  │
│  180 giorni: 68.2 kg (-7.0 kg) │
│                                │
│  Composizione (se calibrata):  │
│  Massa Grassa: 15.8 kg (-1.1kg)│
│  Massa Magra: 58.3 kg (stabile)│
└────────────────────────────────┘
```

---

### 5️⃣ 📊 STATISTICHE

**Posizione:** Quinto tab

#### Sezione: Panoramica Macronutrienti
```
┌─ ULTIMI 7 GIORNI ──────────────┐
│  CALORIE                       │
│  Lun: 1950 | Mar: 2100         │
│  Mer: 1850 | Gio: 2000         │
│  Ven: 1900 | Sab: 2200         │
│  Dom: 1980                     │
│  Media: 2000 kcal              │
│  Target: 2200 kcal             │
│  Gap: -200 kcal/giorno         │
│                                │
│  [GRAFICO A BARRE]             │
│  200 ├──────                   │
│      ├──────────               │
│      ├─────                    │
│      ├──────                   │
│      ├──────                   │
│      ├────────────             │
│      ├──────                   │
│      └                         │
│  Lun Tue Wed Thu Fri Sat Sun   │
└────────────────────────────────┘
```

**Stesso layout per Proteine, Carbs, Grassi**

#### Sezione: Trend Bilancio Energetico (7 giorni)
```
┌─ BILANCIO NETTO (ultimi 7gg) ──┐
│  Lun: -200 kcal (Deficit)      │  ← Verde
│  Mar: -150 kcal (Deficit)      │  ← Verde
│  Mer: +100 kcal (Surplus)      │  ← Rosso
│  Gio: -300 kcal (Deficit)      │  ← Verde
│  Ven: -250 kcal (Deficit)      │  ← Verde
│  Sab: -180 kcal (Deficit)      │  ← Verde
│  Dom: -220 kcal (Deficit)      │  ← Verde
│                                │
│  Media Deficit: 215 kcal/giorno│
│  Proiezione 30 giorni: -2.2 kg │
│  Proiezione 90 giorni: -6.5 kg │
└────────────────────────────────┘
```

#### Sezione: Attività
```
┌─ ATTIVITÀ ULTIMI 7 GIORNI ─────┐
│  Sessioni Allenamento: 5       │
│  Tempo Totale: 420 min         │
│  Kcal da Esercizio: 1850       │
│  Passi Medi: 8500/giorno       │
│  Distanza: 59.5 km             │
│                                │
│  [GRAFICO BARRE SESSIONI]      │
│  Lun: 💪💪 | Tue: — | Wed: 💪  │
│  Thu: 🏃 | Fri: 💪 | Sat: 🏃💪 │
│  Sun: —                        │
└────────────────────────────────┘
```

#### Sezione: Peso (se presente storico)
```
┌─ PESO STORICO ─────────────────┐
│  Inizio: 78.7 kg (20 mag)      │
│  Attuale: 75.2 kg              │
│  Perdita Totale: -3.5 kg       │
│  Perdita Media: -0.12 kg/gg    │
│  Trend: ↓ In calo              │
│                                │
│  [GRAFICO LINEA]               │
│    80 ╮                        │
│    78 │ ╲                      │
│    76 │  ╲╲                    │
│    74 │    ╲╮╭╮                │
└────────────────────────────────┘
```

#### Sezione: Composizione Corporea (se calibrata)
```
┌─ COMPOSIZIONE TREND ───────────┐
│  Massa Grassa: 22.5% → 21.8%   │  ← Miglioramento
│  Cambio stimato: -0.7%         │
│  In kg: -0.5 kg (da 16.9 a 16.4)
│                                │
│  Massa Magra: 77.5% (stabile)  │
│  Cambio stimato: -0.5 kg       │
│  (Effetto solitamente positivo)│
└────────────────────────────────┘
```

#### Sezione: Filtri Timeline
```
┌─ SCEGLI PERIODO ───────────────┐
│  [7 GIORNI] | [30 GIORNI] | [90 GIORNI] | [TUTTO]
└────────────────────────────────┘
```

---

### 6️⃣ ⚙️ IMPOSTAZIONI

**Posizione:** Sesto tab

#### Sezione: Profilo Utente
```
┌─ PROFILO ──────────────────────┐
│  Nome: Riccardo Moretti        │
│  Email: riccardo@example.com   │
│  [Modifica Profilo]            │  ← Bottone
│                                │
│  Genere: Uomo                  │
│  Età: 28 anni                  │
│  Altura: 175 cm                │
│  Peso Attuale: 75.2 kg         │
│  [Aggiorna Dati]               │  ← Bottone
└────────────────────────────────┘
```

#### Sezione: Obiettivi Nutrizionali
```
┌─ TARGET MACRONUTRIENTI ────────┐
│  Calorie Giornaliere: 2200 kcal│
│  (Calcolato da BMR × Attività) │
│                                │
│  Proteine: 150 g/giorno (27%)  │
│  [Modifica]                    │
│                                │
│  Carboidrati: 250 g/giorno (45%)
│  [Modifica]                    │
│                                │
│  Grassi: 80 g/giorno (33%)     │
│  [Modifica]                    │
│                                │
│  ℹ️ BMR Calcolato: Harris-     │
│  Benedict Formula = 1800 kcal  │
│  Fattore Attività: 1.22x       │
│  TDEE = 2200 kcal              │
└────────────────────────────────┘
```

#### Sezione: Preferenze Attività
```
┌─ PREFERENZE ATTIVITÀ ──────────┐
│  Step Goal: 10000 passi        │
│  [Modifica]                    │
│                                │
│  Attività Media Settimanale:   │
│  Bassa / Moderata / Alta       │
│  [Corrente: Moderata]          │
│                                │
│  Fattore BMR: 1.22x            │
│  (Calcolato automaticamente)   │
└────────────────────────────────┘
```

#### Sezione: Tema e Visualizzazione
```
┌─ TEMA ─────────────────────────┐
│  Modalità: [🌙 Dark] | [☀️ Light]
│  Salvataggio: Automatico       │
│  (Preferenza nel localStorage) │
└────────────────────────────────┘
```

#### Sezione: Database e Backup
```
┌─ GESTIONE DATI ────────────────┐
│  Storage Utilizzato: 2.3 MB    │
│  [Esporta Dati] (CSV)          │  ← Bottone
│  [Importa Dati] (CSV)          │  ← Bottone
│  [Cancella Tutto]              │  ← Bottone rosso (richiede conferma)
│                                │
│  Service Worker: Attivo        │
│  App Offline: ✅ Funzionante   │
│  Ultimo Sync: 20 mag 15:30     │
└────────────────────────────────┘
```

#### Sezione: Informazioni App
```
┌─ INFORMAZIONI ─────────────────┐
│  Nome: Conta Calorie           │
│  Versione: 1.0.0               │
│  Build: 20260521               │
│  PWA: ✅ Installabile          │
│  Tema: Dark/Light (Auto)       │
│                                │
│  [Installa App]                │  ← Se disponibile
│  [Info Legali]                 │
│  [Ringraziamenti]              │
└────────────────────────────────┘
```

---

## 🎯 QUICK ADD PASTI (Modale)

Aperto da bottone **+ PASTO** in Home o da click su card Pasti

```
┌─ ➕ AGGIUNGI PASTO ────────────┐
│  Data: [21 maggio 2026]        │
│  Momento: [Colazione ▼]        │  ← Dropdown
│                                │
│  ┌─ TAB 1: 🔍 RICERCA ─────────┐
│  │ Cerca alimento...           │
│  │ [Barra di ricerca]          │
│  │ (lista database alimenti)   │
│  │ • Pane Integrale            │
│  │ • Pasta Fresca              │
│  │ • Pollo Arrosto             │
│  │ [x] Nessun risultato        │
│  └─────────────────────────────┘
│
│  ┌─ TAB 2: 📷 STIMA FOTO ──────┐
│  │ Scatta o carica foto piatto │
│  │ Descrivi quello che vedi... │
│  │ [Fotocamera] [Galleria]     │
│  │ [Stima Calorie]             │
│  └─────────────────────────────┘
│
│  ┌─ TAB 3: 📝 PERSONALIZZATO ──┐
│  │ [+ Nuovo Alimento Personalized]
│  │ Oppure seleziona da precedenti:
│  │ • Pasta Carbonara (custom)  │
│  │ • Frullato Proteine (custom)│
│  └─────────────────────────────┘
│
│  ┌─ SE SELEZIONATO ALIMENTO ──┐
│  │ Nome: Pane Integrale        │
│  │ Kcal per 100g: 220          │
│  │ Proteine: 8g               │
│  │ Carboidrati: 40g           │
│  │ Grassi: 2g                 │
│  │                             │
│  │ Porzione: [___] g          │
│  │ Oppure: [1 fetta] [2 fette]│
│  │                             │
│  │ TOTALE: 220 kcal (100g)    │
│  │ TOTALE: 440 kcal (200g)    │  ← Aggiorna con slider
│  │                             │
│  │ [✕ Cancella] [✓ Aggiungi]  │
│  └─────────────────────────────┘
│
└────────────────────────────────┘
```

**Flusso:**
1. Seleziona momento (colazione/pranzo/merenda/cena)
2. Scegli tab (Ricerca / Stima Foto / Personalizzato)
3. Scegli alimento
4. Inserisci porzione in grammi
5. Click "Aggiungi"
6. Ritorna a Home con pasto aggiornato

---

## 🧬 CUSTOM FOOD FORM (Modale)

Aperto da "📝 PERSONALIZZATO" → "+ Nuovo Alimento Personalizzato"

```
┌─ ➕ NUOVO ALIMENTO ─────────────┐
│  Nome Alimento:                │
│  [Pasta Carbonara]             │
│                                │
│  Macro per 100 grammi:         │
│  Kcal: [460]                   │
│  Proteine: [18g]               │
│  Carboidrati: [45g]            │
│  Grassi: [20g]                 │
│                                │
│  Porzione Base: [100g]         │
│  (per il calcolo rapido)       │
│                                │
│  [Salva Alimento] [Annulla]    │
└────────────────────────────────┘

DOPO SALVATAGGIO:
Ritorna al quick add con il nuovo alimento
selezionato pronto per la porzione.
```

---

## 📸 PHOTO ANALYSIS (Modale)

Aperto da "📷 STIMA FOTO"

```
┌─ STIMA FOTO ───────────────────┐
│  Carica o scatta una foto del  │
│  piatto che hai mangiato       │
│                                │
│  [📸 Scatta Foto] [📁 Carica]  │
│                                │
│  DOPO UPLOAD:                  │
│  Descrizione piatto:           │
│  [Pasta carbonara con contorni]│
│                                │
│  Ingredienti stimati:          │
│  • Pasta (200g) - 700 kcal     │
│  • Uova (2) - 140 kcal         │
│  • Guanciale (80g) - 240 kcal  │
│  • Pecorino (30g) - 120 kcal   │
│  TOTALE: 1200 kcal             │
│                                │
│  [Modifica] [✓ Aggiungi]       │
└────────────────────────────────┘

NOTA: Sistema di stima basato su
descrizione testuale (no AI image
processing — ridimensionato a MVP)
```

---

## ⚡ MODAL SYSTEM (Generale)

Tutti i modali funzionano con:
- Overlay semi-trasparente dark
- Scroll verticale se contenuto > viewport
- Close button [✕] in alto a destra
- Bottoni Annulla / Salva in basso
- Chiusura al click su overlay (opzionale)
- Animation slide-up da basso

---

## 🎨 COLORI & TEMA

### Dark Mode (Default)
```
Background: #0f0f1e (blu scurissimo)
Surface (card): rgba(30, 30, 50, 0.6)
Border: rgba(100, 100, 150, 0.2)
Text: #e8e8f0 (grigio chiaro)
Text Muted: rgba(150, 150, 170, 0.7)
Primary: #6366f1 (indaco)
```

### Light Mode
```
Background: #f8f8fc (grigio-blu chiarissimo)
Surface: rgba(255, 255, 270, 0.8)
Border: rgba(100, 100, 150, 0.15)
Text: #1a1a2e (nero-blu)
Text Muted: rgba(100, 100, 120, 0.6)
Primary: #6366f1 (indaco)
```

### Colori Semantici
```
Kcal/Calorie: 🔵 #3b82f6 (Blu)
Proteine: 🟣 #a855f7 (Viola)
Carboidrati: 🟢 #22c55e (Verde)
Grassi: 🟡 #eab308 (Giallo)
Deficit: 🟢 #22c55e (Verde - positivo per perdita peso)
Surplus: 🔴 #ef4444 (Rosso - negativo)
Warning/Deficit Significativo: 🔴 #ef4444
Light Deficit: 🟠 #f97316 (Arancione)
Equilibrio: 🔵 #3b82f6 (Blu)
Success: 🟢 #22c55e
Danger: 🔴 #ef4444
```

---

## 📱 RESPONSIVE

- **Mobile:** Single column, scroll verticale (layout default)
- **Tablet:** 2-column grid opzionale su statistiche
- **Desktop:** Responsive grid con max-width 1000px

---

## 💾 STORAGE

### IndexedDB Stores
```
userProfile          (1 record: dati utente)
userFoods            (Custom foods)
mealsByDate          (Pasti giornalieri)
dailyWeights         (Peso giornaliero)
strengthSessions     (Allenamenti pesi)
cardioSessions       (Sessioni cardio)
dailySteps           (Passi giornalieri)
bodyCompBaselines    (Calibrazioni body fat %)
recipes              (Ricette salvate)
activityPreferences  (Preferenze allenamenti)
```

### localStorage (Preferenze Utente)
```
theme                 (dark/light)
onboardingComplete    (boolean)
activitySyncProvider  (ID provider sincronizzazione)
activitySyncLastTime  (timestamp)
activitySyncDaysCount (numero giorni importati)
```

---

## 🔄 FLUSSI PRINCIPALI

### Flusso 1: Aggiungere Pasto
```
Home [+ PASTO] 
  → Quick Add Modal 
  → Seleziona momento 
  → Scegli alimento (ricerca/foto/custom) 
  → Inserisci porzione 
  → [Aggiungi] 
  → Salva in IndexedDB 
  → Home si aggiorna
```

### Flusso 2: Aggiungere Allenamento Pesi
```
Home [+ ATTIVITÀ] 
  → Tab Allenamenti 
  → [💪 Allenamento Pesi] 
  → Modale con form completo 
  → [Salva] 
  → Salva in IndexedDB 
  → Calola kcal stimato (MET × peso × minuti) 
  → Tab si aggiorna
```

### Flusso 3: Sincronizzare Passi (FASE 5)
```
Tab Allenamenti [🔗 Sincronizza Passi]
  → Provider Selection Modal 
  → Seleziona provider 
  → File Import Modal 
  → Drag-drop o browse CSV 
  → Anteprima dati 
  → [Importa] 
  → Loop e saveDailySteps 
  → localStorage aggiornato 
  → Sync status aggiornato
```

### Flusso 4: Aggiornare Peso
```
Home [+ PESO]
  → Weight Update Modal
  → Input peso in kg
  → [Salva]
  → saveDailyWeight in IndexedDB
  → Aggiorna Body Composition calcolato
  → Toast: "✅ Peso salvato"
  → Home si aggiorna
```

### Flusso 5: Calibrare Body Fat %
```
Tab Peso [Calibra Composizione]
  → Modale con:
    - Method dropdown (DEXA/BIA/Caliper)
    - Body Fat % input
    - Data baseline
  → [Salva]
  → saveBodyCompBaseline in IndexedDB
  → Attiva composizione corporea
  → Calcoli stimati su peso
```

---

## 🧮 CALCOLI PRINCIPALI

### BMR (Basal Metabolic Rate)
```
Harris-Benedict Formula:
Uomo: 88.362 + (13.397 × weight_kg) + (4.799 × height_cm) − (5.677 × age)
Donna: 447.593 + (9.247 × weight_kg) + (3.098 × height_cm) − (4.330 × age)
```

### TDEE (Total Daily Energy Expenditure)
```
TDEE = BMR × Activity Factor

Activity Factors:
- Sedentario: 1.2
- Moderato: 1.37-1.55
- Attivo: 1.55-1.75
- Molto Attivo: 1.725-1.9
```

### Kcal da Esercizio (MET Formula)
```
Kcal = MET × weight_kg × duration_hours

Esempi MET:
- Camminata lenta (3 km/h): 2.8
- Camminata veloce (5 km/h): 3.8
- Jogging: 7.0
- Corsa veloce (13 km/h): 10.0
- Ciclismo moderato: 8.0
- Nuoto: 10.0
- Sollevamento pesi: 6.0
```

### Body Composition (Stima)
```
Baseline: misuri body fat % iniziale (DEXA/BIA/caliper)
Fat Mass (kg) = weight × body_fat_%
Lean Mass (kg) = weight − fat_mass

Cambio stimato:
- Per ogni -7700 kcal deficit → -1 kg grasso
- Per ogni +7700 kcal surplus → +1 kg grasso
- Lean mass assumed constant (con adeguate proteine)
```

### Deficit/Surplus Giornaliero
```
Daily Balance = Intake Calorico − TDEE − Kcal Esercizio

Intake = Sum di tutti i pasti del giorno
TDEE = Consumo basale
Kcal Esercizio = Sum da strength + cardio + passi
```

---

## 🔐 PRIVACY & OFFLINE

- ✅ **Completamente offline:** Niente server, tutto locale
- ✅ **PWA:** Installabile come app nativa
- ✅ **Service Worker:** Cache-first strategy
- ✅ **IndexedDB:** Persistenza dati locale (non cloud)
- ✅ **localStorage:** Solo preferenze non sensibili
- ✅ **No API calls:** Nessun tracciamento esterno

---

## 🚀 INSTALLAZIONE

### Browser
```
Visita: http://localhost:8000
O scarica il file .zip e apri index.html
```

### Mobile (PWA)
```
1. Apri app su Safari/Chrome mobile
2. Bottone "Condividi" / "Menu"
3. "Aggiungi alla Home"
4. Icon della app sulla home screen
5. Accesso offline
```

---

## 📝 RIASSUNTO FINALE

**Conta Calorie** è un'app di tracciamento nutrizionale e fitness completa:

✅ **6 Tab principali** (Home, Nutrizione, Allenamenti, Peso, Statistiche, Impostazioni)
✅ **Tracciamento macros** (Calorie, Proteine, Carbs, Grassi)
✅ **Allenamenti** (Pesi con esercizi, Cardio, Passi)
✅ **Sincronizzazione passi** (Google Fit, Health Connect, Apple Health, CSV generico)
✅ **Peso & Composizione** (Con calibrazione body fat %)
✅ **Statistiche dettagliate** (7/30/90 giorni, grafici, proiezioni)
✅ **Custom foods** (Aggiungi alimenti personalizzati con macro)
✅ **Offline-first** (PWA, IndexedDB, Service Worker)
✅ **Dark/Light theme** (Auto con preferenza)

**Tutto locale, privacy garantita, nessun backend! 🎉**
