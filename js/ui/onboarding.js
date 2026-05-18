/*
  Schermata di onboarding e profilo iniziale.
  Fornisce un flusso in tre step con riepilogo target.
*/

import { buildNutritionWarning } from '../nutritionEngine.js';

const CONDITIONS = ['ipertensione', 'prediabete', 'colesterolo alto'];
const PREFERENCES = ['vegetariano', 'low-carb', 'senza lattosio'];

export function renderOnboarding(profile, targets) {
  return `
    <section class="section card">
      <h1>Benvenuto</h1>
      <p>Inizia impostando il tuo profilo e i tuoi obiettivi. I dati resteranno sul dispositivo.</p>
      <div class="onboarding-step step-1">
        <h2>1. Dati base</h2>
        <label>Nome<input id="onbName" value="${profile.nome || ''}" autocomplete="name"></label>
        <div class="field-grid">
          <label>Data di nascita<input id="onbDob" type="date" value="${profile.dataNascita || ''}"></label>
          <label>Genere<select id="onbSex">
            <option value="M">Uomo</option>
            <option value="F">Donna</option>
            <option value="altro">Altro</option>
            <option value="non specificato">Non specificato</option>
          </select></label>
        </div>
        <div class="field-grid">
          <label>Altezza (cm)<input id="onbHeight" type="number" min="100" max="250" value="${profile.altezzaCm || 170}"></label>
          <label>Peso (kg)<input id="onbWeight" type="number" min="30" max="250" value="${profile.pesoKg || 70}"></label>
        </div>
      </div>
      <div class="onboarding-step step-2 hidden">
        <h2>2. Attività e obiettivo</h2>
        <label>Livello di attività<select id="onbActivity">
          <option value="sedentario">Sedentario</option>
          <option value="leggero">Leggero</option>
          <option value="moderato">Moderato</option>
          <option value="intenso">Intenso</option>
        </select></label>
        <label>Obiettivo<select id="onbGoal">
          <option value="dimagrire">Dimagrire</option>
          <option value="mantenere">Mantenere</option>
          <option value="massa">Massa</option>
        </select></label>
      </div>
      <div class="onboarding-step step-3 hidden">
        <h2>3. Condizioni e preferenze</h2>
        <p>Questi elementi servono solo per avvisi nutrizionali.</p>
        <div class="field-grid">
          <label>Condizioni<select id="onbConditions" multiple size="3">
            ${CONDITIONS.map(item => `<option value="${item}">${item}</option>`).join('')}
          </select></label>
          <label>Preferenze<select id="onbPreferences" multiple size="3">
            ${PREFERENCES.map(item => `<option value="${item}">${item}</option>`).join('')}
          </select></label>
        </div>
      </div>
      <div class="onboarding-step step-4 hidden">
        <h2>4. Riepilogo</h2>
        <div class="alert">Verifica sempre i target e modificane i valori se vuoi un preset diverso.</div>
        <div id="onbSummary"></div>
      </div>
      <div class="field-grid">
        <button id="onbPrev" class="secondary" type="button">Indietro</button>
        <button id="onbNext" class="primary" type="button">Avanti</button>
      </div>
    </section>
  `;
}

function getSelectedOptions(select) {
  return Array.from(select.selectedOptions).map(opt => opt.value);
}

function gatherProfile(container) {
  return {
    nome: container.querySelector('#onbName').value.trim(),
    sesso: container.querySelector('#onbSex').value,
    dataNascita: container.querySelector('#onbDob').value,
    altezzaCm: Number(container.querySelector('#onbHeight').value) || 170,
    pesoKg: Number(container.querySelector('#onbWeight').value) || 70,
    attività: container.querySelector('#onbActivity').value,
    obiettivo: container.querySelector('#onbGoal').value,
    condizioni: getSelectedOptions(container.querySelector('#onbConditions')),
    preferenzeDieta: getSelectedOptions(container.querySelector('#onbPreferences'))
  };
}

export function bindOnboardingEvents(container, startProfile, onComplete, calculateTargets) {
  const steps = Array.from(container.querySelectorAll('.onboarding-step'));
  let currentStep = 0;
  const prevButton = container.querySelector('#onbPrev');
  const nextButton = container.querySelector('#onbNext');
  const summaryBox = container.querySelector('#onbSummary');

  container.querySelector('#onbSex').value = startProfile.sesso;
  container.querySelector('#onbActivity').value = startProfile.attività;
  container.querySelector('#onbGoal').value = startProfile.obiettivo;
  (startProfile.condizioni || []).forEach(value => {
    const el = container.querySelector(`#onbConditions option[value="${value}"]`);
    if (el) el.selected = true;
  });
  (startProfile.preferenzeDieta || []).forEach(value => {
    const el = container.querySelector(`#onbPreferences option[value="${value}"]`);
    if (el) el.selected = true;
  });

  function showStep(index) {
    steps.forEach((step, idx) => step.classList.toggle('hidden', idx !== index));
    prevButton.style.visibility = index === 0 ? 'hidden' : 'visible';
    nextButton.textContent = index === steps.length - 1 ? 'Completa' : 'Avanti';
    if (index === steps.length - 1) {
      const profile = gatherProfile(container);
      const targets = calculateTargets(profile);
      summaryBox.innerHTML = `
        <div class="card">
          <p><strong>Calorie:</strong> ${targets.calorie} kcal</p>
          <p><strong>Proteine:</strong> ${targets.proteine} g</p>
          <p><strong>Carboidrati:</strong> ${targets.carboidrati} g</p>
          <p><strong>Grassi:</strong> ${targets.grassi} g</p>
          <p><strong>Fibra stimata:</strong> ${targets.fibra} g</p>
          <p><strong>Zuccheri consigliati:</strong> ${targets.zuccheri} g</p>
        </div>
      `;
    }
  }

  prevButton.addEventListener('click', () => {
    if (currentStep > 0) {
      currentStep -= 1;
      showStep(currentStep);
    }
  });

  nextButton.addEventListener('click', () => {
    if (currentStep < steps.length - 1) {
      currentStep += 1;
      showStep(currentStep);
      return;
    }
    const profile = gatherProfile(container);
    if (!profile.nome || !profile.dataNascita) {
      alert('Inserisci nome e data di nascita.');
      return;
    }
    onComplete(profile);
  });

  showStep(currentStep);
}
