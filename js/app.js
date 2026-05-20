/*
  Punto di avvio dell'app PWA Conta Calorie.
  Inizializza lo stato, carica i dati locali e gestisce il rendering delle viste.
*/

import { bootstrapApp } from './appBootstrap.js';
import { loadUserProfile, saveUserProfile, loadUserFoods, saveUserFoods, loadMealsByDate, saveMealEntries, loadAllMeals, saveWeightsSession, loadWeightsSessions, saveCardioSession, loadCardioSessions, saveDailyWeight, loadDailyWeights, loadAllWeightsSessions, loadAllCardioSessions, deleteWeightsSession, deleteCardioSession, saveBodyCompBaseline, loadBodyCompBaselines } from './storage.js';
import { calculateEnergyTargets, aggregateDailySummary, calculateMacrosForAmount, buildNutritionWarning } from './nutritionEngine.js';
import { searchFoods, getFoodDetails } from './nutritionDataProvider.js';
import { analyzePhoto } from './photoNutrition.js';
import { renderOnboarding, bindOnboardingEvents } from './ui/onboarding.js';
import { renderDashboard, bindDashboardEvents } from './ui/dashboard.js';
import { renderFoodSearch, bindFoodSearchEvents } from './ui/foodSearch.js';
import { renderUserFoods, bindUserFoodsEvents, renderUserFoodForm, bindUserFoodFormEvents } from './ui/userFoods.js';
import { renderWeekView, bindWeekViewEvents } from './ui/weekView.js';
import { renderPhotoAnalysis, bindPhotoAnalysisEvents } from './ui/photoAnalysis.js';
import { renderEstimatedFoodForm, bindEstimatedFoodFormEvents } from './ui/estimatedFoodForm.js';
import { renderWeightLoss, bindWeightLossEvents } from './ui/weightLoss.js';
import { renderSettings, bindSettingsEvents } from './ui/settings.js';
import { triggerInstallPrompt } from './pwaHandler.js';
import { aggregateDailyExercise, estimateWeightsCalories, estimateCardioCalories } from './activityEnergyEngine.js';
import { getTheoreticalTDEE, getDailyEnergyBalance, getEnergyBalanceSummary, estimateAdaptiveTDEE } from './weightLossEstimator.js';
import { estimateBodyCompositionChange } from './bodyCompositionModel.js';
import { getTrendWindowData, calculateAllProjections } from './trendProjection.js';
import { getCurrentBaseline, computeBodyCompDeltasSinceBaseline, estimateCompositionToday, createBodyCompBaseline } from './bodyCompTracker.js';

const appState = {
  userProfile: null,
  nutritionTargets: null,
  currentDate: new Date().toISOString().slice(0, 10),
  meals: [],
  userFoods: [],
  searchResults: [],
  currentView: 'dashboard'
};

const mainContent = document.getElementById('mainContent');
const bottomNav = document.getElementById('bottomNav');
const themeToggle = document.getElementById('themeToggle');
const modalTemplate = document.getElementById('modalTemplate');

function reportError(message) {
  showToast(message, 4000);
}

function showToast(message, duration = 2500) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

async function loadState() {
  appState.userProfile = await loadUserProfile();
  appState.userFoods = await loadUserFoods();
  appState.nutritionTargets = appState.userProfile ? calculateEnergyTargets(appState.userProfile) : null;
  appState.meals = appState.userProfile ? await loadMealsByDate(appState.currentDate) : [];
}

