/*
  Engine micronutrienti (puro, senza side-effect).

  - Valori di riferimento RDA/AI da LARN (SINU, IV revisione) per adulti.
  - Aggrega i micronutrienti giornalieri dai pasti che usano alimenti CREA.
  - Rileva carenze e suggerisce alimenti CREA per integrare, tenendo conto
    delle calorie rimanenti nel budget giornaliero.

  ⚠️ Indicativo: la copertura dei micro nel DB CREA non è totale; i valori
     vanno letti come stima, non come misura clinica.
*/

// chiave → { label, unit, rda per sesso }
export const MICRO_META = {
  calcio:     { label: 'Calcio',      unit: 'mg', rda: { M: 1000, F: 1000 } },
  ferro:      { label: 'Ferro',       unit: 'mg', rda: { M: 10,   F: 18   } },
  potassio:   { label: 'Potassio',    unit: 'mg', rda: { M: 3900, F: 3900 } },
  magnesio:   { label: 'Magnesio',    unit: 'mg', rda: { M: 240,  F: 240  } },
  fosforo:    { label: 'Fosforo',     unit: 'mg', rda: { M: 700,  F: 700  } },
  zinco:      { label: 'Zinco',       unit: 'mg', rda: { M: 12,   F: 9    } },
  vitamina_c: { label: 'Vitamina C',  unit: 'mg', rda: { M: 105,  F: 85   } },
  vitamina_a: { label: 'Vitamina A',  unit: 'µg', rda: { M: 700,  F: 600  } },
  vitamina_e: { label: 'Vitamina E',  unit: 'mg', rda: { M: 13,   F: 12   } },
  b1:         { label: 'Vitamina B1', unit: 'mg', rda: { M: 1.2,  F: 1.1  } },
  b2:         { label: 'Vitamina B2', unit: 'mg', rda: { M: 1.6,  F: 1.3  } },
  b3:         { label: 'Vitamina B3', unit: 'mg', rda: { M: 18,   F: 14   } },
  b12:        { label: 'Vitamina B12',unit: 'µg', rda: { M: 2.4,  F: 2.4  } },
  folati:     { label: 'Folati',      unit: 'µg', rda: { M: 400,  F: 400  } },
  vitamina_d: { label: 'Vitamina D',  unit: 'µg', rda: { M: 15,   F: 15   } }
};

// Sotto questa frazione di kcal coperte da dati per un micro, non affermiamo una
// carenza (dati insufficienti) per evitare falsi allarmi sui micro poco coperti.
const COVERAGE_THRESHOLD = 0.4;

export function getRda(key, sex) {
  const meta = MICRO_META[key];
  if (!meta) return null;
  return sex === 'F' ? meta.rda.F : meta.rda.M;
}

/**
 * Somma i micronutrienti dei pasti del giorno usando l'indice DB.
 * Considera solo i pasti il cui foodRef.id è presente nel DB CREA con micro.
 * @param {Array} meals - meal entries del giorno
 * @param {Object} microsById - { foodId: { micros..(per 100g), kcal_100g } }
 * @returns {{ totals: Object, coveredKcal: number, totalKcal: number }}
 */
export function aggregateDailyMicros(meals, microsById) {
  const totals = {};
  const microCoveredKcal = {}; // per-micro: kcal da alimenti che hanno quel dato
  let coveredKcal = 0;
  let totalKcal = 0;

  for (const meal of meals) {
    const kcal = meal.macroCalcolate?.kcal || 0;
    totalKcal += kcal;
    const entry = microsById[meal.foodRef?.id];
    if (!entry || !entry.micros) continue;
    coveredKcal += kcal;
    const ratio = (meal.grammi || 0) / 100;
    for (const k in entry.micros) {
      if (entry.micros[k] != null) {
        totals[k] = (totals[k] || 0) + entry.micros[k] * ratio;
        microCoveredKcal[k] = (microCoveredKcal[k] || 0) + kcal;
      }
    }
  }
  return { totals, microCoveredKcal, coveredKcal, totalKcal };
}

