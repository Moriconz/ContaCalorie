# UX ARCHITECTURE REDESIGN — CONTA CALORIE

**Data:** 2026-05-20  
**Versione:** 1.0 — Riorganizzazione Home + Tab  
**Principio Guida:** Home = sintesi operativa | Tab = approfondimento specialistico

---

## PARTE 1: ANALISI DELLA SITUAZIONE ATTUALE

### 1.1 Duplicazioni Rilevate nel DASHBOARD_STRUCTURE.md

#### 🔴 DUPLICAZIONE 1: Calorie Intake ripetute
- **Sezione 1 (Macronutrienti):** mostra "Calorie: X/Y kcal" come primo box
- **Sezione 3 (Bilancio Energetico):** mostra "INTAKE CALORICO: X kcal" come box separato
- **Problema:** L'intake calorico è mostrato due volte in due card diverse, causando confusione e spreco di spazio
- **Impatto:** Home diventa ridondante e poco leggibile

#### 🔴 DUPLICAZIONE 2: Composizione corporea ripetuta
- **Sezione 4 (Andamento):** contiene un box "COMPOSIZIONE" con massa grassa/magra e anche una "Sottosezione: Box Composizione Futura"
- **Sezione 5 (Composizione Corporea):** intera sezione dedicata a peso, body fat, massa grassa/magra, baseline, scarti
- **Problema:** Composizione appare sia come mini-snapshot in S4 che come sezione enorme in S5
- **Impatto:** S4 e S5 si sovrappongono; Home è confusa su dove leggere i dati di composizione

#### 🔴 DUPLICAZIONE 3: Attività odierna troppo decorata
- **Sezione 2 (Attività Odierna):** contiene badge achievement (🎯🏆⚡💪), che sono elementi decorativi/secondari
- **Sezione Nel Tab "Allenamenti":** dovrebbe contenere il dettaglio completo di attività
- **Problema:** Home carica badge che non aggiungono informazione critica, quando il valore è solo decorativo
- **Impatto:** La card Attività in Home è più grande del necessario; il badge dovrebbe essere nel tab dedicato

#### 🔴 DUPLICAZIONE 4: Pasti ripetuti in 5 sezioni
- **Sezione 6:** Bottone "+ AGGIUNGI PASTO"
- **Sezione 7:** "Cibi Recenti" (lista scrollabile)
- **Sezioni 8-11:** "COLAZIONE", "PRANZO", "MERENDA", "CENA" (4 sezioni separate)
- **Problema:** 5 sezioni consecutive gestiscono tutte nutrizione/pasti; Recenti è una sezione intera se non vuota
- **Impatto:** Home è dominata da nutrizione; il flusso diventa pesante; non c'è chiarezza su dove aggiungere vs dove consultare

#### 🟠 SOVRAPPOSIZIONE 5: Tab vs Home (architettura confusa)
- **Home:** contiene "Ricerca", "Cibi", "Home", "Statistiche", "Allenamenti" come tab in fondo
- **Problema:** Home è già una vista completa e dettagliata; i tab dovrebbero essere specializzati, ma è confuso cosa va dove
- **Impatto:** Difficile capire se un contenuto debba stare in Home o in un tab dedicato

---

### 1.2 Contenuti che NON dovrebbero stare in Home

1. ❌ Spiegazione lunga della metodologia di composizione corporea (va in tab Peso)
2. ❌ Avviso esteso su scarto di stima vs peso (va in tab Peso)
3. ❌ Form di calibrazione basline (va in tab Peso)
4. ❌ Ricerca alimenti estesa (va in tab Nutrizione)
5. ❌ Elenco cibi recenti intero (va in tab Nutrizione)
6. ❌ Dettagli completi di attività passate (vanno in tab Attività)
7. ❌ Grafici estesi di trend (vanno in tab Statistiche)
8. ❌ Impostazioni profilo/target (vanno in tab Impostazioni)

---

## PARTE 2: NUOVA ARCHITETTURA — HOME SEMPLIFICATA

### 2.1 Principi della Nuova Home

1. **Leggibile in 5-10 secondi:** tutto ciò che serve per capire "come sto oggi"
2. **3 Quick Actions:** + Pasto, + Attività, + Composizione — sempre ben visibili
3. **Zero duplicazioni:** ogni metrica appare una sola volta
4. **Accesso ai tab:** ogni card ha una CTA esplicita verso il tab dettagliato
5. **Empty states chiari:** se non ci sono dati, messaggio breve + CTA

### 2.2 Struttura della Nuova Home (ordine dall'alto al basso)