function setActiveNav(view) {
  appState.currentView = view;
  bottomNav.querySelectorAll('.nav-button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
}

function goToView(view) {
  appState.currentView = view;
  renderCurrentView();
}

async function renderCurrentView() {
  if (!appState.userProfile) {
    return renderOnboardingView();
  }

  setActiveNav(appState.currentView);

  if (appState.currentView === 'dashboard') {
    return renderDashboardView();
  }
  if (appState.currentView === 'week') {
    return renderWeekViewPage();
  }
  if (appState.currentView === 'search') {
    return renderSearchView();
  }
  if (appState.currentView === 'foods') {
    return renderFoodsView();
  }
  if (appState.currentView === 'weight') {
    return renderWeightLossView();
  }
  if (appState.currentView === 'settings') {
    return renderSettingsView();
  }
  return renderDashboardView();
}

function renderOnboardingView() {
  mainContent.innerHTML = renderOnboarding(appState.userProfile || {}, appState.nutritionTargets || {});
  bindOnboardingEvents(mainContent, appState.userProfile || {}, async (profile) => {
    profile.id = profile.id || crypto.randomUUID();
    appState.userProfile = profile;
    appState.nutritionTargets = calculateEnergyTargets(profile);
    await saveUserProfile(profile);
    appState.meals = await loadMealsByDate(appState.currentDate);
    appState.currentView = 'dashboard';
    renderCurrentView();
    showToast('Profilo salvato. Benvenuto!');
  }, calculateEnergyTargets);
}

async function renderDashboardView() {
  const summary = aggregateDailySummary(appState.meals, appState.nutritionTargets);
  const warnings = buildNutritionWarning(appState.userProfile, summary);

  let bodyCompData = null;
  let baselines = [];

  try {
    baselines = await loadBodyCompBaselines();
    console.log('Baselines caricate:', baselines.length > 0 ? baselines : 'nessuno');
    const currentBaseline = getCurrentBaseline(baselines, appState.currentDate);
    console.log('Current baseline:', currentBaseline);

    if (currentBaseline) {
      console.log('Caricamento dati per calcolo composizione...');
      const [allMeals, allWeightsSessions, allCardioSessions, dailyWeights] = await Promise.all([
        loadAllMeals(),
        loadAllWeightsSessions(),
        loadAllCardioSessions(),
        loadDailyWeights()
      ]);

      console.log('Dati caricati:', { mealsCount: allMeals.length, weightsCount: allWeightsSessions.length, cardioCount: allCardioSessions.length, weightsCount: dailyWeights.length });

      const deltas = computeBodyCompDeltasSinceBaseline(
        currentBaseline,
        appState.currentDate,
        allMeals,
        allWeightsSessions,
        allCardioSessions,
        dailyWeights,
        appState.userProfile
      );

      console.log('Deltas calcolati:', deltas);

      const todayWeightEntry = dailyWeights.find(w => w.data === appState.currentDate);
      const weightToday = todayWeightEntry?.pesoKg || appState.userProfile.pesoKg;

      console.log('Peso oggi:', weightToday);

      const composition = estimateCompositionToday(currentBaseline, weightToday, deltas);

      console.log('Composizione stimata:', composition);

      bodyCompData = {
        ...composition,
        baseline: currentBaseline,
        driftWarning: composition.driftWarning
      };
      console.log('bodyCompData finale:', bodyCompData);
    } else {
      console.log('Nessun baseline presente');
    }
  } catch (error) {
    console.error('Errore nel calcolo composizione corporea:', error);
    console.error('Stack trace:', error.stack);
    bodyCompData = null;
  }

  mainContent.innerHTML = renderDashboard(appState, summary, warnings, bodyCompData);
  bindDashboardEvents(mainContent,
    () => goToView('search'),
    () => openPhotoImport(),
    () => triggerInstallPrompt(),
    () => openBodyCompBaselineForm(baselines)
  );
}

function renderSearchView() {
  mainContent.innerHTML = renderFoodSearch(appState, appState.searchResults, appState.userFoods);
  bindFoodSearchEvents(mainContent, {
    onSearch: executeFoodSearch,
    onCustomFood: () => openCustomFoodForm(),
    onSelectFood: handleFoodSelection,
    onEstimatedFood: () => openEstimatedFoodForm()
  });
}

function renderFoodsView() {
  mainContent.innerHTML = renderUserFoods(appState.userFoods);
  bindUserFoodsEvents(mainContent, {
    onCreate: () => openCustomFoodForm(),
    onEdit: id => editUserFood(id),
    onDelete: id => deleteUserFood(id)
  });
}

async function renderWeightLossView() {
  // Carica tutti i dati necessari
  const [allMeals, todayWeightsSessions, todayCardioSessions, allWeightsSessions, allCardioSessions, dailyWeights] = await Promise.all([
    loadAllMeals(),
    loadWeightsSessions(appState.currentDate),
    loadCardioSessions(appState.currentDate),
    loadAllWeightsSessions(),
    loadAllCardioSessions(),
    loadDailyWeights()
  ]);

  // Filtra pasti di oggi
  const todayMeals = allMeals.filter(meal => meal.data === appState.currentDate);

  // Calcola TDEE teorico
  const tdee = getTheoreticalTDEE(appState.userProfile);

  // Calcola esercizio di oggi
  const todayExercise = aggregateDailyExercise(todayWeightsSessions, todayCardioSessions, appState.userProfile);

  // Calcola i bilanci energetici degli ultimi 7 giorni
  const last7DaysBalances = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const dayMeals = allMeals.filter(meal => meal.data === dateKey);
    const dayIntake = dayMeals.reduce((sum, meal) => sum + (meal.macroCalcolate?.kcal || 0), 0);

    const dayWeightsSessions = allWeightsSessions.filter(s => s.data === dateKey);
    const dayCardioSessions = allCardioSessions.filter(s => s.data === dateKey);
    const dayExercise = aggregateDailyExercise(dayWeightsSessions, dayCardioSessions, appState.userProfile);

    const balance = getDailyEnergyBalance(dayIntake, dayExercise, tdee);
    last7DaysBalances.push({ ...balance, data: dateKey });
  }

  // Calcola TDEE adattivo da dati reali
  const tdeeAdaptiveResult = estimateAdaptiveTDEE(dailyWeights, last7DaysBalances);

  // Calcola training stats (ultimi 7 giorni)
  const recentWeightsSessions = allWeightsSessions.filter(s => {
    const sessionDate = new Date(s.data);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return sessionDate >= sevenDaysAgo;
  });
  const weightsSessionsPerWeek = recentWeightsSessions.length / 1;
  const avgRPE = recentWeightsSessions.length > 0
    ? (recentWeightsSessions.reduce((sum, s) => {
        if (typeof s.intensita === 'number') return sum + s.intensita;
        const rpeMap = { leggero: 3, moderato: 6, intenso: 9 };
        return sum + (rpeMap[s.intensita] || 5);
      }, 0) / recentWeightsSessions.length)
    : 5;

  // Calcola protein stats (media ultimi 7 giorni)
  const allProteinIntake = allMeals
    .filter(meal => {
      const mealDate = new Date(meal.data);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return mealDate >= sevenDaysAgo;
    })
    .reduce((sum, meal) => sum + (meal.macroCalcolate?.proteine || 0), 0);
  const proteinPerKg = appState.userProfile.pesoKg > 0
    ? (allProteinIntake / 7) / appState.userProfile.pesoKg
    : 1.0;

  // Calcola composizione corporea per 30 giorni
  const bodyCompositionEstimate = estimateBodyCompositionChange(
    last7DaysBalances.length > 0 ? (last7DaysBalances.reduce((sum, b) => sum + b.netDeficitOrSurplus, 0) / last7DaysBalances.length) : 0,
    30,
    tdee,
    { weightsSessionsPerWeek, avgRPE },
    { proteinPerKg }
  );

  // Calcola proiezioni basate su trend (ultimi 30 giorni)
  const trendData = getTrendWindowData(30, allMeals, allWeightsSessions, allCardioSessions, dailyWeights, appState.userProfile);
  const allProjections = trendData.insufficientData
    ? { insufficientData: true, reason: trendData.reason }
    : calculateAllProjections(trendData, appState.userProfile, tdeeAdaptiveResult.adaptiveTDEE || tdee, !!tdeeAdaptiveResult.adaptiveTDEE);

  const renderData = {
    userProfile: appState.userProfile,
    todayMeals,
    todayExercise,
    tdee,
    todayWeightsSessions,
    todayCardioSessions,
    allWeightsSessions,
    allCardioSessions,
    dailyWeights,
    last7DaysBalances,
    tdeeAdaptive: tdeeAdaptiveResult.adaptiveTDEE,
    trainingStats: { weightsSessionsPerWeek, avgRPE },
    nutritionStats: { proteinPerKg },
    bodyCompositionEstimate,
    projections: allProjections
  };

  mainContent.innerHTML = renderWeightLoss(renderData);
  bindWeightLossEvents(mainContent, {
    onSaveWeightsSession: async (session) => {
      const sessionToSave = {
        id: crypto.randomUUID(),
        data: appState.currentDate,
        ...session
      };
      await saveWeightsSession(sessionToSave);
      renderWeightLossView();
      showToast('Sessione pesi aggiunta.');
    },
    onSaveCardioSession: async (session) => {
      const sessionToSave = {
        id: crypto.randomUUID(),
        data: appState.currentDate,
        ...session
      };
      await saveCardioSession(sessionToSave);
      renderWeightLossView();
      showToast('Sessione cardio aggiunta.');
    },
    onSaveDailyWeight: async (pesoKg) => {
      const weightEntry = {
        id: appState.currentDate,
        data: appState.currentDate,
        pesoKg
      };
      await saveDailyWeight(weightEntry);
      renderWeightLossView();
      showToast('Peso registrato.');
    },
    onDeleteSession: async (type, id) => {
      if (type === 'weights') {
        await deleteWeightsSession(id);
      } else if (type === 'cardio') {
        await deleteCardioSession(id);
      }
      renderWeightLossView();
      showToast('Sessione eliminata.');
    },
  });
}

