/*
  Gestione della PWA installation prompt.
  Registra il Service Worker il prima possibile per soddisfare i criteri di installabilità PWA.
*/

let installPrompt = null;
let isAppInstalled = false;
let beforeinstallpromptCaught = false;

console.log('🔧 pwaHandler.js caricato');

// Usa l'evento beforeinstallprompt catturato dall'HTML inline
if (window.__beforeInstallPromptCaught && window.__beforeInstallPromptEvent) {
  console.log('🎉 beforeinstallprompt catturato dall\'HTML!');
  installPrompt = window.__beforeInstallPromptEvent;
  beforeinstallpromptCaught = true;
  updateButtonState();
} else {
  console.log('⏳ beforeinstallprompt non ancora catturato, rimango in ascolto...');
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('🎉 beforeinstallprompt catturato da pwaHandler!');
    e.preventDefault();
    installPrompt = e;
    beforeinstallpromptCaught = true;
    updateButtonState();
  }, true);
}

// SW è registrato da index.html, verifichiamo lo stato
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(() => {
    console.log('✅ Service Worker pronto');
  }).catch(error => {
    console.warn('❌ Errore SW:', error);
  });
}

// Verifica se l'app è già installata
window.addEventListener('appinstalled', () => {
  isAppInstalled = true;
  hideInstallButton();
  console.log('✅ App installata con successo');
});

function hideInstallButton() {
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.style.display = 'none';
}

function showInstallButton() {
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.style.display = 'flex';
}

function updateButtonState() {
  const btn = document.getElementById('installAppBtn');
  if (btn) {
    if (beforeinstallpromptCaught) {
      btn.textContent = '📲';
      btn.title = 'Installa app';
    }
  }
}

// Funzione per mostrare diagnostica in un modal
function showInstallDiagnostics() {
  // Verifica lo stato della registrazione del manifest
  const manifestLink = document.querySelector('link[rel="manifest"]');
  const manifestLoaded = manifestLink !== null;

  // Verifica il supporto del browser
  const hasSW = 'serviceWorker' in navigator;
  const isHTTPS = window.location.protocol === 'https:' || window.location.hostname === 'localhost';

  // Testo diagnostico
  const diagnostics = `
📊 DIAGNOSTICA PWA INSTALLAZIONE

🔍 STATO BROWSER:
• Protocollo: ${window.location.protocol}
• HTTPS/Localhost: ${isHTTPS ? '✅ Sì' : '❌ No (richiesto)'}
• Service Worker: ${hasSW ? '✅ Supportato' : '❌ Non supportato'}

🔍 MANIFEST:
• Caricato: ${manifestLoaded ? '✅ Sì' : '❌ No'}
• Path: ${manifestLink?.href || 'N/A'}

🔍 PWA REQUIREMENTS:
• beforeinstallprompt: ${beforeinstallpromptCaught ? '✅ Catturato' : '❌ Non catturato'}
• SW Registrato: ${navigator.serviceWorker?.controller ? '✅ Sì' : '⏳ In attesa...'}
• App Installata: ${isAppInstalled ? '✅ Sì' : '❌ No'}

📱 ISTRUZIONI PER BRAVE ANDROID:

Se il pulsante di installazione automatica non funziona:

1️⃣ Premi il menu (⋮) in alto a destra
2️⃣ Seleziona "Installa app" o "Aggiungi alla home"
3️⃣ Conferma quando richiesto

🍎 ISTRUZIONI PER iOS SAFARI:

1️⃣ Tocca il pulsante Condividi (quadrato con freccia)
2️⃣ Scorri verso il basso e seleziona "Aggiungi alla schermata home"
3️⃣ Assegna un nome e tocca Aggiungi

⚠️ NOTA IMPORTANTE:
Se beforeinstallprompt non è catturato su HTTPS, il browser
non riconosce l'app come installabile.
  `;

  // Rimuovi modal vecchi se presenti
  document.querySelectorAll('.install-diagnostics-modal').forEach(el => el.remove());

  // Crea un modal
  const modal = document.createElement('div');
  modal.className = 'install-diagnostics-modal';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 100;';

  const card = document.createElement('div');
  card.style.cssText = 'width: min(100%, 520px); max-height: 85vh; overflow-y: auto; border-radius: 20px; background: var(--surface); padding: 1.5rem; box-shadow: 0 20px 60px rgba(0,0,0,0.3); font-family: system-ui, -apple-system, sans-serif; font-size: 0.9rem; line-height: 1.6; color: var(--text);';

  const content = document.createElement('pre');
  content.style.cssText = 'margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 0.85rem; font-family: monospace;';
  content.textContent = diagnostics;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Chiudi';
  closeBtn.style.cssText = 'display: block; margin-top: 1.5rem; width: 100%; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 1rem;';
  closeBtn.onclick = () => {
    modal.remove();
  };

  card.appendChild(content);
  card.appendChild(closeBtn);
  modal.appendChild(card);
  document.body.appendChild(modal);
}