```
┌─────────────────────────────────────────┐
│ HEADER                                  │
│ Data • Quick actions: +Pasto +Attività  │
│ +Composizione                           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ CARD "OGGI"                             │
│ • Macros (Calorie/Proteine/Carbs/Fat)  │
│ • Bilancio (TDEE + Attività = Bilancio) │
│ • Link: "Vedi dettagli nutrizione"      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ CARD "ATTIVITÀ DI OGGI"                 │
│ • Passi / Obiettivo                     │
│ • Sessioni allenamento                  │
│ • Kcal attività stimate                 │
│ • Link: "Vedi dettagli attività"        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ CARD "PESO E COMPOSIZIONE"              │
│ • Peso attuale                          │
│ • Massa grassa / Magra (se calibrata)   │
│ • Link: "Aggiorna peso"                 │
│ • Link: "Vedi composizione completa"    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ CARD "TREND RAPIDO"                     │
│ • Grafico 7 giorni (mini)               │
│ • Deficit medio                         │
│ • Proiezione 30 giorni                  │
│ • Link: "Vedi statistiche complete"     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ CARD "PASTI DI OGGI"                    │
│ • Colazione (lista pasti compatta)      │
│ • Pranzo (lista pasti compatta)         │
│ • Merenda (lista pasti compatta)        │
│ • Cena (lista pasti compatta)           │
│ • Link: "Vedi ricerca e personalizzato" │
└─────────────────────────────────────────┘
                    ↓
        [BOTTOM NAVIGATION]
```

---

## PARTE 3: DETTAGLIO DELLE NUOVE CARD

### 3.1 HEADER (in alto, sempre visibile o semi-sticky)

**Contenuto:**
- Data odierna (es. "Martedì 20 Maggio 2026")
- **3 Quick Action Buttons in riga orizzontale:**
  - `+ Pasto` (azzurro)
  - `+ Attività` (verde)
  - `+ Composizione` (viola)

**Styling:**
- Background leggero
- Padding compatto
- Buttons 1/3 della larghezza con gap

**Al clic:**
- `+ Pasto` → apre azione sheet / modale per aggiungere pasto (ricerca, stima, personalizzato)
- `+ Attività` → apre azione sheet / modale per aggiungere allenamento, cardio, passi
- `+ Composizione` → apre modale per aggiornare peso o body fat

---

### 3.2 CARD "OGGI" (Macronutrienti + Bilancio Energetico)

**Responsabilità:**
- Unifica Sezione 1 (Macronutrienti) + Sezione 3 (Bilancio Energetico)
- Mostra in un'unica vista integrata cosa ho mangiato e cosa sto consumando

**Struttura interna (2 parti):**

#### Parte A: Macronutrienti
- 4 box in griglia 2x2 (uguale a sezione 1 attuale):
  - Calorie (blu): X / Y kcal — % target
  - Proteine (viola): X / Y g — % target
  - Carboidrati (verde): X / Y g — % target
  - Grassi (giallo): X / Y g — % target

#### Parte B: Bilancio Energetico
- 2 box in riga (semplificato rispetto a sezione 3):
  - **A sinistra:** "SPESA ENERGETICA"
    - TDEE base: X kcal
    - Attività: +X kcal
    - **Totale:** X kcal (in rilievo)
  - **A destra:** "BILANCIO NETTO"
    - Mangiato - Speso = Bilancio
    - Valore grande con colore dinamico (rosso/arancione/blu/verde)
    - Label (Deficit Significativo / Deficit / Equilibrio / Surplus)

**Alerts:**
- Se ci sono avvertimenti nutrizionali (alert warning)

**CTA:**
- Bottone/link "Vedi dettagli nutrizione" → naviga al tab Nutrizione

**Vuoto:**
- Messaggio breve: "Nessun pasto registrato oggi. Aggiungi il tuo primo pasto con il bottone + Pasto in alto."

---

### 3.3 CARD "ATTIVITÀ DI OGGI"

**Responsabilità:**
- Semplificazione della Sezione 2
- Mostra attività di oggi senza eccesso di decorazione
- Link al tab Attività per il dettaglio

**Struttura:**
- **Parte alta:** 2 box in riga
  - Box Passi (blu): "8432 / 10000 passi"
    - Sotto: barra di progresso (verde)
  - Box Sessioni (arancione): "2 sessioni" (1 Forza, 1 Cardio)

- **Parte bassa:** 1 box grande
  - "Kcal Attività: +250 kcal" (verde)

**Styling:**
- Semplice, compatto
- **NO badge achievement** (❌ via dalla Home)
- Colori chiari ma non ornamentali

**CTA:**
- Bottone/link "Vedi dettagli attività" → tab Attività

