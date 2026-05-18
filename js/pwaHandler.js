/*
  Gestione della PWA installation prompt.
  Cattura beforeinstallprompt, mostra il pulsante custom, gestisce l'evento appinstalled.
*/

let installPrompt = null;
let isAppInstalled = false;

// Verifica se l'app è già installata
window.addEventListener('appinstalled', () => {
  isAppInstalled = true;
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
});

// Cattura il beforeinstallprompt (supportato su Android Chrome, non su iOS)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;

  // Mostra il pulsante quando il prompt è disponibile
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.style.display = 'flex';
  }
});

export function triggerInstallPrompt() {
  if (installPrompt && !isAppInstalled) {
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('Utente ha accettato l\'installazione');
        isAppInstalled = true;
      } else {
        console.log('Utente ha rifiutato l\'installazione');
      }
      installPrompt = null;
    });
  }
}

export function isInstallAvailable() {
  return installPrompt !== null && !isAppInstalled;
}

export function isInstalled() {
  return isAppInstalled;
}