async function renderWeekViewPage() {
  const allMeals = await loadAllMeals();
  const days = Array.from({ length: 7 }).map((_, idx) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - idx));
    const dateKey = day.toISOString().slice(0, 10);
    const entries = allMeals.filter(entry => entry.data === dateKey);
    const summary = aggregateDailySummary(entries, appState.nutritionTargets);
    const ratio = summary.confrontoConTarget.calorie.percent;
    const status = ratio >= 90 && ratio <= 110 ? 'Ok' : ratio < 90 ? 'Basso' : 'Alto';
    return {
      data: dateKey,
      label: day.toLocaleDateString('it-IT', { weekday: 'short' }),
      totaleCalorie: summary.totaleCalorie,
      status
    };
  });
  mainContent.innerHTML = renderWeekView(days);
  bindWeekViewEvents(mainContent, {
    onSelectDay: async selectedDate => {
      appState.currentDate = selectedDate;
      appState.meals = await loadMealsByDate(selectedDate);
      appState.currentView = 'dashboard';
      renderCurrentView();
    }
  });
}

async function executeFoodSearch(query) {
  if (!query) {
    reportError('Inserisci un termine di ricerca.');
    return;
  }
  mainContent.querySelector('#searchButton').textContent = 'Ricerca...';
  const results = await searchFoods(query);
  appState.searchResults = results;
  await renderSearchView();
}