**Vuoto:**
- Messaggio: "Nessuna attività oggi. Aggiungi un allenamento, cardio o sincronizza i tuoi passi."

---

### 3.4 CARD "PESO E COMPOSIZIONE"

**Responsabilità:**
- Snapshot sintetico di peso e composizione corporea
- Quick actions per aggiornare
- Link al tab completo Peso/Composizione per calibrazione e dettagli

**Struttura (se calibrata):**
- 3 box in riga:
  - Peso (blu): "75.2 kg"
  - Massa Grassa (giallo): "22.5 kg (30%)"
  - Massa Magra (verde): "52.7 kg"

**Struttura (se NON calibrata):**
- Messaggio breve: "Composizione non calibrata. Inserisci il tuo body fat % per iniziare il tracking."
- Bottone: "+ Calibra composizione" (apre modale o va al tab Peso)

**CTA:**
- Bottone "Aggiorna peso" (quick update) → modale veloce o tab
- Bottone "Vedi dettagli" → tab Peso/Composizione

**Nota importante:**
- **NON mettere in questa card:**
  - Spiegazione della metodologia
  - Avviso su scarto di stima
  - Form di calibrazione baseline (va nel tab)
  - Stima futura di composizione (va in tab Statistiche)

---

### 3.5 CARD "TREND RAPIDO"

**Responsabilità:**
- Mini-overview dei dati di trend ultimi 7 giorni
- Non è la versione completa (quella è nel tab Statistiche)
- Serve per rispondere a: "come sto andando in media?"

**Struttura:**
- **Parte alta:** Mini grafico a barre (ultimi 7 giorni, compatto)
  - 7 piccole barre (colori: verde deficit, rosso surplus)
  - Legenda sotto

- **Parte bassa:** 3 metriche in riga
  - "Deficit medio: 450 kcal/giorno" (verde)
  - "Proiezione 30 giorni: 2.1 kg" (viola)
  - "Trend: " (trend positivo/negativo con freccia)

**Styling:**
- Grafico compatto, non enorme
- Metriche chiare e leggibili

**CTA:**
- Bottone/link "Vedi statistiche complete" → tab Statistiche

**Vuoto:**
- Se meno di 7 giorni di dati: "Pochi dati. I trend appariranno dopo 7 giorni di tracking."

---

### 3.6 CARD "PASTI DI OGGI"

**Responsabilità:**
- Fusione di Sezione 6 (Bottone) + Sezione 7 (Recenti) + Sezioni 8-11 (Pasti per momento)
- Mostra i pasti registrati per momento della giornata
- **Recenti spariranno da Home** e vanno nel tab Nutrizione

**Struttura:**
- **Sottosezione Colazione:**
  - Elenco pasti (compatto, nome + kcal)
  - Se vuota: "Nessun pasto"

- **Sottosezione Pranzo:**
  - Elenco pasti (compatto)
  - Se vuota: "Nessun pasto"

- **Sottosezione Merenda:**
  - Elenco pasti (compatto)
  - Se vuota: "Nessun pasto"

- **Sottosezione Cena:**
  - Elenco pasti (compatto)
  - Se vuota: "Nessun pasto"

**Azioni per pasto:**
- Click su nome → modifica il pasto
- Click su X → cancella il pasto
- Click su ➕ → aggiungi un'altra porzione dello stesso

**CTA:**
- Bottone/link al top della card: "Ricerca, personalizzato, ricette" → tab Nutrizione

**Styling:**
- Elenco verticale compatto
- Icone emoji per ogni momento della giornata (🌅🥗🍿🌙)
- Collassabile per momento (espandi/riduci)

---

## PARTE 4: ELIMINAZIONE DELLE SEZIONI

Le seguenti sezioni della DASHBOARD_STRUCTURE.md **spariscono da Home** perché duplicate o troppo dettagliate:

| Sezione Attuale | Destinazione | Motivo |
|---|---|---|
| Sezione 1 (Macronutrienti) | Fusa in Card "Oggi" | Unificata con Bilancio Energetico |
| Sezione 3 (Bilancio Energetico completo 2x2) | Semplificata in Card "Oggi" | Troppo dettagliata; la sintesi basta |
| Sezione 4 (Andamento completo con composizione) | Card "Trend Rapido" (mini) | Troppo grande; dettaglio va in tab Statistiche |
| Sezione 5 (Composizione Corporea enorme) | Ridotta a Card "Peso e Composizione" sintetica | Spostata nel tab Peso/Composizione |
| Sezione 7 (Cibi Recenti intera sezione) | Spostata nel tab Nutrizione | Recenti = feature di ricerca, non di Home |
| Sezioni 8-11 (Pasti per momento singolarmente) | Fuse in Card "Pasti di Oggi" con sottosezioni | Unica card con tabulazioni interne |

