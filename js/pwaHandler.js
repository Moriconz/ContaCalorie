/*
  Gestione della PWA installation prompt.
  Registra il Service Worker il prima possibile per soddisfare i criteri di installabilità.
*/

let installPrompt = null;
let isAppInstalled = false;
let beforeinstallpromptCaught = false;

console.log('🔧 pwaHandler.js caricato');

// Registra il SW IMMEDIATAMENTE per soddisfare i criteri di installabilità PWA
// Deve avvenire prima che il browser decida se mostrare beforeinstallprompt
if ('serviceWorker' in navigator) {
  console.log('🔧 Registrazione SW in corso...');
  navigator.serviceWorker.register('/sw.js')
    .then(reg => {
      console.log('✅ Service Worker registrato:', reg.scope);
    })
    .catch(error => {
      console.warn('❌ Service Worker registration fallito:', error);
    });
} else {
  console.warn('⚠️ Service Worker non supportato');
}

// Verifica se l'app è già installata
window.addEventListener('appinstalled', () => {
  isAppInstalled = true;
  hideInstallButton();
  console.log('✅ App installata con successo');
});

// **CRUCIALE**: Cattura il beforeinstallprompt non appena disponibile
// Questo listener è CRITICO e deve essere il primo ad essere registrato
console.log('🔧 Registrazione listener beforeinstallprompt...');
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('🎉 *** beforeinstallprompt CATTURATO! *** 🎉');
  e.preventDefault();
  installPrompt = e;
  beforeinstallpromptCaught = true;
  updateButtonState();
}, false);
console.log('✅ Listener beforeinstallprompt registrato');

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
      btn.textContent = '📲'; // Reset text
      btn.title = 'Installa app';
    }
  }
}

export function triggerInstallPrompt() {
  console.log('🔵 triggerInstallPrompt chiamato');
  console.log('beforeinstallprompt catturato?', !!installPrompt);
  
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
    alert('📲 Per installare l\'app:\n\n1. Premi il menu (⋮)\n2. Seleziona "Installa app" o "Aggiungi alla home"');
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
    console.log('📊 === PWA DIAGNOSTICA ===');
    console.log('   beforeinstallprompt catturato:', beforeinstallpromptCaught);
    console.log('   installPrompt disponibile:', !!installPrompt);
    console.log('   App già installata:', isAppInstalled);
    console.log('   Protocollo:', window.location.protocol);
    console.log('   Manifesto caricato:', document.querySelector('link[rel="manifest"]') !== null);

    if (!beforeinstallpromptCaught && window.location.protocol === 'https:') {
      console.warn('⚠️ beforeinstallprompt NON catturato su HTTPS - possibile problema di installabilità');
      console.warn('   Controlla: manifest.webmanifest, icons, service worker, theme-color');
    } else if (!beforeinstallpromptCaught && window.location.protocol !== 'https:') {
      console.log('ℹ️ beforeinstallprompt non disponibile su localhost (normale in development)');
    }
  }, 2000);
}

// Inizializza quando il DOM è pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInstallButton);
} else {
  initInstallButton();
}