async function handleFoodSelection(id, source) {
  let food;
  if (source === 'USER_CUSTOM') {
    food = appState.userFoods.find(item => item.id === id);
  } else {
    food = await getFoodDetails(id);
  }
  if (!food) {
    reportError('Impossibile trovare il prodotto selezionato.');
    return;
  }
  showFoodDetailModal(food);
}

function showFoodDetailModal(food) {
  const html = `
    <div>
      <h1>Aggiungi alimento</h1>
      <div class="card">
        <p><strong>${food.nome}</strong>${food.brand ? ` - ${food.brand}` : ''}</p>
        <p class="small-muted">${food.porzioneBase}</p>
        <label>Momento del pasto<select id="mealMoment">
          <option value="colazione">Colazione</option>
          <option value="spuntino">Spuntino</option>
          <option value="pranzo">Pranzo</option>
          <option value="merenda">Merenda</option>
          <option value="cena">Cena</option>
          <option value="altro">Altro</option>
        </select></label>
        <label>Grammi<input id="foodGrams" type="number" min="1" max="3000" value="100"></label>
        <div id="foodDetailCalc" class="small-muted">Kcal: ${food.per100g.kcal} • Prot: ${food.per100g.proteine} g • Carbo: ${food.per100g.carboidrati} g</div>
        <div class="field-grid">
          <button id="confirmAddFood" class="primary">Aggiungi</button>
          <button id="cancelAddFood" class="secondary">Annulla</button>
        </div>
      </div>
    </div>
  `;
  showModal(html, container => {
    const gramsInput = container.querySelector('#foodGrams');
    const detail = container.querySelector('#foodDetailCalc');
    function updateDetail() {
      const grams = Number(gramsInput.value) || 0;
      const macro = calculateMacrosForAmount(food, grams);
      detail.textContent = `Kcal: ${macro.kcal} • Prot: ${macro.proteine} g • Carbo: ${macro.carboidrati} g • Grassi: ${macro.grassi} g`;
    }
    updateDetail();
    gramsInput.addEventListener('input', updateDetail);
    container.querySelector('#confirmAddFood').addEventListener('click', async () => {
      const grams = Number(gramsInput.value);
      if (!grams || grams < 1) {
        reportError('Inserisci un valore di grammi valido.');
        return;
      }
      const moment = container.querySelector('#mealMoment').value;
      const macroCalcolate = calculateMacrosForAmount(food, grams);
      const entry = {
        id: crypto.randomUUID(),
        userId: appState.userProfile.id,
        data: appState.currentDate,
        momento: moment,
        foodRef: { id: food.id, source: food.source, name: food.nome },
        grammi: grams,
        macroCalcolate,
        origin: 'manual_search',
        note: ''
      };
      appState.meals.push(entry);
      await saveMealEntries([entry]);
      closeModal();
      renderCurrentView();
      showToast('Alimento aggiunto.');
    });
    container.querySelector('#cancelAddFood').addEventListener('click', closeModal);
  });
}