---

## PARTE 5: NUOVA ARCHITETTURA DEI TAB

### 5.1 Panoramica

La app avrà **6 tab principali** (bottom navigation):

```
🏠 Home | 🥗 Nutrizione | 💪 Attività | ⚖️ Peso | 📊 Statistiche | ⚙️ Impostazioni
```

**Differenza rispetto a adesso:**
- Viene rimosso il tab "🔍 Ricerca" (funzionalità confluisce in Nutrizione)
- Viene rimosso il tab "🥘 Cibi" (unificato con Nutrizione)
- Viene aggiunto il tab "⚖️ Peso/Composizione" (nuovo, dettagliato)
- Tab "📊 Statistiche" diventa il vero spazio per analytics
- Tab "💪 Attività" ospita tutto ciò che è attività, sport, provider

---

### 5.2 TAB 1 — 🏠 HOME

**Scopo:** Sintesi operativa della giornata + quick actions

**Contiene:**
- Header con 3 quick actions
- Card "Oggi" (macros + bilancio)
- Card "Attività di oggi"
- Card "Peso e composizione"
- Card "Trend rapido"
- Card "Pasti di oggi"

**NON contiene:**
- Ricerca
- Recenti estesi
- Dettagli composizione corporea
- Spiegazioni lunghe
- Grafici di analytics

---

### 5.3 TAB 2 — 🥗 NUTRIZIONE

**Scopo:** Ricerca, logging, personalizzazione di cibo e pasti

**Contiene:**
- **Sezione Ricerca:** Barra di ricerca + risultati alimenti
- **Sezione Cibi Recenti:** Lista scrollabile di cibi usati di recente
- **Sezione Alimenti Personalizzati:** Cibi salvati dall'utente
- **Sezione Piatti/Ricette:** Se esistono ricette salvate
- **Sezione Input Pasto:** Form per aggiungere manualmente
- **Sezione Stima Foto:** Input con foto per stima nutrizionale (se disponibile)
- **Sezione Pasti per Momento (dettagliata):** Elenco esteso di pasti aggiunti con opzioni di modifica/cancella

**Workflow principale:**
1. Cerchi un alimento in Ricerca
2. Lo selezioni
3. Specifichi porzione/quantità
4. Scegli il momento della giornata
5. Aggiungi
6. Viene sincronizzato in Home nella Card "Pasti di oggi"

**CTA:**
- Link in Home "Vedi ricerca e personalizzato" → qui

---

### 5.4 TAB 3 — 💪 ATTIVITÀ

**Scopo:** Logging allenamenti, passi, cardio, provider, storico

**Contiene:**
- **Sezione Attività Odierna (dettagliata):**
  - Elenco sessioni strength + cardio di oggi
  - Opzioni modifica/cancella
  - Badge achievement (🎯⚡💪) SPOSTATI QUI da Home
  - Dettagli HR, RPE, zona, etc.

- **Sezione Passi:**
  - Log manuale passi
  - Sincronizzazione con provider (Google Fit, Health Connect, Apple Health) se presente
  - Storico 7/30 giorni

- **Sezione Cardio:**
  - Inserimento sessioni cardio custom
  - Stima kcal per tipo attività

- **Sezione Pesi/Forza:**
  - Inserimento sessioni palestra
  - Esercizi, serie, ripetizioni
  - Stima kcal

- **Sezione Provider/Sync:**
  - Collegamento Google Fit / Health Connect / Apple Health
  - Stato sincronizzazione
  - Manuale sync se necessario

- **Sezione Storico Attività:**
  - Elenco attività ultimi 7/30 giorni
  - Filtri per tipo (forza, cardio, passi)

**CTA:**
- Link in Home "Vedi dettagli attività" → qui

---

### 5.5 TAB 4 — ⚖️ PESO / COMPOSIZIONE (NUOVO)

**Scopo:** Weight tracking, body composition, baseline, calibrazione, scarti di stima

**Contiene:**
- **Sezione Peso Giornaliero:**
  - Inserimento/aggiornamento peso
  - Grafico storico peso (ultimi 30 giorni)
  - Trend del peso

- **Sezione Body Fat Baseline:**
  - Inserimento BF% iniziale (DEXA, BIA, plicometria)
  - Data baseline
  - Metodo di misurazione
  - Opzione aggiornamento

- **Sezione Composizione Corporea Stimata:**
  - Peso attuale
  - Massa grassa attuale (kg + %) con trend
  - Massa magra attuale (kg) con trend
  - Grafico storico composizione

