/*
  Punto di avvio dell'app PWA Conta Calorie.
  Inizializza lo stato, carica i dati locali e gestisce il rendering delle viste.
*/

import { bootstrapApp } from './appBootstrap.js';
import { loadUserProfile, saveUserProfile, loadUserFoods, saveUserFoods, loadMealsByDate, saveMealEntries, deleteMealEntry, loadAllMeals, saveCardioSession, loadCardioSessions, saveDailyWeight, loadDailyWeights, deleteDailyWeight, loadAllCardioSessions, deleteCardioSession, saveBodyCompBaseline, loadBodyCompBaselines, saveRecipe, loadRecipes, deleteRecipe, updateRecipe, loadRecipeById, saveDailySteps, loadDailyStepsByDate, loadDailyStepsByDateRange, deleteDailySteps, saveActivityPreferences, loadActivityPreferences, saveStrengthSession, loadStrengthSessionsByDateRange, loadAllStrengthSessions, updateStrengthSession, deleteStrengthSession, loadCardioSessionsByDateRange, updateCardioSession, loadFridgeItems } from './storage.js';
import { calculateEnergyTargets, aggregateDailySummary, calculateMacrosForAmount, buildNutritionWarning } from './nutritionEngine.js';
import { searchFoods, getFoodDetails, getMicrosIndex, getAllFoods, normalizeFoodItem } from './nutritionDataProvider.js';
import { aggregateDailyMicros, analyzeMicronutrients, suggestFoodsForMicro } from './micronutrientEngine.js';
import { renderOnboarding, bindOnboardingEvents } from './ui/onboarding.js';
import { renderDashboard, bindDashboardEvents, renderMicroDetail } from './ui/dashboard.js';
import { renderNutritionView, bindNutritionViewEvents } from './ui/nutritionView.js';
import { renderPhysicsView, bindPhysicsViewEvents } from './ui/physicsView.js';
import { initSwipeNavigation } from './ui/swipeNav.js';
import { lazyLoadImages } from './ui/lazyLoad.js';
import { renderFoodSearch, bindFoodSearchEvents } from './ui/foodSearch.js';
import { renderFridgeView, bindFridgeViewEvents, computeGaps, computeDailyScore, computeWeeklyInsight, weakestMacro, applyMealToFridge, applyRecipeToFridge, maybeNotifyExpiring, notificationsState } from './ui/fridgeView.js';
import { renderUserFoods, bindUserFoodsEvents, renderUserFoodForm, bindUserFoodFormEvents } from './ui/userFoods.js';
import { renderRecipesSection, bindRecipesEvents, renderRecipeForm, bindRecipeFormEvents } from './ui/recipes.js';
import { renderWeekView, bindWeekViewEvents } from './ui/weekView.js';
import { renderWeightLoss, bindWeightLossEvents } from './ui/weightLoss.js';
import { renderSettings, bindSettingsEvents } from './ui/settings.js';
import { renderStatsView, bindStatsViewEvents } from './ui/statsView.js';
import { renderActivitiesView, bindActivitiesEvents, showAddStrengthModal, showEditStrengthModal, showAddCardioModal, showEditCardioModal, showAddStepsModal, showProviderSelectionModal, showFileImportModal } from './ui/activities.js';
import { PROVIDERS, getAvailableProviders, parseStepsFile, getConnectedProvider, setConnectedProvider, clearConnectedProvider } from './activitySyncProviders.js';
import { triggerInstallPrompt } from './pwaHandler.js';
import { aggregateDailyExercise, estimateWeightsCalories, estimateCardioCalories, estimateStepsCalories, shouldExcludeStepsCalories, applyEatBackCalories, computeDayActivityKcal } from './activityEnergyEngine.js';
import { getTheoreticalTDEE, getDailyEnergyBalance, getEnergyBalanceSummary, estimateAdaptiveTDEE } from './weightLossEstimator.js';
import { estimateBodyCompositionChange } from './bodyCompositionModel.js';
import { getTrendWindowData, calculateAllProjections } from './trendProjection.js';
import { getCurrentBaseline, computeBodyCompDeltasSinceBaseline, estimateCompositionToday, createBodyCompBaseline } from './bodyCompTracker.js';
import { openEstimationWizard } from './estimationEngine.js';
import { openComposedMealWizard } from './composedMealWizard.js';

import { trackFoodUsage, getRecents } from './recentFoodsTracker.js';
import { escapeHtml, formatDateIT, buildLastNDates } from './utils.js';
import { showModal, closeModal, showConfirm } from './ui/modal.js';
import { wireVoiceButton, voiceButtonHtml } from './ui/voiceInput.js';
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

function reportError(message) {
  showToast(message, { duration: 4000, type: 'error' });
}

/**
 * Toast 2.0 — supporta tipi (info/success/error), stacking e un'azione opzionale
 * (es. "Annulla" per l'undo delle eliminazioni).
 * Retro-compatibile: showToast(msg, 3000) continua a funzionare.
 * @param {string} message
 * @param {number|Object} optsOrDuration - durata ms, oppure { duration, type, action: { label, onClick } }
 */
function showToast(message, optsOrDuration = {}) {
  const opts = typeof optsOrDuration === 'number' ? { duration: optsOrDuration } : optsOrDuration;
  const { duration = 2500, type = 'info', action = null } = opts;

  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  // Massimo 3 toast visibili: rimuovi il più vecchio
  while (container.children.length >= 3) container.firstChild.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.className = 'toast-text';
  const icon = type === 'success' ? '✓ ' : type === 'error' ? '⚠️ ' : '';
  text.textContent = icon + message;
  toast.appendChild(text);

  let timer;
  const dismiss = () => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 250);
  };

  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.type = 'button';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      clearTimeout(timer);
      dismiss();
      action.onClick();
    });
    toast.appendChild(btn);
  }

  container.appendChild(toast);
  // Con azione (undo) lascia più tempo per cliccare
  timer = setTimeout(dismiss, action ? Math.max(duration, 5000) : duration);
}

/**
 * Elimina una sessione (pesi o cardio) con toast di Annulla.
 * Carica il record prima di cancellarlo così l'undo lo ripristina identico (stesso id).
 */
async function deleteSessionWithUndo(kind, id, rerender) {
  const all = kind === 'strength' ? await loadAllStrengthSessions() : await loadAllCardioSessions();
  const record = all.find(sess => sess.id === id);
  if (kind === 'strength') await deleteStrengthSession(id);
  else await deleteCardioSession(id);
  rerender();
  showToast(kind === 'strength' ? 'Allenamento eliminato' : 'Sessione cardio eliminata', {
    type: 'success',
    action: record ? {
      label: 'Annulla',
      onClick: async () => {
        if (kind === 'strength') await saveStrengthSession(record);
        else await saveCardioSession(record);
        rerender();
      }
    } : null
  });
}

async function loadState() {
  appState.userProfile = await loadUserProfile();
  appState.userFoods = await loadUserFoods();
  appState.nutritionTargets = appState.userProfile ? calculateEnergyTargets(appState.userProfile) : null;
  appState.meals = appState.userProfile ? await loadMealsByDate(appState.currentDate) : [];
}

