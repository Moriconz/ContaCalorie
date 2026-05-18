/*
  Valori nutrizionali medi per 100g per categoria di alimento.

  Fonte: tabelle USDA FoodData Central, INRAN/CREA (Italia), valori standardizzati da letteratura.
  Aggiornabile facilmente per nuove categorie o correzioni.

  Struttura: { categoryKey: { kcal, proteine, carboidrati, grassi, fibra, zuccheri } }
*/

export const TYPICAL_FOOD_CATEGORIES = {
  // Frutta fresca
  banana: {
    kcal: 89, proteine: 1.1, carboidrati: 23, grassi: 0.3, fibra: 2.6, zuccheri: 12
  },
  mela: {
    kcal: 52, proteine: 0.3, carboidrati: 14, grassi: 0.2, fibra: 2.4, zuccheri: 10
  },
  pera: {
    kcal: 57, proteine: 0.4, carboidrati: 15, grassi: 0.1, fibra: 3.1, zuccheri: 9
  },
  arancia: {
    kcal: 47, proteine: 0.9, carboidrati: 12, grassi: 0.1, fibra: 2.4, zuccheri: 9
  },
  fragola: {
    kcal: 32, proteine: 0.8, carboidrati: 8, grassi: 0.3, fibra: 2.0, zuccheri: 5
  },
  uva: {
    kcal: 67, proteine: 0.7, carboidrati: 17, grassi: 0.2, fibra: 0.9, zuccheri: 16
  },
  melone: {
    kcal: 34, proteine: 0.8, carboidrati: 8, grassi: 0.2, fibra: 0.9, zuccheri: 7
  },
  cocomero: {
    kcal: 30, proteine: 0.6, carboidrati: 7.5, grassi: 0.2, fibra: 0.4, zuccheri: 6
  },
  albicocca: {
    kcal: 48, proteine: 1.4, carboidrati: 11, grassi: 0.4, fibra: 2.0, zuccheri: 9
  },
  pesca: {
    kcal: 39, proteine: 0.9, carboidrati: 10, grassi: 0.3, fibra: 1.5, zuccheri: 8
  },
  frutta_fresca_generica: {
    kcal: 50, proteine: 0.8, carboidrati: 13, grassi: 0.3, fibra: 2.0, zuccheri: 9
  },

  // Verdure
  insalata_lattuga: {
    kcal: 15, proteine: 1.2, carboidrati: 2.9, grassi: 0.2, fibra: 1.2, zuccheri: 0.6
  },
  pomodoro: {
    kcal: 18, proteine: 0.9, carboidrati: 3.9, grassi: 0.2, fibra: 1.2, zuccheri: 2.6
  },
  cetriolo: {
    kcal: 16, proteine: 0.7, carboidrati: 3.6, grassi: 0.1, fibra: 0.5, zuccheri: 1.7
  },
  carota: {
    kcal: 41, proteine: 0.9, carboidrati: 10, grassi: 0.2, fibra: 2.8, zuccheri: 4.7
  },
  zucchina: {
    kcal: 21, proteine: 1.4, carboidrati: 3.5, grassi: 0.4, fibra: 1.1, zuccheri: 1.2
  },
  broccoli: {
    kcal: 34, proteine: 2.8, carboidrati: 7, grassi: 0.4, fibra: 2.4, zuccheri: 1.7
  },
  cavolfiore: {
    kcal: 25, proteine: 1.9, carboidrati: 5, grassi: 0.3, fibra: 2.4, zuccheri: 1.9
  },
  spinaci: {
    kcal: 23, proteine: 2.7, carboidrati: 3.6, grassi: 0.4, fibra: 2.2, zuccheri: 0.4
  },
  melanzana: {
    kcal: 25, proteine: 0.98, carboidrati: 5.9, grassi: 0.2, fibra: 3.0, zuccheri: 3.5
  },
  peperone: {
    kcal: 31, proteine: 1.0, carboidrati: 6, grassi: 0.3, fibra: 2.0, zuccheri: 3
  },
  cipolla: {
    kcal: 40, proteine: 1.1, carboidrati: 9, grassi: 0.1, fibra: 1.7, zuccheri: 4.2
  },
  verdura_cotta_generica: {
    kcal: 30, proteine: 1.5, carboidrati: 5.5, grassi: 0.3, fibra: 1.8, zuccheri: 1.5
  },

  // Tuberi
  patata_bollita: {
    kcal: 77, proteine: 1.7, carboidrati: 17, grassi: 0.1, fibra: 1.5, zuccheri: 0.7
  },
  patata_al_forno: {
    kcal: 93, proteine: 2.1, carboidrati: 21, grassi: 0.1, fibra: 1.8, zuccheri: 1
  },
  patata_fritta: {
    kcal: 365, proteine: 3.4, carboidrati: 48, grassi: 17, fibra: 4.2, zuccheri: 0.3
  },
  patata_dolce_cotta: {
    kcal: 86, proteine: 1.6, carboidrati: 20, grassi: 0.1, fibra: 3, zuccheri: 4.2
  },
  rapa: {
    kcal: 36, proteine: 1.2, carboidrati: 8, grassi: 0.2, fibra: 1.7, zuccheri: 4.8
  },
  barbabietola: {
    kcal: 43, proteine: 1.6, carboidrati: 10, grassi: 0.2, fibra: 2.4, zuccheri: 6.8
  },

  // Cereali e pane
  pane_bianco: {
    kcal: 265, proteine: 8, carboidrati: 49, grassi: 3.3, fibra: 2.7, zuccheri: 4
  },
  pane_integrale: {
    kcal: 247, proteine: 9, carboidrati: 43, grassi: 3.3, fibra: 6.8, zuccheri: 3
  },
  pane_tostato: {
    kcal: 313, proteine: 9, carboidrati: 58, grassi: 4, fibra: 3, zuccheri: 4
  },
  pasta_cotta: {
    kcal: 131, proteine: 5, carboidrati: 25, grassi: 0.3, fibra: 1.8, zuccheri: 0.6
  },
  pasta_integrale_cotta: {
    kcal: 124, proteine: 5, carboidrati: 23, grassi: 0.5, fibra: 3.6, zuccheri: 0.4
  },
  riso_cotto: {
    kcal: 130, proteine: 2.7, carboidrati: 28, grassi: 0.3, fibra: 0.4, zuccheri: 0.1
  },
  riso_integrale_cotto: {
    kcal: 111, proteine: 2.6, carboidrati: 23, grassi: 0.9, fibra: 1.8, zuccheri: 0.0
  },
  cereali_fiocchi_sec: {
    kcal: 357, proteine: 7.5, carboidrati: 70, grassi: 5, fibra: 6, zuccheri: 15
  },
  polenta_cotta: {
    kcal: 74, proteine: 1.5, carboidrati: 17, grassi: 0.3, fibra: 1.0, zuccheri: 0.0
  },

  // Proteine: carne
  pollo_petto_magro: {
    kcal: 165, proteine: 31, carboidrati: 0, grassi: 3.6, fibra: 0, zuccheri: 0
  },
  pollo_coscia: {
    kcal: 209, proteine: 26, carboidrati: 0, grassi: 11, fibra: 0, zuccheri: 0
  },
  tacchino_petto: {
    kcal: 135, proteine: 30, carboidrati: 0, grassi: 0.7, fibra: 0, zuccheri: 0
  },
  manzo_magro: {
    kcal: 250, proteine: 26, carboidrati: 0, grassi: 15, fibra: 0, zuccheri: 0
  },
  maiale_magro: {
    kcal: 242, proteine: 27, carboidrati: 0, grassi: 14, fibra: 0, zuccheri: 0
  },
  prosciutto_cotto: {
    kcal: 215, proteine: 20, carboidrati: 2, grassi: 14, fibra: 0, zuccheri: 0
  },
  mortadella: {
    kcal: 312, proteine: 12, carboidrati: 0.8, grassi: 29, fibra: 0, zuccheri: 0
  },
  carne_magra_generica: {
    kcal: 200, proteine: 28, carboidrati: 0, grassi: 10, fibra: 0, zuccheri: 0
  },

  // Proteine: pesce
  salmone: {
    kcal: 208, proteine: 20, carboidrati: 0, grassi: 13, fibra: 0, zuccheri: 0
  },
  tonno_in_scatola_olio: {
    kcal: 289, proteine: 25, carboidrati: 0, grassi: 21, fibra: 0, zuccheri: 0
  },
  merluzzo: {
    kcal: 82, proteine: 18, carboidrati: 0, grassi: 0.7, fibra: 0, zuccheri: 0
  },
  spigola: {
    kcal: 97, proteine: 19, carboidrati: 0, grassi: 2, fibra: 0, zuccheri: 0
  },
  trota: {
    kcal: 141, proteine: 20, carboidrati: 0, grassi: 6.1, fibra: 0, zuccheri: 0
  },
  pesce_bianco_generica: {
    kcal: 100, proteine: 20, carboidrati: 0, grassi: 2, fibra: 0, zuccheri: 0
  },
  pesce_grasso_generica: {
    kcal: 180, proteine: 20, carboidrati: 0, grassi: 10, fibra: 0, zuccheri: 0
  },

  // Proteine: latticini
  latte_intero: {
    kcal: 61, proteine: 3.2, carboidrati: 4.8, grassi: 3.3, fibra: 0, zuccheri: 4.8
  },
  latte_scremato: {
    kcal: 35, proteine: 3.4, carboidrati: 5, grassi: 0.1, fibra: 0, zuccheri: 5
  },
  yogurt_naturale: {
    kcal: 59, proteine: 3.5, carboidrati: 4.7, grassi: 0.4, fibra: 0, zuccheri: 4
  },
  yogurt_greco: {
    kcal: 59, proteine: 10.2, carboidrati: 3.3, grassi: 0.4, fibra: 0, zuccheri: 2
  },
  formaggio_fresco: {
    kcal: 98, proteine: 11, carboidrati: 3.6, grassi: 5, fibra: 0, zuccheri: 0.7
  },
  formaggio_duro: {
    kcal: 402, proteine: 25, carboidrati: 1.3, grassi: 33, fibra: 0, zuccheri: 0.7
  },
  ricotta: {
    kcal: 174, proteine: 12, carboidrati: 3, grassi: 13, fibra: 0, zuccheri: 0.3
  },

  // Uova
  uovo_intero: {
    kcal: 155, proteine: 13, carboidrati: 1.1, grassi: 11, fibra: 0, zuccheri: 1.1
  },
  albume_uovo: {
    kcal: 52, proteine: 11, carboidrati: 0.7, grassi: 0.2, fibra: 0, zuccheri: 0
  },

  // Legumi cotti
  lenticchie_cotte: {
    kcal: 116, proteine: 9, carboidrati: 20, grassi: 0.4, fibra: 3.8, zuccheri: 0.4
  },
  ceci_cotti: {
    kcal: 134, proteine: 8.9, carboidrati: 23, grassi: 2.1, fibra: 6.5, zuccheri: 0.4
  },
  fagioli_cotti: {
    kcal: 127, proteine: 8.7, carboidrati: 23, grassi: 0.4, fibra: 6.4, zuccheri: 0.3
  },
  piselli_cotti: {
    kcal: 84, proteine: 5.4, carboidrati: 15, grassi: 0.4, fibra: 5.7, zuccheri: 5.7
  },
  legumi_cotti_generici: {
    kcal: 120, proteine: 8.5, carboidrati: 20, grassi: 0.6, fibra: 5.5, zuccheri: 0.5
  },

  // Oli e grassi
  olio_oliva: {
    kcal: 884, proteine: 0, carboidrati: 0, grassi: 100, fibra: 0, zuccheri: 0
  },
  burro: {
    kcal: 717, proteine: 0.9, carboidrati: 0.1, grassi: 81, fibra: 0, zuccheri: 0
  },

  // Dolci e snack
  cioccolato_fondente: {
    kcal: 546, proteine: 12, carboidrati: 61, grassi: 32, fibra: 7.2, zuccheri: 24
  },
  biscotto_secco: {
    kcal: 438, proteine: 9, carboidrati: 72, grassi: 13, fibra: 2.2, zuccheri: 14
  },
  crackers: {
    kcal: 440, proteine: 9, carboidrati: 72, grassi: 14, fibra: 2.3, zuccheri: 1.5
  },
  dolce_generico: {
    kcal: 400, proteine: 5, carboidrati: 60, grassi: 16, fibra: 1, zuccheri: 40
  },

  // Zuppe e piatti
  pasta_al_pomodoro: {
    kcal: 95, proteine: 4, carboidrati: 18, grassi: 0.5, fibra: 1.5, zuccheri: 2
  },
  risotto_burro: {
    kcal: 160, proteine: 4, carboidrati: 29, grassi: 3.5, fibra: 0.5, zuccheri: 0.2
  },
  minestrone: {
    kcal: 50, proteine: 2.5, carboidrati: 9, grassi: 0.3, fibra: 2, zuccheri: 2
  },
  zuppa_generica: {
    kcal: 60, proteine: 3, carboidrati: 10, grassi: 0.5, fibra: 1.5, zuccheri: 1.5
  },
  piatto_generico: {
    kcal: 200, proteine: 12, carboidrati: 25, grassi: 6, fibra: 2, zuccheri: 3
  },

  // Piatti comuni
  pizza_margherita: {
    kcal: 285, proteine: 12, carboidrati: 36, grassi: 10, fibra: 2, zuccheri: 3
  },
  lasagna_carne: {
    kcal: 150, proteine: 12, carboidrati: 13, grassi: 6, fibra: 0.5, zuccheri: 1.5
  },
  tagliatelle_burro: {
    kcal: 140, proteine: 5, carboidrati: 24, grassi: 3, fibra: 1.5, zuccheri: 0.5
  },
  insalata_mista_olio: {
    kcal: 80, proteine: 2.5, carboidrati: 5, grassi: 6, fibra: 1.5, zuccheri: 1.5
  },
  carne_con_contorno: {
    kcal: 180, proteine: 28, carboidrati: 8, grassi: 6, fibra: 1.5, zuccheri: 0.5
  },
  pesce_con_contorno: {
    kcal: 150, proteine: 25, carboidrati: 8, grassi: 4, fibra: 1.5, zuccheri: 0.5
  },
  insalata_tuna_tonno: {
    kcal: 140, proteine: 18, carboidrati: 3, grassi: 7, fibra: 1.5, zuccheri: 0.5
  },
  panino_hamburger: {
    kcal: 290, proteine: 15, carboidrati: 28, grassi: 12, fibra: 1.5, zuccheri: 3
  },
  riso_bianco_cotto: {
    kcal: 130, proteine: 2.7, carboidrati: 28, grassi: 0.3, fibra: 0.4, zuccheri: 0
  },
  polenta_cotta: {
    kcal: 93, proteine: 2.3, carboidrati: 21, grassi: 0.5, fibra: 1.3, zuccheri: 0.2
  },
  udon_cotte: {
    kcal: 190, proteine: 6.5, carboidrati: 40, grassi: 0.5, fibra: 1.8, zuccheri: 0.3
  },
  ramen: {
    kcal: 200, proteine: 7, carboidrati: 42, grassi: 1, fibra: 1, zuccheri: 0.5
  },
  tofu: {
    kcal: 76, proteine: 8, carboidrati: 1.9, grassi: 4.8, fibra: 1.2, zuccheri: 0.3
  },
  tempeh: {
    kcal: 195, proteine: 19, carboidrati: 7.6, grassi: 11, fibra: 1.3, zuccheri: 0
  },
  seitan: {
    kcal: 370, proteine: 25, carboidrati: 14, grassi: 5, fibra: 1.4, zuccheri: 1
  },
  soia_edamame: {
    kcal: 111, proteine: 11.9, carboidrati: 9.5, grassi: 5.2, fibra: 3.2, zuccheri: 2
  },
  noci: {
    kcal: 654, proteine: 9.3, carboidrati: 14, grassi: 65, fibra: 6.7, zuccheri: 2.6
  },
  mandorle: {
    kcal: 579, proteine: 21.2, carboidrati: 22, grassi: 50, fibra: 12.5, zuccheri: 4.4
  },
  arachidi: {
    kcal: 567, proteine: 25.8, carboidrati: 16, grassi: 49, fibra: 6, zuccheri: 4.7
  },
  semi_zucca: {
    kcal: 446, proteine: 19, carboidrati: 34, grassi: 19, fibra: 6, zuccheri: 0
  },
  semi_girasole: {
    kcal: 584, proteine: 20.8, carboidrati: 20, grassi: 51, fibra: 8.6, zuccheri: 2.6
  },
  avocado: {
    kcal: 160, proteine: 2, carboidrati: 9, grassi: 15, fibra: 7, zuccheri: 0.7
  },
  noce_cocco: {
    kcal: 354, proteine: 3.3, carboidrati: 15, grassi: 34, fibra: 9, zuccheri: 6.2
  },
  olio_cocco: {
    kcal: 892, proteine: 0, carboidrati: 0, grassi: 99, fibra: 0, zuccheri: 0
  },
  tahina: {
    kcal: 595, proteine: 17, carboidrati: 21, grassi: 53, fibra: 9.3, zuccheri: 0.7
  },
  hummus: {
    kcal: 166, proteine: 7.5, carboidrati: 14, grassi: 9.6, fibra: 3.7, zuccheri: 0.2
  },
  zucchero_bianco: {
    kcal: 387, proteine: 0, carboidrati: 100, grassi: 0, fibra: 0, zuccheri: 100
  },
  miele: {
    kcal: 304, proteine: 0.3, carboidrati: 82, grassi: 0, fibra: 0.2, zuccheri: 82
  },
  conserva_frutta: {
    kcal: 278, proteine: 0.4, carboidrati: 70, grassi: 0.1, fibra: 1, zuccheri: 60
  },
  burro_arachidi: {
    kcal: 588, proteine: 25, carboidrati: 20, grassi: 50, fibra: 6, zuccheri: 7
  },
  pasta_integrale_cotta: {
    kcal: 124, proteine: 5, carboidrati: 23, grassi: 0.5, fibra: 3.6, zuccheri: 0.4
  },
  farina_bianca: {
    kcal: 364, proteine: 10, carboidrati: 76, grassi: 1, fibra: 2.7, zuccheri: 0.3
  },
  farina_integrale: {
    kcal: 340, proteine: 13.7, carboidrati: 72, grassi: 2.5, fibra: 10.7, zuccheri: 0.5
  },

  // Bevande (completamente assenti - alta frequenza d'uso)
  acqua: {
    kcal: 0, proteine: 0, carboidrati: 0, grassi: 0, fibra: 0, zuccheri: 0
  },
  caffe_espresso: {
    kcal: 3, proteine: 0.2, carboidrati: 0.1, grassi: 0, fibra: 0, zuccheri: 0
  },
  te_nero: {
    kcal: 2, proteine: 0, carboidrati: 0.4, grassi: 0, fibra: 0, zuccheri: 0
  },
  te_verde: {
    kcal: 2, proteine: 0, carboidrati: 0.4, grassi: 0, fibra: 0, zuccheri: 0
  },
  succo_arancia_100: {
    kcal: 45, proteine: 0.7, carboidrati: 11, grassi: 0.3, fibra: 0.2, zuccheri: 9.3
  },
  succo_frutta_generico: {
    kcal: 50, proteine: 0.5, carboidrati: 12, grassi: 0.2, fibra: 0, zuccheri: 11
  },
  bibita_cola: {
    kcal: 42, proteine: 0, carboidrati: 11, grassi: 0, fibra: 0, zuccheri: 11
  },
  bibita_cola_zero: {
    kcal: 0, proteine: 0, carboidrati: 0, grassi: 0, fibra: 0, zuccheri: 0
  },
  latte_soia: {
    kcal: 33, proteine: 3.3, carboidrati: 1.3, grassi: 1.6, fibra: 0.3, zuccheri: 0.7
  },
  latte_avena: {
    kcal: 49, proteine: 1, carboidrati: 8, grassi: 1.5, fibra: 0.6, zuccheri: 7
  },
  latte_mandorla: {
    kcal: 34, proteine: 1.1, carboidrati: 1.3, grassi: 2.5, fibra: 0.4, zuccheri: 0.1
  },
  latte_cocco: {
    kcal: 23, proteine: 0.2, carboidrati: 0.9, grassi: 2.3, fibra: 0, zuccheri: 0
  },
  birra: {
    kcal: 43, proteine: 0.4, carboidrati: 3.6, grassi: 0, fibra: 0, zuccheri: 0
  },
  vino_bianco: {
    kcal: 82, proteine: 0.1, carboidrati: 2.6, grassi: 0, fibra: 0, zuccheri: 0.6
  },
  vino_rosso: {
    kcal: 85, proteine: 0.1, carboidrati: 2.6, grassi: 0, fibra: 0, zuccheri: 0.6
  },

  // Condimenti e salse
  maionese: {
    kcal: 717, proteine: 0.2, carboidrati: 0.6, grassi: 80, fibra: 0, zuccheri: 0.2
  },
  ketchup: {
    kcal: 112, proteine: 1.3, carboidrati: 29, grassi: 0.1, fibra: 0.5, zuccheri: 15
  },
  senape: {
    kcal: 66, proteine: 4.1, carboidrati: 6, grassi: 3.3, fibra: 2, zuccheri: 3.3
  },
  salsa_soia: {
    kcal: 61, proteine: 10.5, carboidrati: 5.6, grassi: 0.6, fibra: 0.8, zuccheri: 1.5
  },
  pesto_genovese: {
    kcal: 557, proteine: 20.8, carboidrati: 6, grassi: 49, fibra: 3.7, zuccheri: 1.2
  },
  sugo_pomodoro: {
    kcal: 27, proteine: 1.3, carboidrati: 5, grassi: 0.3, fibra: 1, zuccheri: 2.5
  },
  besciamella: {
    kcal: 106, proteine: 5, carboidrati: 4, grassi: 7.3, fibra: 0, zuccheri: 2
  },
  aceto_balsamico: {
    kcal: 88, proteine: 0.5, carboidrati: 18, grassi: 0.1, fibra: 0, zuccheri: 17
  },
  olio_girasole: {
    kcal: 884, proteine: 0, carboidrati: 0, grassi: 100, fibra: 0, zuccheri: 0
  },

  // Dolci e dessert italiani  gelato_crema: {
    kcal: 207, proteine: 4, carboidrati: 21, grassi: 12, fibra: 0, zuccheri: 16
  },
  gelato_sorbetto: {
    kcal: 120, proteine: 0.8, carboidrati: 28, grassi: 0.3, fibra: 0.5, zuccheri: 25
  },
  tiramisu: {
    kcal: 347, proteine: 6.5, carboidrati: 38, grassi: 18, fibra: 0.5, zuccheri: 35
  },
  panna_cotta: {
    kcal: 335, proteine: 3.2, carboidrati: 21, grassi: 26, fibra: 0, zuccheri: 19
  },
  cornetto_crema: {
    kcal: 290, proteine: 6.5, carboidrati: 32, grassi: 15, fibra: 1, zuccheri: 12
  },
  ciambella: {
    kcal: 405, proteine: 5.8, carboidrati: 49, grassi: 22, fibra: 0.7, zuccheri: 26
  },
  nutella: {
    kcal: 544, proteine: 6.3, carboidrati: 57, grassi: 31, fibra: 0, zuccheri: 56
  },
  barretta_cioccolato: {
    kcal: 535, proteine: 7.9, carboidrati: 59, grassi: 30, fibra: 2.4, zuccheri: 53
  },
  brioche: {
    kcal: 395, proteine: 6.5, carboidrati: 49, grassi: 18, fibra: 1.2, zuccheri: 20
  },
  torta_cioccolato: {
    kcal: 380, proteine: 5.2, carboidrati: 45, grassi: 20, fibra: 1.5, zuccheri: 38
  },
  crostata: {
    kcal: 330, proteine: 4, carboidrati: 42, grassi: 16, fibra: 0.8, zuccheri: 24
  },

  // Formaggi italiani
  parmigiano: {
    kcal: 431, proteine: 38, carboidrati: 1.3, grassi: 30, fibra: 0, zuccheri: 0.1
  },
  mozzarella: {
    kcal: 280, proteine: 28, carboidrati: 3, grassi: 17, fibra: 0, zuccheri: 0.1
  },
  gorgonzola: {
    kcal: 375, proteine: 20, carboidrati: 0.5, grassi: 32, fibra: 0, zuccheri: 0
  },
  mascarpone: {
    kcal: 412, proteine: 6.5, carboidrati: 4.3, grassi: 43, fibra: 0, zuccheri: 0
  },
  burrata: {
    kcal: 270, proteine: 19, carboidrati: 1, grassi: 21, fibra: 0, zuccheri: 0
  },
  pecorino: {
    kcal: 415, proteine: 36, carboidrati: 2.3, grassi: 29, fibra: 0, zuccheri: 0
  },

  // Salumi e carni espansi
  prosciutto_crudo: {
    kcal: 217, proteine: 27, carboidrati: 0, grassi: 12, fibra: 0, zuccheri: 0
  },
  bresaola: {
    kcal: 156, proteine: 35, carboidrati: 0, grassi: 2.2, fibra: 0, zuccheri: 0
  },
  salame: {
    kcal: 407, proteine: 24, carboidrati: 0.6, grassi: 34, fibra: 0, zuccheri: 0
  },
  salsiccia: {
    kcal: 350, proteine: 12, carboidrati: 2, grassi: 32, fibra: 0, zuccheri: 0
  },
  pancetta: {
    kcal: 529, proteine: 6.5, carboidrati: 0, grassi: 55, fibra: 0, zuccheri: 0
  },
  speck: {
    kcal: 240, proteine: 26, carboidrati: 0, grassi: 14, fibra: 0, zuccheri: 0
  },
  wurstel: {
    kcal: 290, proteine: 12, carboidrati: 2, grassi: 26, fibra: 0, zuccheri: 1.3
  },
  cotoletta_panata: {
    kcal: 240, proteine: 25, carboidrati: 10, grassi: 11, fibra: 0.3, zuccheri: 0.5
  },
  polpette: {
    kcal: 210, proteine: 20, carboidrati: 6, grassi: 12, fibra: 0.2, zuccheri: 0.3
  },

  // Pesce espanso
  gamberi: {
    kcal: 99, proteine: 24, carboidrati: 0, grassi: 0.3, fibra: 0, zuccheri: 0
  },
  cozze: {
    kcal: 95, proteine: 13.5, carboidrati: 3.7, grassi: 2, fibra: 0, zuccheri: 0
  },
  vongole: {
    kcal: 86, proteine: 15, carboidrati: 3.4, grassi: 1.1, fibra: 0, zuccheri: 0
  },
  polpo: {
    kcal: 82, proteine: 15, carboidrati: 0.9, grassi: 1, fibra: 0, zuccheri: 0
  },
  calamari: {
    kcal: 92, proteine: 16, carboidrati: 3, grassi: 1.4, fibra: 0, zuccheri: 0
  },
  orata: {
    kcal: 100, proteine: 20, carboidrati: 0, grassi: 1.2, fibra: 0, zuccheri: 0
  },
  sgombro: {
    kcal: 205, proteine: 20, carboidrati: 0, grassi: 13, fibra: 0, zuccheri: 0
  },
  sardine: {
    kcal: 208, proteine: 25, carboidrati: 0, grassi: 12, fibra: 0, zuccheri: 0
  },
  branzino: {
    kcal: 82, proteine: 18, carboidrati: 0, grassi: 0.7, fibra: 0, zuccheri: 0
  },

  // Verdure mancanti
  funghi_champignon: {
    kcal: 22, proteine: 3.1, carboidrati: 3.3, grassi: 0.3, fibra: 1, zuccheri: 1.7
  },
  funghi_porcini: {
    kcal: 31, proteine: 3.1, carboidrati: 5, grassi: 0.5, fibra: 1, zuccheri: 0.5
  },
  aglio: {
    kcal: 149, proteine: 6.4, carboidrati: 33, grassi: 0.5, fibra: 2.1, zuccheri: 1
  },
  porro: {
    kcal: 61, proteine: 1.5, carboidrati: 14, grassi: 0.3, fibra: 2.4, zuccheri: 7.6
  },
  sedano: {
    kcal: 16, proteine: 0.7, carboidrati: 3.7, grassi: 0.2, fibra: 0.6, zuccheri: 1.3
  },
  finocchio: {
    kcal: 31, proteine: 1.2, carboidrati: 7.3, grassi: 0.2, fibra: 3.1, zuccheri: 4.2
  },
  carciofo: {
    kcal: 47, proteine: 3, carboidrati: 10, grassi: 0.1, fibra: 5.4, zuccheri: 0.7
  },
  asparagi: {
    kcal: 20, proteine: 2.2, carboidrati: 3.7, grassi: 0.1, fibra: 2.1, zuccheri: 1.9
  },
  cavolo: {
    kcal: 25, proteine: 1.3, carboidrati: 6, grassi: 0.1, fibra: 2.4, zuccheri: 1.1
  },
  rucola: {
    kcal: 25, proteine: 2.6, carboidrati: 3.7, grassi: 0.7, fibra: 1.6, zuccheri: 0.4
  },
  radicchio: {
    kcal: 23, proteine: 1.2, carboidrati: 4.5, grassi: 0.1, fibra: 0.9, zuccheri: 0.6
  },
  mais_dolce: {
    kcal: 86, proteine: 3.3, carboidrati: 19, grassi: 1.2, fibra: 2.4, zuccheri: 6.3
  },
  fagiolini: {
    kcal: 31, proteine: 1.8, carboidrati: 7, grassi: 0.2, fibra: 3.4, zuccheri: 1.6
  },

  // Cereali alternativi
  quinoa_cotta: {
    kcal: 120, proteine: 4.4, carboidrati: 21, grassi: 1.9, fibra: 3, zuccheri: 0.9
  },
  farro_cotto: {
    kcal: 147, proteine: 5.7, carboidrati: 28, grassi: 0.9, fibra: 5, zuccheri: 0.4
  },
  avena_fiocchi: {
    kcal: 389, proteine: 16.9, carboidrati: 67, grassi: 6.9, fibra: 10.6, zuccheri: 0.8
  },
  couscous_cotto: {
    kcal: 112, proteine: 3.8, carboidrati: 23, grassi: 0.2, fibra: 1.5, zuccheri: 0.3
  },
  bulgur_cotto: {
    kcal: 83, proteine: 3, carboidrati: 19, grassi: 0.2, fibra: 4.5, zuccheri: 0
  },
  gnocchi_cotti: {
    kcal: 145, proteine: 5.5, carboidrati: 24, grassi: 3.5, fibra: 1, zuccheri: 0.3
  },
  piadina: {
    kcal: 330, proteine: 8, carboidrati: 45, grassi: 12, fibra: 1.5, zuccheri: 1
  },
  focaccia: {
    kcal: 335, proteine: 9, carboidrati: 50, grassi: 9, fibra: 2, zuccheri: 1.5
  },
  fette_biscottate: {
    kcal: 360, proteine: 11, carboidrati: 70, grassi: 3, fibra: 4.5, zuccheri: 6
  },

  // Frutta espansa
  kiwi: {
    kcal: 61, proteine: 1.1, carboidrati: 15, grassi: 0.5, fibra: 3, zuccheri: 6.3
  },
  mango: {
    kcal: 60, proteine: 0.8, carboidrati: 15, grassi: 0.4, fibra: 1.6, zuccheri: 13.5
  },
  ananas: {
    kcal: 50, proteine: 0.5, carboidrati: 13, grassi: 0.1, fibra: 1.4, zuccheri: 10
  },
  ciliegia: {
    kcal: 63, proteine: 1.1, carboidrati: 16, grassi: 0.2, fibra: 2.1, zuccheri: 13
  },
  lampone: {
    kcal: 52, proteine: 1.2, carboidrati: 12, grassi: 0.7, fibra: 6.5, zuccheri: 5.4
  },
  mirtillo: {
    kcal: 57, proteine: 0.7, carboidrati: 14, grassi: 0.3, fibra: 2.4, zuccheri: 10
  },
  mora: {
    kcal: 43, proteine: 1.4, carboidrati: 10, grassi: 0.5, fibra: 5.3, zuccheri: 4.9
  },
  mandarino: {
    kcal: 47, proteine: 0.7, carboidrati: 12, grassi: 0.3, fibra: 1.8, zuccheri: 9.3
  },

  // Snack e fast food
  patatine_busta: {
    kcal: 536, proteine: 6, carboidrati: 53, grassi: 34, fibra: 4.7, zuccheri: 0.5
  },
  popcorn: {
    kcal: 387, proteine: 12.3, carboidrati: 77, grassi: 4.5, fibra: 14.5, zuccheri: 1.1
  },
  nuggets_pollo: {
    kcal: 243, proteine: 14, carboidrati: 16, grassi: 13, fibra: 0.5, zuccheri: 0
  },
  kebab: {
    kcal: 215, proteine: 18, carboidrati: 25, grassi: 7, fibra: 2, zuccheri: 3
  },
  hot_dog: {
    kcal: 290, proteine: 12, carboidrati: 24, grassi: 16, fibra: 0.8, zuccheri: 2
  }
};

