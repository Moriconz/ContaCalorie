# 05 — Design System, Theming, PWA

Analisi di: `css/theme.css`, `css/glassmorphism.css`, `css/styles.css`, `css/components.css`, `css/background.css`, `css/mobile-optimized-2026.css`, `index.html`, `js/themeManager.js`, `js/pwaHandler.js`, `sw.js`, `manifest.webmanifest`.

## Ordine di caricamento CSS

`index.html` (righe 16-23) carica i fogli in quest'ordine:

```
theme.css → glassmorphism.css → background.css → styles.css → components.css → mobile-optimized-2026.css
```

**Cosa fa:** `theme.css` definisce i design token (custom property su `:root[data-theme]`); `glassmorphism.css` definisce le classi componente riutilizzabili (`.glass-card`, `.btn-primary`, ecc.) che consumano quei token; `background.css` disegna lo sfondo animato; `styles.css` è il foglio principale con lo stile di ogni schermata dell'app; `components.css` è un design system più recente di widget riusabili (stat-box, list-row, fridge-*); `mobile-optimized-2026.css`, caricato per ultimo, applica override mobile-first (spacing, touch target, focus-visible globale, a11y).

**A cosa serve:** l'ordine è rilevante per la cascata — le regole in `mobile-optimized-2026.css` (es. `:focus-visible` globale, `.page-content`, `.card`) vincono su quelle omonime definite prima in `styles.css`, perché arrivano dopo con la stessa specificità.

---

## 1. Design token — `css/theme.css`

Il file è organizzato in tre livelli: blocco DARK, blocco LIGHT, blocco "Liquid Glass elevato" che sovrascrive parte dei token sopra (righe 186-264).

### 1.1 Colori base e superfici