function setActiveNav(view) {
  appState.currentView = view;
  const navView = (view === 'weight' || view === 'activities' || view === 'weightloss') ? 'physics' : view;
  bottomNav.querySelectorAll('.nav-button').forEach(btn => {
    const isActive = btn.dataset.view === navView;
    btn.classList.toggle('active', isActive);
    // Stato per screen reader
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

function goToView(view) {
  appState.currentView = view;
  renderCurrentView();
}

let _lastRenderedView = null;

async function renderCurrentView() {
  if (!appState.userProfile) {
    return renderOnboardingView();
  }

  // UX: cambiando vista si riparte dall'alto; aggiornando la stessa vista
  // (es. dopo aver aggiunto un pasto) si mantiene la posizione di scroll.
  const previousScrollY = window.scrollY;
  const isSameView = _lastRenderedView === appState.currentView;

  // Render the view
  if (appState.currentView === 'dashboard') {
    await renderDashboardView();
  } else if (appState.currentView === 'nutrition') {
    await renderNutritionViewPage();
  } else if (appState.currentView === 'physics') {
    await renderPhysicsViewPage();
  } else if (appState.currentView === 'week') {
    await renderWeekViewPage();
  } else if (appState.currentView === 'search') {
    await renderSearchView();
  } else if (appState.currentView === 'foods') {
    await renderFoodsView();
  } else if (appState.currentView === 'fridge') {
    await renderFridgeViewPage();
  } else if (appState.currentView === 'weight') {
    await renderPhysicsViewPage();
  } else if (appState.currentView === 'activities') {
    await renderPhysicsViewPage();
  } else if (appState.currentView === 'stats') {
    await renderStatsViewPage();
  } else if (appState.currentView === 'weightloss') {
    await renderWeightLossView();
  } else if (appState.currentView === 'settings') {
    await renderSettingsView();
  } else {
    await renderDashboardView();
  }

  // Aggiorna nav DOPO il render del view
  setActiveNav(appState.currentView);

  window.scrollTo({ top: isSameView ? previousScrollY : 0 });
  _lastRenderedView = appState.currentView;
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
  const theoreticalTdee = getTheoreticalTDEE(appState.userProfile);

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

    const dayKcal = computeDayActivityKcal(todayStrength, todayCardio, todaySteps, appState.userProfile, activityPrefs);

    activityData = {
      strengthCount: todayStrength.length,
      cardioCount: todayCardio.length,
      steps: todaySteps?.steps || 0,
      distanceKm: todaySteps?.distanceKm,
      activityKcal: dayKcal.activityKcal,
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
    const lastSeven = buildLastNDates(appState.currentDate, 7);

    const [allMeals, weekStrength, weekCardio, weekSteps] = await Promise.all([
      loadAllMeals(),
      loadStrengthSessionsByDateRange(lastSeven[0], lastSeven[lastSeven.length - 1]),
      loadCardioSessionsByDateRange(lastSeven[0], lastSeven[lastSeven.length - 1]),
      loadDailyStepsByDateRange(lastSeven[0], lastSeven[lastSeven.length - 1])
    ]);

    for (const date of lastSeven) {
      const dayMeals = allMeals.filter(m => m.data === date);
      const daySummary = aggregateDailySummary(dayMeals, appState.nutritionTargets);
      const dayStrength = weekStrength.filter(s => s.date === date);
      const dayCardio = weekCardio.filter(c => c.date === date);
      const daySteps = weekSteps.find(s => s.date === date);

      const dayActivityKcal = computeDayActivityKcal(dayStrength, dayCardio, daySteps, appState.userProfile, activityData.prefs).activityKcal;

      const intake = Math.round(daySummary.totaleCalorie || 0);
      const tdeeTotal = theoreticalTdee + dayActivityKcal;
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
  let dailyWeights = [];

  try {
    baselines = await loadBodyCompBaselines();
    const currentBaseline = getCurrentBaseline(baselines, appState.currentDate);

    if (currentBaseline) {
      const [allMeals, allWeightsSessions, allCardioSessions, weights] = await Promise.all([
        loadAllMeals(),
        loadAllStrengthSessions(),
        loadAllCardioSessions(),
        loadDailyWeights()
      ]);
      dailyWeights = weights;

      const deltas = computeBodyCompDeltasSinceBaseline(
        currentBaseline,
        appState.currentDate,
        allMeals,
        allWeightsSessions,
        allCardioSessions,
        dailyWeights,
        appState.userProfile
      );

      const todayWeightEntry = dailyWeights.find(w => w.data === appState.currentDate);
      const weightToday = todayWeightEntry?.pesoKg || appState.userProfile.pesoKg;

      const composition = estimateCompositionToday(currentBaseline, weightToday, deltas);

      bodyCompData = {
        ...composition,
        baseline: currentBaseline,
        driftWarning: composition.driftWarning
      };
    }
  } catch (error) {
    console.error('Errore nel calcolo composizione corporea:', error);
    bodyCompData = null;
  }

  appState.dailyWeights = dailyWeights;
  summary.tdee = theoreticalTdee;
  summary.activityKcal = activityData.activityKcal;

  // Micronutrienti: aggrega dai pasti CREA, rileva carenze, suggerisci integrazioni
  let microData = null;
  try {
    const [microsIndex, allFoods] = await Promise.all([getMicrosIndex(), getAllFoods()]);
    const daily = aggregateDailyMicros(appState.meals, microsIndex);
    const analysis = analyzeMicronutrients(daily, appState.userProfile);
    const remainingKcal = Math.max(0, (appState.nutritionTargets?.calorie || 0) - (summary.totaleCalorie || 0));
    const suggestions = {};
    for (const m of analysis.filter(x => x.status === 'low' || x.status === 'medium').slice(0, 4)) {
      suggestions[m.key] = suggestFoodsForMicro(m.key, allFoods, remainingKcal, Math.max(0, m.rda - m.actual));
    }
    microData = { analysis, suggestions, remainingKcal, coverage: daily, hasMeals: appState.meals.length > 0 };
  } catch (err) {
    console.warn('Errore calcolo micronutrienti:', err);
  }

  mainContent.innerHTML = renderDashboard(appState, summary, warnings, bodyCompData, activityData, microData);
  lazyLoadImages();
  bindDashboardEvents(mainContent, {
    onAddMeal: () => goToView('nutrition'),
    onAddActivity: () => goToView('activities'),
    onAddWeight: () => showWeightUpdateModal(),
    onUpdateWeight: () => showWeightUpdateModal(),
    onGoToWeight: () => goToView('physics'),
    onGoToActivities: () => goToView('physics'),
    onGoToNutrition: () => goToView('nutrition'),
    onBodyComp: () => openBodyCompBaselineForm(baselines),
    onMicroDetail: () => {
      if (microData?.analysis) showModal(renderMicroDetail(microData.analysis));
    },
    onGoToProjections: () => goToView('weightloss'),
    onChangeDate: async (newDate) => {
      appState.currentDate = newDate;
      appState.meals = await loadMealsByDate(newDate);
      renderCurrentView();
    }
  });
}

async function renderNutritionViewPage() {
  const summary = aggregateDailySummary(appState.meals, appState.nutritionTargets);

  // Load weekly data for analysis
  try {
    const allMeals = await loadAllMeals();
    const lastSeven = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(appState.currentDate);
      date.setDate(date.getDate() - i);
      lastSeven.push(date.toISOString().split('T')[0]);
    }

    const weeklyIntake = lastSeven.map(date => {
      const dayMeals = allMeals.filter(m => m.data === date);
      return dayMeals.reduce((sum, m) => sum + (m.macroCalcolate?.kcal || 0), 0);
    });
    summary.weeklyIntakeAvg = Math.round(weeklyIntake.reduce((a, b) => a + b, 0) / 7);
  } catch (err) {
    console.warn('Errore nel caricamento dati settimanali:', err);
  }

  mainContent.innerHTML = renderNutritionView(appState, summary);
  lazyLoadImages();
  bindNutritionViewEvents(mainContent, {
    onAddMealToMoment: (moment) => {
      const momentMap = { 'Colazione': 'colazione', 'Pranzo': 'pranzo', 'Merenda': 'merenda', 'Cena': 'cena' };
      openQuickAddWithMoment(momentMap[moment] || moment);
    },
    onEditMeal: (moment, index) => {
      editMealModal(moment, index);
    },
    onDeleteMeal: async (moment, index) => {
      try {
        const momentMap = { 'Colazione': 'colazione', 'Spuntino': 'spuntino', 'Pranzo': 'pranzo', 'Merenda': 'merenda', 'Cena': 'cena', 'Altro': 'altro' };
        const actualMoment = momentMap[moment] || moment;
        const mealsOfMoment = appState.meals.filter(m => m.momento === actualMoment);
        const target = mealsOfMoment[index];
        if (!target) return;
        appState.meals = appState.meals.filter(m => m.id !== target.id);
        await deleteMealEntry(target.id); // FIX: ora la cancellazione è persistita davvero
        renderNutritionViewPage();
        showToast('Pasto eliminato', {
          type: 'success',
          action: {
            label: 'Annulla',
            onClick: async () => {
              await saveMealEntries([target]);
              appState.meals = await loadMealsByDate(appState.currentDate);
              renderCurrentView();
            }
          }
        });
      } catch (err) {
        console.error('Errore eliminazione pasto:', err);
        showToast('Errore nell\'eliminazione', { duration: 3000, type: 'error' });
      }
    },
    onCreateCustomFood: () => openCustomFoodForm(null, renderNutritionViewPage),
    onEditCustomFood: (foodId) => {
      editCustomFoodModal(foodId);
    },
    onDeleteCustomFood: async (foodId) => {
      try {
        const updatedFoods = appState.userFoods.filter(f => f.id !== foodId);
        await saveUserFoods(updatedFoods);
        appState.userFoods = updatedFoods;
        renderNutritionViewPage();
        showToast('Alimento eliminato');
      } catch (err) {
        console.error('Errore eliminazione alimento:', err);
        showToast('Errore nell\'eliminazione', { duration: 3000, type: 'error' });
      }
    },
    onManageRecipes: () => goToView('foods')
  });

}
async function renderPhysicsViewPage() {
  const today = appState.currentDate;
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const startDate = sevenDaysAgo.toISOString().slice(0, 10);

  try {
    const [weekStrength, weekCardio, weekSteps, dailyWeights, prefs] = await Promise.all([
      loadStrengthSessionsByDateRange(startDate, today),
      loadCardioSessionsByDateRange(startDate, today),
      loadDailyStepsByDateRange(startDate, today),
      loadDailyWeights(),
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

    // Build last7Days data structure
    const last7Days = Array.from({ length: 7 }).map((_, idx) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - idx));
      const dateKey = day.toISOString().slice(0, 10);

      const dayStrength = weekStrength.filter(s => s.date === dateKey);
      const dayCardio = weekCardio.filter(c => c.date === dateKey);
      const daySteps = weekSteps.find(s => s.date === dateKey);

      const strengthMin = dayStrength.reduce((sum, s) => sum + (s.durationMin || 0), 0);
      const cardioMin = dayCardio.reduce((sum, c) => sum + (c.durationMin || 0), 0);
      const dayKcal = computeDayActivityKcal(dayStrength, dayCardio, daySteps, appState.userProfile, activityPrefs);

      return {
        date: dateKey,
        strengthCount: dayStrength.length,
        cardioCount: dayCardio.length,
        strengthMin,
        cardioMin,
        steps: daySteps?.steps || 0,
        activityKcal: dayKcal.activityKcal,
        strengthSessions: dayStrength,
        cardioSessions: dayCardio
      };
    });

    // Get today's activity summary
    const todayDate = appState.currentDate;
    const todayStrength = weekStrength.filter(s => s.data === todayDate);
    const todayCardio = weekCardio.filter(c => c.data === todayDate);
    const todaySteps = weekSteps.find(s => s.data === todayDate);

    // Get activity sync status
    const connectedProvider = getConnectedProvider();
    const activitySyncStatus = connectedProvider ? {
      connectedProvider,
      lastSyncDate: localStorage.getItem('lastActivitySyncDate')
    } : null;

    const physicsState = {
      userProfile: appState.userProfile,
      last7Days,
      todayStrength,
      todayCardio,
      todaySteps,
      prefs: activityPrefs,
      activitySyncStatus,
      dailyWeights
    };

    mainContent.innerHTML = renderPhysicsView(physicsState);
  lazyLoadImages();
    bindPhysicsViewEvents(mainContent, {
      onAddStrength: () => showAddStrengthModal(async (data) => {
        await saveStrengthSession(data);
        renderPhysicsViewPage();
        showToast('Allenamento salvato');
      }),
      onEditStrength: (id) => {
        const session = weekStrength.find(s => s.id === id);
        if (session) {
          showEditStrengthModal(session, async (data) => {
            await updateStrengthSession(id, data);
            renderPhysicsViewPage();
            showToast('Allenamento aggiornato');
          });
        }
      },
      onDeleteStrength: async (id) => {
        try {
          await deleteSessionWithUndo('strength', id, renderPhysicsViewPage);
        } catch (err) {
          showToast('Errore eliminazione allenamento', { duration: 3000, type: 'error' });
        }
      },
      onAddCardio: () => showAddCardioModal(async (data) => {
        await saveCardioSession(data);
        renderPhysicsViewPage();
        showToast('Cardio salvato');
      }),
      onEditCardio: (id) => {
        const session = weekCardio.find(c => c.id === id);
        if (session) {
          showEditCardioModal(session, async (data) => {
            await updateCardioSession(id, data);
            renderPhysicsViewPage();
            showToast('Cardio aggiornato');
          });
        }
      },
      onDeleteCardio: async (id) => {
        try {
          await deleteSessionWithUndo('cardio', id, renderPhysicsViewPage);
        } catch (err) {
          showToast('Errore eliminazione cardio', { duration: 3000, type: 'error' });
        }
      },
      onAddSteps: () => showAddStepsModal(async (data) => {
        await saveDailySteps(data);
        renderPhysicsViewPage();
        showToast('Passi salvati');
      }),
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
                  showToast('Nessun record importato.', { duration: 4000, type: 'error' });
                  return { success: false, error: 'Nessun record importato con successo' };
                }

                // Update sync metadata in localStorage
                setConnectedProvider(providerId);
                localStorage.setItem('activitySyncLastTime', new Date().toLocaleString('it-IT'));
                const existingCount = localStorage.getItem('activitySyncDaysCount') ? parseInt(localStorage.getItem('activitySyncDaysCount')) : 0;
                localStorage.setItem('activitySyncDaysCount', (existingCount + imported).toString());

                showToast(`✅ ${imported} giorni importati${skipped > 0 ? `, ${skipped} saltati` : ''}.`);
                renderPhysicsViewPage();
                return { success: true };
              } catch (err) {
                console.error('Errore durante import:', err);
                showToast('❌ Errore durante l\'importazione. Riprova.', { duration: 4000, type: 'error' });
                return { success: false, error: err.message };
              }
            }, { parseStepsFile });
          }, { PROVIDERS, getAvailableProviders });
        } catch (err) {
          console.error('Errore apertura provider selection:', err);
          showToast('Errore. Riprova.', { duration: 4000, type: 'error' });
        }
      },
      onDisconnectProvider: async () => {
        try {
          clearConnectedProvider();
          localStorage.removeItem('activitySyncLastTime');
          localStorage.removeItem('activitySyncDaysCount');
          showToast('Provider scollegato.', { type: 'success' });
          renderPhysicsViewPage();
        } catch (err) {
          console.error('Errore disconnessione provider:', err);
          showToast('Errore. Riprova.', { duration: 4000, type: 'error' });
        }
      },
      onAddWeight: () => {
        showAddWeightModal(async (data) => {
          await saveDailyWeight(data);
          renderPhysicsViewPage();
          showToast('Peso registrato');
        });
      },
      onDeleteWeight: async (date) => {
        try {
          await deleteDailyWeight(date);
          renderPhysicsViewPage();
          showToast('Peso eliminato');
        } catch (err) {
          showToast('Errore eliminazione peso', { duration: 3000, type: 'error' });
        }
      }
    });

  } catch (err) {
    console.error('Errore nel caricamento fisica:', err);
    mainContent.innerHTML = '<div class="section card"><p>Errore nel caricamento dati attività.</p></div>';
  }
}

