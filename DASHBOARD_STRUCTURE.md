# STRUTTURA COMPLETA DELLA DASHBOARD

## TAB: 🏠 Home (Dashboard)
La dashboard è **una singola colonna verticale** con scroll. Eccone l'ordine dall'alto al basso:

---

## 1️⃣ SEZIONE MACRONUTRIENTI

**Posizione:** Tutta in alto, subito visibile al caricamento

- **Titolo:** "Oggi: [DATA]"
- **Contenuto:** 4 card in 2 righe:
  - **Riga 1 (sinistra-destra):**
    - Card Calorie (blu): mostra `actual/target kcal` e % completamento
    - Card Proteine (viola): mostra `actual/target g` e % completamento
  - **Riga 2 (sinistra-destra):**
    - Card Carboidrati (verde): mostra `actual/target g` e % completamento
    - Card Grassi (giallo): mostra `actual/target g` e % completamento
- **Sotto:** Un alert warning (rosso) se ci sono avvertimenti nutrizionali
- **Sotto:** Un alert blu con disclaimer legale

---

## 2️⃣ SEZIONE ATTIVITÀ ODIERNA

**Posizione:** Subito sotto i macronutrienti

- **Titolo:** "💪 Attività Odierna"
- **Contenuto (se c'è attività):**
  - **2 box in alto:**
    - Box Calorie da Attività (verde): mostra kcal bruciate
    - Box Sessioni (blu): mostra numero di sessioni (💪 strength + 🏃 cardio)
  - **Barra Progressi Passi:**
    - Mostra passi attuali vs obiettivo (es. 0/10000)
    - Barra di avanzamento verde
  - **Badge Achievements:**
    - 🎯 Target raggiunto
    - ⚡ Percentuale attività
    - 💪 Numero sessioni
    - 🔥 Calorie bruciate
- **Se NO attività:** Mostra messaggio "Nessuna attività oggi" con bottone "➕ Aggiungi Attività"

---

## 3️⃣ SEZIONE BILANCIO ENERGETICO ⭐ **NUOVO**

**Posizione:** Sotto le attività

- **Titolo:** Nessun titolo, solo 4 box grandi a griglia 2x2

### Box Layout (2x2 Grid)

#### Box 1 (alto-sinistra):
- **Titolo:** "INTAKE CALORICO"
- **Numero grande:** calorie mangiate oggi (blu)
- **Unità:** "kcal"
- **Styling:** Sfumatura blu, bordo sinistro blu

#### Box 2 (alto-destra):
- **Titolo:** "TDEE"
- **Numero grande:** consumo basale (arancione)
- **Unità:** "kcal"
- **Styling:** Sfumatura arancione, bordo sinistro arancione

#### Box 3 (basso-sinistra):
- **Titolo:** "ESERCIZIO"
- **Numero grande:** calorie da attività con + (verde)
- **Unità:** "kcal"
- **Styling:** Sfumatura verde, bordo sinistro verde

#### Box 4 (basso-destra):
- **Titolo:** "DEFICIT/SURPLUS NETTO"
- **Numero grande:** bilancio finale (colore dinamico):
  - 🔴 **Rosso** (#ef4444) se deficit > 500 → "Deficit Significativo"
  - 🟠 **Arancione** (#f97316) se deficit leggero → "Deficit Leggero"
  - 🔵 **Blu** (#3b82f6) se equilibrio → "Equilibrio"
  - 🟢 **Verde** (#22c55e) se surplus > 500 → "Surplus"
- **Etichetta descrittiva** del bilancio
- **Styling:** Sfumatura dinamica, bordo sinistro dinamico

---

## 4️⃣ SEZIONE ANDAMENTO (TREND 7 GIORNI) ⭐ **NUOVO**

**Posizione:** Sotto il bilancio energetico

- **Titolo:** "📊 Andamento"

### Sottosezione: Grafico a Barre (ultimi 7 giorni)
- **7 barre verticali colorate**
- **Giorni visualizzati:** GIO, VEN, SAB, DOM, LUN, MAR, MER (gli ultimi 7 giorni)
- **Colori delle barre:**
  - 🟢 **Verde** = Deficit (positivo per perdita peso)
  - 🔴 **Rosso** = Surplus (negativo)
- **Altezza barre:** Proporzionale al deficit/surplus
- **Legenda sotto grafico:** "Verde = Deficit | Rosso = Surplus"

### Sottosezione: 3 Box di Statistiche
**Layout:** 3 colonne (1fr 1fr 1fr)

#### Box 1 (sinistra):
- **Titolo:** "DEFICIT MEDIO"
- **Numero:** Verde, valore in kcal/giorno
- **Unità:** "kcal/giorno"

#### Box 2 (centro):
- **Titolo:** "STIMA 30 GIORNI"
- **Numero:** Viola, proiezione in kg
- **Unità:** "kg"
- **Nota:** Proiezione se mantieni il trend attuale

#### Box 3 (destra):
- **Titolo:** "COMPOSIZIONE"
- **Se calibrata:**
  - Massa Grassa (giallo): `X kg`
  - Massa Magra (verde): `X kg`
  - Etichetta: "Massa grassa/Magra"
- **Se NON calibrata:**
  - Testo: "Non calibrata"

### Sottosezione: Box Composizione Futura (opzionale)
**Mostra solo se composizione è tracciata**

- **Titolo:** "Stima Composizione (30 giorni)"
- **2 valori:**
  - Massa Grassa: cambio stimato in kg (giallo)
  - Massa Magra: cambio stimato in kg (verde)

---

## 5️⃣ SEZIONE COMPOSIZIONE CORPOREA

**Posizione:** Sotto l'andamento

- **Titolo:** "📊 Composizione Corporea Stimata" (o messaggio se non calibrata)

### Se Calibrata:
- **3 box orizzontali (1fr 1fr 1fr):**
  - **Peso (blu):** `X kg`
  - **Massa Grassa (giallo):** `X kg (XX%)`
  - **Massa Magra (verde):** `X kg`

- **Avviso scarto (se presente):**
  - ⚠️ Sfondo rosso traslucido
  - Messaggio: "Scarto tra stima e peso misurato: X kg"
  - Suggerimento: "Se lo scarto persiste, valuta di aggiornare la calibrazione BF%."

- **Info box grigio:**
  - Spiega il metodo di calcolo:
    - Body fat % iniziale usato
    - Data baseline
    - Fattori considerati (peso attuale, trend calorico, allenamenti, proteine)
  - Disclaimer: "Non è una misura clinica"
  - **Bottone:** "Aggiorna Calibrazione" (blocco, grigio scuro, font piccolo)

### Se NON Calibrata:
- **Messaggio:** "Per tracciare la tua composizione corporea (massa grassa e magra), inserisci una misurazione iniziale di body fat % da DEXA, BIA o plicometria."
- **Bottone:** "+ Calibra Composizione" (blu, largura 100%)

---

## 6️⃣ BOTTONE AGGIUNGI PASTO

**Posizione:** Sotto la composizione

- **Stile:** Pulsante grande blu (primary)
- **Testo principale:** "+ AGGIUNGI PASTO"
- **Padding:** 1.25rem, font-size 1.1rem, bold
- **Sottotesto:** "Ricerca, stima o personalizzato" (grigio, piccolo, under il bottone)
- **Al clic:** Apre il menu di quick add (ricerca, stima foto, personalizzato)

---

## 7️⃣ SEZIONE CIBI RECENTI

**Posizione:** Sotto il bottone aggiungi

- **Titolo:** "🕐 Recenti"
- **Contenuto:** Lista orizzontale scrollabile di cibi aggiunti di recente
  - Immagine (thumbnail)
  - Nome cibo
  - Calorie
  - Opzioni (aggiungi, favoriti, etc.)
- **Se vuoto:** Messaggio "Nessun cibo recente"

---

## 8️⃣-1️⃣1️⃣ SEZIONI PASTI PER MOMENTO (4 SEZIONI)

**Posizione:** Dal resto della pagina verso il basso

Ogni sezione è un'area collassabile con lista dei pasti.

### COLAZIONE (Sezione 8)
- **Titolo:** "🌅 COLAZIONE"
- **Contenuto:** Lista di pasti aggiunti
  - Ogni pasto mostra: nome, porzione, kcal
  - Pulsanti: modifica, cancella
- **Se vuota:** "Nessun pasto"

### PRANZO (Sezione 9)
- **Titolo:** "☀️ PRANZO"
- **Contenuto:** Lista di pasti aggiunti
- **Se vuota:** "Nessun pasto"

### MERENDA (Sezione 10)
- **Titolo:** "🕐 MERENDA"
- **Contenuto:** Lista di pasti aggiunti
- **Se vuota:** "Nessun pasto"

### CENA (Sezione 11)
- **Titolo:** "🌙 CENA"
- **Contenuto:** Lista di pasti aggiunti
- **Se vuota:** "Nessun pasto"

---

## BOTTOM NAVIGATION BAR

**Posizione:** Sempre visibile in fondo (fixed, bottom: 0)

**6 bottoni disposti orizzontalmente:**
1. 🏠 **Home** (dashboard attiva - evidenziato)
2. 🔍 **Ricerca**
3. 🥘 **Cibi**
4. 📊 **Statistiche**
5. ⚙️ **Impostazioni**
6. 💪 **Allenamenti**

**Styling:** Fixed bottom, z-index elevato, grid 6 colonne

---

## COLORI E STILE

### Tema
- **Background principale:** Scuro (dark mode)
- **Superficie:** Leggermente più chiara che il background
- **Box/Card:** Sfondo semitrasparente con bordi sottili (1px solid var(--border))

### Tipografia
- **Titoli:** Bold, font-size 1.1rem
- **Numeri grandi:** Bold, font-size 2rem (bilancio), 1.5rem (attività)
- **Testo piccolo:** var(--text-muted), font-size 0.75-0.85rem

### Bordi e Gradienti
- **Bordi sinistri:** 4px solid con colore della categoria:
  - Blu (#3b82f6) = Intake/TDEE primario
  - Arancione (#f97316) = TDEE/Spesa
  - Verde (#22c55e) = Esercizio/Deficit
  - Rosso/Blu/Altro = Bilancio (dinamico)
- **Gradient backgrounds:** Sfumature colorate dietro i box (135deg) per profondità visiva
  - Es: `linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.15) 100%)`

### Spaziatura
- **Tra sezioni:** gap: 1rem
- **Dentro box:** padding: 0.75-1rem
- **Border radius:** 8-12px per arrotondamento

---

## STRUTTURA GENERALE

- **Layout:** Singola colonna verticale
- **Scroll:** Verticale infinito (tutto sulla stessa pagina)
- **NON ci sono tab orizzontali** nella dashboard
- **Tutti i dati sono sulla pagina HOME** in ordine fisso
- **Responsive:** Adattabile a mobile/tablet/desktop con media queries

---

## DATI VISUALIZZATI

### Dalla Sezione 1 (Macronutrienti):
- Calorie totali giornaliere vs target
- Proteine totali vs target
- Carboidrati totali vs target
- Grassi totali vs target
- % completamento per ogni macronutriente

### Dalla Sezione 2 (Attività):
- Numero sessioni strength/cardio
- Calorie bruciate da attività
- Passi attuali vs goal
- Badge di achievement

### Dalla Sezione 3 (Bilancio Energetico):
- Intake calorico (dato da sezione 1)
- TDEE base (da profilo utente)
- Calorie da esercizio (da sezione 2)
- Bilancio netto (intake - TDEE - esercizio)
- Label descriptiva del bilancio

### Dalla Sezione 4 (Andamento):
- Daily balance per ultimi 7 giorni (grafico a barre)
- Deficit medio giornaliero
- Stima di cambio peso in 30 giorni
- Composizione corporea attuale (se calibrata)
- Stima composizione corporea futura (se calibrata)

### Dalla Sezione 5 (Composizione):
- Peso attuale
- Massa grassa (kg e %)
- Massa magra (kg)
- Scarto tra stima e peso misurato (se presente)

### Dalle Sezioni 8-11 (Pasti):
- Lista pasti per momento giornaliero
- Kcal per pasto
- Opzioni modifica/cancella

---

## INTERAZIONI PRINCIPALI

1. **Bottone "+ AGGIUNGI PASTO"**
   - Apre menu con: Ricerca, Stima Foto, Personalizzato

2. **Cibi Recenti**
   - Scroll orizzontale
   - Click = aggiunge al pasto corrente

3. **Pasti nelle sezioni**
   - Click nome = modifica
   - Click X = cancella
   - Click ➕ = aggiungi un'altra porzione

4. **Bottone "Aggiorna Calibrazione"**
   - Apre form per aggiornare body fat %

5. **Bottom Nav**
   - Naviga tra le 6 sezioni principali

---

**Generato il:** 2026-05-20
**Versione:** Dashboard con Bilancio Energetico e Trend Settimanale
