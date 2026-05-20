/*
  Punto di avvio dell'app PWA Conta Calorie.
  Inizializza lo stato, carica i dati locali e gestisce il rendering delle viste.
*/

import { bootstrapApp } from './appBootstrap.js';
import { loadUserProfile, saveUserProfile, loadUserFoods, saveUserFoods, loadMealsByDate, saveMealEntries, loadAllMeals, saveWeightsSession, loadWeightsSessions, saveCardioSession, loadCardioSessions, saveDailyWeight, loadDailyWeights, loadAllWeightsSessions, loadAllCardioSessions, deleteWeightsSession, deleteCardioSession, saveBodyCompBaseline, loadBodyCompBaselines, saveRecipe, loadRecipes, deleteRecipe, updateRecipe, loadRecipeById, saveDailySteps, loadDailyStepsByDate, loadDailyStepsByDateRange, deleteDailySteps, saveActivityPreferences, loadActivityPreferences, saveStrengthSession, loadStrengthSessionsByDateRange, updateStrengthSession, deleteStrengthSession, loadWeightsSessionsByDateRange, updateWeightsSession, loadCardioSessionsByDateRange, updateCardioSession } from './storage.js';
import { calculateEnergyTargets, aggregateDailySummary, calculateMacrosForAmount, buildNutritionWarning } from './nutritionEngine.js';
import { searchFoods, getFoodDetails } from './nutritionDataProvider.js';
import { analyzePhoto } from './photoNutrition.js';
import { renderOnboarding, bindOnboardingEvents } from './ui/onboarding.js';
import { renderDashboard, bindDashboardEvents } from './ui/dashboard.js';
import { renderFoodSearch, bindFoodSearchEvents } from './ui/foodSearch.js';
import { renderUserFoods, bindUserFoodsEvents, renderUserFoodForm, bindUserFoodFormEvents } from './ui/userFoods.js';
import { renderRecipesSection, bindRecipesEvents, renderRecipeForm, bindRecipeFormEvents } from './ui/recipes.js';
import { renderWeekView, bindWeekViewEvents } from './ui/weekView.js';
import { renderPhotoAnalysis, bindPhotoAnalysisEvents } from './ui/photoAnalysis.js';
import { renderEstimatedFoodForm, bindEstimatedFoodFormEvents } from './ui/estimatedFoodForm.js';
import { renderWeightLoss, bindWeightLossEvents } from './ui/weightLoss.js';
import { renderSettings, bindSettingsEvents } from './ui/settings.js';
import { renderActivitiesView, bindActivitiesEvents, showAddStrengthModal, showEditStrengthModal, showAddCardioModal, showEditCardioModal, showAddStepsModal, showProviderSelectionModal, showFileImportModal } from './ui/activities.js';
import { PROVIDERS, getAvailableProviders, parseStepsFile, getConnectedProvider, setConnectedProvider, clearConnectedProvider } from './activitySyncProviders.js';
import { triggerInstallPrompt } from './pwaHandler.js';
import { aggregateDailyExercise, estimateWeightsCalories, estimateCardioCalories, estimateStepsCalories, shouldExcludeStepsCalories, applyEatBackCalories } from './activityEnergyEngine.js';
import { getTheoreticalTDEE, getDailyEnergyBalance, getEnergyBalanceSummary, estimateAdaptiveTDEE } from './weightLossEstimator.js';
import { estimateBodyCompositionChange } from './bodyCompositionModel.js';
import { getTrendWindowData, calculateAllProjections } from './trendProjection.js';
import { getCurrentBaseline, computeBodyCompDeltasSinceBaseline, estimateCompositionToday, createBodyCompBaseline } from './bodyCompTracker.js';