function renderSearchView() {
  mainContent.innerHTML = renderFoodSearch(appState, appState.searchResults, appState.userFoods);
  bindFoodSearchEvents(mainContent, {
    onSearch: executeFoodSearch,
    onCustomFood: () => openCustomFoodForm(null, renderSearchView),
    onSelectFood: handleFoodSelection,
    onEstimatedFood: () => openEstimationWizard(null, async (mealEntry) => {
      appState.meals.push(mealEntry);
      await saveMealEntries([mealEntry]);
      trackFoodUsage(mealEntry.foodRef, mealEntry.grammi);
      closeModal();
      renderCurrentView();
      showToast('✓ Alimento da CREA aggiunto (dati verificati)');
    })
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

async function renderFridgeViewPage() {
  const [fridgeItems, recipes] = await Promise.all([loadFridgeItems(), loadRecipes()]);
  const targets = appState.nutritionTargets;
  const gaps = computeGaps(appState.meals, targets);
  const score = computeDailyScore(gaps, appState.meals, fridgeItems);

  // Insight settimanale: serve ≥7 giorni di dati reali. Guarda indietro 10 giorni
  // e tiene solo quelli con pasti loggati (ponytail: 10gg basta per trovarne 7;
  // se servono finestre più lunghe, alza la costante).
  let insight = null;
  let weak = null;
  if (targets) {
    const summaries = [];
    for (const d of buildLastNDates(appState.currentDate, 10)) {
      const dayMeals = await loadMealsByDate(d);
      if (!dayMeals.length) continue;
      const sum = aggregateDailySummary(dayMeals, targets);
      summaries.push({ pct: {
        proteine: Math.min(1, sum.totaleProteine / targets.proteine),
        carboidrati: Math.min(1, sum.totaleCarbo / targets.carboidrati),
        grassi: Math.min(1, sum.totaleGrassi / targets.grassi)
      } });
    }
    insight = computeWeeklyInsight(summaries, fridgeItems);
    weak = weakestMacro(summaries);
  }

  // Lista della spesa: carica il DB alimenti solo se c'è una carenza cronica.
  // getAllFoods() ritorna la shape grezza → normalizza a { nome, per100g }.
  const allFoods = weak ? (await getAllFoods()).map(normalizeFoodItem) : [];

  mainContent.innerHTML = renderFridgeView({ fridgeItems, gaps, meals: appState.meals, score, insight, recipes, allFoods, weak });
  bindFridgeViewEvents(mainContent, {
    onChanged: () => renderCurrentView(),
    onAddFoodToMeal: (food, grams) => showFoodDetailModal(food, grams),
    onCookRecipe: (recipeId) => openAddRecipeAsMeal(recipeId)
  }, { fridgeItems, gaps, allFoods, weak });
}

async function renderWeightLossView() {
  // Carica tutti i dati necessari
  const [allMeals, todayWeightsSessions, todayCardioSessions, allWeightsSessions, allCardioSessions, dailyWeights] = await Promise.all([
    loadAllMeals(),
    loadStrengthSessionsByDateRange(appState.currentDate, appState.currentDate),
    loadCardioSessions(appState.currentDate),
    loadAllStrengthSessions(),
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
    onSaveGoalWeight: async (pesoObiettivoKg) => {
      appState.userProfile = { ...appState.userProfile, pesoObiettivoKg };
      await saveUserProfile(appState.userProfile);
      renderWeightLossView();
      showToast('Obiettivo peso salvato.');
    },
    onSaveWeightsSession: async (session) => {
      // Salva nello store attivo strengthSessions (coerente con la lettura della vista)
      const sessionToSave = {
        id: crypto.randomUUID(),
        date: appState.currentDate,
        ...session
      };
      await saveStrengthSession(sessionToSave);
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
      await deleteSessionWithUndo(type === 'weights' ? 'strength' : 'cardio', id, renderWeightLossView);
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

function showFoodDetailModal(food, defaultGrams = 100) {
  const suggestedMoment = suggestMealMoment();
  const html = `
    <div>
      <h1>Aggiungi alimento</h1>
      <div class="card">
        <p><strong>${escapeHtml(food.nome)}</strong>${food.brand ? ` - ${escapeHtml(food.brand)}` : ''}</p>
        <p class="small-muted">${food.porzioneBase}</p>
        <label>Momento del pasto<select id="mealMoment">
          <option value="colazione" ${suggestedMoment === 'colazione' ? 'selected' : ''}>Colazione</option>
          <option value="spuntino" ${suggestedMoment === 'spuntino' ? 'selected' : ''}>Spuntino</option>
          <option value="pranzo" ${suggestedMoment === 'pranzo' ? 'selected' : ''}>Pranzo</option>
          <option value="merenda" ${suggestedMoment === 'merenda' ? 'selected' : ''}>Merenda</option>
          <option value="cena" ${suggestedMoment === 'cena' ? 'selected' : ''}>Cena</option>
          <option value="altro" ${suggestedMoment === 'altro' ? 'selected' : ''}>Altro</option>
        </select></label>
        <label>Grammi<input id="foodGrams" type="number" min="1" max="3000" value="${defaultGrams}" style="font-size: 16px;"></label>
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
        per100g: food.per100g, // riferimento stabile per modifiche successive (no drift)
        origin: 'manual_search',
        note: ''
      };
      appState.meals.push(entry);
      await saveMealEntries([entry]);
      trackFoodUsage(entry.foodRef, entry.grammi);
      await applyMealToFridge(entry.foodRef, entry.grammi); // scala la scorta nel frigo se presente
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

/**
 * Riferimento per-100g stabile di un pasto. Se l'entry non ha `per100g` salvato
 * (entry storiche o stime), lo deriva UNA volta da macroCalcolate/grammi; il
 * chiamante lo persiste poi nell'entry, evitando il drift da arrotondamenti
 * ripetuti a ogni modifica.
 */
function getPer100gRef(meal) {
  if (meal.per100g && typeof meal.per100g.kcal === 'number') return meal.per100g;
  const g = meal.grammi || 100;
  const m = meal.macroCalcolate || {};
  return {
    kcal: (m.kcal || 0) * 100 / g,
    proteine: (m.proteine || 0) * 100 / g,
    carboidrati: (m.carboidrati || 0) * 100 / g,
    grassi: (m.grassi || 0) * 100 / g,
    zuccheri: (m.zuccheri || 0) * 100 / g,
    fibra: (m.fibra || 0) * 100 / g
  };
}

function editMealModal(moment, mealIndex) {
  const momentMap = { 'Colazione': 'colazione', 'Spuntino': 'spuntino', 'Pranzo': 'pranzo', 'Merenda': 'merenda', 'Cena': 'cena', 'Altro': 'altro' };
  const actualMoment = momentMap[moment] || moment;
  const mealEntries = appState.meals.filter(m => m.momento === actualMoment);
  const meal = mealEntries[mealIndex];

  if (!meal) {
    reportError('Pasto non trovato');
    return;
  }

  const html = `
    <div>
      <h1 style="margin-top: 0;">Modifica Pasto</h1>
      <div class="card">
        <div style="margin-bottom: 1.5rem;">
          <strong style="font-size: 1.1rem;">${escapeHtml(meal.foodRef.name)}</strong>
          <p class="small-muted" style="margin: 0.25rem 0 0.75rem 0;">
            ${actualMoment.charAt(0).toUpperCase() + actualMoment.slice(1)}
          </p>
        </div>

        <label style="display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem;">
          <span class="label-text">Momento del pasto</span>
          <select id="editMealMoment">
            <option value="colazione">Colazione</option>
            <option value="spuntino">Spuntino</option>
            <option value="pranzo">Pranzo</option>
            <option value="merenda">Merenda</option>
            <option value="cena">Cena</option>
            <option value="altro">Altro</option>
          </select>
        </label>

        <label style="display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem;">
          <span class="label-text">Grammi</span>
          <input id="editMealGrams" type="number" min="1" max="3000" style="font-size: 16px;">
        </label>

        <label style="display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem;">
          <span class="label-text">Note (opzionale)</span>
          <textarea id="editMealNote" placeholder="Es: meno olio, senza sale..." style="padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; resize: vertical; min-height: 60px;"></textarea>
        </label>

        <div id="editMealDetailCalc" class="small-muted" style="padding: 0.75rem; background: var(--glass-secondary); border-radius: 6px; margin-bottom: 1rem;"></div>

        <div class="field-grid">
          <button id="confirmEditMeal" class="primary">Salva Modifiche</button>
          <button id="cancelEditMeal" class="secondary">Annulla</button>
        </div>
      </div>
    </div>
  `;

  showModal(html, container => {
    const momentSelect = container.querySelector('#editMealMoment');
    const gramsInput = container.querySelector('#editMealGrams');
    const noteInput = container.querySelector('#editMealNote');
    const detail = container.querySelector('#editMealDetailCalc');

    // Set initial values
    momentSelect.value = meal.momento;
    gramsInput.value = meal.grammi;
    noteInput.value = meal.note || '';

    const per100gRef = getPer100gRef(meal);

    function updateDetail() {
      const grams = Number(gramsInput.value) || 0;
      const macro = calculateMacrosForAmount({ per100g: per100gRef }, grams);
      detail.textContent = `Kcal: ${macro.kcal} • Prot: ${macro.proteine.toFixed(1)} g • Carbo: ${macro.carboidrati.toFixed(1)} g • Grassi: ${macro.grassi.toFixed(1)} g`;
    }

    updateDetail();
    gramsInput.addEventListener('input', updateDetail);

    gramsInput.focus();
    gramsInput.select();

    container.querySelector('#confirmEditMeal').addEventListener('click', async () => {
      const grams = Number(gramsInput.value);
      if (!grams || grams < 1) {
        reportError('Inserisci un valore di grammi valido.');
        return;
      }

      const newMoment = momentSelect.value;
      const macroCalcolate = calculateMacrosForAmount({ per100g: per100gRef }, grams);

      // Update the meal entry (persiste anche per100g per le modifiche future)
      const updatedMeal = {
        ...meal,
        momento: newMoment,
        grammi: grams,
        macroCalcolate,
        per100g: per100gRef,
        note: noteInput.value || ''
      };

      // Replace in appState
      const mealIndex = appState.meals.findIndex(m => m.id === meal.id);
      if (mealIndex !== -1) {
        appState.meals[mealIndex] = updatedMeal;
      }

      await saveMealEntries(appState.meals);
      closeModal();
      renderNutritionViewPage();
      showToast('Pasto modificato.');
    });

    container.querySelector('#cancelEditMeal').addEventListener('click', closeModal);

    gramsInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        container.querySelector('#confirmEditMeal').click();
      }
    });
  });
}

function editCustomFoodModal(foodId) {
  const food = appState.userFoods.find(f => f.id === foodId);
  if (!food) {
    reportError('Alimento non trovato');
    return;
  }

  const html = renderUserFoodForm(food);
  showModal(html, container => {
    bindUserFoodFormEvents(container, {
      onSave: async data => {
        if (!data.nome) {
          reportError('Il nome dell alimento è obbligatorio.');
          return;
        }

        const updatedFood = { ...food, ...data };
        appState.userFoods = appState.userFoods.map(item => item.id === foodId ? updatedFood : item);
        await saveUserFoods(appState.userFoods);
        closeModal();
        renderNutritionViewPage();
        showToast('Alimento modificato.');
      },
      onCancel: closeModal
    });
  });
}

// onSaved: vista da ri-renderizzare dopo il salvataggio — di default torna a
// Ricette/Alimenti, ma i chiamanti da Nutrizione o Ricerca passano la propria
// vista così l'utente resta nel contesto in cui stava lavorando invece di
// essere spostato altrove.
function openCustomFoodForm(existingFood = null, onSaved = renderFoodsView) {
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
        onSaved();
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
  if (!(await showConfirm('Eliminare questo alimento personalizzato?', { confirmLabel: 'Elimina', danger: true }))) return;
  const removed = appState.userFoods.find(item => item.id === id);
  appState.userFoods = appState.userFoods.filter(item => item.id !== id);
  await saveUserFoods(appState.userFoods);
  renderFoodsView();
  showToast('Alimento eliminato', {
    type: 'success',
    action: removed ? {
      label: 'Annulla',
      onClick: async () => {
        appState.userFoods.push(removed);
        await saveUserFoods(appState.userFoods);
        renderFoodsView();
      }
    } : null
  });
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
      onCancel: closeModal
    }, existingRecipe?.ingredients || []);
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
  if (!(await showConfirm('Eliminare questa ricetta?', { confirmLabel: 'Elimina', danger: true }))) return;
  try {
    const removed = await loadRecipeById(id);
    await deleteRecipe(id);
    renderFoodsView();
    showToast('Ricetta eliminata', {
      type: 'success',
      action: removed ? {
        label: 'Annulla',
        onClick: async () => {
          await saveRecipe(removed);
          renderFoodsView();
        }
      } : null
    });
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
      <h2>${escapeHtml(recipe.nome)}</h2>
      <p class="small-muted">${escapeHtml(recipe.descrizione || '')}</p>

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
        // per100g salvato nell'ingrediente (ricette nuove); fallback a userFoods (legacy)
        const per100 = ing.per100g || appState.userFoods.find(f => f.id === ing.foodRef?.id)?.per100g;
        if (per100) {
          totalKcal += (per100.kcal * totalGrams) / 100;
          totalProt += (per100.proteine * totalGrams) / 100;
          totalCarb += (per100.carboidrati * totalGrams) / 100;
          totalFat += (per100.grassi * totalGrams) / 100;
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
      let totalKcal = 0, totalProt = 0, totalCarb = 0, totalFat = 0, totalSugar = 0, totalFiber = 0;
      recipe.ingredients.forEach(ing => {
        const totalGrams = ing.grammi * portions;
        // per100g salvato nell'ingrediente (ricette nuove); fallback a userFoods (legacy)
        const per100 = ing.per100g || appState.userFoods.find(f => f.id === ing.foodRef?.id)?.per100g;
        if (per100) {
          totalKcal += (per100.kcal * totalGrams) / 100;
          totalProt += (per100.proteine * totalGrams) / 100;
          totalCarb += (per100.carboidrati * totalGrams) / 100;
          totalFat += (per100.grassi * totalGrams) / 100;
          totalSugar += ((per100.zuccheri || 0) * totalGrams) / 100;
          totalFiber += ((per100.fibra || 0) * totalGrams) / 100;
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
          zuccheri: Math.round(totalSugar),
          fibra: Math.round(totalFiber)
        },
        origin: 'recipe_saved',
        note: `Ricetta: ${recipe.nome} (${portions} porzioni)`
      };

      appState.meals.push(entry);
      await saveMealEntries([entry]);
      trackFoodUsage(entry.foodRef, entry.grammi);
      await applyRecipeToFridge(recipe.ingredients, portions); // scala gli ingredienti dal frigo
      closeModal();
      renderCurrentView();
      showToast('Ricetta aggiunta al giorno!');
    });

    container.querySelector('#cancelAddRecipeMeal').addEventListener('click', closeModal);
  });
}

// showModal/closeModal estratti in ./ui/modal.js; restano esposti come globali
// per i moduli che li usano via window (estimationEngine, composedMealWizard).
window.showModal = showModal;
window.closeModal = closeModal;
window.appState = appState;

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

  // Swipe gesture support per la navigazione a tab: registrata UNA volta sola.
  // Prima era annidata dentro il listener di click e veniva re-inizializzata
  // ad ogni tap, accumulando listener touchstart/touchend duplicati su
  // mainContent — dopo N click, uno swipe navigava N tab invece di uno solo.
  const swipeTarget = document.getElementById('mainContent');
  const navButtonsForSwipe = Array.from(document.querySelectorAll('.nav-button'));
  if (swipeTarget && navButtonsForSwipe.length > 0) {
    initSwipeNavigation(swipeTarget, navButtonsForSwipe, (view) => {
      appState.currentView = view;
      renderCurrentView();
    });
  }
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

function renderSettingsView() {
  mainContent.innerHTML = renderSettings();
  bindSettingsEvents(mainContent, {
    onEditProfile: async () => {
      appState.currentView = 'dashboard';
      renderOnboardingView();
    }
  });
}

async function renderStatsViewPage() {
  try {
    const [allMeals, dailyWeights] = await Promise.all([
      loadAllMeals(),
      loadDailyWeights()
    ]);
    mainContent.innerHTML = renderStatsView(allMeals, dailyWeights, appState.nutritionTargets, appState.userProfile);
    bindStatsViewEvents(mainContent, {});
  } catch (err) {
    console.error('Errore nel caricamento statistiche:', err);
    mainContent.innerHTML = '<div class="section card"><p>Errore nel caricamento delle statistiche.</p></div>';
  }
}

function populateBottomNav() {
  const navButtons = [
    { view: 'dashboard', label: 'Home', emoji: '🏠' },
    { view: 'nutrition', label: 'Pasti', emoji: '🍽️' },
    { view: 'fridge', label: 'Frigo', emoji: '🧊' },
    { view: 'physics', label: 'Attività', emoji: '💪' },
    { view: 'stats', label: 'Trend', emoji: '📈' },
    { view: 'settings', label: 'Altro', emoji: '⚙️' }
  ];

  // Etichetta testuale sotto l'emoji: scopribilità senza dover indovinare le icone
  bottomNav.innerHTML = navButtons.map(btn => `
    <button class="nav-button" data-view="${btn.view}" title="${btn.label}" aria-label="${btn.label}">
      <span class="nav-emoji" aria-hidden="true">${btn.emoji}</span>
      <span class="nav-label">${btn.label}</span>
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
  await loadState();
  renderCurrentView();

  // Promemoria scadenze: solo se l'utente ha già concesso il permesso (max 1/giorno).
  if (notificationsState() === 'granted') {
    loadFridgeItems().then(maybeNotifyExpiring).catch(() => {});
  }
}

function openCustomFoodFormWithMoment(moment) {
  const html = renderUserFoodForm(null);
  showModal(html, container => {
    bindUserFoodFormEvents(container, {
      onSave: async data => {
        if (!data.nome) {
          reportError('Il nome dell\'alimento è obbligatorio.');
          return;
        }
        const food = { ...data, id: crypto.randomUUID(), source: 'USER_CUSTOM', createdByUserId: appState.userProfile.id };
        appState.userFoods.push(food);
        await saveUserFoods(appState.userFoods);

        closeModal();
        openQuickAddWithFoodAndMoment(
          { id: food.id, source: food.source, name: food.nome },
          100,
          moment
        );
        showToast('Alimento personalizzato salvato.');
      },
      onCancel: closeModal
    });
  });
}

function openQuickAddWithMoment(moment) {
  // Apre il modale di aggiunta rapida con il momento preselezionato
  const html = `
    <div style="min-width: 320px;">
      <h1 style="margin-top: 0; text-align: center;">+ Aggiungi Cibo</h1>
      <p style="text-align: center; color: var(--muted); margin-bottom: 1.5rem;">
        Momento: <strong>${moment.charAt(0).toUpperCase() + moment.slice(1)}</strong>
      </p>

      <div class="quick-add-tabs" style="display: flex; gap: 0.25rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--glass-border); padding-bottom: 0; flex-wrap: wrap;">
        <button class="tab-btn active" data-tab="search" style="flex: 1; min-width: 70px; padding: 0.75rem; background: none; border: none; border-bottom: 3px solid var(--accent-cyan); cursor: pointer; color: var(--text-primary); font-weight: 600; font-size: 0.9rem;">🔍 Cerca</button>
        <button class="tab-btn" data-tab="composed" style="flex: 1; min-width: 70px; padding: 0.75rem; background: none; border: none; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-muted); font-weight: 600; font-size: 0.9rem;">🍝 Composto</button>
        <button class="tab-btn" data-tab="custom" style="flex: 1; min-width: 70px; padding: 0.75rem; background: none; border: none; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-muted); font-weight: 600; font-size: 0.9rem;">📝 Pers.</button>
        <button class="tab-btn" data-tab="estimate" style="flex: 1; min-width: 70px; padding: 0.75rem; background: none; border: none; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-muted); font-weight: 600; font-size: 0.9rem;">📊 Stima</button>
        <button class="tab-btn" data-tab="recent" style="flex: 1; min-width: 70px; padding: 0.75rem; background: none; border: none; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-muted); font-weight: 600; font-size: 0.9rem;">⭐ Rec.</button>
      </div>

      <!-- TAB: CERCA -->
      <div class="tab-content active" data-tab="search" style="display: block;">
        <div style="margin-bottom: 1rem;">
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input id="quickSearchInput" type="text" placeholder="Cerca alimenti (es: pollo, pasta, latte)" style="flex: 1; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--glass-border);">
            ${voiceButtonHtml('quickVoiceBtn')}
          </div>
          <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">
            <span id="quickSearchHint">Scrivi per cercare nei tuoi alimenti e nel database</span>
          </div>
        </div>
        <div id="quickSearchResults" style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;"></div>
        <p id="quickSearchEmpty" style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Nessun risultato. Prova a cercare o crea un nuovo alimento.</p>
      </div>

      <!-- TAB: PIATTO COMPOSTO -->
      <div class="tab-content" data-tab="composed" style="display: none;">
        <div style="text-align: center; padding: 2rem 0;">
          <p style="margin-bottom: 1.5rem; color: var(--text-muted);">Decomponici un piatto nei suoi componenti (pasta al tonno, insalata di riso, ecc.)</p>
          <button id="openComposedMealBtn" class="primary" style="width: 100%; padding: 0.875rem;">🍝 Nuovo Piatto Composto</button>
        </div>
      </div>

      <!-- TAB: PERSONALIZZATO -->
      <div class="tab-content" data-tab="custom" style="display: none;">
        <div style="text-align: center; padding: 2rem 0;">
          <p style="margin-bottom: 1.5rem; color: var(--text-muted);">Crea un alimento personalizzato con macro ogni 100g</p>
          <button id="openCustomFoodFormBtn" class="primary" style="width: 100%; padding: 0.875rem;">+ Nuovo Alimento Personalizzato</button>
        </div>
      </div>

      <!-- TAB: STIMA -->
      <div class="tab-content" data-tab="estimate" style="display: none;">
        <div style="text-align: center; padding: 2rem 0;">
          <p style="margin-bottom: 1.5rem; color: var(--text-muted);">Seleziona il tipo, il taglio, lo stato e aggiungi condimenti.</p>
          <p style="margin-bottom: 1.5rem; font-size: 0.85rem; color: var(--text-muted);">Es: Pollo Petto Cotto con olio</p>
          <button id="openEstimationWizardBtn" class="primary" style="width: 100%; padding: 0.875rem;">📊 Avvia Stima Precisa</button>
        </div>
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

    // Search functionality
    const searchInput = container.querySelector('#quickSearchInput');
    const searchResults = container.querySelector('#quickSearchResults');
    const searchEmpty = container.querySelector('#quickSearchEmpty');
    const searchHint = container.querySelector('#quickSearchHint');
    let searchTimeout;

    searchInput?.addEventListener('input', async (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();

      if (query.length < 2) {
        searchResults.innerHTML = '';
        searchEmpty.style.display = 'block';
        searchHint.textContent = query.length === 0 ? 'Scrivi per cercare nei tuoi alimenti e nel database' : 'Digita almeno 2 caratteri';
        return;
      }

      searchEmpty.style.display = 'none';
      searchHint.textContent = '';
      searchResults.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">Cercando...</div>';

      searchTimeout = setTimeout(async () => {
        const results = await performQuickSearch(query);
        renderQuickSearchResults(results, container, moment);
      }, 300);
    });

    // Custom food button
    const openCustomBtn = container.querySelector('#openCustomFoodFormBtn');
    openCustomBtn?.addEventListener('click', () => {
      closeModal();
      openCustomFoodFormWithMoment(moment);
    });

    // Composed meal button
    const openComposedBtn = container.querySelector('#openComposedMealBtn');
    openComposedBtn?.addEventListener('click', () => {
      closeModal();
      openComposedMealWizard(moment, (entry) => {
        addMealAndClose(entry);
      });
    });

    // Estimation wizard button
    const openEstimationBtn = container.querySelector('#openEstimationWizardBtn');
    openEstimationBtn?.addEventListener('click', () => {
      closeModal();
      openEstimationWizard(moment, (estimatedEntry) => {
        addMealAndClose(estimatedEntry);
      });
    });

    // Recent foods
    loadRecentFoodsWithMoment(container, moment);

    // Dettatura vocale per la ricerca
    wireVoiceButton(container.querySelector('#quickVoiceBtn'), searchInput);

    // Focus search input
    searchInput?.focus();
  });
}

async function performQuickSearch(query) {
  const normalizedQuery = query.toLowerCase();

  // Search user foods first
  const userFoodsResults = (appState.userFoods || [])
    .filter(f => f.nome.toLowerCase().includes(normalizedQuery) || (f.brand && f.brand.toLowerCase().includes(normalizedQuery)))
    .map(f => ({ ...f, name: f.nome, source: 'user', priority: 2 }))
    .slice(0, 5);

  // Then search database via API
  let dbResults = [];
  try {
    const dbFoods = await searchFoods(query);
    dbResults = (dbFoods || [])
      .map(f => ({ ...f, name: f.nome, source: 'database', priority: 1 }))
      .slice(0, 7);
  } catch (e) {
    console.warn('Search error:', e);
  }

  // Combine and sort
  return [...userFoodsResults, ...dbResults];
}

function renderQuickSearchResults(results, container, moment) {
  const searchResults = container.querySelector('#quickSearchResults');
  const searchEmpty = container.querySelector('#quickSearchEmpty');

  if (!results || results.length === 0) {
    searchResults.innerHTML = '';
    searchEmpty.style.display = 'block';
    return;
  }

  searchEmpty.style.display = 'none';
  searchResults.innerHTML = results.map((food, idx) => {
    const badge = food.source === 'user' ? '⭐' : '📦';
    const brand = food.brand ? ` · ${escapeHtml(food.brand)}` : '';
    const displayName = escapeHtml(food.name || food.nome);
    return `
      <button class="secondary" data-search-idx="${idx}" style="text-align: left; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--glass-border);">
        <div>
          <div><strong>${badge} ${displayName}</strong></div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">${food.porzioneBase}${brand}</div>
          ${food.per100g?.kcal ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${Math.round(food.per100g.kcal)} kcal/100g</div>` : ''}
        </div>
        <div style="font-size: 1.25rem;">→</div>
      </button>
    `;
  }).join('');

  searchResults.querySelectorAll('button').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const food = results[idx];
      closeModal();
      openQuickAddWithFoodAndMoment(food, 100, moment);
    });
  });
}

function loadRecentFoodsWithMoment(container, moment) {
  // Carica cibi recenti e aggiunge al momento specificato
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
        <div><strong>${escapeHtml(recent.foodRef.name)}</strong></div>
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
      openQuickAddWithFoodAndMoment(recent.foodRef, recent.grammi, moment);
    });
  });
}