- **Sezione Scarti e Avvisi:**
  - Avviso scarto tra stima e peso misurato (se presente)
  - Suggerimenti su quando ricalibrare
  - Spiegazione completa del metodo

- **Sezione Metodologia:**
  - Spiegazione lunga di come viene calcolata la composizione
  - Fattori considerati (TDEE, trend calorico, proteine, allenamenti)
  - Disclaimer: "Non è una misura clinica"
  - Quando ricalibrare

**CTA:**
- Link in Home "Vedi composizione completa" → qui
- Quick action "Aggiorna peso" (Home) → apre modale rapido in Home (non va al tab)

---

### 5.6 TAB 5 — 📊 STATISTICHE

**Scopo:** Analytics profonde, trend, proiezioni, insight

**Contiene:**
- **Sezione Trend Calorie:**
  - Grafico intake kcal ultimi 7/30 giorni
  - Media giornaliera
  - vs target

- **Sezione Trend TDEE:**
  - Grafico spesa energetica ultimi 7/30 giorni
  - TDEE base vs extra attività

- **Sezione Bilancio Energetico:**
  - Grafico bilancio (intake - spesa) ultimi 7/30 giorni
  - Deficit medio
  - Proiezione di cambio peso (completa)

- **Sezione Macronutrienti Storico:**
  - Grafico proteine, carbs, grassi vs target
  - Compliance storica

- **Sezione Proiezioni:**
  - Proiezione peso 30 giorni
  - Proiezione composizione corporea 30 giorni (massa grassa + magra)
  - Se mantengo il trend attuale...

- **Sezione Comparazione Periodi:**
  - Settimana scorsa vs questa settimana
  - Mese scorso vs questo mese
  - Trend positivo/negativo

---

### 5.7 TAB 6 — ⚙️ IMPOSTAZIONI

**Scopo:** Profilo, target, preferenze app, modello energetico

**Contiene:**
- **Sezione Profilo:**
  - Nome, genere, data nascita
  - Altezza, peso iniziale, goal peso

- **Sezione Target Nutrizione:**
  - Target calorie giornaliere
  - Target proteine/carbs/grassi

- **Sezione Modello Energetico:**
  - TDEE model (sedentary + activities vs activity factor)
  - Activity factor slider (1.2 - 1.9)
  - Scelta tra "aggiungi attività" vs "moltiplicatore"

- **Sezione Attività (Preferences):**
  - Double counting prevention toggle
  - Include steps in TDEE toggle
  - Step goal slider

- **Sezione Eat-Back:**
  - Modalità eat-back (none / partial / full)
  - Eat-back ratio (% da recuperare)

- **Sezione Tema/App:**
  - Tema (dark/light)
  - Notifiche
  - Lingua

- **Sezione Data/Privacy:**
  - Export data
  - Reset app
  - Disclaimer

---

## PARTE 6: QUICK ACTIONS — DETTAGLIO FLOW

### 6.1 Quick Action: + PASTO

**Trigger:** Click su bottone "+ Pasto" in Header (Home)

**Flow:**

```
1. Apre action sheet con 3 opzioni:
   ├─ Ricerca alimento
   ├─ Aggiungi senza dati
   └─ Alimento personalizzato

2. Se "Ricerca alimento":
   ├─ Naviga al tab Nutrizione (Sezione Ricerca)
   └─ Flusso completo di ricerca, selezione, quantità, momento, aggiunta

3. Se "Aggiungi senza dati":
   ├─ Modale veloce:
   │  ├─ Nome del cibo (input testuale libero)
   │  ├─ Kcal stimate (input numerico)
   │  ├─ Momento della giornata (select: colazione/pranzo/merenda/cena)
   │  └─ Bottone "Aggiungi"
   └─ Aggiunge il pasto e torna a Home

4. Se "Alimento personalizzato":
   ├─ Naviga al tab Nutrizione (Sezione Alimenti Personalizzati)
   └─ Flusso di creazione alimento custom
```

**Ritorno:** Tutti i flow ritornano a Home o restano nel tab Nutrizione a scelta dell'utente

---

### 6.2 Quick Action: + ATTIVITÀ

**Trigger:** Click su bottone "+ Attività" in Header (Home)

**Flow:**

