/*
  Sistema modali condiviso (estratto da app.js).
  Usa il <template id="modalTemplate"> presente in index.html.

  showModal(contentHtml, bind?) — monta un modale; `bind(modalRoot)` collega gli eventi.
  closeModal() — rimuove il modale corrente.
*/

export function showModal(contentHtml, bind) {
  const modalTemplate = document.getElementById('modalTemplate');
  if (!modalTemplate) {
    console.error('modalTemplate non trovato in index.html');
    return;
  }
  const fragment = modalTemplate.content.cloneNode(true);
  const backdrop = fragment.querySelector('.modal-overlay');
  const body = fragment.querySelector('.modal-body');
  body.innerHTML = contentHtml;
  const closeButton = fragment.querySelector('.modal-close');
  function closeHandler() {
    document.removeEventListener('keydown', escHandler);
    backdrop.remove();
  }
  function escHandler(event) {
    if (event.key === 'Escape') closeHandler();
  }
  closeButton.addEventListener('click', closeHandler);
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) closeHandler();
  });
  document.addEventListener('keydown', escHandler);
  document.body.appendChild(fragment);
  const modalRoot = document.body.querySelector('.modal-overlay:last-of-type');
  if (bind && modalRoot) bind(modalRoot);
  // Autofocus sul primo campo, se il bind non l'ha già gestito
  if (modalRoot && !modalRoot.contains(document.activeElement)) {
    const firstField = modalRoot.querySelector('input, select, textarea, button.primary');
    if (firstField) firstField.focus();
  }
}

export function closeModal() {
  const backdrop = document.querySelector('.modal-overlay');
  if (backdrop) backdrop.remove();
}

/**
 * Conferma coerente con il design dell'app, in sostituzione di confirm() nativo.
 * @param {string} message - testo della domanda
 * @param {Object} [opts] - { title, confirmLabel, cancelLabel, danger }
 * @returns {Promise<boolean>} true se l'utente conferma
 */
export function showConfirm(message, opts = {}) {
  const {
    title = 'Conferma',
    confirmLabel = 'Conferma',
    cancelLabel = 'Annulla',
    danger = false
  } = opts;

  return new Promise(resolve => {
    const modalTemplate = document.getElementById('modalTemplate');
    if (!modalTemplate) {
      // Fallback estremo: confirm nativo
      resolve(window.confirm(message));
      return;
    }
    const fragment = modalTemplate.content.cloneNode(true);
    const backdrop = fragment.querySelector('.modal-overlay');
    const body = fragment.querySelector('.modal-body');
    const closeButton = fragment.querySelector('.modal-close');

    body.innerHTML = `
      <div style="min-width: 260px;">
        <h2 style="margin-top: 0; font-size: 1.1rem;">${title}</h2>
        <p style="margin: 0.75rem 0 1.25rem 0; white-space: pre-line;"></p>
        <div class="field-grid">
          <button class="confirm-yes primary" type="button" ${danger ? 'style="background: #ef4444; border-color: #ef4444; color: white;"' : ''}>${confirmLabel}</button>
          <button class="confirm-no secondary" type="button">${cancelLabel}</button>
        </div>
      </div>
    `;
    // textContent per il messaggio: mai HTML da dati dinamici
    body.querySelector('p').textContent = message;

    function done(result) {
      document.removeEventListener('keydown', escHandler);
      backdrop.remove();
      resolve(result);
    }
    function escHandler(event) {
      if (event.key === 'Escape') done(false);
    }
    body.querySelector('.confirm-yes').addEventListener('click', () => done(true));
    body.querySelector('.confirm-no').addEventListener('click', () => done(false));
    closeButton.addEventListener('click', () => done(false));
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) done(false);
    });
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(fragment);
    // Focus sul bottone di conferma (Enter conferma, Esc annulla)
    document.body.querySelector('.modal-overlay:last-of-type .confirm-yes')?.focus();
  });
}