import { trackFoodUsage, getRecents, suggestMealMomentByTime, getLastMealMoment } from './recentFoodsTracker.js';
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
  if (appState.currentView === 'activities') {
    return renderActivitiesViewPage();
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

  // Load activity data for today
  let activityData = { strengthCount: 0, cardioCount: 0, steps: 0, activityKcal: 0 };
  try {
    const [todayStrength, todayCardio, todaySteps, prefs] = await Promise.all([
      loadStrengthSessionsByDateRange(appState.currentDate, appState.currentDate),
      loadCardioSessionsByDateRange(appState.currentDate, appState.currentDate),
      loadDailyStepsByDate(appState.currentDate),
      loadActivityPreferences()
    ]);

    const activityPrefs = prefs || {
      energyModel: 'tdee_plus_extras',
      avoidDoubleCountingWalking: true,
      eatBackMode: 'partial',
      eatBackRatio: 0.3,
      includeStepsInTdee: true,
      stepGoal: 10000,
      includeStrengthInExpenditure: true,
      includeCardioInExpenditure: true
    };

    const strengthKcal = todayStrength.reduce((sum, s) => sum + (s.estimatedKcal || estimateWeightsCalories(s, appState.userProfile)), 0);
    const cardioKcal = todayCardio.reduce((sum, c) => sum + (c.estimatedKcal || estimateCardioCalories(c, appState.userProfile)), 0);
    const stepsExcluded = shouldExcludeStepsCalories(todaySteps, todayCardio, activityPrefs);
    const stepsKcal = (!stepsExcluded && todaySteps) ? estimateStepsCalories(todaySteps, appState.userProfile, activityPrefs) : 0;

    activityData = {
      strengthCount: todayStrength.length,
      cardioCount: todayCardio.length,
      steps: todaySteps?.steps || 0,
      distanceKm: todaySteps?.distanceKm,
      activityKcal: strengthKcal + cardioKcal + stepsKcal,
      strengthSessions: todayStrength,
      cardioSessions: todayCardio,
      prefs: activityPrefs
    };
  } catch (err) {
    console.warn('Errore nel caricamento attività per dashboard:', err);
  }

  // Calculate weekly trend (last 7 days)
  try {
    const dailyBalances = [];
    const lastSeven = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(appState.currentDate);
      date.setDate(date.getDate() - i);
      lastSeven.push(date.toISOString().split('T')[0]);
    }

    const [allMeals, allStrength, allCardio, allSteps] = await Promise.all([
      loadAllMeals(),
      loadAllWeightsSessions(),
      loadAllCardioSessions(),
      loadDailyStepsByDateRange(lastSeven[0], lastSeven[lastSeven.length - 1])
    ]);

    for (const date of lastSeven) {
      const dayMeals = allMeals.filter(m => m.data === date);
      const daySummary = aggregateDailySummary(dayMeals, appState.nutritionTargets);
      const dayStrength = allStrength.filter(s => s.data === date);
      const dayCardio = allCardio.filter(c => c.data === date);
      const daySteps = allSteps.find(s => s.data === date);

      const sKcal = dayStrength.reduce((sum, s) => sum + (s.estimatedKcal || estimateWeightsCalories(s, appState.userProfile)), 0);
      const cKcal = dayCardio.reduce((sum, c) => sum + (c.estimatedKcal || estimateCardioCalories(c, appState.userProfile)), 0);
      const stepsExcl = shouldExcludeStepsCalories(daySteps, dayCardio, activityData.prefs);
      const stsKcal = (!stepsExcl && daySteps) ? estimateStepsCalories(daySteps, appState.userProfile, activityData.prefs) : 0;
      const dayActivityKcal = sKcal + cKcal + stsKcal;

      const intake = Math.round(daySummary.totaleCalorie || 0);
      const tdeeBase = Math.round(daySummary.tdee || 0);
      const tdeeTotal = tdeeBase + dayActivityKcal;
      const balance = intake - tdeeTotal;

      dailyBalances.push(balance);
    }

    const avgDeficit = Math.round(dailyBalances.reduce((a, b) => a + b, 0) / 7);
    const estimatedFatChange = Math.abs(avgDeficit) / 7700 * 30;
    const estimatedLeanChange = -(estimatedFatChange * 0.1); // Rough estimate of lean mass change

    summary.weeklyTrend = {
      dailyBalances,
      avgDeficit,
      estimatedFatChange,
      estimatedLeanChange
    };
  } catch (err) {
    console.warn('Errore nel calcolo trend settimanale:', err);
    summary.weeklyTrend = {
      dailyBalances: [0, 0, 0, 0, 0, 0, 0],
      avgDeficit: 0,
      estimatedFatChange: 0,
      estimatedLeanChange: 0
    };
  }

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

  mainContent.innerHTML = renderDashboard(appState, summary, warnings, bodyCompData, activityData);
  bindDashboardEvents(mainContent, {
    onAddMeal: () => openQuickAdd(),
    onAddActivity: () => goToView('activities'),
    onAddWeight: () => showWeightUpdateModal(),
    onUpdateWeight: () => showWeightUpdateModal(),
    onGoToWeight: () => goToView('weight'),
    onGoToActivities: () => goToView('activities'),
    onGoToStats: () => goToView('statistics'),
    onGoToNutrition: () => goToView('search'),
    onBodyComp: () => openBodyCompBaselineForm(baselines)
  });
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