function openCustomFoodForm(existingFood = null) {
  const html = renderUserFoodForm(existingFood);
  showModal(html, container => {
    bindUserFoodFormEvents(container, {
      onSave: async data => {
        if (!data.nome) {
          reportError('Il nome dell alimento è obbligatorio.');
          return;
        }
        const food = existingFood ? { ...existingFood, ...data } : { ...data, id: crypto.randomUUID(), source: 'USER_CUSTOM', createdByUserId: appState.userProfile.id };
        if (existingFood) {
          appState.userFoods = appState.userFoods.map(item => item.id === food.id ? food : item);
        } else {
          appState.userFoods.push(food);
        }
        await saveUserFoods(appState.userFoods);
        closeModal();
        renderFoodsView();
        showToast('Alimento salvato localmente.');
      },
      onCancel: closeModal
    });
  });
}

function editUserFood(id) {
  const food = appState.userFoods.find(item => item.id === id);
  if (!food) return;
  openCustomFoodForm(food);
}

async function deleteUserFood(id) {
  if (!confirm('Eliminare questo alimento personalizzato?')) return;
  appState.userFoods = appState.userFoods.filter(item => item.id !== id);
  await saveUserFoods(appState.userFoods);
  renderFoodsView();
  showToast('Alimento eliminato.');
}

function openPhotoImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    closeModal();
    try {
      showToast('Analizzo l’immagine...');
      const result = await analyzePhoto(file);
      openPhotoAnalysis(result.items);
    } catch (error) {
      reportError('Analisi foto non disponibile, prova inserimento manuale.');
    }
  });
  input.click();
}