| Token | Dark | Light | Cosa fa |
|---|---|---|---|
| `--bg-main` | `#07080f` | `#eef0f9` | Colore di sfondo pagina (dietro l'aurora animata) |
| `--bg-secondary` / `--bg-tertiary` | tonalità più chiare di `--bg-main` | idem | Sfondi secondari, non molto usati direttamente nei componenti (vedi § Problemi) |

### 1.2 Materiali vetro ("Liquid Glass")

| Token | Dark (base) | Light (base) | Cosa fa |
|---|---|---|---|
| `--glass-primary` | `rgba(22,25,41,.55)` | `rgba(255,255,255,.58)` | Colore di fondo delle card/superfici principali, sempre **neutro** (mai tinto), traslucido |
| `--glass-secondary` | `rgba(255,255,255,.06)` | `rgba(255,255,255,.42)` | Superfici "leggere" (list item, stat-box, input) |
| `--glass-thick` | `rgba(24,27,45,.72)` | `rgba(255,255,255,.72)` | Superfici "pesanti" (modali, dock) — più opache per garantire leggibilità sopra contenuto denso |
| `--glass-border` / `--glass-border-hover` / `--glass-border-active` | bordi bianchi a bassa opacità crescente | bordi bianchi quasi opachi, `-active` vira verso l'indigo | Bordo sottile da 1px su ogni "lastra" di vetro; lo stato hover/active lo rende più visibile |
| `--glass-highlight` / `--glass-highlight-strong` | `inset 0 1px 0 rgba(255,255,255,.12/.18)` | `inset 0 1px 0 rgba(255,255,255,.85/.95)` | Riflesso speculare: un inset-shadow da 1px in alto che simula la luce che colpisce il bordo superiore della lastra di vetro |

**Cosa fa:** questi quattro token (`--glass-primary`, `--blur-glass`, `--saturate-glass`, `--glass-border`, più `--glass-highlight` per l'ombra) sono gli "ingredienti" documentati nel commento di apertura di `glassmorphism.css`: sfondo traslucido neutro + `backdrop-filter: blur() saturate()` + bordo sottile + riflesso interno + ombra stratificata. Ogni componente `.glass-card`, `.btn-secondary`, `.navbar`, `.topbar`, `.icon-button`, `input/select/textarea` li combina allo stesso modo.

**A cosa serve:** dare l'effetto "vetro smerigliato" in stile Apple (Liquid Glass / macOS-iOS) con un'unica fonte di verità: cambiando questi 5-6 token in `theme.css` l'intera UI cambia materiale, senza toccare i singoli componenti.

### 1.3 Accenti colore

Un solo accento primario (indigo) più colori di sistema per stato:

- `--accent-cyan` (alias legacy, in realtà indigo chiaro: `#6e85ff` dark / `#5a6cf3` light)
- `--accent-purple`, `--accent-magenta` (alias legacy → violetto), `--accent-orange` (iOS orange, uso raro), `--accent-pink`

**Cosa fa:** nonostante i nomi (`cyan`, `magenta`) suggeriscano una palette multicolore, il commento in testa al file chiarisce che il sistema usa **un solo accento** (indigo) e questi sono alias storici mantenuti per compatibilità con codice che li referenzia ancora.

**A cosa serve:** evitare pannelli "colorati" (viola, ciano, ecc.) che romperebbero la coerenza del materiale vetro neutro; i nomi originali restano per non dover fare una migrazione di tutti i punti che li usano.

### 1.4 Testo

`--text-primary`, `--text-secondary`, `--text-muted`, `--text-disabled` — quattro livelli di enfasi, invertiti fra dark (chiaro su scuro) e light (scuro su chiaro).

### 1.5 Ombre

`--shadow-sm/md/lg` sono tutte **stratificate**: due `box-shadow` sommati, una ombra di "contatto" ravvicinata e una ombra "ambiente" larga e sfumata (es. dark `--shadow-md`: `0 2px 6px rgba(0,0,0,.22), 0 16px 40px -14px rgba(0,0,0,.55)`). `--shadow-glow` è dichiarata ma vuota (`0 0 0 transparent`) con commento esplicito "niente neon: il glow non è Apple".

**Cosa fa:** simula la profondità reale di una lastra sollevata dal piano — contatto netto vicino al bordo, alone morbido più lontano.

**A cosa serve:** è il tratto distintivo del linguaggio "Liquid Glass" vs. il glassmorphism generico anni 2020 con singola ombra piatta o glow neon.

### 1.6 Raggi, durate, easing

- `--radius-sm/md/lg/xl`: 10/14/20/26px, identici in dark e light.
- `--duration-fast/normal/slow`: 150/240/380ms.
- `--easing-smooth`: `cubic-bezier(0.32, 0.72, 0, 1)` — la curva "sheet" di iOS (apertura foglio modale).
- `--easing-bounce`: `cubic-bezier(0.34, 1.3, 0.5, 1)` — leggero overshoot per micro-interazioni.

**A cosa serve:** movimento coerente e minimale — nel commento di `glassmorphism.css` è esplicito: "Movimento: solo al press (scale 0.97), mai salti all'hover".

### 1.7 Blocco DEFAULTS pre-hydration (righe 114-132)

`:root` (senza `[data-theme]`) definisce un sottoinsieme dei token dark come fallback, usato nella finestra fra il parsing del CSS e l'attribuzione di `data-theme` da parte dello script inline in `<head>` (che in pratica è sincrono e quindi la finestra è pressoché nulla — vedi § Theming).

### 1.8 Alias di compatibilità all'indietro (righe 134-176)

```css
--bg: var(--bg-main);
--surface: var(--glass-primary);
--surface-strong: var(--glass-secondary);
--text: var(--text-primary);
--muted: var(--text-muted);
--primary: #7c8cff;      /* dark */ | #5a6cf3 (light)
--primary-light / --primary-dark
--accent: #a78bfa (dark) | #7d5cf0 (light)
--danger: iOS system red (#ff453a dark / #ff3b30 light)
--success: iOS system green (#30d158 dark / #34c759 light)
--border: var(--glass-border)
--shadow: var(--shadow-md)
--glass-blur: 40px (dark) | 36px (light)   /* valore numerico, non un blur() */
--color-border / --color-text / --color-text-secondary
```

**Cosa fa:** il commento nel file lo dice esplicitamente — "Centinaia di stili inline usano questi nomi: restano validi". `styles.css`, `components.css` e gli stili inline sparsi nei moduli `js/ui/*` usano quasi esclusivamente questi alias (`var(--primary)`, `var(--surface)`, `var(--border)`, `var(--muted)`) invece dei token "nuovi" (`--glass-primary`, `--text-primary`).

**A cosa serve:** disaccoppiare il refactor del sistema token (rinominato durante l'introduzione del linguaggio "Liquid Glass") dal resto della codebase, senza dover riscrivere ogni riferimento esistente. `--primary` non è un semplice ridirezionamento (`var(--glass-primary)` sarebbe sbagliato, è un colore diverso) ma un valore hex indipendente scelto per restare leggibile come colore di accento pieno (bottoni, link, focus ring) mentre `--glass-primary` è pensato solo come sfondo traslucido.

Da notare: `--glass-blur: 40px` è un **numero**, non una funzione `blur()` — è usato in un punto isolato di `styles.css` (riga 1097: `backdrop-filter: blur(var(--glass-blur))`), diverso dal pattern dominante `var(--blur-glass)` che invece è già un `blur(Npx)` completo. Sono due sistemi di naming che convivono (vedi § Problemi).

### 1.9 `color-scheme`

```css
html[data-theme="dark"] { color-scheme: dark; }
html[data-theme="light"] { color-scheme: light; }
```

**Cosa fa:** dice al browser quale schema di colori nativo usare per gli elementi di UI del sistema operativo/browser non stilizzati da CSS (scrollbar, autofill, selezione testo, controlli form nativi).

**A cosa serve:** evita scrollbar chiare su sfondo scuro (o viceversa) e migliora la coerenza visiva dei widget nativi del browser con il tema scelto dall'utente.

---

## 2. Il blocco "Liquid Glass" elevato (fine di `theme.css`, righe 186-264)

Questo è un secondo blocco di regole che **ridefinisce** (override, stessa specificità ma dichiarato dopo → vince in cascata) un sottoinsieme dei token glass già visti sopra, con l'obiettivo dichiarato nel commento: "materiali vetro premium (dark + light) ... Blur tenuto a un livello sostenibile per la GPU; su mobile è ridotto ulteriormente".

### 2.1 Cosa cambia rispetto al blocco base

| Token | Dark base → elevato | Light base → elevato |
|---|---|---|
| `--glass-primary` | `.55` → `.44` (più traslucido) | `.58` → `.40` (più traslucido) |
| `--glass-border` | `.10` → `.18` | `.65` → `.90` |
| `--glass-highlight` | `.12` → `.30` | `.85` → `1` (rim pieno) |
| `--blur-glass` | `40px` → `44px` | `36px` → `42px` |
| `--saturate-glass` | `180%` → `210%` | `170%` → `200%` |
| `--shadow-md` / `--shadow-lg` | ombre più profonde e più estese (es. `--shadow-lg` dark: raggio ambiente passa da `-18px` 70px a `-22px` 110px) | idem, tinte blu/indaco anziché nero puro |

**Cosa fa:** aumenta contemporaneamente la trasparenza (`--glass-primary` più basso) *e* il bordo/riflesso (`--glass-border`, `--glass-highlight` più alti) e il blur/saturazione. Il risultato è un vetro più "sottile e luminoso" — più si vede attraverso, ma il bordo e il rim diventano più marcati per mantenere la lastra leggibile e distinguibile dallo sfondo.

**A cosa serve:** è l'iterazione più recente del linguaggio visivo (il commento nel service worker, `APP_VERSION = 'v26'`, conferma: "stile Liquid Glass elevato"), pensata per avvicinarsi all'estetica "Liquid Glass" di Apple (iOS 18+/visionOS) rispetto alla versione glassmorphism più opaca e piatta della prima iterazione.

### 2.2 Sheen speculare sulle card

```css
.card {
  background-image: linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 46%);
}
html[data-theme="light"] .card {
  background-image: linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0) 52%);
}
```

**Cosa fa:** aggiunge un secondo layer, un gradiente lineare bianco che sfuma dall'alto verso il centro della card, sovrapposto (non sostitutivo) al `background` traslucido colorato/neutro.

**A cosa serve:** simula la luce che scivola sulla superficie curva superiore della lastra di vetro — la "firma" del materiale premium citata nel commento — senza coprire il colore/trasparenza sottostante, perché `background-image` si compone sopra `background-color`/`background` (rgba) invece di sostituirlo.

### 2.3 Fix del colore traccia `.fridge-bar`

```css
.fridge-bar { background: rgba(120,130,170,0.28); }
html[data-theme="light"] .fridge-bar { background: rgba(90,100,160,0.20); }
```

**Cosa fa:** la traccia (sfondo) delle barre macro nella vista "Il tuo Frigo" viene fissata a un colore rgba indipendente, invece di ereditare `var(--glass-secondary)` come nella definizione base in `components.css` (riga 117: `.fridge-bar { ... background:var(--glass-secondary); ... }`).

**A cosa serve:** con `--glass-secondary` reso più traslucido dal blocco elevato (es. dark `.06` → `.07`, quasi invariato, ma comunque un valore molto basso), la traccia della progress bar rischiava di risultare quasi invisibile sopra sfondi vari. Fissare un tono specifico e più contrastato garantisce che la barra resti leggibile indipendentemente da cosa succede dietro.

### 2.4 Media query performance mobile (righe 233-251)

```css
@media (max-width: 640px) {
  :root[data-theme="dark"], html[data-theme="dark"] {
    --glass-primary: rgba(18, 21, 36, 0.66);   /* più opaco: .44 → .66 */
    --glass-thick: rgba(20, 23, 40, 0.80);
    --blur-glass: blur(22px);                   /* 44px → 22px, dimezzato */
    --blur-glass-hover: blur(24px);
    --saturate-glass: saturate(150%);            /* 210% → 150% */
  }
  :root[data-theme="light"], html[data-theme="light"] {
    --glass-primary: rgba(255, 255, 255, 0.70);  /* .40 → .70 */
    --glass-thick: rgba(255, 255, 255, 0.82);
    --blur-glass: blur(20px);                     /* 42px → 20px */
    --blur-glass-hover: blur(22px);
    --saturate-glass: saturate(150%);              /* 200% → 150% */
  }
}
```

**Cosa fa:** sotto i 640px di viewport, il raggio di blur viene circa dimezzato (44px→22px dark, 42px→20px light) e le superfici diventano molto più opache (dark `.44`→`.66`, light `.40`→`.70`), con saturazione ridotta.

**A cosa serve — perché il backdrop-filter blur è costoso sulla GPU dei telefoni:** `backdrop-filter: blur()` obbliga il compositor a renderizzare un layer separato campionando ripetutamente i pixel sottostanti per ogni frame in cui l'elemento (o ciò che ha dietro) si muove — es. durante lo scroll, che su questa app è continuo (liste di pasti, storico, ecc.). Il costo del blur gaussiano scala con il quadrato del raggio in pixel, e le GPU mobili hanno bandwidth di memoria e fill-rate molto più bassi delle GPU desktop. Un blur da 44px su più elementi sovrapposti (topbar sticky + card + modali) può facilmente causare jank (frame drop) durante lo scroll su un iPhone di fascia media o su Android. Riducendo il raggio a ~20-22px il costo computazionale cala nettamente, e compensando con superfici più opache (meno bisogno che il blur "nasconda" i dettagli sottostanti per restare leggibile) il risultato visivo resta accettabile pur non essendo identico al desktop.

### 2.5 Fallback A11y: `prefers-reduced-transparency` (righe 253-257)

```css
@media (prefers-reduced-transparency: reduce) {
  :root[data-theme="dark"], html[data-theme="dark"] { --glass-primary: rgba(18,21,36,0.94); --glass-thick: rgba(20,23,40,0.97); }
  :root[data-theme="light"], html[data-theme="light"] { --glass-primary: rgba(255,255,255,0.94); --glass-thick: rgba(255,255,255,0.97); }
}
```

**Cosa fa:** quando l'utente ha attivato l'impostazione di sistema operativo "riduci trasparenza", le superfici vetro diventano quasi completamente opache (94-97% invece di 40-70%).

**A cosa serve:** `prefers-reduced-transparency` è una media feature CSS pensata per utenti con ipovisione o sensibilità visiva per cui i contenuti che "traspariscono" attraverso una superficie translucida riducono il contrasto e la leggibilità del testo sopra. Nota: questa regola non tocca `--blur-glass`, quindi il blur resta attivo — solo l'opacità del colore di sfondo aumenta, il che comunque riduce fortemente l'effetto "vede-attraverso".

### 2.6 Fallback `@supports not backdrop-filter` (righe 259-264)

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :root[data-theme="dark"], html[data-theme="dark"] { --glass-primary: rgba(18,21,36,0.96); --glass-thick: rgba(20,23,40,0.98); }
  :root[data-theme="light"], html[data-theme="light"] { --glass-primary: rgba(255,255,255,0.96); --glass-thick: rgba(255,255,255,0.98); }
}
```

**Cosa fa:** su browser che non supportano affatto `backdrop-filter` (né prefisso `-webkit-`, quindi niente vetro sfocato possibile), i token diventano quasi opachi (96-98%).

**A cosa serve:** senza questo fallback, un browser senza `backdrop-filter` mostrerebbe le card con lo stesso colore rgba parzialmente trasparente ma **senza alcun blur**, rendendo il testo sovrapposto a contenuti/sfondo sottostante illeggibile (il colore di sfondo da solo, senza sfocatura, non basta a garantire contrasto). Rendendo il colore quasi opaco si ottiene una superficie "flat" leggibile come degradazione elegante.

---

## 3. Componenti vetro — `css/glassmorphism.css`

**Cosa fa:** definisce le classi builder-block del linguaggio visivo, tutte espresse in termini dei token di `theme.css` (mai colori hardcoded, tranne poche eccezioni di stato come `rgba(5,7,14,.45)` sull'overlay modale).

Componenti principali:

- **`.glass-card` / `.glass-card-light`**: la card base — `background: var(--glass-primary)`, `backdrop-filter: var(--blur-glass) var(--saturate-glass)` (doppio, con prefisso `-webkit-` per Safari), bordo `var(--glass-border)`, `box-shadow: var(--glass-highlight), var(--shadow-md)` (due box-shadow: l'inset per il riflesso + l'ombra esterna stratificata). Transizione solo su `border-color` e `box-shadow`. `:active` scala a `0.995` (quasi impercettibile, coerente col principio "movimento minimo").
- **`.btn-primary`**: gradiente verticale sul colore `--primary` (da +12% bianco a colore pieno, via `color-mix`), ombra inset per il rim luminoso + ombra colorata soft sotto (`color-mix(in srgb, var(--primary) 65%, transparent)`). `:active` scala a `0.97` con leggero scurimento (`brightness(0.96)`).
- **`.btn-ghost` / `.btn-secondary`**: varianti meno enfatizzate, la seconda con vetro vero (backdrop-filter).
- **`.modal-overlay`**: sfondo scuro/chiaro semitrasparente con `blur(20px) saturate(120%)` fisso (non tokenizzato) + animazione `fadeIn`.
- **`.modal-content`**: usa `var(--glass-thick, var(--glass-primary))` — fallback esplicito nel caso `--glass-thick` non fosse definito — con blur ancora più alto (`blur(48px)`, fisso, non tokenizzato) e `--glass-highlight-strong` per un rim più marcato, coerente con l'idea che gli elementi "sopra" tutto (modali) meritano il materiale più pesante/leggibile. Animazione `slideUp` (curva iOS).
- **`.navbar`, `.list-item`, `.badge`, `.badge-secondary`**: pattern minori dello stesso linguaggio.
- **`.glass-card-elevated` / `.glass-card-floating`**: due varianti di solo `box-shadow` (rispettivamente `--shadow-md` e `--shadow-lg` con relativo highlight) da comporre su `.glass-card` per dare più o meno "elevazione" percepita.
- Media query `@media (max-width: 640px)` in fondo: riduce padding di card/modali e bottoni per schermi piccoli (non tocca blur — quello è gestito centralmente in `theme.css`).

**A cosa serve:** è la libreria di classi effettivamente applicate nell'HTML/JS (vedi `js/ui/*`), il "vocabolario" visivo riusabile sopra i token grezzi.

---

## 4. Componenti recenti — `css/components.css`

**Cosa fa:** design system più mirato, introdotto per sostituire stili inline ripetuti nei moduli JS (`.card-head`, `.grid-2/3`, `.stack`, `.stat-box`, `.list-row`, `.bar-track/.bar-fill`, `.note-banner`, `.btn-tinted`) più un blocco dedicato interamente alla vista "Il Tuo Frigo" (`fridgeView.js`): score animato, barre macro, tile suggerimento con stagger via `animation-delay` inline, badge "in scadenza" con pulse animation, lista della spesa.

Pattern d'uso: il colore d'accento per-istanza si passa con una custom property inline `style="--c:#3b82f6"`, letta dai componenti come `var(--c, var(--primary))` — fallback al primary se non specificato.

**A cosa serve:** riduce duplicazione di stile inline nei moduli JS; centralizza le regole di interazione (stagger, pulse, focus-visible) per la feature "Frigo" più recente.

Nota su a11y: righe 138 e 183-189 aggiungono `:focus-visible` esplicito solo per gli elementi del Frigo (`.fridge-sug`, `.small-action` dentro `.fridge-item-actions`/`.fridge-shop-item`, `#fridgeAdd`, `#fridgeNotify`), con un commento che ammette il problema strutturale: "l'app non lo definisce sui button: qui lo aggiungo per la navigazione da tastiera" — vedi § Problemi.

---

## 5. Sfondo animato — `css/background.css`

**Cosa fa:** disegna un "aurora" di 4 blob radiali molto grandi (70-130vw), fortemente sfocati (`blur(90px)` desktop, `blur(60-70px)` mobile) e desaturati, in `mix-blend-mode: screen` (dark) o `normal` (light), che derivano lentamente con animazioni CSS `translate3d`+`scale` da 90 a 150 secondi di durata, ciascuna con un piccolo `animation-delay` negativo per sfalsare le fasi. Il commento in testa spiega la scelta di design: prima c'erano blob "lava lamp" (blur 8px, colori pieni/neon), ora sostituiti da campi di colore enormi e sfumati che "derivano dietro il vetro" lasciando che sia il blur dei pannelli a fare la sfocatura percepita, non il blob stesso.

- `.bg-container`: gradiente radiale di base fisso (blu scurissimo in dark, quasi bianco in light) + vignettatura in basso via `::after`.
- 4 `.blob-N` con `will-change: transform` e `translateZ(0)` per forzare il layer compositing GPU-accelerato, evitando repaint del resto della pagina durante l'animazione.
- `@media (prefers-reduced-motion: reduce)`: disattiva tutte le animazioni dei blob.
- `@media (max-width: 768px)`: blob ingranditi (per coprire meglio viewport strette) ma blur ridotto (90px→60px, 100px→70px light) — altra ottimizzazione GPU mobile.
- `.content-wrapper`: wrapper con `z-index:1` e `position:relative` per stare sopra `.bg-container` (`z-index:0`).

**A cosa serve:** dà profondità/vita dietro le lastre di vetro senza il costo di un vero motion background renderizzato via canvas/WebGL — è puro CSS/GPU compositing.

---

## 6. Ottimizzazioni mobile 2026 — `css/mobile-optimized-2026.css`

Caricato per ultimo, quindi vince sulla cascata precedente a parità di specificità.

**Cosa fa (per sezione):**

- **Design token aggiuntivi**: spacing 8px-based (`--space-xs` a `--space-2xl`), scala tipografica mobile-first (`--font-size-xs` a `--font-size-3xl`), line-height, e due token per touch target (`--touch-target: 48px`, `--touch-target-sm: 44px`) — soglie minime WCAG/Apple HIG per aree cliccabili.
- **`button:not([class])`**: applica touch target minimo (48px) solo ai bottoni "nudi" senza classe — quelli con classe (`.btn-primary`, `.icon-button`, ecc.) già gestiscono le proprie dimensioni altrove.
- **`input, select, textarea`**: font-size forzato a `--font-size-lg` (18px) — su iOS Safari un font-size < 16px sui campi di input causa uno zoom automatico indesiderato al focus; 18px garantisce margine.
- **`:focus-visible` globale**: `outline: 2px solid var(--primary); outline-offset: 2px;` — **unica regola dell'intera codebase che applica un anello di focus visibile a *ogni* elemento** (non solo bottoni), attivo per navigazione da tastiera.
- **`@media (prefers-reduced-motion: reduce)`**: azzera durata di ogni `animation`/`transition` nell'intero documento (`* { animation-duration: 0.01ms !important; ... }`) — copertura più ampia della sola disattivazione dei blob in `background.css`.
- **`@media (prefers-contrast: more)`**: aggiunge un bordo visibile ai bottoni quando l'utente richiede più contrasto.
- **Indicatori di progresso, layout mobile (`.page-content`, `.card`, `.nav-button`, `.list-item`), data viz (`.stat-grid`, `.stat-item`, `.stat-value`)**: ridefiniscono/rifiniscono classi già presenti altrove — es. `.page-content` qui ha `max-width:600px` e padding diverso da quello in `styles.css` (riga 128-131), e vince per ordine di caricamento.
- **Sezione "Collapsible" (2026 UX)**: stile per `[data-toggle="collapsible"]` con icona freccia che ruota 180° quando `aria-expanded="true"` — pattern per ridurre carico cognitivo nascondendo contenuto secondario.

**A cosa serve:** è lo strato di rifinitura "mobile-first 2026" applicato sopra un sistema più vecchio (`styles.css`), che introduce anche l'unico vero baseline di accessibilità da tastiera dell'app.

---

## 7. Theming — script pre-paint + `ThemeManager`

### 7.1 Script inline in `index.html` (righe 28-46)

```js
const savedTheme = localStorage.getItem('theme')
  || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
document.documentElement.setAttribute('data-theme', savedTheme);
```

**Cosa fa:** eseguito in un `<script>` sincrono nel `<head>`, **prima** che qualsiasi CSS venga applicato al DOM visibile e prima che `js/themeManager.js` (caricato più avanti come modulo) venga eseguito. Legge `localStorage.theme`; se assente, verifica `prefers-color-scheme: light` di sistema (default a `dark` se n é salvato né `light` di sistema). Applica subito l'attributo `data-theme` sull'elemento `<html>`.

**A cosa serve:** evitare il FOUC/flash — se il tema venisse applicato solo dopo il parsing di `app.js` (un modulo, quindi differito), l'utente vedrebbe per una frazione di secondo il tema di default (`dark`, hardcoded nell'attributo statico `data-theme="dark"` in `<html>` al punto 2 del file) anche se ha scelto/preferisce `light`. Lo script sincrono chiude questa finestra. Da notare il secondo IIFE subito sotto, che silenzia `console.log/debug/info` in produzione (mantenendo `warn`/`error`) a meno di `localhost`/`127.0.0.1` o `?debug=1` in query string.

**Nota realizzativa:** `<html lang="it" data-theme="dark">` (riga 2) ha già `data-theme="dark"` come valore statico nel markup. Lo script lo sovrascrive immediatamente all'esecuzione, quindi per un utente `light` non c'è comunque flash visibile in pratica (lo script gira prima che il browser dipinga qualunque pixel, essendo bloccante e in `<head>` prima di ogni `<link rel="stylesheet">` con effetto visivo... in realtà i `<link>` sono *sopra* nello script, ma il paint reale avviene solo dopo il parsing completo dell'head + primo elemento renderizzabile del body, quindi l'attributo è già corretto per allora).

### 7.2 `js/themeManager.js` — classe `ThemeManager`

Istanza singleton esportata: `export const themeManager = new ThemeManager()`.

- **`loadTheme()`**: stessa logica dello script inline (localStorage → altrimenti `prefers-color-scheme` di sistema, default `dark`), rieseguita qui per inizializzare lo stato interno della classe (`this.current`).
- **`init()`** (chiamato dal costruttore): applica il tema corrente via `applyTheme()`, poi registra un listener su `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)` — se **non** c'è una preferenza esplicita salvata (`!localStorage.getItem(this.storageKey)`), un cambio del tema di sistema a runtime (es. l'utente passa da chiaro a scuro nelle impostazioni del telefono mentre l'app è aperta) aggiorna automaticamente il tema dell'app.
- **`applyTheme(theme)`**: imposta `data-theme` sull'elemento `<html>`, aggiunge/rimuove le classi `theme-dark`/`theme-light` (ridondanti con l'attributo, presumibilmente per selettori CSS che usano classe anziché attributo altrove — nessun file css analizzato le usa però, vedi § Problemi), dispatcha un evento custom `themechange` con `detail: { theme }`.
- **`setTheme(theme)`**: chiama `applyTheme()` e **persiste** la scelta in `localStorage` — questa è la funzione chiamata quando l'utente fa una scelta esplicita (toggle) o quando il listener di sistema propaga un cambio (ma solo se non c'era già una preferenza salvata, quindi non "esplicita" in quel path... il codice comunque scrive in localStorage anche in quel branch, il che di fatto trasforma il cambio di sistema in una preferenza salvata — vedi § Problemi).
- **`toggleTheme()`**: alterna dark↔light e chiama `setTheme()`.
- **`getTheme()` / `isDark()` / `isLight()`**: getter di stato.

**A cosa serve — pattern "default segue il sistema, la scelta esplicita persiste":** finché l'utente non ha mai toccato il toggle, l'app segue sempre `prefers-color-scheme` (sia al caricamento sia a runtime via il listener `change`). Nel momento in cui l'utente preme il pulsante toggle (`#themeToggle` in `index.html`, riga 91, gestito nello `<script type="module">` di fondo pagina che chiama `themeManager.toggleTheme()`), quella scelta viene scritta in `localStorage` e da quel momento **vince sempre** su qualunque cambiamento del tema di sistema, perché `loadTheme()` controlla `localStorage` per primo e il listener di `init()` si disattiva da solo (`if (!localStorage.getItem(...))`) una volta che la chiave esiste.

Il bottone toggle in `index.html` (righe 113-137) aggiorna anche l'icona (☀️/🌙) e sincronizza i meta tag `theme-color` (colore della status bar su mobile) col tema scelto, perché i meta `theme-color` statici nell'head usano `media="(prefers-color-scheme: ...)"` che segue solo il sistema, non la scelta esplicita in-app.

---

## 8. Service Worker — `sw.js`

### 8.1 Versionamento cache

```js
const APP_VERSION = 'v26';
const CACHE_NAME = `calorie-pwa-${APP_VERSION}`;
```

**Cosa fa:** `APP_VERSION` è, per dichiarazione esplicita nel commento di testa, **l'unica costante da cambiare per pubblicare un aggiornamento** — determina il nome della cache Cache Storage.

**A cosa serve:** è il meccanismo di cache-busting a livello di service worker: cambiando la stringa, `install` apre una cache nuova con nome diverso, e `activate` cancella tutte le cache con nome diverso da quella corrente (vedi sotto) — quindi bump di versione = invalidazione totale della vecchia cache per tutti i client, senza dover rinominare/cache-bust ogni singolo asset.

### 8.2 `CRITICAL_ASSETS` vs `STATIC_ASSETS`

- **`CRITICAL_ASSETS`** (9 file): `index.html`, i CSS/JS minimi per bootstrap (`styles.css`, `theme.css`, `mobile-optimized-2026.css`, `app.js`, `storage.js`, `appBootstrap.js`), il manifest, e **i due dataset alimentari** (`italian_foods_full.json`, `crea_hierarchy.json`).
- **`STATIC_ASSETS`** (~45 file): resto dei CSS, tutti gli altri moduli JS (`js/ui/*`, engine vari), le icone.

**Cosa fa (in `install`):**
```js
cache.addAll(CRITICAL_ASSETS.map(a => new Request(a, { cache: 'reload' })))
  .then(() => Promise.allSettled(STATIC_ASSETS.map(a => cache.add(new Request(a, { cache: 'reload' })))));
```
`CRITICAL_ASSETS` usa `cache.addAll()`, che **fallisce interamente** (rifiuta la promise) se anche un solo asset non si scarica. `STATIC_ASSETS` usa `Promise.allSettled()` su singoli `cache.add()`, quindi i fallimenti individuali sono **tollerati** (loggati implicitamente ma non bloccanti).

**A cosa serve:** garantire che l'app funzioni offline al minimo indispensabile (shell + database alimenti, essenziale perché la ricerca cibo deve funzionare offline dal primo avvio) anche se qualche asset secondario non accessorio fallisse il download durante l'installazione del SW (es. rete instabile) — un 404 o timeout su un modulo UI non critico non deve impedire l'intera installazione del service worker.

Ogni richiesta usa `{ cache: 'reload' }`, che forza il bypass della cache HTTP del browser durante il download iniziale in cache — garantisce che si stia effettivamente cachando l'ultima versione dal network, non una versione HTTP-cached stale.

### 8.3 `install` / `activate`

```js
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(/* cache.open + addAll/allSettled */);
});