async function renderFoodsView() {
  const recipes = await loadRecipes();
  mainContent.innerHTML = renderUserFoods(appState.userFoods) + renderRecipesSection(recipes);
  bindUserFoodsEvents(mainContent, {
    onCreate: () => openCustomFoodForm(),
    onEdit: id => editUserFood(id),
    onDelete: id => deleteUserFood(id)
  });
  bindRecipesEvents(mainContent, {
    onCreate: () => openRecipeForm(),
    onAdd: id => openAddRecipeAsMeal(id),
    onEdit: id => editRecipe(id),
    onDelete: id => deleteRecipeConfirm(id)
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
  const today = appState.currentDate;
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const startDate = sevenDaysAgo.toISOString().slice(0, 10);

  // Load activity data for the week
  const [weekStrength, weekCardio, weekSteps, prefs] = await Promise.all([
    loadStrengthSessionsByDateRange(startDate, today),
    loadCardioSessionsByDateRange(startDate, today),
    loadDailyStepsByDateRange(startDate, today),
    loadActivityPreferences()
  ]);

  const activityPrefs = prefs || {
    energyModel: 'tdee_plus_extras',
    avoidDoubleCountingWalking: true,
    eatBackMode: 'partial',
    eatBackRatio: 0.3,
    includeStepsInTdee: true,
    stepGoal: 10000,
    includeStrengthInExpenditure: true,
    includeCardioInExpenditure: true
  };

  // Calculate weekly activity stats
  const weeklyActivityStats = {
    totalActivityKcal: 0,
    strengthCount: weekStrength.length,
    cardioCount: weekCardio.length,
    totalSteps: weekSteps.reduce((sum, s) => sum + (s.steps || 0), 0),
    avgStepsPerDay: 0
  };

  weeklyActivityStats.avgStepsPerDay = weekSteps.length > 0 ? Math.round(weeklyActivityStats.totalSteps / weekSteps.length) : 0;

  // Calculate activity kcal for the week
  weekStrength.forEach(s => {
    weeklyActivityStats.totalActivityKcal += s.estimatedKcal || estimateWeightsCalories(s, appState.userProfile);
  });
  weekCardio.forEach(c => {
    weeklyActivityStats.totalActivityKcal += c.estimatedKcal || estimateCardioCalories(c, appState.userProfile);
  });

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
  mainContent.innerHTML = renderWeekView(days, weeklyActivityStats);
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
  const suggestedMoment = suggestMealMoment();
  const html = `
    <div>
      <h1>Aggiungi alimento</h1>
      <div class="card">
        <p><strong>${food.nome}</strong>${food.brand ? ` - ${food.brand}` : ''}</p>
        <p class="small-muted">${food.porzioneBase}</p>
        <label>Momento del pasto<select id="mealMoment">
          <option value="colazione" ${suggestedMoment === 'colazione' ? 'selected' : ''}>Colazione</option>
          <option value="spuntino" ${suggestedMoment === 'spuntino' ? 'selected' : ''}>Spuntino</option>
          <option value="pranzo" ${suggestedMoment === 'pranzo' ? 'selected' : ''}>Pranzo</option>
          <option value="merenda" ${suggestedMoment === 'merenda' ? 'selected' : ''}>Merenda</option>
          <option value="cena" ${suggestedMoment === 'cena' ? 'selected' : ''}>Cena</option>
          <option value="altro" ${suggestedMoment === 'altro' ? 'selected' : ''}>Altro</option>
        </select></label>
        <label>Grammi<input id="foodGrams" type="number" min="1" max="3000" value="100" style="font-size: 16px;"></label>
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

    // Auto-focus on grammi input
    gramsInput.focus();
    gramsInput.select();

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
      trackFoodUsage(entry.foodRef, entry.grammi);
      closeModal();
      renderCurrentView();
      showToast('Alimento aggiunto.');
    });
    container.querySelector('#cancelAddFood').addEventListener('click', closeModal);

    // Support Enter key to submit
    gramsInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        container.querySelector('#confirmAddFood').click();
      }
    });
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

function openRecipeForm(existingRecipe = null) {
  const html = renderRecipeForm(existingRecipe);
  showModal(html, container => {
    bindRecipeFormEvents(container, {
      onSave: async recipeData => {
        try {
          if (existingRecipe) {
            await updateRecipe(existingRecipe.id, recipeData);
            showToast('Ricetta aggiornata.');
          } else {
            await saveRecipe(recipeData);
            showToast('Ricetta salvata.');
          }
          closeModal();
          renderFoodsView();
        } catch (error) {
          reportError('Errore nel salvataggio della ricetta');
        }
      },
      onCancel: closeModal,
      onRemoveIngredient: (idx) => {
        // This would need more complex state management in the modal
        // For now, just show a message
        console.log('Remove ingredient at index:', idx);
      }
    });
  });
}

async function editRecipe(id) {
  const recipe = await loadRecipeById(id);
  if (!recipe) {
    reportError('Ricetta non trovata');
    return;
  }
  openRecipeForm(recipe);
}

async function deleteRecipeConfirm(id) {
  if (!confirm('Eliminare questa ricetta?')) return;
  try {
    await deleteRecipe(id);
    renderFoodsView();
    showToast('Ricetta eliminata.');
  } catch (error) {
    reportError('Errore nell\'eliminazione della ricetta');
  }
}

async function openAddRecipeAsMeal(recipeId) {
  const recipe = await loadRecipeById(recipeId);
  if (!recipe) {
    reportError('Ricetta non trovata');
    return;
  }

  const html = `
    <div style="min-width: 320px;">
      <h2>${recipe.nome}</h2>
      <p class="small-muted">${recipe.descrizione || ''}</p>

      <label style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
        <span class="label-text">Momento del pasto</span>
        <select id="recipeMealMoment" style="width: 100%; padding: 0.75rem; margin-top: 0.5rem;">
          <option value="colazione">Colazione</option>
          <option value="spuntino">Spuntino</option>
          <option value="pranzo" selected>Pranzo</option>
          <option value="merenda">Merenda</option>
          <option value="cena">Cena</option>
          <option value="altro">Altro</option>
        </select>
      </label>

      <label style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
        <span class="label-text">Numero di porzioni</span>
        <input id="recipePortionsCount" type="number" min="0.5" step="0.5" value="${recipe.porzioniBase || 1}" style="width: 100%; padding: 0.75rem; font-size: 16px;">
      </label>

      <div style="padding: 1rem; background: var(--glass-secondary); border: 1px solid var(--glass-border); border-radius: 8px; margin-bottom: 1.5rem;">
        <strong>Totale nutrienti:</strong>
        <div style="margin-top: 0.5rem; font-size: 0.9rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
          <div>Kcal: <span id="recipeAddKcal">0</span></div>
          <div>Proteine: <span id="recipeAddProt">0</span>g</div>
          <div>Carbo: <span id="recipeAddCarb">0</span>g</div>
          <div>Grassi: <span id="recipeAddFat">0</span>g</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <button id="confirmAddRecipeMeal" class="primary" style="width: 100%;">Aggiungi al Giorno</button>
        <button id="cancelAddRecipeMeal" class="secondary" style="width: 100%;">Annulla</button>
      </div>
    </div>
  `;

  showModal(html, container => {
    const portionsInput = container.querySelector('#recipePortionsCount');

    // Calculate macros based on portions
    function updateMacros() {
      const portions = parseFloat(portionsInput.value) || recipe.porzioniBase;
      let totalKcal = 0, totalProt = 0, totalCarb = 0, totalFat = 0;

      recipe.ingredients.forEach(ing => {
        const totalGrams = ing.grammi * portions;
        // Try to find the food to get its per100g values
        const food = appState.userFoods.find(f => f.id === ing.foodRef?.id);
        if (food && food.per100g) {
          totalKcal += (food.per100g.kcal * totalGrams) / 100;
          totalProt += (food.per100g.proteine * totalGrams) / 100;
          totalCarb += (food.per100g.carboidrati * totalGrams) / 100;
          totalFat += (food.per100g.grassi * totalGrams) / 100;
        }
      });

      container.querySelector('#recipeAddKcal').textContent = Math.round(totalKcal);
      container.querySelector('#recipeAddProt').textContent = Math.round(totalProt);
      container.querySelector('#recipeAddCarb').textContent = Math.round(totalCarb);
      container.querySelector('#recipeAddFat').textContent = Math.round(totalFat);
    }

    updateMacros();
    portionsInput.addEventListener('input', updateMacros);

    container.querySelector('#confirmAddRecipeMeal').addEventListener('click', async () => {
      const moment = container.querySelector('#recipeMealMoment').value;
      const portions = parseFloat(portionsInput.value) || recipe.porzioniBase;

      // Calculate total macros
      let totalKcal = 0, totalProt = 0, totalCarb = 0, totalFat = 0;
      recipe.ingredients.forEach(ing => {
        const totalGrams = ing.grammi * portions;
        const food = appState.userFoods.find(f => f.id === ing.foodRef?.id);
        if (food && food.per100g) {
          totalKcal += (food.per100g.kcal * totalGrams) / 100;
          totalProt += (food.per100g.proteine * totalGrams) / 100;
          totalCarb += (food.per100g.carboidrati * totalGrams) / 100;
          totalFat += (food.per100g.grassi * totalGrams) / 100;
        }
      });

      const entry = {
        id: crypto.randomUUID(),
        userId: appState.userProfile.id,
        data: appState.currentDate,
        momento: moment,
        foodRef: { id: recipe.id, source: 'RECIPE', name: recipe.nome },
        grammi: Math.round(recipe.ingredients.reduce((sum, ing) => sum + ing.grammi, 0) * portions),
        macroCalcolate: {
          kcal: Math.round(totalKcal),
          proteine: Math.round(totalProt),
          carboidrati: Math.round(totalCarb),
          grassi: Math.round(totalFat),
          zuccheri: 0,
          fibra: 0
        },
        origin: 'recipe_saved',
        note: `Ricetta: ${recipe.nome} (${portions} porzioni)`
      };

      appState.meals.push(entry);
      await saveMealEntries([entry]);
      trackFoodUsage(entry.foodRef, entry.grammi);
      closeModal();
      renderCurrentView();
      showToast('Ricetta aggiunta al giorno!');
    });

    container.querySelector('#cancelAddRecipeMeal').addEventListener('click', closeModal);
  });
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
        trackFoodUsage(entry.foodRef, entry.grammi);
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
  const backdrop = fragment.querySelector('.modal-overlay');
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
  const modalRoot = appendedNode.querySelector('.modal-overlay') || document.body.querySelector('.modal-overlay:last-of-type');
  if (bind && modalRoot) bind(modalRoot);
}

function closeModal() {
  const backdrop = document.querySelector('.modal-overlay');
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

function attachSWUpdateListener() {
  window.addEventListener("sw-update-available", () => {
    showToast("🔄 Nuova versione disponibile. Ricarica per gli aggiornamenti.", 5000);
    console.log("🔄 SW update available — user can reload");
  });
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

async function renderActivitiesViewPage() {
  try {
    // Show loading state
    mainContent.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 1rem;">
        <div style="font-size: 3rem; animation: spin 1s linear infinite;">⏳</div>
        <div style="color: var(--text-muted); font-size: 0.9rem;">Caricamento attività...</div>
      </div>
      <style>
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    `;

    // Load data for last 7 days
    const today = appState.currentDate;
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const startDate = sevenDaysAgo.toISOString().slice(0, 10);

    const [strengthSessions, cardioSessions, stepsRecords, prefs] = await Promise.all([
      loadStrengthSessionsByDateRange(startDate, today),
      loadCardioSessionsByDateRange(startDate, today),
      loadDailyStepsByDateRange(startDate, today),
      loadActivityPreferences()
    ]);

    // Activity preferences (use defaults if not found)
    const activityPrefs = prefs || {
      energyModel: 'tdee_plus_extras',
      avoidDoubleCountingWalking: true,
      eatBackMode: 'partial',
      eatBackRatio: 0.3,
      includeStepsInTdee: true,
      stepGoal: 10000,
      includeStrengthInExpenditure: true,
      includeCardioInExpenditure: true
    };

    // Build last 7 days summary
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);

      const dayStrength = strengthSessions.filter(s => s.date === dateKey);
      const dayCardio = cardioSessions.filter(c => c.data === dateKey);
      const daySteps = stepsRecords.find(st => st.date === dateKey);

      // Calcola calorie con le nuove funzioni (con supporto DB v5)
      const strengthKcal = dayStrength.reduce((sum, s) => sum + (s.estimatedKcal || estimateWeightsCalories(s, appState.userProfile)), 0);
      const cardioKcal = dayCardio.reduce((sum, c) => sum + (c.estimatedKcal || estimateCardioCalories(c, appState.userProfile)), 0);

      // Stima calorie da passi con anti-double-counting
      const stepsExcluded = shouldExcludeStepsCalories(daySteps, dayCardio, activityPrefs);
      const stepsKcal = (!stepsExcluded && daySteps) ? estimateStepsCalories(daySteps, appState.userProfile, activityPrefs) : 0;

      last7Days.push({
        date: dateKey,
        strength: dayStrength,
        cardio: dayCardio,
        steps: daySteps?.steps || 0,
        distanceKm: daySteps?.distanceKm,
        strengthCount: dayStrength.length,
        cardioCount: dayCardio.length,
        strengthMin: dayStrength.reduce((sum, s) => sum + (s.durationMin || s.durataMin || 0), 0),
        cardioMin: dayCardio.reduce((sum, c) => sum + (c.durationMin || c.durataMin || 0), 0),
        activityKcal: strengthKcal + cardioKcal + stepsKcal,
        stepsExcluded
      });
    }

    // Today's summary
    const todayData = last7Days[last7Days.length - 1];
    const todayStrength = todayData.strength || [];
    const todayCardio = todayData.cardio || [];
    const todaySteps = todayData.steps ? { date: today, steps: todayData.steps, distanceKm: todayData.distanceKm, source: 'manual', estimatedKcal: 0 } : null;

    // Activity sync status from localStorage
    const connectedProviderId = getConnectedProvider();
    const connectedProviderName = connectedProviderId && PROVIDERS[connectedProviderId] ? PROVIDERS[connectedProviderId].name : null;
    const activitySyncStatus = {
      connectedProvider: connectedProviderName,
      lastSyncTime: localStorage.getItem('activitySyncLastTime') || null,
      importedDaysCount: localStorage.getItem('activitySyncDaysCount') ? parseInt(localStorage.getItem('activitySyncDaysCount')) : 0
    };

    const viewState = {
      userProfile: appState.userProfile,
      last7Days,
      todayStrength,
      todayCardio,
      todaySteps,
      prefs: activityPrefs,
      activitySyncStatus
    };

    mainContent.innerHTML = renderActivitiesView(viewState);

    bindActivitiesEvents(mainContent, {
      onAddStrength: () => showAddStrengthModal(async (formData) => {
        try {
          await saveStrengthSession(formData);
          showToast('✅ Allenamento pesi salvato.');
          renderActivitiesViewPage();
        } catch (err) {
          console.error('Errore salvataggio allenamento:', err);
          showToast('❌ Errore nel salvataggio. Riprova.', 4000);
        }
      }),
      onEditStrength: (id) => {
        const session = strengthSessions.find(s => s.id === id);
        if (session) {
          showEditStrengthModal(session, async (formData) => {
            try {
              await updateStrengthSession(id, formData);
              showToast('✅ Allenamento pesi aggiornato.');
              renderActivitiesViewPage();
            } catch (err) {
              console.error('Errore aggiornamento allenamento:', err);
              showToast('❌ Errore nell\'aggiornamento. Riprova.', 4000);
            }
          });
        }
      },
      onDeleteStrength: async (id) => {
        try {
          await deleteStrengthSession(id);
          showToast('✅ Allenamento pesi eliminato.');
          renderActivitiesViewPage();
        } catch (err) {
          console.error('Errore eliminazione allenamento:', err);
          showToast('❌ Errore nell\'eliminazione. Riprova.', 4000);
        }
      },
      onAddCardio: () => showAddCardioModal(async (formData) => {
        try {
          await saveCardioSession(formData);
          showToast('✅ Sessione cardio salvata.');
          renderActivitiesViewPage();
        } catch (err) {
          console.error('Errore salvataggio cardio:', err);
          showToast('❌ Errore nel salvataggio. Riprova.', 4000);
        }
      }),
      onEditCardio: (id) => {
        const session = cardioSessions.find(c => c.id === id);
        if (session) {
          showEditCardioModal(session, async (formData) => {
            try {
              await updateCardioSession(id, formData);
              showToast('✅ Sessione cardio aggiornata.');
              renderActivitiesViewPage();
            } catch (err) {
              console.error('Errore aggiornamento cardio:', err);
              showToast('❌ Errore nell\'aggiornamento. Riprova.', 4000);
            }
          });
        }
      },
      onDeleteCardio: async (id) => {
        try {
          await deleteCardioSession(id);
          showToast('✅ Sessione cardio eliminata.');
          renderActivitiesViewPage();
        } catch (err) {
          console.error('Errore eliminazione cardio:', err);
          showToast('❌ Errore nell\'eliminazione. Riprova.', 4000);
        }
      },
      onAddSteps: () => showAddStepsModal(async (formData) => {
        try {
          await saveDailySteps(formData);
          showToast('✅ Passi salvati.');
          renderActivitiesViewPage();
        } catch (err) {
          console.error('Errore salvataggio passi:', err);
          showToast('❌ Errore nel salvataggio. Riprova.', 4000);
        }
      }),
      onEditSteps: (date) => {
        const stepsData = stepsRecords.find(s => s.date === date);
        showAddStepsModal(async (formData) => {
          try {
            await saveDailySteps(formData);
            showToast('✅ Passi aggiornati.');
            renderActivitiesViewPage();
          } catch (err) {
            console.error('Errore aggiornamento passi:', err);
            showToast('❌ Errore nell\'aggiornamento. Riprova.', 4000);
          }
        }, stepsData);
      },
      onSyncSteps: () => {
        try {
          showProviderSelectionModal(async (providerId, provider) => {
            showFileImportModal(provider, async (recordsToImport) => {
              try {
                let imported = 0;
                let skipped = 0;
                const errors = [];

                for (const record of recordsToImport) {
                  try {
                    await saveDailySteps({
                      date: record.date,
                      steps: record.steps,
                      distanceKm: record.distanceKm,
                      activeMinutes: record.activeMinutes,
                      source: providerId,
                      syncMeta: {
                        provider: providerId,
                        importedAt: new Date().toISOString(),
                        rawPayloadVersion: 'csv_import'
                      }
                    });
                    imported++;
                  } catch (err) {
                    skipped++;
                    errors.push(`${record.date}: ${err.message}`);
                  }
                }

                if (imported === 0) {
                  showToast('❌ Nessun record importato.', 4000);
                  return { success: false, error: 'Nessun record importato con successo' };
                }

                // Update sync metadata in localStorage
                setConnectedProvider(providerId);
                localStorage.setItem('activitySyncLastTime', new Date().toLocaleString('it-IT'));
                const existingCount = localStorage.getItem('activitySyncDaysCount') ? parseInt(localStorage.getItem('activitySyncDaysCount')) : 0;
                localStorage.setItem('activitySyncDaysCount', (existingCount + imported).toString());

                showToast(`✅ ${imported} giorni importati${skipped > 0 ? `, ${skipped} saltati` : ''}.`);
                renderActivitiesViewPage();
                return { success: true };
              } catch (err) {
                console.error('Errore durante import:', err);
                showToast('❌ Errore durante l\'importazione. Riprova.', 4000);
                return { success: false, error: err.message };
              }
            }, { parseStepsFile });
          }, { PROVIDERS, getAvailableProviders });
        } catch (err) {
          console.error('Errore apertura provider selection:', err);
          showToast('❌ Errore. Riprova.', 4000);
        }
      },
      onDisconnectProvider: async () => {
        try {
          clearConnectedProvider();
          localStorage.removeItem('activitySyncLastTime');
          localStorage.removeItem('activitySyncDaysCount');
          showToast('✅ Provider scollegato.');
          renderActivitiesViewPage();
        } catch (err) {
          console.error('Errore disconnessione provider:', err);
          showToast('❌ Errore. Riprova.', 4000);
        }
      }
    });
  } catch (error) {
    console.error('Errore nel caricamento attività:', error);
    reportError('Errore nel caricamento attività.');
  }
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

