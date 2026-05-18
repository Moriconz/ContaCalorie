/*
  Gestione della PWA installation prompt.
*/

let installPrompt = null;
let isAppInstalled = false;
let beforeinstallpromptCaught = false;

// Verifica se l'app è già installata
window.addEventListener('appinstalled', () => {
  isAppInstalled = true;
  hideInstallButton();
  console.log('✅ App installata');
});

// **CRUCIALE**: Cattura il beforeinstallprompt non appena disponibile
// Deve essere fatto il prima possibile, prima che l'utente faccia click
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('🎉 beforeinstallprompt CATTURATO!');
  e.preventDefault();
  installPrompt = e;
  beforeinstallpromptCaught = true;
  updateButtonState();
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

// Inizializza
function initInstallButton() {
  console.log('🚀 Inizializzazione install button');
  if (!isAppInstalled) {
    showInstallButton();
  }
  
  // Log stato dopo 1 secondo (per verificare se beforeinstallprompt è stato catturato)
  setTimeout(() => {
    console.log('📊 Stato dopo 1s - beforeinstallprompt catturato:', beforeinstallpromptCaught);
  }, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInstallButton);
} else {
  initInstallButton();
}