self.addEventListener('activate', event => {
  self.clients.claim();
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
});
```

**Cosa fa:** `skipWaiting()` in `install` forza il nuovo service worker a diventare attivo immediatamente, senza aspettare che tutte le tab con la vecchia versione si chiudano. `clients.claim()` in `activate` fa sì che il nuovo SW prenda immediatamente il controllo di tutte le pagine aperte (anche quelle già caricate prima dell'attivazione), invece di aspettare un reload. Il cleanup cancella ogni cache con nome diverso da `CACHE_NAME` corrente (quindi ogni versione precedente).

**A cosa serve:** aggiornamenti aggressivi e immediati — appropriato per una PWA installata standalone dove l'utente non ricarica spesso manualmente. Il rovescio della medaglia: un client può ricevere codice nuovo mentre uno stato JS in-memory vecchio è ancora attivo nella tab (mitigato dal banner "nuova versione" menzionato nel commento di testa, gestito presumibilmente in `appBootstrap.js` tramite l'evento `message`/`controllerchange`, non incluso nello scope di questa analisi).

### 8.4 Strategia fetch

```js
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;   // solo same-origin

  const isHtml = event.request.destination === 'document';
  const isAppAsset = isHtml || url.pathname.startsWith('/css/') || .../js/ .../data/ .../icons/ || manifest;

  if (isAppAsset) {
    event.respondWith(staleWhileRevalidate(event));
  } else {
    event.respondWith(/* network-first con fallback cache */);
  }
});
```

**Cosa fa:** filtra subito richieste non-GET e cross-origin (lasciate al comportamento di rete di default del browser, senza intercettazione). Per tutto ciò che è "app shell" (documento HTML, CSS, JS, dataset JSON, icone, manifest) applica **stale-while-revalidate**. Per tutto il resto (es. eventuali chiamate a API esterne, se presenti altrove nell'app) applica **network-first con fallback su cache**.

**`staleWhileRevalidate(event)`:**
```js
function staleWhileRevalidate(event) {
  return caches.match(event.request, { ignoreSearch: true }).then(cached => {
    const networkUpdate = fetchWithTimeout(new Request(event.request.url, { cache: 'no-cache' }))
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request.url.split('?')[0], clone));
        }
        return response;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(networkUpdate);
      return cached;      // risposta immediata dalla cache
    }
    return networkUpdate.then(response => {
      if (response) return response;
      if (event.request.destination === 'document') {
        return caches.match('/index.html', { ignoreSearch: true });  // fallback SPA
      }
      return Response.error();
    });
  });
}
```

**Cosa fa:**
1. Cerca in cache con `{ ignoreSearch: true }` — ignora i query string nel matching, quindi `app.js?t=12345` e `app.js` sono considerati la stessa entry.
2. Se c'è un hit in cache, la ritorna **immediatamente** al client, e avvia in parallelo (`event.waitUntil`, non blocca la risposta) un fetch di rete con `{ cache: 'no-cache' }` che bypassa la cache HTTP del browser, per garantire di ricevere davvero l'ultima versione dal server se disponibile.
3. Se il fetch di rete ha successo (status 200), aggiorna l'entry in Cache Storage — chiave normalizzata togliendo il query string (`url.split('?')[0]`), coerente con `ignoreSearch: true` usato in lettura.
4. Se non c'era nulla in cache (cache miss), attende il risultato di rete; se anche quello fallisce e la richiesta è per un documento HTML, fa fallback su `/index.html` cachato (comportamento da SPA: qualunque route sconosciuta risolve alla shell); altrimenti propaga un `Response.error()`.

`fetchWithTimeout` (5000ms) avvolge ogni `fetch` in una `Promise.race` con un timeout — su reti 3G/lente un fetch che non risponde in 5s viene trattato come fallito, evitando che l'utente resti in attesa indefinita quando la cache potrebbe già avere una risposta valida pronta.

**A cosa serve:** l'utente ottiene sempre una risposta rapida (dalla cache, se esiste) evitando la latenza di rete percepita, mentre in background la cache si allinea alla versione più recente — al prossimo reload/navigazione l'utente vedrà l'aggiornamento. `ignoreSearch: true` risolve il problema dei cache-busting query param (`?t=...`, comuni per bypassare cache HTTP lato client in altre parti del codice) che altrimenti genererebbero un cache miss ad ogni richiesta con timestamp diverso.

**Branch "tutto il resto" (network-first):**
```js
fetchWithTimeout(event.request)
  .then(response => {
    if (!response || response.status !== 200) {
      return caches.match(event.request, { ignoreSearch: true }).then(c => c || response);
    }
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
    return response;
  })
  .catch(() => caches.match(event.request, { ignoreSearch: true }));