/**
 * Indovina la categoria di alimento dal nome.
 * Applica pattern matching semplice normalizzando il nome e cercando parole chiave.
 *
 * @param {string} foodName - nome dell'alimento inserito dall'utente
 * @returns {{category: string, quality: 'specific'|'generic'|'fallback'}}
 */
export function guessTypicalCategoryFromName(foodName) {
  if (!foodName || typeof foodName !== 'string') {
    return { category: 'piatto_generico', quality: 'fallback' };
  }

  const normalized = foodName.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // rimuove accenti
    .trim();

  // Mapping specifico per categorie comuni
  const keywordMap = [
    // Frutta
    { keywords: ['banana'], category: 'banana', quality: 'specific' },
    { keywords: ['mela'], category: 'mela', quality: 'specific' },
    { keywords: ['pera'], category: 'pera', quality: 'specific' },
    { keywords: ['arancia', 'orange'], category: 'arancia', quality: 'specific' },
    { keywords: ['fragola', 'fragole'], category: 'fragola', quality: 'specific' },
    { keywords: ['uva'], category: 'uva', quality: 'specific' },
    { keywords: ['melone'], category: 'melone', quality: 'specific' },
    { keywords: ['cocomero', 'anguria'], category: 'cocomero', quality: 'specific' },
    { keywords: ['albicocca'], category: 'albicocca', quality: 'specific' },
    { keywords: ['pesca'], category: 'pesca', quality: 'specific' },

    // Verdure
    { keywords: ['insalata', 'lattuga'], category: 'insalata_lattuga', quality: 'specific' },
    { keywords: ['pomodoro', 'pomodori'], category: 'pomodoro', quality: 'specific' },
    { keywords: ['cetriolo'], category: 'cetriolo', quality: 'specific' },
    { keywords: ['carota', 'carote'], category: 'carota', quality: 'specific' },
    { keywords: ['zucchina', 'zucchine'], category: 'zucchina', quality: 'specific' },
    { keywords: ['broccoli', 'broccolo'], category: 'broccoli', quality: 'specific' },
    { keywords: ['cavolfiore'], category: 'cavolfiore', quality: 'specific' },
    { keywords: ['spinaci', 'spinacio'], category: 'spinaci', quality: 'specific' },
    { keywords: ['melanzana'], category: 'melanzana', quality: 'specific' },
    { keywords: ['peperone', 'peperoni'], category: 'peperone', quality: 'specific' },
    { keywords: ['cipolla', 'cipolle'], category: 'cipolla', quality: 'specific' },

    // Tuberi
    { keywords: ['patata', 'patate', 'patate bollite'], category: 'patata_bollita', quality: 'specific' },
    { keywords: ['patata al forno', 'patata arrosto'], category: 'patata_al_forno', quality: 'specific' },
    { keywords: ['patata fritta', 'patatine fritte'], category: 'patata_fritta', quality: 'specific' },
    { keywords: ['patata dolce', 'patate dolci'], category: 'patata_dolce_cotta', quality: 'specific' },
    { keywords: ['rapa'], category: 'rapa', quality: 'specific' },
    { keywords: ['barbabietola', 'barbabietole', 'bietola rossa'], category: 'barbabietola', quality: 'specific' },

    // Bevande
    { keywords: ['acqua'], category: 'acqua', quality: 'specific' },
    { keywords: ['caffe', 'espresso'], category: 'caffe_espresso', quality: 'specific' },
    { keywords: ['te', 'tè', 'te nero'], category: 'te_nero', quality: 'specific' },
    { keywords: ['te verde'], category: 'te_verde', quality: 'specific' },
    { keywords: ['succo arancia'], category: 'succo_arancia_100', quality: 'specific' },
    { keywords: ['succo'], category: 'succo_frutta_generico', quality: 'generic' },
    { keywords: ['cola'], category: 'bibita_cola', quality: 'specific' },
    { keywords: ['cola zero'], category: 'bibita_cola_zero', quality: 'specific' },
    { keywords: ['latte soia'], category: 'latte_soia', quality: 'specific' },
    { keywords: ['latte avena'], category: 'latte_avena', quality: 'specific' },
    { keywords: ['latte mandorla'], category: 'latte_mandorla', quality: 'specific' },
    { keywords: ['latte cocco'], category: 'latte_cocco', quality: 'specific' },
    { keywords: ['birra'], category: 'birra', quality: 'specific' },
    { keywords: ['vino bianco'], category: 'vino_bianco', quality: 'specific' },
    { keywords: ['vino rosso', 'vino'], category: 'vino_rosso', quality: 'specific' },

    // Condimenti
    { keywords: ['maionese'], category: 'maionese', quality: 'specific' },
    { keywords: ['ketchup'], category: 'ketchup', quality: 'specific' },
    { keywords: ['senape'], category: 'senape', quality: 'specific' },
    { keywords: ['salsa soia'], category: 'salsa_soia', quality: 'specific' },
    { keywords: ['pesto'], category: 'pesto_genovese', quality: 'specific' },
    { keywords: ['sugo pomodoro', 'ragù'], category: 'sugo_pomodoro', quality: 'specific' },
    { keywords: ['besciamella'], category: 'besciamella', quality: 'specific' },
    { keywords: ['aceto balsamico'], category: 'aceto_balsamico', quality: 'specific' },

    // Dolci
    { keywords: ['gelato crema', 'gelato'], category: 'gelato_crema', quality: 'specific' },
    { keywords: ['gelato sorbetto'], category: 'gelato_sorbetto', quality: 'specific' },
    { keywords: ['tiramisu'], category: 'tiramisu', quality: 'specific' },
    { keywords: ['panna cotta'], category: 'panna_cotta', quality: 'specific' },
    { keywords: ['cornetto'], category: 'cornetto_crema', quality: 'specific' },
    { keywords: ['ciambella', 'ciambelle'], category: 'ciambella', quality: 'specific' },
    { keywords: ['nutella'], category: 'nutella', quality: 'specific' },
    { keywords: ['barretta'], category: 'barretta_cioccolato', quality: 'specific' },
    { keywords: ['brioche'], category: 'brioche', quality: 'specific' },
    { keywords: ['torta cioccolato'], category: 'torta_cioccolato', quality: 'specific' },
    { keywords: ['crostata'], category: 'crostata', quality: 'specific' },

    // Formaggi italiani
    { keywords: ['parmigiano'] , category: 'parmigiano', quality: 'specific' },
    { keywords: ['mozzarella'], category: 'mozzarella', quality: 'specific' },
    { keywords: ['gorgonzola'], category: 'gorgonzola', quality: 'specific' },
    { keywords: ['mascarpone'], category: 'mascarpone', quality: 'specific' },
    { keywords: ['burrata'], category: 'burrata', quality: 'specific' },
    { keywords: ['pecorino'], category: 'pecorino', quality: 'specific' },

    // Salumi
    { keywords: ['prosciutto crudo'], category: 'prosciutto_crudo', quality: 'specific' },
    { keywords: ['bresaola'], category: 'bresaola', quality: 'specific' },
    { keywords: ['salame'], category: 'salame', quality: 'specific' },
    { keywords: ['salsiccia'], category: 'salsiccia', quality: 'specific' },
    { keywords: ['pancetta'], category: 'pancetta', quality: 'specific' },
    { keywords: ['speck'], category: 'speck', quality: 'specific' },
    { keywords: ['wurstel'], category: 'wurstel', quality: 'specific' },
    { keywords: ['cotoletta'], category: 'cotoletta_panata', quality: 'specific' },
    { keywords: ['polpetta', 'polpette'], category: 'polpette', quality: 'specific' },

    // Pesce espanso
    { keywords: ['gamberi'], category: 'gamberi', quality: 'specific' },
    { keywords: ['cozze'], category: 'cozze', quality: 'specific' },
    { keywords: ['vongole'], category: 'vongole', quality: 'specific' },
    { keywords: ['polpo'], category: 'polpo', quality: 'specific' },
    { keywords: ['calamari'], category: 'calamari', quality: 'specific' },
    { keywords: ['orata'], category: 'orata', quality: 'specific' },
    { keywords: ['sgombro'], category: 'sgombro', quality: 'specific' },
    { keywords: ['sardine'], category: 'sardine', quality: 'specific' },
    { keywords: ['branzino'], category: 'branzino', quality: 'specific' },

    // Verdure mancanti
    { keywords: ['funghi champignon', 'funghi'], category: 'funghi_champignon', quality: 'specific' },
    { keywords: ['funghi porcini', 'porcini'], category: 'funghi_porcini', quality: 'specific' },
    { keywords: ['aglio'], category: 'aglio', quality: 'specific' },
    { keywords: ['porro'], category: 'porro', quality: 'specific' },
    { keywords: ['sedano'], category: 'sedano', quality: 'specific' },
    { keywords: ['finocchio'], category: 'finocchio', quality: 'specific' },
    { keywords: ['carciofo', 'carciofi'], category: 'carciofo', quality: 'specific' },
    { keywords: ['asparagi'], category: 'asparagi', quality: 'specific' },
    { keywords: ['cavolo'], category: 'cavolo', quality: 'specific' },
    { keywords: ['rucola', 'rughetta'], category: 'rucola', quality: 'specific' },
    { keywords: ['radicchio'], category: 'radicchio', quality: 'specific' },
    { keywords: ['mais', 'granturco'], category: 'mais_dolce', quality: 'specific' },
    { keywords: ['fagiolini'], category: 'fagiolini', quality: 'specific' },

    // Cereali
    { keywords: ['quinoa'], category: 'quinoa_cotta', quality: 'specific' },
    { keywords: ['farro'], category: 'farro_cotto', quality: 'specific' },
    { keywords: ['avena'], category: 'avena_fiocchi', quality: 'specific' },
    { keywords: ['couscous'], category: 'couscous_cotto', quality: 'specific' },
    { keywords: ['bulgur'], category: 'bulgur_cotto', quality: 'specific' },
    { keywords: ['gnocchi'], category: 'gnocchi_cotti', quality: 'specific' },
    { keywords: ['piadina'], category: 'piadina', quality: 'specific' },
    { keywords: ['focaccia'], category: 'focaccia', quality: 'specific' },
    { keywords: ['fette biscottate'], category: 'fette_biscottate', quality: 'specific' },

    // Frutta espansa
    { keywords: ['kiwi'], category: 'kiwi', quality: 'specific' },
    { keywords: ['mango'], category: 'mango', quality: 'specific' },
    { keywords: ['ananas'], category: 'ananas', quality: 'specific' },
    { keywords: ['ciliegia', 'ciliegie'], category: 'ciliegia', quality: 'specific' },
    { keywords: ['lampone', 'lamponi'], category: 'lampone', quality: 'specific' },
    { keywords: ['mirtillo', 'mirtilli'], category: 'mirtillo', quality: 'specific' },
    { keywords: ['mora', 'more'], category: 'mora', quality: 'specific' },
    { keywords: ['mandarino', 'mandarini'], category: 'mandarino', quality: 'specific' },

    // Snack e fast food
    { keywords: ['patatine', 'chips'], category: 'patatine_busta', quality: 'specific' },
    { keywords: ['popcorn'], category: 'popcorn', quality: 'specific' },
    { keywords: ['nuggets'], category: 'nuggets_pollo', quality: 'specific' },
    { keywords: ['kebab'], category: 'kebab', quality: 'specific' },
    { keywords: ['hot dog'] , category: 'hot_dog', quality: 'specific' },

    // Cereali e pane
    { keywords: ['pane', 'integrale'], category: 'pane_integrale', quality: 'specific' },
    { keywords: ['pane'], category: 'pane_bianco', quality: 'specific' },
    { keywords: ['pasta'], category: 'pasta_cotta', quality: 'specific' },
    { keywords: ['riso'], category: 'riso_cotto', quality: 'specific' },
    { keywords: ['polenta'], category: 'polenta_cotta', quality: 'specific' },

    // Carni
    { keywords: ['pollo', 'petto'], category: 'pollo_petto_magro', quality: 'specific' },
    { keywords: ['pollo'], category: 'pollo_coscia', quality: 'specific' },
    { keywords: ['tacchino'], category: 'tacchino_petto', quality: 'specific' },
    { keywords: ['manzo'], category: 'manzo_magro', quality: 'specific' },
    { keywords: ['maiale'], category: 'maiale_magro', quality: 'specific' },
    { keywords: ['prosciutto'], category: 'prosciutto_cotto', quality: 'specific' },

    // Pesce
    { keywords: ['salmone'], category: 'salmone', quality: 'specific' },
    { keywords: ['tonno'], category: 'tonno_in_scatola_olio', quality: 'specific' },
    { keywords: ['merluzzo'], category: 'merluzzo', quality: 'specific' },

    // Latticini
    { keywords: ['latte'], category: 'latte_intero', quality: 'specific' },
    { keywords: ['yogurt'], category: 'yogurt_naturale', quality: 'specific' },
    { keywords: ['formaggio', 'cheddar', 'parmigiano'], category: 'formaggio_duro', quality: 'specific' },
    { keywords: ['ricotta'], category: 'ricotta', quality: 'specific' },

    // Uova
    { keywords: ['uovo', 'uova'], category: 'uovo_intero', quality: 'specific' },

    // Legumi
    { keywords: ['lenticchia', 'lenticchie'], category: 'lenticchie_cotte', quality: 'specific' },
    { keywords: ['ceci'], category: 'ceci_cotti', quality: 'specific' },
    { keywords: ['fagioli'], category: 'fagioli_cotti', quality: 'specific' },
    { keywords: ['piselli'], category: 'piselli_cotti', quality: 'specific' },

    // Piatti comuni
    { keywords: ['pasta', 'pomodoro'], category: 'pasta_al_pomodoro', quality: 'specific' },
    { keywords: ['risotto'], category: 'risotto_burro', quality: 'specific' },
    { keywords: ['minestrone'], category: 'minestrone', quality: 'specific' },
    { keywords: ['zuppa'], category: 'zuppa_generica', quality: 'generic' },
    { keywords: ['pizza'], category: 'pizza_margherita', quality: 'specific' },
    { keywords: ['lasagna', 'lasagne'], category: 'lasagna_carne', quality: 'specific' },
    { keywords: ['tagliatelle'], category: 'tagliatelle_burro', quality: 'specific' },
    { keywords: ['insalata mista'], category: 'insalata_mista_olio', quality: 'specific' },
    { keywords: ['panino', 'hamburger', 'burger'], category: 'panino_hamburger', quality: 'specific' },
    { keywords: ['ramen'], category: 'ramen', quality: 'specific' },
    { keywords: ['udon'], category: 'udon_cotte', quality: 'specific' },
    { keywords: ['tofu'], category: 'tofu', quality: 'specific' },
    { keywords: ['tempeh'], category: 'tempeh', quality: 'specific' },
    { keywords: ['seitan'], category: 'seitan', quality: 'specific' },
    { keywords: ['edamame', 'soia'], category: 'soia_edamame', quality: 'specific' },

    // Frutta secca e semi
    { keywords: ['noce', 'noci'], category: 'noci', quality: 'specific' },
    { keywords: ['mandorla', 'mandorle'], category: 'mandorle', quality: 'specific' },
    { keywords: ['arachide', 'arachidi', 'noccioline'], category: 'arachidi', quality: 'specific' },
    { keywords: ['semi zucca'], category: 'semi_zucca', quality: 'specific' },
    { keywords: ['semi girasole'], category: 'semi_girasole', quality: 'specific' },
    { keywords: ['avocado', 'avocato'], category: 'avocado', quality: 'specific' },
    { keywords: ['cocco'], category: 'noce_cocco', quality: 'specific' },
    { keywords: ['tahina'], category: 'tahina', quality: 'specific' },
    { keywords: ['hummus'], category: 'hummus', quality: 'specific' },
    { keywords: ['burro arachidi', 'burro di arachidi'], category: 'burro_arachidi', quality: 'specific' },

    // Dolcificanti e condimenti
    { keywords: ['zucchero'], category: 'zucchero_bianco', quality: 'specific' },
    { keywords: ['miele'], category: 'miele', quality: 'specific' },
    { keywords: ['conserva', 'marmellata'], category: 'conserva_frutta', quality: 'specific' },

    // Farine
    { keywords: ['farina bianca'], category: 'farina_bianca', quality: 'specific' },
    { keywords: ['farina integrale'], category: 'farina_integrale', quality: 'specific' },

    // Fallback per gruppi generici
    { keywords: ['frutta'], category: 'frutta_fresca_generica', quality: 'generic' },
    { keywords: ['verdura'], category: 'verdura_cotta_generica', quality: 'generic' },
    { keywords: ['carne'], category: 'carne_magra_generica', quality: 'generic' },
    { keywords: ['pesce'], category: 'pesce_bianco_generica', quality: 'generic' }
  ];

  // Cerca i keyword nel nome normalizzato
  for (const map of keywordMap) {
    if (map.keywords.some(keyword => normalized.includes(keyword))) {
      return { category: map.category, quality: map.quality };
    }
  }

  // Fallback assoluto
  return { category: 'piatto_generico', quality: 'fallback' };
}

/**
 * Ottiene i valori tipici per una categoria.
 * @param {string} category - chiave della categoria
 * @returns {object|null} - valori per 100g o null se non trovata
 */
export function getTypicalValuesForCategory(category) {
  return TYPICAL_FOOD_CATEGORIES[category] || null;
}

/**
 * Lista tutte le categorie disponibili (per dropdown/selezione).
 * @returns {array} - array di categorie ordinate
 */
export function listAvailableCategories() {
  return Object.keys(TYPICAL_FOOD_CATEGORIES).sort();
}
