/*
  Gestione della PWA installation prompt.
  Cattura beforeinstallprompt, mostra il pulsante custom, gestisce l'evento appinstalled.
*/

let installPrompt = null;
let isAppInstalled = false;

// Verifica se l'app è già installata (dopo l'installazione)
window.addEventListener('appinstalled', () => {
  isAppInstalled = true;
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
  console.log('PWA installata con successo');
});

// Cattura il beforeinstallprompt (Android Chrome, Brave, Edge, ecc.)
// Se non viene catturato, il pulsante rimane visibile comunque
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  console.log('beforeinstallprompt catturato');
  
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.style.display = 'flex';
  }
});

export function triggerInstallPrompt() {
  console.log('triggerInstallPrompt chiamato, installPrompt:', !!installPrompt);
  
  if (installPrompt) {
    // Se abbiamo il beforeinstallprompt, usalo
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
  } else {
    // Se il beforeinstallprompt non è stato catturato, mostra istruzioni
    alert('Per installare l\'app:\n\n1. Premi il menu (⋮) in alto a destra\n2. Seleziona "Installa app" o "Aggiungi alla schermata home"');
  }
}

export function isInstallAvailable() {
  return installPrompt !== null && !isAppInstalled;
}

export function isInstalled() {
  return isAppInstalled;
}