function populateBottomNav() {
  const navButtons = [
    { view: 'dashboard', label: '📊 Dashboard', emoji: '📊' },
    { view: 'week', label: '📅 Settimana', emoji: '📅' },
    { view: 'activities', label: '💪 Allenamenti', emoji: '💪' },
    { view: 'search', label: '🔍 Ricerca', emoji: '🔍' },
    { view: 'weight', label: '⚖️ Perdita Peso', emoji: '⚖️' },
    { view: 'settings', label: '⚙️ Impostazioni', emoji: '⚙️' }
  ];

  bottomNav.innerHTML = navButtons.map(btn => `
    <button class="nav-button" data-view="${btn.view}" title="${btn.label}" aria-label="${btn.label}">
      ${btn.emoji}
    </button>
  `).join('');
}

export async function init() {
  const bootstrapOk = await bootstrapApp();
  if (!bootstrapOk) {
    console.error('❌ Bootstrap fallito, app non può avviarsi');
    return;
  }
  populateBottomNav();
  attachBottomNav();
  attachInstallButton();
  attachSWUpdateListener();
  await loadState();
  renderCurrentView();
}

function openQuickAdd() {
  const html = `
    <div style="min-width: 320px;">
      <h1 style="margin-top: 0; text-align: center;">+ Aggiungi Pasto</h1>
      
      <div class="quick-add-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--glass-border); padding-bottom: 0;">
        <button class="tab-btn active" data-tab="custom" style="flex: 1; padding: 0.75rem; background: none; border: none; border-bottom: 3px solid var(--accent-cyan); cursor: pointer; color: var(--text-primary); font-weight: 600;">📝 Personalizzato</button>
        <button class="tab-btn" data-tab="estimate" style="flex: 1; padding: 0.75rem; background: none; border: none; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-muted); font-weight: 600;">📊 Stima</button>
        <button class="tab-btn" data-tab="recent" style="flex: 1; padding: 0.75rem; background: none; border: none; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-muted); font-weight: 600;">⭐ Recenti</button>
      </div>

      <!-- TAB: PERSONALIZZATO -->
      <div class="tab-content active" data-tab="custom" style="display: block;">
        <div style="text-align: center; padding: 2rem 0;">
          <p style="margin-bottom: 1.5rem; color: var(--text-muted);">Crea un alimento personalizzato con macro ogni 100g</p>
          <button id="openCustomFoodFormBtn" class="primary" style="width: 100%; padding: 0.875rem;">+ Nuovo Alimento Personalizzato</button>
        </div>
      </div>

      <!-- TAB: STIMA -->
      <div class="tab-content" data-tab="estimate" style="display: none;">
        <label>Categoria piatto</label>
        <select id="quickEstimateCategory" style="width: 100%; padding: 0.75rem; margin-bottom: 1rem;">
          <option value="">Seleziona...</option>
          <option value="pasta">🍝 Pasta</option>
          <option value="riso">🍚 Riso</option>
          <option value="carne">🥩 Carne</option>
          <option value="pesce">🐟 Pesce</option>
          <option value="verdura">🥬 Verdura</option>
          <option value="frutta">🍎 Frutta</option>
          <option value="latticini">🧀 Latticini</option>
        </select>
        
        <label>Grammi</label>
        <input id="quickEstimateGrams" type="number" min="1" max="1000" value="100" style="width: 100%; padding: 0.75rem; margin-bottom: 1.5rem;">
        
        <button id="quickEstimateBtn" class="primary" style="width: 100%;">Stima e Aggiungi</button>
      </div>

      <!-- TAB: RECENTI -->
      <div class="tab-content" data-tab="recent" style="display: none;">
        <div id="quickRecentList" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
        <p id="quickRecentEmpty" style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Nessun alimento recente</p>
      </div>
    </div>
  `;

  showModal(html, container => {
    // Tab switching
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        container.querySelectorAll('.tab-btn').forEach(b => {
          b.style.color = b.dataset.tab === tabName ? 'var(--text-primary)' : 'var(--text-muted)';
          b.style.borderBottomColor = b.dataset.tab === tabName ? 'var(--accent-cyan)' : 'transparent';
        });
        container.querySelectorAll('.tab-content').forEach(c => {
          c.style.display = c.dataset.tab === tabName ? 'block' : 'none';
        });
      });
    });

    // Custom food button
    const openCustomBtn = container.querySelector('#openCustomFoodFormBtn');
    openCustomBtn?.addEventListener('click', () => {
      closeModal();
      openCustomFoodForm();
    });

    // Estimate button
    container.querySelector('#quickEstimateBtn')?.addEventListener('click', async () => {
      const category = container.querySelector('#quickEstimateCategory').value;
      const grams = Number(container.querySelector('#quickEstimateGrams').value);
      
      if (!category || grams < 1) {
        reportError('Seleziona categoria e grammi');
        return;
      }

      closeModal();
      openEstimatedFoodForm(category, grams);
    });

    // Recent foods
    loadRecentFoods(container);
  });
}