function openQuickAddWithFoodAndMoment(foodRef, suggestedGrams, moment) {
  const html = `
    <div style="min-width: 320px;">
      <h2 style="margin-top: 0;">${escapeHtml(foodRef.name)}</h2>
      <div class="card" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--glass-secondary);">
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--glass-tertiary); border-radius: 8px; text-align: center;">
          <strong style="color: var(--primary);">${moment.charAt(0).toUpperCase() + moment.slice(1)}</strong>
        </div>
        <label>Grammi
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
    // Auto-focus on grammi
    container.querySelector('#foodGramsInput').focus();
    container.querySelector('#foodGramsInput').select();

    container.querySelector('#confirmRecentFood').addEventListener('click', async () => {
      const grams = parseFloat(container.querySelector('#foodGramsInput').value);
      if (!grams || grams < 1) {
        reportError('Inserisci grammi validi');
        return;
      }

      const entry = {
        data: appState.currentDate,
        momento: moment,
        foodRef,
        grammi: grams,
        macroCalcolate: calculateMacrosForAmount(foodRef, grams)
      };

      await addMealAndClose(entry);
    });

    container.querySelector('#cancelRecentFood').addEventListener('click', closeModal);
  });
}

async function showWeightUpdateModal() {
  // Carica l'ultimo peso per verificare se è passata una settimana
  const allWeights = await loadDailyWeights();
  const lastWeight = allWeights && allWeights.length > 0
    ? allWeights.sort((a, b) => new Date(b.data) - new Date(a.data))[0]
    : null;

  // Controlla se è passata una settimana
  const lastBodyCompDate = lastWeight?.data ? new Date(lastWeight.data) : null;
  const today = new Date(appState.currentDate);
  const daysSinceLastBodyComp = lastBodyCompDate
    ? Math.floor((today - lastBodyCompDate) / (1000 * 60 * 60 * 24))
    : 999;
  const shouldAskBodyFat = !lastWeight || daysSinceLastBodyComp >= 7;

  const html = `
    <div style="min-width: 320px;">
      <h2 style="margin-top: 0;">⚖️ Registra Peso</h2>

      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Data</label>
        <input id="weightDateInput" type="date" value="${appState.currentDate}" style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--glass-secondary);">
      </div>

      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Peso (kg)</label>
        <input id="weightInput" type="number" step="0.1" min="30" max="200" value="${lastWeight?.pesoKg || ''}" style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--glass-secondary);" placeholder="es. 75.5">
      </div>

      ${shouldAskBodyFat ? `
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(168, 85, 247, 0.1); border-left: 3px solid #a855f7; border-radius: 8px;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Body Fat % ${!lastWeight ? '(RICHIESTO - Prima calibrazione)' : ''}</label>
          <input id="bodyFatInput" type="number" step="0.1" min="5" max="95" value="${lastWeight?.bodyFatPercent || appState.userProfile?.bodyFatPercent || 20}" style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--glass-secondary);" placeholder="es. 22.5">
          <div class="small-muted" style="margin-top: 0.5rem; font-size: 0.85rem;">Stima da DEXA, BIA o plicometria</div>
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <button id="cancelWeightBtn" class="secondary" style="padding: 0.75rem;">Annulla</button>
        <button id="saveWeightBtn" class="primary" style="padding: 0.75rem;">Salva</button>
      </div>
    </div>
  `;

  showModal(html);

  const cancelBtn = document.querySelector('#cancelWeightBtn');
  const saveBtn = document.querySelector('#saveWeightBtn');
  const weightInput = document.querySelector('#weightInput');
  const dateInput = document.querySelector('#weightDateInput');
  const bodyFatInput = document.querySelector('#bodyFatInput');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const weight = parseFloat(weightInput.value);
      const date = dateInput.value;

      if (!weight || weight < 30 || weight > 200) {
        reportError('Inserisci un peso valido (30-200 kg)');
        return;
      }

      if (shouldAskBodyFat) {
        const bodyFat = parseFloat(bodyFatInput.value);
        if (!bodyFat || bodyFat < 5 || bodyFat > 95) {
          reportError('Inserisci una body fat % valida (5-95%)');
          return;
        }

        try {
          const newWeight = { data: date, pesoKg: weight, bodyFatPercent: bodyFat };
          await saveDailyWeight(newWeight);
          closeModal();
          renderCurrentView();
          showToast(`✅ Peso ${weight}kg e Body Fat ${bodyFat}% registrati!`);
        } catch (err) {
          console.error('Errore salvataggio peso:', err);
          reportError('Errore nel salvataggio');
        }
      } else {
        try {
          const newWeight = { data: date, pesoKg: weight, bodyFatPercent: lastWeight?.bodyFatPercent };
          await saveDailyWeight(newWeight);
          closeModal();
          renderCurrentView();
          showToast(`✅ Peso ${weight}kg registrato!`);
        } catch (err) {
          console.error('Errore salvataggio peso:', err);
          reportError('Errore nel salvataggio');
        }
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
      <h2 style="margin-top: 0;">${escapeHtml(foodRef.name)}</h2>
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

