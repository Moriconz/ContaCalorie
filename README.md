# Conta Calorie

PWA mobile-first per gestire pasti, calorie e macro con storage locale e supporto offline.

## Avvio e installazione

### Sviluppo locale

L'app richiede un server HTTP locale (gli ES6 modules non funzionano con il protocollo `file://`).

**Con Node.js:**
```bash
node server.js
```
Poi apri http://localhost:3000

**Con Python (alternativa):**
```bash
python3 -m http.server 3000
```

### Deployment su Vercel (PWA installabile)

1. Installa Vercel CLI: `npm i -g vercel`
2. Dalla cartella dell'app: `vercel --prod`
3. Segui le istruzioni per collegare il progetto a Vercel
4. L'app è online su HTTPS automatico con URL univoco

Poi apri l'URL da:
- **Android Chrome**: premi il banner "Aggiungi alla schermata home"
- **iOS Safari**: Condividi → "Aggiungi alla schermata home"
- L'app si installa come PWA standalone (no barra URL browser)

### Verificare la PWA offline

1. Apri l'app installata
2. Vai offline (modalità aereo o disattiva WiFi)
3. Riapri l'app: tutto funziona da cache Service Worker

## Struttura del progetto

- `index.html` - pagina principale.
- `css/styles.css` - stile responsive e mobile-first.
- `js/app.js` - bootstrap dell’app, routing locale e logica principale.
- `js/models.js` - definizione dei dati e delle forme dei record.
- `js/storage.js` - accesso a IndexedDB + fallback a localStorage.
- `js/nutritionEngine.js` - calcolo macros, BMR/TDEE e riepiloghi.
- `js/nutritionDataProvider.js` - integrazione con Open Food Facts.
- `js/photoNutrition.js` - integrazione astratta per API foto.
- `js/ui/*.js` - moduli di interfaccia utente per onboarding, dashboard, ricerca, alimenti utente, settimana e foto.
- `sw.js` - service worker minimale.
- `manifest.webmanifest` - manifest PWA.

## Cambiare provider dell’API nutrizionale

Il provider è definito in `js/nutritionDataProvider.js`.

- `searchFoods(query)` usa Open Food Facts.
- `getFoodDetails(id)` recupera il dettaglio prodotto.
- Per sostituire il provider, mantenere le funzioni esportate e normalizzare il risultato in formato `foodItem`.

## Agganciare la `PhotoNutritionAPI`

Il modulo `js/photoNutrition.js` definisce il placeholder:

- `PHOTO_NUTRITION_API_URL` - impostare l’endpoint reale.
- `analyzePhoto(imageBlob)` invia un `FormData` con chiave `image`.
- Il risultato atteso deve essere un oggetto con:
  - `items: Array<{ name, estimateGrams, macro: { kcal, proteine, carboidrati, grassi, zuccheri, fibra }, imageUri? }>`

Se l’endpoint non è definito, l’app usa un mock dimostrativo per sviluppo.

## Stima dei valori nutrizionali senza etichetta

Nella schermata **Aggiungi alimento**, puoi usare **"Stima senza dati precisi"** per aggiungere cibi di cui conosci solo il nome e il peso.

### Flusso di stima

1. Clicca "Stima senza dati precisi"
2. Inserisci il **nome dell'alimento** (es: "pasta col sugo", "pane dal forno")
3. Inserisci il **peso in grammi**
4. L'app riconosce la categoria e mostra:
   - Categoria stimata (es: "Pasta cotta", "Pane bianco")
   - Valori medi per 100g dalla tabella USDA
   - Valori calcolati per il peso inserito
5. Puoi **cambiare categoria** se non è corretta
6. Conferma e aggiungi al pasto

### Note importanti

- **Sono valori medi**, non precisi. Usa sempre dati da etichetta quando disponibili.
- Le categorie supportate sono ordinate alfabeticamente nel modulo (`typicalValues.js`).
- Se non riconosce il nome, scegli una categoria generica dal dropdown.
- Un piccolo "~" indica nella lista pasti che è un valore stimato.

### Estendere le categorie

Nel file `js/typicalValues.js`:
1. Aggiungi una nuova chiave in `TYPICAL_FOOD_CATEGORIES` con i valori per 100g.
2. Aggiungi le parole chiave di matching nella funzione `guessTypicalCategoryFromName()`.
3. I valori sono in grammi (proteine, carbo, grassi, fibra, zuccheri) e calorie (kcal).

Esempio:
```js
melone: {
  kcal: 34, proteine: 0.8, carboidrati: 8, grassi: 0.2, fibra: 0.9, zuccheri: 7
}
```

## Parametri scientifici configurabili

I valori principali sono in `js/nutritionEngine.js`:

- `ACTIVITY_FACTORS` - fattori per stile di vita.
- `CALORIE_ADJUSTMENT` - deficit/surplus per obiettivi.
- `PROTEIN_G_PER_KG` - valori in g/kg in base al target.
- `FAT_RATIO` - percentuale del fabbisogno calorico destinata ai grassi.
- `DEFAULT_FIBER_TARGET` - fibra giornaliera suggerita.
- `DEFAULT_SUGAR_THRESHOLD` e `SODIUM_THRESHOLD` - soglie critiche per warning.

## Test manuali consigliati

1. Completa l’onboarding con un profilo e guarda i target.
2. Aggiungi un alimento da ricerca e verifica il riepilogo del giorno.
3. Crea un alimento personalizzato e usalo nell’inserimento.
4. Prova il flusso foto: carica un’immagine demo, modifica le stime e conferma.
5. Vai offline e riapri l’app: verifica che il contenuto di base sia disponibile.
6. Usa la vista settimana e seleziona un giorno per vedere i dettagli.

## Note su privacy, performance e robustezza

- Nessun tracking esterno.
- Dati salvati solo localmente (profilo, pasti, alimenti).
- IndexedDB è preferito, con fallback a localStorage.
- Errori mostrati all’utente in modo chiaro, senza stack trace.
- Service worker minimo per caching statico.
