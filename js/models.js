/*
  Definizione del modello dati dell'app.
  Le interfacce sono espresse in codice JS per documentare i campi usati.
*/

export const UserSex = ['M', 'F', 'altro', 'non specificato'];
export const ActivityLevels = ['sedentario', 'leggero', 'moderato', 'intenso'];
export const Goals = ['dimagrire', 'mantenere', 'massa'];
export const MealMoments = ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena', 'altro'];
export const FoodSources = ['USDA_API', 'OPEN_FOOD_API', 'USER_CUSTOM', 'TYPICAL_ESTIMATE'];
export const Origins = ['manual_search', 'manual_quick_add', 'photo_ai_guess', 'estimated_typical_value'];

export const emptyUserProfile = {
  id: '',
  nome: '',
  sesso: 'non specificato',
  dataNascita: '',
  altezzaCm: 170,
  pesoKg: 70,
  attività: 'sedentario',
  obiettivo: 'mantenere',
  condizioni: [],
  preferenzeDieta: [],
  customTargets: null
};

export const emptyNutritionTargets = {
  calorie: 2000,
  proteine: 90,
  carboidrati: 230,
  grassi: 70,
  fibra: 30,
  zuccheri: 50
};

export function createFoodItem(fields = {}) {
  return {
    id: fields.id || crypto.randomUUID(),
    source: fields.source || 'USER_CUSTOM',
    nome: fields.nome || '',
    brand: fields.brand || '',
    porzioneBase: fields.porzioneBase || '100 g',
    per100g: {
      kcal: fields.per100g?.kcal || 0,
      proteine: fields.per100g?.proteine || 0,
      carboidrati: fields.per100g?.carboidrati || 0,
      zuccheri: fields.per100g?.zuccheri || 0,
      grassi: fields.per100g?.grassi || 0,
      grassi_saturi: fields.per100g?.grassi_saturi || 0,
      fibra: fields.per100g?.fibra || 0,
      sodioMg: fields.per100g?.sodioMg || 0
    },
    tags: fields.tags || [],
    createdByUserId: fields.createdByUserId || null
  };
}

export function createMealEntry(fields = {}) {
  return {
    id: fields.id || crypto.randomUUID(),
    userId: fields.userId || '',
    data: fields.data || new Date().toISOString().slice(0, 10),
    momento: fields.momento || 'altro',
    foodRef: fields.foodRef || { id: '', source: 'USER_CUSTOM' },
    grammi: fields.grammi || 100,
    macroCalcolate: fields.macroCalcolate || {},
    origin: fields.origin || 'manual_search',
    note: fields.note || ''
  };
}

export function createDailySummary(fields = {}) {
  return {
    data: fields.data || new Date().toISOString().slice(0, 10),
    totaleCalorie: fields.totaleCalorie || 0,
    totaleProteine: fields.totaleProteine || 0,
    totaleCarbo: fields.totaleCarbo || 0,
    totaleGrassi: fields.totaleGrassi || 0,
    totaleFibra: fields.totaleFibra || 0,
    totaleZuccheri: fields.totaleZuccheri || 0,
    totaleSodioMg: fields.totaleSodioMg || 0,
    confrontoConTarget: fields.confrontoConTarget || {}
  };
}