```
1. Apre action sheet con opzioni:
   ├─ Allenamento pesi
   ├─ Cardio
   ├─ Passi manuali
   └─ Sync provider (se configurato)

2. Se "Allenamento pesi":
   ├─ Modale/form veloce:
   │  ├─ Tipo esercizio (select: leg press, panca, etc.)
   │  ├─ Serie e ripetizioni
   │  ├─ Peso utilizzato
   │  ├─ RPE (1-10)
   │  └─ Bottone "Aggiungi sessione"
   └─ Aggiunge e torna a Home o tab Attività

3. Se "Cardio":
   ├─ Modale/form veloce:
   │  ├─ Tipo cardio (select: corsa, nuoto, bici, etc.)
   │  ├─ Durata (minuti)
   │  ├─ Intensità (light/moderate/vigorous)
   │  └─ Bottone "Aggiungi sessione"
   └─ Aggiunge e torna a Home

4. Se "Passi manuali":
   ├─ Modale semplice:
   │  ├─ Numero passi (input numerico)
   │  └─ Bottone "Registra"
   └─ Aggiunge ai passi di oggi

5. Se "Sync provider":
   ├─ Naviga al tab Attività (Sezione Provider/Sync)
   └─ Flusso di sincronizzazione con provider esterno
```

**Ritorno:** Tutti i flow ritornano a Home

---

### 6.3 Quick Action: + COMPOSIZIONE

**Trigger:** Click su bottone "+ Composizione" in Header (Home)

**Flow:**

```
1. Apre action sheet con 2 opzioni:
   ├─ Aggiorna peso
   └─ Aggiorna body fat %

2. Se "Aggiorna peso":
   ├─ Modale veloce:
   │  ├─ Peso in kg (input numerico)
   │  ├─ Data (default: oggi)
   │  └─ Bottone "Salva"
   └─ Registra il peso e torna a Home
   └─ Card "Peso e composizione" si aggiorna istantaneamente

3. Se "Aggiorna body fat %":
   ├─ Modale con opzioni:
   │  ├─ Opzione 1: "Aggiorna calibrazione" 
   │  │  ├─ Apre modale esteso per nuovo baseline
   │  │  ├─ Naviga al tab Peso
   │  │  └─ Flusso completo con spiegazioni
   │  │
   │  └─ Opzione 2: "Quick update misura"
   │     ├─ Input BF% con data e metodo
   │     └─ Aggiorna senza cambiare baseline
   │
   └─ Torna a Home; Card "Peso e composizione" si aggiorna
```

**Ritorno:** Tutti i flow ritornano a Home; se Click "Aggiorna calibrazione" → naviga al tab Peso

---

## PARTE 7: MAPPATURA DEL CONTENUTO

### 7.1 Contenuti che RIMANGONO in Home

✅ Header con data e quick actions  
✅ Card "Oggi" (macros + bilancio)  
✅ Card "Attività di oggi" (semplificata)  
✅ Card "Peso e composizione" (sintetica)  
✅ Card "Trend rapido" (mini)  
✅ Card "Pasti di oggi" (lista compatta per momento)  

**Caratteristica:** Tutto leggibile in 10-15 secondi di scroll

---

### 7.2 Contenuti che ESCONO da Home e vanno nei Tab

| Contenuto | Destinazione Tab | Motivo |
|---|---|---|
| Ricerca alimenti estesa | Nutrizione | Feature di ricerca, non summary |
| Cibi recenti lista | Nutrizione | Recenti = helper di input, non di Home |
| Alimenti personalizzati | Nutrizione | Gestione dati avanzata |
| Dettaglio composizione + metodologia | Peso | Specifico di Peso |
| Avviso scarto stima | Peso | Dettaglio avanzato |
| Form calibrazione baseline | Peso | Input complesso |
| Badge achievement (🎯⚡💪) | Attività | Decorativo, non critico |
| Storico attività 7/30 giorni | Attività + Statistiche | Analytics, non summary |
| Provider/sync configurazione | Attività | Setup avanzato |
| Trend calorie esteso | Statistiche | Analytics |
| Grafico composizione | Statistiche | Analytics |
| Proiezioni avanzate | Statistiche | Analytics |
| Impostazioni TDEE | Impostazioni | Configurazione globale |

---

## PARTE 8: BENEFICI DELLA NUOVA ARCHITETTURA

### 8.1 Per l'Utente

- ✅ **Clarity:** Home non è sovraccarica; capisco subito lo stato odierno
- ✅ **Actionability:** I 3 quick actions sono sempre a portata di mano
- ✅ **No confusion:** Ogni tab ha un proposito chiaro; niente duplicazioni
- ✅ **Fast scanning:** 5-10 secondi per capire "come sto oggi"
- ✅ **Drill-down:** Clic su un link/CTA → accedo ai dettagli quando serve

### 8.2 Per il Codice/Architettura