```

**Cosa fa:** prova prima la rete; se la risposta manca o non è 200, prova la cache come fallback (altrimenti restituisce comunque la risposta di rete anche se non-200); se la rete fallisce del tutto (eccezione/timeout), fallback su cache.

**A cosa serve:** per risorse che non sono "app shell" (potenzialmente contenuti dinamici o di terze parti), privilegia sempre il dato più fresco dalla rete, usando la cache solo come rete di sicurezza.

### 8.5 Messaggio `SKIP_WAITING`

```js
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
```

**A cosa serve:** dà al codice applicativo (`appBootstrap.js`, fuori scope diretto ma menzionato nei commenti) un modo per forzare l'attivazione di un SW "in attesa" (es. dopo che l'utente conferma un banner "nuova versione disponibile, ricarica ora"), bypassando l'attesa naturale del lifecycle del service worker.

---

## 9. `js/pwaHandler.js` — install prompt

**Cosa fa:**

- Riceve l'evento `beforeinstallprompt` **catturato in anticipo** da uno script inline in `index.html` (righe 52-60: `window.__beforeInstallPromptEvent`/`__beforeInstallPromptCaught`), oppure lo ascolta direttamente se non ancora catturato — pattern necessario perché `beforeinstallprompt` può scattare prima che i moduli JS (differiti) siano eseguiti.
- Verifica readiness del service worker (`navigator.serviceWorker.ready`), ma **non lo registra** — la registrazione avviene una sola volta in `appBootstrap.js` (commento esplicito in `index.html` riga 49-50 che segnala una vecchia duplicazione ormai rimossa: "prima era duplicata anche qui → doppi listener update").
- Ascolta `appinstalled` per nascondere il bottone e persistere `appInstalled=true` in `localStorage`.
- `isStandalone()`: rileva se l'app gira già come PWA installata via tre segnali (`navigator.standalone` per iOS legacy, `matchMedia('(display-mode: standalone)')` standard, o `document.referrer` che contiene `android-app://`).
- `triggerInstallPrompt()`: se il prompt nativo è disponibile, lo mostra (`installPrompt.prompt()`) e gestisce l'esito (`userChoice`); altrimenti fa **device detection via user-agent** (Android+Chrome/Brave vs iOS Safari vs fallback generico) per mostrare istruzioni manuali passo-passo specifiche per piattaforma, perché iOS Safari non espone mai `beforeinstallprompt` (l'installazione lì è sempre manuale via "Condividi → Aggiungi a Home").
- `showInstallDiagnostics()`: modal di debug con stato completo (protocollo, HTTPS, supporto SW, manifest caricato, prompt catturato) — utile per diagnosticare perché l'installazione non è disponibile su un dato browser/dispositivo.
- `verifyManifest()`: fetch del manifest a runtime e verifica che ogni icona dichiarata risponda con successo — diagnostica proattiva di problemi comuni (icone mancanti bloccano l'installabilità PWA).

**A cosa serve:** la UX di installazione PWA è frammentata per design tra browser (Chrome/Edge/Brave desktop e Android espongono un prompt nativo intercettabile; iOS Safari no) — questo modulo unifica l'esperienza offrendo sempre un bottone (`#installAppBtn` in `index.html`) che o triggera il prompt nativo o mostra istruzioni guidate.

---

## 10. `manifest.webmanifest`

**Cosa fa:** dichiara nome (`Conta Calorie`/`Calorie`), `start_url: "/"`, `scope: "/"`, `display: "standalone"` (nasconde la UI del browser quando installata), `orientation: "portrait"`, colori (`background_color: #f5f7ff`, `theme_color: #6366f1` — quest'ultimo coincide col meta `theme-color` light in `index.html`), e 4 icone (192/512 `any` + 192/512 `maskable`, quest'ultime richieste per l'adattamento alle forme icona di Android — nota: la entry maskable 512 punta allo stesso file PNG della entry `any` 512, `/icons/icon-512.png`, non a un file maskable dedicato).

**A cosa serve:** è il file richiesto dallo standard Web App Manifest perché il browser consideri l'app installabile e sappia come presentarla una volta aggiunta alla home screen (icona, nome, colori splash screen, modalità standalone senza barra indirizzi).

---

## Problemi / note

- **Doppio sistema di naming dei token.** Convivono due generazioni di variabili: quelle "nuove" (`--glass-primary`, `--text-primary`, `--shadow-md`, `--blur-glass`) definite nei blocchi dark/light principali, e gli "alias di compatibilità" (`--primary`, `--surface`, `--text`, `--muted`, `--border`, `--accent`) che sono quelli realmente usati dalla stragrande maggioranza di `styles.css`, `components.css` e degli stili inline nei moduli `js/ui/*`. Il rischio pratico: chi tocca il blocco "Liquid Glass elevato" di `theme.css` (che ridefinisce solo i token *nuovi*) può avere l'impressione di aver aggiornato l'intera palette, mentre `--primary`/`--accent`/`--danger`/`--success` restano fissi come hex indipendenti — non seguono affatto l'evoluzione "elevata" del glass. Sono deliberatamente non collegati (perché rappresentano colori pieni, non materiali vetro), ma la distinzione non è ovvia leggendo solo `css/glassmorphism.css` o `css/components.css`.
- **`--glass-blur` è un'anomalia isolata.** È l'unico token che contiene un numero puro (`40px`/`36px`) invece di una funzione `blur()` completa come tutti gli altri (`--blur-glass: blur(40px)`), ed è usato una sola volta in `styles.css` riga 1097 (`backdrop-filter: blur(var(--glass-blur))`). Un refactor che rinominasse o rimuovesse `--blur-glass` senza controllare anche `--glass-blur` lascerebbe quel punto silenziosamente rotto (nessun errore, semplicemente niente blur se la variabile sparisse, perché la sintassi `blur(var(--x))` con `--x` non definita risulta in `blur()` invalido → property ignorata).
- **Valori di blur "vetro pesante" non tokenizzati.** `.modal-overlay` (`blur(20px) saturate(120%)`) e `.modal-content` (`blur(48px)`) in `glassmorphism.css`, e diversi punti analoghi in `styles.css` (es. `blur(44px)`, `blur(16px) saturate(135%)`, `blur(6px)`, `blur(8px)`), hardcodano il raggio invece di usare `var(--blur-glass)`. Significa che la media query mobile-performance e i due fallback a11y in fondo a `theme.css` (che agiscono solo su `--blur-glass`/`--saturate-glass`) **non riducono il blur di questi elementi specifici** su mobile o per utenti con `prefers-reduced-transparency`/senza supporto `backdrop-filter` — restano al valore fisso originale. Per i modali (elemento con superficie più grande e spesso sopra contenuto scrollabile) questo è probabilmente il punto di maggior costo GPU non coperto dall'ottimizzazione mobile.
- **Focus-visible sui bottoni: presente ma minimale, aggiunto "in emergenza".** L'unica regola che dà un anello di focus a *ogni* bottone dell'app (incluso il toggle tema, il bottone install, tutte le CTA `.btn-primary`/`.btn-secondary`/`.btn-ghost`, i bottoni "nudi" nei moduli UI) è la regola globale `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }` in `mobile-optimized-2026.css`. Non ci sono regole `:focus-visible` dedicate su `.btn-primary`, `.icon-button`, `.glass-card` interattive, ecc. — il commento in `components.css` righe 183-184 lo conferma esplicitamente per il modulo Frigo: "l'app non lo definisce sui button: qui lo aggiungo per la navigazione da tastiera", il che implica che prima di quell'aggiunta *nessun* focus visibile esisteva affatto per quei controlli, e che l'unica rete di sicurezza reale per il resto dell'app è la regola globale di `mobile-optimized-2026.css` (che comunque copre correttamente tutti gli elementi, essendo un selettore universale sullo pseudo-stato, non serve altro). Il rischio residuo è stilistico/di specificità: qualunque componente futuro con `outline: none` esplicito su `:focus` (come fanno già `input:focus`/`select:focus`/`textarea:focus` in più punti di `styles.css`, che però ricompensano con un `box-shadow` visibile) romperebbe silenziosamente il fallback globale per quell'elemento se non aggiungesse un proprio anello sostitutivo.
- **`--bg-secondary` / `--bg-tertiary` sembrano poco usati.** Definiti in entrambi i temi in `theme.css` ma non referenziati da nessuno dei file CSS letti in questa analisi (`grep` mentale sui file: solo `--bg-main`, tramite l'alias `--bg`, appare in `html,body { background-color: var(--bg); }`). Possibile residuo di un refactor precedente o riservato a componenti non ancora analizzati.
- **Classi `theme-dark`/`theme-light` aggiunte da `ThemeManager.applyTheme()`** non risultano usate da nessun selettore CSS nei file analizzati (che usano tutti `[data-theme="dark|light"]`). Se non servono ad altri moduli JS non coperti da questo audit, sono ridondanti.
- **Sincronizzazione dello stato "preferenza esplicita" un po' fragile.** `ThemeManager.init()` registra il listener di sistema con la guardia `if (!localStorage.getItem(this.storageKey))`, valutata solo al momento in cui l'evento `change` scatta (non quando il listener viene registrato). Se l'utente non ha mai scelto esplicitamente e il sistema cambia tema, `setTheme()` viene chiamato e **scrive** in `localStorage` — da quel momento in poi il comportamento "segue il sistema" per quell'utente si interrompe silenziosamente (la sessione diventa equivalente a una scelta esplicita, anche se l'utente non ha mai toccato il toggle). È una conseguenza implicita del riuso di `setTheme()` per entrambi i path (toggle manuale e propagazione di sistema), non necessariamente un bug bloccante, ma diverge dal comportamento "default segue sempre il sistema finché non tocchi il toggle" che il resto della documentazione/commenti lascia intendere.
- **Manifest: icona maskable 512 duplicata.** La entry `icon-512-maskable` punta a `/icons/icon-512.png`, lo stesso file della entry `any` 512×512, non a un asset con safe-zone dedicata per maschere adattive Android. Visivamente può risultare in un logo tagliato ai bordi su launcher Android che applicano una maschera (cerchio, squircle, ecc.), perché un'icona "any" tipicamente non lascia il padding di sicurezza richiesto dalla spec maskable.
- **Performance: molti `backdrop-filter` sovrapposti nello stesso viewport.** Con topbar sticky (`.topbar`/`.navbar`), card multiple (`.glass-card`/`.card`), bottom nav, e potenzialmente un modale aperto sopra tutto, il numero di elementi con `backdrop-filter` attivo contemporaneamente può essere alto; ognuno richiede il proprio layer di compositing. La mitigazione mobile (blur ridotto sotto 640px) copre la maggior parte dei casi tramite i token centralizzati, ma non i punti con blur hardcoded elencati sopra.