/**
 * Analizza i micronutrienti vs RDA.
 * @param {Object} dailyMicros - risultato di aggregateDailyMicros
 * @param {Object} profile - { sesso }
 * @returns {Array<{key,label,unit,actual,rda,pct,status}>} ordinato dal più carente
 */
export function analyzeMicronutrients(dailyMicros, profile) {
  const sex = profile?.sesso === 'F' ? 'F' : 'M';
  const totalKcal = dailyMicros.totalKcal || 0;
  const out = [];
  for (const key of Object.keys(MICRO_META)) {
    const rda = getRda(key, sex);
    const actual = dailyMicros.totals[key] || 0;
    const pct = rda ? (actual / rda) * 100 : 0;
    // Copertura dati per questo micro: frazione delle kcal del giorno da alimenti con il dato
    const coverage = totalKcal > 0 ? (dailyMicros.microCoveredKcal?.[key] || 0) / totalKcal : 0;
    let status;
    if (totalKcal === 0 || coverage < COVERAGE_THRESHOLD) {
      status = 'unknown'; // dati insufficienti: non affermiamo carenza
    } else {
      status = pct < 50 ? 'low' : pct < 80 ? 'medium' : 'ok';
    }
    out.push({
      key,
      label: MICRO_META[key].label,
      unit: MICRO_META[key].unit,
      actual: Math.round(actual * 10) / 10,
      rda,
      pct: Math.round(pct),
      coverage: Math.round(coverage * 100),
      status
    });
  }
  // ordina: prima le carenze reali (low/medium) per %, poi ok, poi unknown
  const rank = { low: 0, medium: 1, ok: 2, unknown: 3 };
  return out.sort((a, b) => (rank[a.status] - rank[b.status]) || (a.pct - b.pct));
}

/**
 * Per un micronutriente carente, trova i migliori alimenti CREA per integrarlo
 * stando entro le calorie rimanenti.
 * @param {string} microKey
 * @param {Array} foods - lista alimenti CREA (con micros, portion_g, kcal_100g)
 * @param {number} remainingKcal - calorie ancora disponibili nel budget
 * @param {number} needed - quantità di micro mancante (in unità del micro)
 * @returns {Array<{name, grams, kcal, amount}>} top 3 suggerimenti
 */
export function suggestFoodsForMicro(microKey, foods, remainingKcal, needed) {
  const budget = remainingKcal > 0 ? remainingKcal : 400; // fallback ragionevole
  const candidates = [];

  for (const f of foods) {
    const per100 = f.micros?.[microKey];
    if (!per100 || per100 <= 0 || !f.kcal_100g) continue;

    // porzione standard CREA (o 100g di default), limitata a una quantità sensata
    let grams = f.portion_g && f.portion_g > 0 ? f.portion_g : 100;
    grams = Math.min(grams, 300);
    let kcal = (f.kcal_100g * grams) / 100;

    // se la porzione standard sfora il budget, riduci a ciò che entra (min 20g)
    if (kcal > budget && f.kcal_100g > 0) {
      grams = Math.max(20, Math.round((budget / f.kcal_100g) * 100));
      kcal = (f.kcal_100g * grams) / 100;
    }
    if (kcal > budget) continue; // non entra comunque

    const amount = (per100 * grams) / 100; // micro fornito dalla porzione
    if (amount <= 0) continue;

    candidates.push({
      name: f.name_it,
      grams: Math.round(grams),
      kcal: Math.round(kcal),
      amount: Math.round(amount * 10) / 10,
      // efficienza: micro per kcal (preferisci alimenti densi di micro e leggeri)
      efficiency: amount / Math.max(1, kcal)
    });
  }

  // ordina per quantità di micro fornita (poi efficienza), prendi i migliori distinti
  candidates.sort((a, b) => b.amount - a.amount || b.efficiency - a.efficiency);
  const seen = new Set();
  const top = [];
  for (const c of candidates) {
    const base = c.name.split(',')[0];
    if (seen.has(base)) continue; // evita duplicati dello stesso alimento base
    seen.add(base);
    top.push(c);
    if (top.length >= 3) break;
  }
  return top;
}