- ✅ **Responsabilità chiare:** Ogni componente sa cosa mostrare e quando
- ✅ **No ridondanza:** Una metrica appare una sola volta
- ✅ **Modularità:** Card sono indipendenti e riusabili
- ✅ **Scalabilità:** Facile aggiungere nuove metriche nei tab senza gonfiare Home
- ✅ **Maintenance:** Meno dipendenze tra Home e Tab

---

## PARTE 9: MIGRAZIONE DALLA STRUTTURA ATTUALE

### 9.1 Cosa elimina dalla Home (dalle Sezioni DASHBOARD_STRUCTURE.md)

1. ❌ Sezione 1 (Macronutrienti intera) → Unisci a Sezione 3 in "Card Oggi"
2. ❌ Sezione 3 (Bilancio 2x2 completo) → Semplifica e unisci a Sezione 1 in "Card Oggi"
3. ❌ Sezione 4 (Andamento completo) → Crea "Card Trend Rapido" mini
4. ❌ Sezione 5 (Composizione intera) → Riduci a "Card Peso e Composizione"
5. ❌ Sezione 6 (Bottone singolo) → Sposta nei Header Quick Actions
6. ❌ Sezione 7 (Recenti intera) → Spostala nel tab Nutrizione
7. ❌ Sezioni 8-11 (Pasti per momento singolarmente) → Unisci in "Card Pasti di Oggi"

### 9.2 Cosa trasformi

1. 🔄 Sezione 1 + Sezione 3 → **Card "Oggi"**
   - Macros (dei di Sezione 1)
   - Bilancio semplificato (core di Sezione 3, senza troppi box)

2. 🔄 Sezione 2 (senza badge) → **Card "Attività di Oggi"**
   - Mantieni passi, sessioni, kcal
   - Rimuovi badge ornamentali

3. 🔄 Sezione 4 (parte mini) → **Card "Trend Rapido"**
   - Mini grafico 7 giorni
   - 3 metriche (deficit medio, proiezione 30, trend)
   - Rimuovi composizione (va in Card Peso)

4. 🔄 Sezione 5 (parte mini) → **Card "Peso e Composizione"**
   - Peso, massa grassa, massa magra (snapshot)
   - Rimuovi dettagli, metodologia, scarti (vanno nel tab Peso)

5. 🔄 Sezioni 8-11 (unificate) → **Card "Pasti di Oggi"**
   - Elenco compatto per momento della giornata
   - Sottosezioni interne (non 4 card separate)

### 9.3 Cosa sposti nei Tab

1. 📌 Tab Nutrizione
   - Ricerca alimenti (from: nuovo)
   - Cibi recenti (from: Sezione 7)
   - Alimenti personalizzati (from: nuovo)
   - Pasti dettagliati (from: aggiunta)

2. 📌 Tab Attività (nuovo focus)
   - Attività odierna dettagliata (from: parte di Sezione 2)
   - Badge achievement (from: Sezione 2 eliminato)
   - Storico attività (from: nuovo)
   - Provider sync (from: nuovo)

3. 📌 Tab Peso/Composizione (NUOVO tab)
   - Composizione completa (from: Sezione 5)
   - Body fat baseline (from: nuovo)
   - Metodologia e spiegazioni (from: Sezione 5)
   - Avvisi scarti (from: Sezione 5)

4. 📌 Tab Statistiche (espanso)
   - Trend extended (from: Sezione 4 rimozione)
   - Proiezioni avanzate (from: nuovo)
   - Grafici analitycs (from: nuovo)

---

## PARTE 10: PROPOSTA FINALE — ARCHITETTURA

### 10.1 Header della App (Bottom Navigation)

**6 Tab (rimossi "Ricerca" e "Cibi", aggiunti "Peso")**

```
🏠 Home  |  🥗 Nutrizione  |  💪 Attività  |  ⚖️ Peso  |  📊 Statistiche  |  ⚙️ Impostazioni
```

---

### 10.2 Home (🏠)