function openPhotoAnalysis(items) {
  const html = renderPhotoAnalysis(items);
  showModal(html, container => {
    bindPhotoAnalysisEvents(container, {
      onConfirm: async selectedItems => {
        const enabled = selectedItems.filter(item => item.enabled && item.estimateGrams > 0);
        if (!enabled.length) {
          reportError('Seleziona almeno un elemento da aggiungere.');
          return;
        }
        const entries = enabled.map(item => ({
          id: crypto.randomUUID(),
          userId: appState.userProfile.id,
          data: appState.currentDate,
          momento: 'altro',
          foodRef: { id: `photo-${item.index}-${Date.now()}`, source: 'USER_CUSTOM', name: item.name },
          grammi: item.estimateGrams,
          macroCalcolate: {
            kcal: item.macro.kcal,
            proteine: item.macro.proteine,
            carboidrati: item.macro.carboidrati,
            grassi: item.macro.grassi,
            zuccheri: item.macro.zuccheri,
            fibra: item.macro.fibra || 0
          },
          origin: 'photo_ai_guess',
          note: 'Stimato da immagine'
        }));
        appState.meals.push(...entries);
        await saveMealEntries(entries);
        closeModal();
        renderCurrentView();
        showToast('Alimenti aggiunti dalla foto. Verifica sempre le quantità.');
      },
      onCancel: closeModal
    });
  });
}

function openEstimatedFoodForm() {
  const html = renderEstimatedFoodForm();
  showModal(html, container => {
    bindEstimatedFoodFormEvents(container, {
      onConfirm: async estimatedFood => {
        // Chiedi il momento del pasto
        const momento = await promptMealMoment();
        if (!momento) return;

        const entry = {
          id: crypto.randomUUID(),
          userId: appState.userProfile.id,
          data: appState.currentDate,
          momento,
          foodRef: {
            id: `estimated-${Date.now()}`,
            source: 'TYPICAL_ESTIMATE',
            name: estimatedFood.nome,
            categoria: estimatedFood.categoria
          },
          grammi: estimatedFood.grammi,
          macroCalcolate: estimatedFood.macroCalcolate,
          origin: 'estimated_typical_value',
          note: `Stima categoria "${estimatedFood.categoria}"`
        };

        appState.meals.push(entry);
        await saveMealEntries([entry]);
        closeModal();
        renderCurrentView();
        showToast('Alimento stimato aggiunto. Usa dati precisi quando disponibili.');
      }
    });
  });
}

function promptMealMoment() {
  return new Promise(resolve => {
    const html = `
      <div class="modal-content">
        <h2>Quando?</h2>
        <label>Momento del pasto
          <select id="mealMomentSelect">
            <option value="colazione">Colazione</option>
            <option value="spuntino">Spuntino</option>
            <option value="pranzo">Pranzo</option>
            <option value="merenda">Merenda</option>
            <option value="cena">Cena</option>
            <option value="altro" selected>Altro</option>
          </select>
        </label>
        <button id="confirmMoment" class="primary">Conferma</button>
        <button id="cancelMoment" class="secondary">Annulla</button>
      </div>
    `;

    showModal(html, container => {
      container.querySelector('#confirmMoment').addEventListener('click', () => {
        const momento = container.querySelector('#mealMomentSelect').value;
        closeModal();
        resolve(momento);
      });
      container.querySelector('#cancelMoment').addEventListener('click', () => {
        closeModal();
        resolve(null);
      });
    });
  });
}

function showModal(contentHtml, bind) {
  const fragment = modalTemplate.content.cloneNode(true);
  const backdrop = fragment.querySelector('.modal-backdrop');
  const body = fragment.querySelector('.modal-body');
  body.innerHTML = contentHtml;
  const closeButton = fragment.querySelector('.modal-close');
  function closeHandler() {
    backdrop.remove();
  }
  closeButton.addEventListener('click', closeHandler);
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) closeHandler();
  });
  const appendedNode = document.body.appendChild(fragment);
  const modalRoot = appendedNode.querySelector('.modal-backdrop') || document.body.querySelector('.modal-backdrop:last-of-type');
  if (bind && modalRoot) bind(modalRoot);
}