export function triggerInstallPrompt() {
  console.log('🔵 triggerInstallPrompt chiamato');
  console.log('beforeinstallprompt catturato?', !!installPrompt);
  console.log('beforeinstallpromptCaught?', beforeinstallpromptCaught);

  if (installPrompt && beforeinstallpromptCaught) {
    console.log('✅ Usando beforeinstallprompt nativo');
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult) => {
      console.log('Scelta utente:', choiceResult.outcome);
      if (choiceResult.outcome === 'accepted') {
        hideInstallButton();
      }
      installPrompt = null;
    }).catch(e => console.error('❌ Errore prompt:', e));
  } else {
    console.warn('⚠️ beforeinstallprompt NON catturato');
    // Prova a detectare il dispositivo e mostrare istruzioni specifiche
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(userAgent);
    const isChrome = /chrome|brave/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);

    if (isAndroid && isChrome) {
      // Android Chrome o Brave
      showAndroidInstallModal();
    } else if (isSafari) {
      // iOS Safari
      showIOSInstallModal();
    } else {
      // Fallback generico
      showInstallDiagnostics();
    }
  }
}

function showAndroidInstallModal() {
  removeExistingModal();

  const modal = document.createElement('div');
  modal.className = 'pwa-install-modal';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 100;';

  const card = document.createElement('div');
  card.style.cssText = 'width: min(100%, 500px); border-radius: 20px; background: var(--surface); padding: 2rem 1.5rem; box-shadow: 0 20px 60px rgba(0,0,0,0.3);';

  const title = document.createElement('h2');
  title.textContent = '📲 Installa Conta Calorie';
  title.style.cssText = 'margin: 0 0 1rem; color: var(--text); font-size: 1.3rem;';

  const text1 = document.createElement('p');
  text1.textContent = 'Accedi al menu del browser per installare l\'app sulla tua schermata home.';
  text1.style.cssText = 'margin: 0 0 1.5rem; color: var(--text); line-height: 1.5;';

  const stepsContainer = document.createElement('div');
  stepsContainer.style.cssText = 'background: var(--surface-strong); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem;';

  const steps = ['Premi il menu (⋮) in alto a destra', 'Seleziona "Installa app" o "Aggiungi alla home"', 'Conferma il nome dell\'app'];
  steps.forEach((step, i) => {
    const stepEl = document.createElement('div');
    stepEl.style.cssText = 'display: flex; gap: 0.75rem; margin-bottom: ' + (i < steps.length - 1 ? '0.75rem' : '0');
    const num = document.createElement('span');
    num.style.cssText = 'flex-shrink: 0; width: 28px; height: 28px; background: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem;';
    num.textContent = (i + 1).toString();
    const text = document.createElement('span');
    text.textContent = step;
    text.style.cssText = 'color: var(--text); line-height: 1.5;';
    stepEl.appendChild(num);
    stepEl.appendChild(text);
    stepsContainer.appendChild(stepEl);
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Ho capito';
  closeBtn.style.cssText = 'display: block; width: 100%; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 1rem;';
  closeBtn.onclick = () => modal.remove();

  card.appendChild(title);
  card.appendChild(text1);
  card.appendChild(stepsContainer);
  card.appendChild(closeBtn);
  modal.appendChild(card);
  document.body.appendChild(modal);
}

function showIOSInstallModal() {
  removeExistingModal();

  const modal = document.createElement('div');
  modal.className = 'pwa-install-modal';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 100;';

  const card = document.createElement('div');
  card.style.cssText = 'width: min(100%, 500px); border-radius: 20px; background: var(--surface); padding: 2rem 1.5rem; box-shadow: 0 20px 60px rgba(0,0,0,0.3);';

  const title = document.createElement('h2');
  title.textContent = '🍎 Installa Conta Calorie';
  title.style.cssText = 'margin: 0 0 1rem; color: var(--text); font-size: 1.3rem;';

  const text1 = document.createElement('p');
  text1.textContent = 'Aggiungi l\'app alla schermata home di Safari.';
  text1.style.cssText = 'margin: 0 0 1.5rem; color: var(--text); line-height: 1.5;';

  const stepsContainer = document.createElement('div');
  stepsContainer.style.cssText = 'background: var(--surface-strong); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem;';

  const steps = ['Tocca il pulsante Condividi (quadrato con freccia)', 'Scorri verso il basso e seleziona "Aggiungi alla schermata home"', 'Assegna un nome e tocca "Aggiungi"'];
  steps.forEach((step, i) => {
    const stepEl = document.createElement('div');
    stepEl.style.cssText = 'display: flex; gap: 0.75rem; margin-bottom: ' + (i < steps.length - 1 ? '0.75rem' : '0');
    const num = document.createElement('span');
    num.style.cssText = 'flex-shrink: 0; width: 28px; height: 28px; background: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem;';
    num.textContent = (i + 1).toString();
    const text = document.createElement('span');
    text.textContent = step;
    text.style.cssText = 'color: var(--text); line-height: 1.5;';
    stepEl.appendChild(num);
    stepEl.appendChild(text);
    stepsContainer.appendChild(stepEl);
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Ho capito';
  closeBtn.style.cssText = 'display: block; width: 100%; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 1rem;';
  closeBtn.onclick = () => modal.remove();

  card.appendChild(title);
  card.appendChild(text1);
  card.appendChild(stepsContainer);
  card.appendChild(closeBtn);
  modal.appendChild(card);
  document.body.appendChild(modal);
}

function removeExistingModal() {
  document.querySelectorAll('.pwa-install-modal, .install-diagnostics-modal').forEach(el => el.remove());
}

// Verifica il contenuto del manifest
async function verifyManifest() {
  try {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      console.warn('❌ Manifest link non trovato');
      return;
    }

    const manifestUrl = link.href;
    const response = await fetch(manifestUrl);
    const manifest = await response.json();

    console.log('📋 MANIFEST CONTENT:');
    console.log('   Name:', manifest.name);
    console.log('   Short name:', manifest.short_name);
    console.log('   Display:', manifest.display);
    console.log('   Start URL:', manifest.start_url);
    console.log('   Scope:', manifest.scope);
    console.log('   Icons:', manifest.icons?.length || 0);

    // Verifica le icone
    if (manifest.icons && manifest.icons.length > 0) {
      console.log('🖼️  ICON CHECK:');
      for (const icon of manifest.icons) {
        const iconRes = await fetch(icon.src);
        console.log(`   ${icon.src}: ${iconRes.ok ? '✅ OK' : '❌ ' + iconRes.status}`);
      }
    }
  } catch (error) {
    console.error('❌ Errore verifica manifest:', error);
  }
}

// Inizializza pulsante install
function initInstallButton() {
  console.log('🚀 Inizializzazione install button');
  if (!isAppInstalled) {
    showInstallButton();
  }

  // Diagnostica dopo un breve delay
  setTimeout(() => {
    console.log('📊 === PWA STATUS CHECK ===');
    console.log('   beforeinstallprompt catturato:', beforeinstallpromptCaught);
    console.log('   installPrompt disponibile:', !!installPrompt);
    console.log('   App già installata:', isAppInstalled);
    console.log('   Protocollo:', window.location.protocol);
    console.log('   Manifesto link:', document.querySelector('link[rel="manifest"]')?.href);
    console.log('   SW Controller:', !!navigator.serviceWorker?.controller);

    // Verifica il manifest
    verifyManifest();
  }, 1000);
}

// Inizializza quando il DOM è pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInstallButton);
} else {
  initInstallButton();
}
