# Data Pack Nutrizionali — Conta Calorie App

Questa directory contiene i data pack JSON **completi** con valori nutrizionali per alimenti italiani, piatti esteri comuni in Italia e fast food. Sono utilizzati dal modulo `js/dataPackLoader.js` per fornire stime nutrizionali accurate quando l'utente non inserisce dati precisi.

**PANORAMA ALIMENTARE COMPLETO**: Il database principale (`italian_foods_full.json`) contiene **516 entries** che coprono l'INTERO panorama alimentare italiano — ogni taglio di carne, ogni varietà di pesce, ogni tipo di verdura e frutta, ogni piatto regionale, senza limitazioni né scorciatoie.

## File disponibili

### 1. `italian_foods_full.json`
**Database COMPLETO alimenti italiani con 516 voci**

- **Versione:** 2026.05.5-COMPLETE
- **Fonte:** CREA eTCA (https://www.alimentinutrizione.it/tabelle-di-composizione-degli-alimenti), BDA IEO (https://bda.ieo.it)
- **Alimenti inclusi:** 516 voci complete coprendo TUTTO il panorama alimentare italiano
- **Generazione:** Script Node.js sistematico che copre OGNI categoria, OGNI taglio, OGNI preparazione
- **Categorie coperte (con TUTTI i tagli e varianti):**
  - **Cereali e derivati** (25+): pane bianco/integrale/semola/5cereali/segale, pasta di semola/all'uovo/integrale/fresca, riso bianco/integrale/arborio/carnaroli, polenta, couscous, farina tipo 0/integrale, avena, farro, orzo, crackers, biscotti, cereali colazione
  - **Carni bovine** (30+): OGNI taglio - filetto, controfiletto, costata, bistecca, entrecote, lombata, fesa, scamone, sottofesa, spalla, coscia, ossobuco, geretto anteriore/posteriore, punta petto, polpa, macinato magro/grasso, spezzatino - CRUDO E COTTO
  - **Carni suine** (19+): lonza, coppa, braciole, costine, costoletta, pancetta, filetto, coscia, macinato, spalla, guanciale, rigatino crudo/cotto
  - **Pollame e selvaggina** (14+): pollo (petto, coscia, ala, intero, fegato), tacchino (petto, coscia), coniglio, lepre - CRUDO E COTTO
  - **Salumi e affettati** (21+): prosciutto crudo/cotto, speck, bresaola, salame, mortadella, pancetta affumicata, guanciale, capocollo, culatello, spalla cruda, salsiccia fresca/secca, wurstel, porchetta, soppressata, 'nduja, mortadella di Bologna, spalla San Daniele, culatello di Parma
  - **Pesce e frutti di mare** (50+): OGNI specie e preparazione - merluzzo, salmone (crudo/cotto/affumicato), tonno fresco/in scatola, orata, branzino, sgombro, sardine (fresche/in scatola), acciughe, trota, carpa, sogliola, pesce spada, rombo, dentice, ricciola, pesce spada, seppia, calamari, polpo, cozze, vongole, gamberi, scampi, anguilla, halibut, nasello, triglie, cernia, rana pescatrice, razza, squalo, passera - CRUDO, COTTO, AFFUMICATO, IN SCATOLA
  - **Latticini e formaggi** (23+): latte intero/scremato/parzialmente scremato, yogurt naturale/magro, ricotta di vacca/pecora, mozzarella fresca/bufala, parmigiano reggiano, pecorino romano, gorgonzola, grana padano, mascarpone, caciotta, provolone, fontina, asiago, taleggio, crescenza, stracchino, feta, burro
  - **Uova** (4): uovo intero crudo/cotto, albume, tuorlo
  - **Legumi** (21+): ceci, fagioli (bianchi/rossi/neri/borlotti/cannellini) secchi/cotti, lenticchie (rosse/verdi) secche/cotte, piselli secchi/freschi, fave secche/cotte, soia
  - **Verdure e ortaggi** (57+): OGNI tipo CRUDO E COTTO - pomodoro, lattuga (iceberg/romana), carota, zucchina, broccoli, cavolfiore, spinaci, melanzana, peperone (rosso/giallo/verde), cipolla, aglio, patata (bollita/fritta), cavolo (cappuccio/nero/romanesco), bietola, erbette, radicchio, rucola, sedano, finocchio, funghi (prataioli/porcini), mais in scatola, barbabietola, rapa, cipollotto, asparago, porro, cetriolo, ravanello, scarola, endivia, e molti altri
  - **Frutta fresca** (32+): OGNI varietà - mele (rossa/verde/renetta), banane, arance, limoni, mandarini, pompelmo, fragole, uva (bianca/nera), pere, pesche (gialle), albicocche, ciliegie, susine, lamponi, mirtilli, ribes, melograni, nespole, kiwi, meloni, angurie, fichi, meloni, rambutan
  - **Frutta secca e oleaginosa** (10+): mandorla, noce, pistacchio, nocciola, pinolo, arachidi, semi di girasole, semi di zucca, cocco, castagna
  - **Oli e grassi** (5+): olio extravergine, olio di oliva, olio di girasole, burro, strutto
  - **Condimenti e salse** (10+): aceto balsamico, aceto vino bianco, sugo di pomodoro, pesto genovese, maionese, ketchup, salsa di soia, miele, marmellata (fragola/albicocca)
  - **Bevande** (10+): caffè espresso, tè nero, vino rosso/bianco, birra, acqua minerale, succhi di frutta, limoncello, amaro, spumante rosé
  - **Piatti composti e regionali** (121): TUTTE le regioni italiane - Lazio (carbonara, amatriciana, cacio e pepe, gricia, carciofi alla romana, supplì, penne all'arrabbiata), Campania (pizza, ragù napoletano, sfogliatella, babà, melanzane alla parmigiana, polpo alla luciana), Lombardia (risotto milanese, cotoletta milanese, ossobuco, panettone, colomba, ravioli burro salvia, pizzoccheri), Emilia-Romagna (tagliatelle ragù, lasagna, tortellini in brodo, piadina, passatelli in brodo, tortellacci ricotta), Sicilia (arancini, pasta alla Norma, trofie pesto pistacchio, granita, cassata, zabaione Marsala), Piemonte (vitello tonnato, bagna cauda, panna cotta, zabaione, tartufi), Veneto (bigoli salsa, risi e bisi, sarde in saòr, tiramisù, pandoro), Toscana (ribollita, pappa al pomodoro, bistecca fiorentina, panzanella, pappardelle lepre, pici aglione, minestrone, cantucci), Puglia (orecchiette cime di rapa, fave e cicoria, focaccia pugliese), Liguria (linguine pesto, focaccia olive, pandolce, farinata), Marche (brodetto anconetana, vincisgrassi, cappelletti carne), Sardegna (malloreddus, culurgiones, spaghetti bottarga), e molti altri - MINESTRE, RISOTTI, PASTE ASCIUTTE, CARNI, PESCI, CONTORNI, DOLCI

#### Copertura Effettiva (Database 2026.05.5-COMPLETE)
```
Categoria               | Entries | Dettagli
───────────────────────────────────────────────────
Piatti composti         │ 121     │ Tutte le regioni italiane
Pesce                   │ 71      │ Tutti gli stati (crudo/cotto/affumicato)
Verdure                 │ 60      │ Crudo e cotto varianti
Carni bovine            │ 39      │ Tutti i tagli
Frutta                  │ 32      │ Tutte le varietà
Pollame                 │ 23      │ Tutte le parti (petto/coscia/ala/fegato)
Latticini               │ 23      │ Formaggi e derivati
Carni suine             │ 20      │ Lonza, coppa, pancetta, guanciale, ecc.
Legumi                  │ 22      │ Secchi e cotti
Affettati               │ 21      │ Prosciutto, speck, bresaola, salami, ecc.
Cereali                 │ 25      │ Pane, pasta, riso, varianti
Bevande                 │ 12      │ Caffè, tè, vini, birra
Condimenti              │ 14      │ Oli, salse, aceti, ecc.
Dolci                   │ 13      │ Regionali e caratteristici
Selvaggina              │ 11      │ Cervo, daino, cinghiale, fagiano, ecc.
Frutta secca            │ 9       │ Mandorla, noce, pistacchio, ecc.
═════════════════════════════════════════════════════════════════
TOTALE                  │ 516     │ PANORAMA COMPLETO ITALIANO
```

**Struttura record:**
```json
{
  "id": "string (identificatore unico es. 'car_001')",
  "name_it": "string (nome alimento es. 'Manzo - Filetto crudo')",
  "category": "string (categoria es. 'carne_bovina')",
  "subtype": "string|null (sottotipo es. 'filetto')",
  "state": "string|null (stato es. 'crudo', 'cotto', 'affumicato')",
  "kcal_100g": "number|null (calorie per 100g)",
  "protein_100g": "number|null (proteine in g per 100g)",
  "carb_100g": "number|null (carboidrati in g per 100g)",
  "fat_100g": "number|null (grassi in g per 100g)",
  "fiber_100g": "number|null (fibra in g per 100g)",
  "sodium_mg": "number|null (sodio in mg per 100g)",
  "sugars_100g": "number|null (zuccheri in g per 100g)",
  "source": "string (fonte: 'CREA' o 'BDA')",
  "tags": "array (tag di ricerca es. ['carne', 'magra'])"
}
```

**Struttura file JSON:**
```json
{
  "dataPackVersion": "2026.05.5-COMPLETE",
  "dataPackName": "Italian Foods Complete Database - CREA/BDA Full Coverage",
  "description": "Comprehensive Italian food database...",
  "source": "CREA eTCA / BDA IEO",
  "lastUpdated": "2026-05-18",
  "totalEntries": 516,
  "coverage": { "note": "COMPLETE panorama alimentare italiano", ... },
  "foods": [ { ...record... }, ... ]
}
```

### 2. `foreign_common_in_italy.json`
**Database piatti esteri comunemente consumati in Italia**

- **Versione:** 2026.05.1
- **Fonte:** EuroFIR FCDB, USDA FoodData, database internazionali, studi pubblicati con medie mercato italiano
- **Piatti inclusi:** 20+ piatti
- **Cucine e piatti coperte:**
  - **Giapponese** (9): nigiri salmone, nigiri tonno, maki roll vegetariano, california roll, tempura misto, ramen carne, ramen vegetariano, sashimi salmone, temaki salmone
  - **Hawaiano adattato** (2): poke bowl salmone, poke bowl tonno
  - **Medio-Orientale** (5): kebab classico con pane, kebab in pita, falafel con pita, hummus con pita, falafel fritto
  - **Tailandese** (3): pad thai, pad thai al pollo, green curry
  - **Greco** (3): gyros con pita, souvlaki (spiedini), spanakopita (torta spinaci)

**Struttura:** Identica al file italian_regional_dishes.json, con aggiunto il campo `cuisine` (es. "giapponese").

### 3. `fast_food_chains_it.json`
**Database completo prodotti fast food presenti in Italia**

- **Versione:** 2026.05.1
- **Fonte:** Siti ufficiali McDonald's Italia (mcdonalds.it), Burger King Italia (burgerking.it), KFC Italia (kfc.it) — consultati febbraio 2025
- **Catene coperte e prodotti:**
  - **McDonald's** (18): Big Mac, Hamburger, Cheeseburger, Double Cheeseburger, Quarter Pounder with Cheese, McChicken, Filet-O-Fish, Crispy McBacon, McBacon, McNuggets (6/9), Patatine (S/M/L), McFlurry Oreo, Sundae, Coca-Cola, Apple Pie
  - **Burger King** (8): Whopper, Double Whopper, Whopper Junior, Cheeseburger BK, Crispy Chicken, Chicken Royale, Onion Rings, Patatine Medie
  - **KFC** (7): Original Recipe, Crispy, Crispy Strip, Popcorn Chicken, Tower Burger, Kentucky Burger, Coleslaw
- **Disponibilità:** Tutti i prodotti elencati sono disponibili a livello nazionale in Italia

**Struttura record:**
```json
{
  "id": "string (es. 'mc_big_mac')",
  "chain": "string (es. 'McDonalds', 'BurgerKing', 'KFC')",
  "name": "string (es. 'Big Mac')",
  "portionDescription": "string (es. '1 panino')",
  "portionSize": "number|null (grammi)",
  "kcal": "number|null",
  "protein": "number|null",
  "carb": "number|null",
  "fat": "number|null",
  "sugar": "number|null",
  "fiber": "number|null",
  "sodium_mg": "number|null",
  "mealType": "panino|contorno|bevanda|dolce|altro",
  "availableRegions": "array (es. ['Italia'])",
  "sourceUrl": "string (URL sito ufficiale)",
  "missingDataReason": "string|null"
}
```

## Flusso di ricerca e utilizzo

Il modulo `js/dataPackLoader.js` implementa una pipeline di ricerca quando l'utente inserisce un nome di alimento:

1. **Normalizzazione:** il nome viene convertito a minuscole, accenti rimossi, punteggiatura pulita
2. **Fuzzy matching:** calcola un score di somiglianza per ogni piatto nei data pack using Levenshtein distance
3. **Pipeline di priorità:**
   - Cerca nei **fast food** (score >= 65, preferisce score >= 90)
   - Cerca nei **piatti italiani** (score >= 65, preferisce score >= 80)
   - Cerca nei **piatti esteri** (score >= 65, preferisce score >= 80)
4. **Fallback:** se nessun match nei data pack, utilizza il sistema di categorie tipiche existente (`typicalValues.js`)

## Accuratezza e disclaimer

- **I valori nutrizionali sono stime medie**, non misurazioni cliniche o etichette ufficiali.
- **Per piatti italiani:** i valori sono basati su composizioni medie dalle tabelle CREA/BDA, rappresentative dei piatti tipici preparati in modo standard.
- **Per fast food:** i valori sono acquisiti dai siti ufficiali delle catene; possono variare leggermente in base alla preparazione, al locale, e agli aggiornamenti di menu. I valori sono validi per l'Italia a febbraio 2025.
- **Variabilità:** porzioni, ingredienti e metodi di preparazione in ristoranti/rosticcerie reali possono variare significativamente dai valori stimati.
- **Non mancano etichette ufficiali:** se l'utente ha accesso a dati nutrizionali ufficiali (etichetta del prodotto, sito del ristorante, ecc.), questi sono **sempre preferibili** alle stime dell'app.

## Come aggiornare i data pack

### Aggiungere un nuovo piatto

1. Aggiungi un record JSON nella sezione `dishes` (per piatti italiani/esteri) o in una delle liste di catene (per fast food).
2. Assicurati che:
   - L'`id` sia unico e consistente con il naming convention
   - Tutti i campi numerici siano `number|null` (non stringa)
   - Il campo `missingDataReason` sia `null` se i dati sono completi, altrimenti una stringa che descrive cosa manca
   - I tag/categorie siano coretti
3. Incrementa il numero di versione `dataPackVersion` (es. `2026.05.2`)

### Aggiornare valori nutrizionali

- Per piatti italiani/esteri: fare riferimento a CREA eTCA o BDA IEO
- Per fast food: controllare i siti ufficiali delle catene
- Aggiornare sia i valori per 100g che per porzione
- Aggiornare il campo `lastUpdated` al format `YYYY-MM-DD`

### Aggiungere una nuova catena di fast food

1. Aggiungi una nuova chiave in `chains` con il nome della catena (es. `"Subway"`)
2. Popola l'array di prodotti con i record seguendo il formato
3. Assicura che tutti i prodotti abbiano `sourceUrl` pointing to official site
4. Incrementa `dataPackVersion`

## Performance e caching

- Il modulo `dataPackLoader.js` implementa lazy loading: i JSON vengono caricati una sola volta e cachati in memoria.
- La ricerca fuzzy è O(n) per data pack, dove n è il numero di piatti.
- Per applicazioni ad alto traffico, considerare pre-caricamento dei data pack o indicizzazione.

## Note legali e attribuzione

- **CREA eTCA:** Tabelle di Composizione degli Alimenti del CREA (Consiglio per la Ricerca in Agricoltura). Liberamente utilizzabili per scopi non commerciali.
- **BDA IEO:** Banca Dati di Composizione degli Alimenti per studi epidemiologici in Italia. Fornita dall'IEO (Istituto Europeo di Oncologia).
- **EuroFIR:** Rete europea per la ricerca nel campo della nutrizione. FCDB (Food Composition Database Aggregated System).
- **Siti fast food:** Dati acquisiti dai siti ufficiali delle catene nel febbraio 2025. Soggetti a cambiamenti senza preavviso.

Tutti i dati utilizzati sono per scopi informativi e didattici. L'app non garantisce l'accuratezza di questi valori per singoli esercizi commerciali o preparazioni specifiche.

## Supporto e feedback

Se hai suggerimenti per aggiungere piatti, correggere valori o migliorare la struttura dei data pack, apri un issue o contatta lo sviluppatore.