```
┌───────────────────────────────────┐
│ HEADER                            │
│ 20 Maggio 2026                    │
│ [+ Pasto] [+ Attività] [+ Peso]   │
└───────────────────────────────────┘
         ↓
┌───────────────────────────────────┐
│ CARD "OGGI"                       │
│ Calorie | Proteine | Carbs | Fat  │
│ ─────────────────────────────────  │
│ SPESA: TDEE + Attività = Totale   │
│ BILANCIO: Mangiato - Speso = X    │
│ [Link: Vedi dettagli nutrizione]  │
└───────────────────────────────────┘
         ↓
┌───────────────────────────────────┐
│ CARD "ATTIVITÀ DI OGGI"           │
│ 8432 passi / 10000 | 2 sessioni   │
│ +250 kcal attività                │
│ [Link: Vedi dettagli attività]    │
└───────────────────────────────────┘
         ↓
┌───────────────────────────────────┐
│ CARD "PESO E COMPOSIZIONE"        │
│ 75.2 kg | 22.5 kg grasso (30%)    │
│ [Aggiorna peso] [Vedi dettagli]   │
└───────────────────────────────────┘
         ↓
┌───────────────────────────────────┐
│ CARD "TREND RAPIDO"               │
│ [Grafico 7 giorni mini]           │
│ Deficit medio: -450 kcal/giorno   │
│ Proiezione 30g: 2.1 kg            │
│ [Link: Vedi statistiche complete] │
└───────────────────────────────────┘
         ↓
┌───────────────────────────────────┐
│ CARD "PASTI DI OGGI"              │
│ 🌅 Colazione: 2 pasti             │
│ ☀️ Pranzo: 1 pasto                │
│ 🕐 Merenda: nessuno               │
│ 🌙 Cena: 2 pasti                  │
│ [Ricerca / Personalizzato]        │
└───────────────────────────────────┘
         ↓
    [BOTTOM NAV]
```

---

### 10.3 Nutrizione (🥗)

- Ricerca alimenti (barra + risultati)
- Cibi recenti (lista scrollabile)
- Alimenti personalizzati
- Form input pasto
- Pasti di oggi (dettagliato)

---

### 10.4 Attività (💪)

- Attività odierna (dettagliata con badge)
- Passi (log + sync)
- Cardio (log)
- Pesi/Forza (log)
- Provider sync
- Storico attività

---

### 10.5 Peso (⚖️) — NUOVO

- Peso giornaliero (log + grafico)
- Body fat baseline
- Composizione stimata (dettaglio)
- Scarti e avvisi
- Metodologia

---

### 10.6 Statistiche (📊)

- Trend calorie (grafico)
- Trend TDEE
- Bilancio energetico
- Macronutrienti storico
- Proiezioni 30 giorni
- Comparazioni periodi

---

### 10.7 Impostazioni (⚙️)

- Profilo
- Target nutrizione
- Modello energetico
- Preferenze attività
- Eat-back settings
- Tema/app
- Data/privacy

---

## PARTE 11: CHECKLIST DI IMPLEMENTAZIONE

- [ ] Rimuovere dalle sezioni Home i box duplicati di intake calorico
- [ ] Creare Card "Oggi" (unione Macro + Bilancio semplificato)
- [ ] Semplificare Card "Attività di Oggi" (rimuovere badge)
- [ ] Creare Card "Peso e Composizione" (snapshot, senza dettagli)
- [ ] Creare Card "Trend Rapido" (mini, con CTA a Statistiche)
- [ ] Unificare Sezioni Pasti in Card "Pasti di Oggi"
- [ ] Creare Header con 3 Quick Actions
- [ ] Implementare flow "+ Pasto" (action sheet)
- [ ] Implementare flow "+ Attività" (action sheet)
- [ ] Implementare flow "+ Composizione" (action sheet)
- [ ] Creare tab Peso/Composizione (nuovo)
- [ ] Migrare Cibi Recenti a tab Nutrizione
- [ ] Migrare Ricerca a tab Nutrizione
- [ ] Migrare badge achievement al tab Attività
- [ ] Migrare Trend esteso a tab Statistiche
- [ ] Verificare bottom nav (6 tab, nomi allineati)
- [ ] Test mobile-first responsiveness

---

## PARTE 12: CONCLUSIONI

### Riassunto dei Vantaggi

| Aspetto | Prima | Dopo |
|---|---|---|
| **Home leggibilità** | Difficile, troppo contenuto | Chiara, 5-10 secondi |
| **Duplicazioni** | Intake, composizione, attività ripetuti | Zero duplicazioni |
| **Quick actions** | Sparse o non evidenti | 3 bottoni sempre visibili |
| **Tab chiarezza** | Confuso (Ricerca, Cibi, Home simili) | Ruoli netti (Nutrizione, Attività, Peso, Stat) |
| **Scalabilità** | Difficile aggiungere metriche | Facile espandere singoli tab |
| **Maintenance** | Componenti interdipendenti | Componenti indipendenti |

### Principi Rispettati

✅ **Home = Sintesi operativa**  
✅ **Tab = Approfondimento specialistico**  
✅ **Zero duplicazioni di metriche**  
✅ **3 quick actions chiare**  
✅ **Leggibilità in 5-10 secondi**  
✅ **Mobile-first responsive**  
✅ **Information architecture coerente**  

---

**Generato il:** 2026-05-20  
**Versione:** 1.0 — Redesign Architetturale Completo