function closeModal() {
  const backdrop = document.querySelector('.modal-backdrop');
  if (backdrop) backdrop.remove();
}

function attachBottomNav() {
  bottomNav.addEventListener('click', event => {
    const button = event.target.closest('.nav-button');
    if (!button) return;
    const view = button.dataset.view;
    if (view) {
      appState.currentView = view;
      renderCurrentView();
    }
  });
}

function attachInstallButton() {
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.addEventListener('click', () => {
      console.log('📲 Pulsante install cliccato');
      triggerInstallPrompt();
    });
  }
}

function openBodyCompBaselineForm(existingBaselines = []) {
  const html = `
    <div>
      <h2>📊 Calibrazione Composizione Corporea</h2>
      <p class="small-muted" style="margin-bottom: 1rem;">Inserisci una misurazione di body fat % da DEXA, BIA o plicometria per tracciare la composizione corporea.</p>

      <label style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
        <span class="label-text">Data misurazione</span>
        <input id="baselineDate" type="date" value="${new Date().toISOString().slice(0, 10)}">
      </label>

      <label style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
        <span class="label-text">Peso (kg)</span>
        <input id="baselineWeight" type="number" min="30" max="300" step="0.1" value="${appState.userProfile.pesoKg || 70}">
      </label>

      <label style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
        <span class="label-text">Body Fat % (da DEXA/BIA/plicometria)</span>
        <input id="baselineBF" type="number" min="5" max="95" step="0.1" value="20">
      </label>

      <div class="small-muted" style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(99,102,241,0.1); border-radius: 8px;">
        ⓘ Quando inserisci il baseline, la composizione corporea sarà calcolata da questo punto in poi usando il tuo trend di calorie, allenamenti e proteine.
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <button id="saveBaseline" class="primary" style="width: 100%;">Salva Calibrazione</button>
        <button id="cancelBaseline" class="secondary" style="width: 100%;">Annulla</button>
      </div>
    </div>
  `;

  showModal(html, container => {
    container.querySelector('#saveBaseline').addEventListener('click', async () => {
      const date = container.querySelector('#baselineDate').value;
      const weight = parseFloat(container.querySelector('#baselineWeight').value);
      const bf = parseFloat(container.querySelector('#baselineBF').value);

      if (!date || weight <= 0 || bf < 5 || bf > 95) {
        reportError('Valori non validi. Verifica i campi.');
        return;
      }

      const baseline = createBodyCompBaseline(date, weight, bf);
      await saveBodyCompBaseline(baseline);
      closeModal();
      renderCurrentView();
      showToast('Calibrazione salvata. Composizione corporea aggiornata.');
    });

    container.querySelector('#cancelBaseline').addEventListener('click', closeModal);
  });
}

function attachThemeToggle() {
  if (!themeToggle) {
    console.warn('Theme toggle element not found');
    return;
  }

  // Carica il tema salvato
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
    themeToggle.textContent = '🌙';
  } else if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
    themeToggle.textContent = '☀️';
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? '🌙' : '☀️';
  });
}

function renderSettingsView() {
  mainContent.innerHTML = renderSettings();
  bindSettingsEvents(mainContent, {
    onEditProfile: async () => {
      appState.currentView = 'dashboard';
      renderOnboardingView();
    }
  });
}


async function init() {
  // 1. CRITICO: Bootstrap della PWA (IndexedDB, storage persistente, SW)
  const bootstrapOk = await bootstrapApp();
  if (!bootstrapOk) {
    console.error('❌ Bootstrap fallito, app non può avviarsi');
    return;
  }

  // 2. Avvio normale dell'app
  attachBottomNav();
  attachThemeToggle();
  attachInstallButton();
  await loadState();
  renderCurrentView();
}

init().catch(error => {
  console.error('❌ Errore inizializzazione app', error);
  reportError('Errore caricamento app. Ricarica la pagina.');
});