function loadRecentFoods(container) {
  // Usa recentFoodsTracker per accesso veloce ai recenti
  const recentList = container.querySelector('#quickRecentList');
  const recentEmpty = container.querySelector('#quickRecentEmpty');

  const recents = getRecents();
  if (!recents || recents.length === 0) {
    recentList.style.display = 'none';
    return;
  }

  recentEmpty.style.display = 'none';
  recentList.innerHTML = recents.slice(0, 10).map((recent, idx) => `
    <button class="secondary" style="text-align: left; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div><strong>${recent.foodRef.name}</strong></div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">${recent.grammi}g</div>
      </div>
      <div style="text-align: right; font-size: 0.85rem; color: var(--text-muted);">
        <div>Usato ${recent.count}x</div>
        <div style="font-size: 0.75rem;">${recent.lastUsed ? new Date(recent.lastUsed).toLocaleDateString('it-IT') : ''}</div>
      </div>
    </button>
  `).join('');

  recentList.querySelectorAll('button').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const recent = recents[idx];
      closeModal();
      openQuickAddWithFood(recent.foodRef, recent.grammi);
    });
  });
}

function showWeightUpdateModal() {
  const html = `
    <div style="min-width: 300px;">
      <h2 style="margin-top: 0;">⚖️ Aggiorna Peso</h2>

      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Peso (kg)</label>
        <input id="weightInput" type="number" step="0.1" min="30" max="200" style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--glass-secondary);" placeholder="es. 75.5">
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <button id="cancelWeightBtn" class="secondary" style="padding: 0.75rem;">Annulla</button>
        <button id="saveWeightBtn" class="primary" style="padding: 0.75rem;">Salva Peso</button>
      </div>
    </div>
  `;

  showModal(html);

  const cancelBtn = document.querySelector('#cancelWeightBtn');
  const saveBtn = document.querySelector('#saveWeightBtn');
  const weightInput = document.querySelector('#weightInput');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const weight = parseFloat(weightInput.value);
      if (!weight || weight < 30 || weight > 200) {
        showToast('❌ Inserisci un peso valido (30-200 kg)', 3000);
        return;
      }

      try {
        const today = appState.currentDate;
        const newWeight = { data: today, pesoKg: weight };
        await saveDailyWeight(newWeight);
        closeModal();
        renderCurrentView();
        showToast('✅ Peso registrato!');
      } catch (err) {
        console.error('Errore salvataggio peso:', err);
        showToast('❌ Errore nel salvataggio', 3000);
      }
    });
  }
}

