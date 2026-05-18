/*
  Gestione della PWA installation prompt.
*/

let installPrompt = null;
let isAppInstalled = false;

// Verifica se l'app è già installata
window.addEventListener('appinstalled', () => {
  isAppInstalled = true;
  hideInstallButton();
});

// Cattura il beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  console.log('✅ beforeinstallprompt catturato');
});

function hideInstallButton() {
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.style.display = 'none';
}

function showInstallButton() {
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.style.display = 'flex';
}

export function triggerInstallPrompt() {
  console.log('🔵 triggerInstallPrompt cliccato');
  
  if (installPrompt) {
    console.log('✅ Usando beforeinstallprompt nativo');
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        hideInstallButton();
      }
      installPrompt = null;
    }).catch(e => console.error('❌ Errore prompt:', e));
  } else {
    console.log('⚠️ beforeinstallprompt non disponibile - mostrando alert');
    alert('📲 Per installare l\'app:\n\n1. Premi il menu (⋮)\n2. Seleziona "Installa app"');
  }
}

// Inizializza - mostra pulsante al caricamento (a meno che già installata)
document.addEventListener('DOMContentLoaded', () => {
  console.log('📱 App caricata');
  if (!isAppInstalled) {
    showInstallButton();
  }
});

// Fallback se DOMContentLoaded già passato
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!isAppInstalled) showInstallButton();
  });
} else {
  if (!isAppInstalled) showInstallButton();
}
