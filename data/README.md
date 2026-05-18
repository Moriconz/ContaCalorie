# Data Pack Nutrizionali — Conta Calorie App

Questa directory contiene i data pack JSON **completi** con valori nutrizionali per alimenti italiani, piatti esteri comuni in Italia e fast food. Sono utilizzati dal modulo `js/dataPackLoader.js` per fornire stime nutrizionali accurate quando l'utente non inserisce dati precisi.

## File disponibili

### 1. `italian_regional_dishes.json`
**Database completo alimenti italiani**

- **Versione:** 2026.05.1
- **Fonte:** CREA eTCA (https://www.alimentinutrizione.it/tabelle-di-composizione-degli-alimenti), BDA IEO (https://bda.ieo.it)
- **Alimenti inclusi:** 110+ voci
- **Categorie coperte:**
  - **Cereali e derivati** (20+): pane bianco/integrale, pasta di semola/all'uovo/integrale, riso, polenta, gnocchi, couscous, farina, avena, quinoa
  - **Carni fresche** (30+): bovino (filetto, bistecca, costata, spalla, coscia, ossobuco, geretto, macinato), suino (costoletta, bistecca, filetto, coscia, macinato), pollo (petto, coscia, ala, intero), tacchino, coniglio, lepre
  - **Salumi** (10+): prosciutto crudo/cotto, speck, pancetta, guanciale, salame, bresaola, mortadella, salsiccia
  - **Pesce e frutti di mare** (20+): salmone, tonno fresco, merluzzo, branzino, orata, sgombro, sardine, acciughe, gamberi, cozze, vongole, calamari, polpo
  - **Latticini e formaggi** (15+): mozzarella, mozzarella di bufala, parmigiano reggiano, gorgonzola, mascarpone, pecorino romano, ricotta, burrata, latte intero/scremato, yogurt, burro
  - **Uova** (3): intero, albume, tuorlo
  - **Verdure** (20+): pomodoro, lattuga, carota, zucchina, broccoli, cavolfiore, spinaci, melanzana, peperone, cipolla, patata, etc.
  - **Frutta** (6+): mela, banana, arancia, fragola, uva, limone
  - **Condimenti** (3): olio extravergine, maionese, sugo di pomodoro
  - **Piatti regionali italiani** (5): carbonara, amatriciana, cacio e pepe, pizza margherita, lasagna al ragù

**Struttura record:**
```json
{
  "id": "string (identificatore unico)",
  "name": "string (nome piatto es. 'Spaghetti alla Carbonara')",
  "slug": "string (versione slug per ricerca fuzzy)",
  "region": "string (es. 'Lazio')",
  "city": "string|null (es. 'Roma')",
  "category": "primo|secondo|contorno|street_food|dolce|antipasto|pane",
  "source": "CREA|BDA|stima_composizione",
  "portionSize": "number (grammi porzione tipica)",
  "kcal_100g": "number|null",
  "protein_100g": "number|null",
  "carb_100g": "number|null",
  "fat_100g": "number|null",
  "fiber_100g": "number|null",
  "sugar_100g": "number|null",
  "kcal_per_portion": "number|null",
  "protein_per_portion": "number|null",
  "carb_per_portion": "number|null",
  "fat_per_portion": "number|null",
  "ingredientsApprox": "array (lista ingredienti approssimativi)",
  "tags": "array (tag per categorizzazione)",
  "missingDataReason": "string|null (se i macro mancano)"
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