function suggestMealMoment() {
  const hour = new Date().getHours();
  if (hour < 11) return 'colazione';
  if (hour < 14) return 'pranzo';
  if (hour < 17) return 'merenda';
  if (hour < 21) return 'cena';
  return 'spuntino';
}

async function addMealAndClose(entry) {
  appState.meals.push(entry);
  await saveMealEntries([entry]);

  // Traccia l'uso dell'alimento
  if (entry.foodRef) {
    trackFoodUsage(entry.foodRef, entry.grammi);
  }

  closeModal();
  renderCurrentView();
  showToast('Pasto aggiunto!');
}

function openQuickAddWithFood(foodRef, suggestedGrams = 100) {
  const html = `
    <div style="min-width: 320px;">
      <h2 style="margin-top: 0;">${foodRef.name}</h2>
      <div class="card" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--glass-secondary);">
        <label>Momento del pasto
          <select id="mealMomentSelect" style="width: 100%; padding: 0.75rem; margin-top: 0.5rem;">
            <option value="colazione">Colazione</option>
            <option value="spuntino">Spuntino</option>
            <option value="pranzo">Pranzo</option>
            <option value="merenda">Merenda</option>
            <option value="cena">Cena</option>
            <option value="altro">Altro</option>
          </select>
        </label>
        <label style="margin-top: 1rem;">Grammi
          <input id="foodGramsInput" type="number" min="1" max="3000" value="${suggestedGrams}" style="width: 100%; padding: 0.75rem; margin-top: 0.5rem; font-size: 16px;">
        </label>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <button id="confirmRecentFood" class="primary" style="width: 100%;">Aggiungi</button>
        <button id="cancelRecentFood" class="secondary" style="width: 100%;">Annulla</button>
      </div>
    </div>
  `;

  showModal(html, container => {
    // Default meal moment to current suggested
    const moment = suggestMealMoment();
    container.querySelector('#mealMomentSelect').value = moment;

    // Auto-focus on grammi
    container.querySelector('#foodGramsInput').focus();
    container.querySelector('#foodGramsInput').select();

    container.querySelector('#confirmRecentFood').addEventListener('click', async () => {
      const grams = Number(container.querySelector('#foodGramsInput').value);
      if (!grams || grams < 1) {
        reportError('Inserisci un valore di grammi valido.');
        return;
      }
      const momentValue = container.querySelector('#mealMomentSelect').value;

      // Try to get food details for macro calculation
      let macroCalcolate = { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0, zuccheri: 0, fibra: 0 };
      try {
        if (foodRef.source === 'USER_CUSTOM') {
          const food = appState.userFoods.find(f => f.id === foodRef.id);
          if (food) {
            macroCalcolate = calculateMacrosForAmount(food, grams);
          }
        } else {
          const food = await getFoodDetails(foodRef.id);
          if (food) {
            macroCalcolate = calculateMacrosForAmount(food, grams);
          }
        }
      } catch (error) {
        console.warn('Could not calculate macros for recent food:', error);
      }

      const entry = {
        id: crypto.randomUUID(),
        userId: appState.userProfile.id,
        data: appState.currentDate,
        momento: momentValue,
        foodRef,
        grammi: grams,
        macroCalcolate,
        origin: 'recent_quick_add',
        note: 'Aggiunto da recenti'
      };
      addMealAndClose(entry);
    });

    container.querySelector('#cancelRecentFood').addEventListener('click', closeModal);

    // Support Enter key to submit
    container.querySelector('#foodGramsInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        container.querySelector('#confirmRecentFood').click();
      }
    });
  });
}

