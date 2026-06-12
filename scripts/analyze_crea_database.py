#!/usr/bin/env python3
"""
FASE DISCOVERY — Analisi Strutturale Database CREA Attuale
Ruolo: Data Ingestion & Validation Agent
Obiettivo: Mappare il database per pianificazione batch
"""

import json
import re
from collections import defaultdict

# Leggi il database CREA
with open('js/typicalValuesCREA_byCooking.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Estrai la struttura JSON (non perfetto ma sufficiente)
# Pattern: "FOOD_NAME": { "COOKING": { ... } }
foods = defaultdict(list)
cooking_types = set()
food_count = 0
total_entries = 0

# Cerca pattern semplificato
lines = content.split('\n')
current_food = None

for i, line in enumerate(lines):
    # Cerca nuovi alimenti (pattern: "  "ALIMENTO": {)
    food_match = re.match(r'\s*"([^"]+)":\s*{', line)
    
    # Se la riga precedente non era una cottura e questa è una {
    if food_match and i > 0:
        # Controlla se è un alimento (non un campo come "code", "nome", etc.)
        prev_line = lines[i-1] if i > 0 else ""
        
        # È un alimento se la { è dopo il nome e prima di "code" o "crudo", ecc.
        if '"code"' not in prev_line and '"nome"' not in prev_line:
            # Potrebbe essere un alimento
            potential_food = food_match.group(1)
            
            # Controlla linee successive per vedere se contiene cooking methods
            # Se vediamo "code", "nome", "kcal" nelle prossime righe, è una cottura, non un alimento
            next_10 = '\n'.join(lines[i+1:min(i+5, len(lines))])
            if '"code"' in next_10 or '"kcal"' in next_10:
                current_food = potential_food
                food_count += 1

    # Cerca cotture (pattern: "COTTURA": { "code": ... })
    if current_food and '"code"' in line and '"kcal"' in '\n'.join(lines[i:min(i+5, len(lines))]):
        # Estrai la cottura dalla riga precedente
        cooking_match = re.match(r'\s*"([^"]+)":\s*{', lines[i-1])
        if cooking_match:
            cooking_type = cooking_match.group(1)
            foods[current_food].append(cooking_type)
            cooking_types.add(cooking_type)
            total_entries += 1

print("=" * 80)
print("📊 ANALISI DATABASE CREA ATTUALE")
print("=" * 80 + "\n")

print(f"🔍 STATISTICHE GENERALI:")
print(f"  Alimenti unici: {len(foods)}")
print(f"  Combinazioni alimento×cottura: {sum(len(v) for v in foods.values())}")
print(f"  Tipi di cottura unici: {len(cooking_types)}")
print()

# Analizza distribuzione cotture per alimento
cotture_per_alimento = defaultdict(int)
for alimento, cotture_list in foods.items():
    cotture_per_alimento[len(cotture_list)] += 1

print(f"📈 DISTRIBUZIONE COTTURE PER ALIMENTO:")
for num_cotture in sorted(cotture_per_alimento.keys()):
    count = cotture_per_alimento[num_cotture]
    print(f"  {num_cotture} cottura/e: {count} alimenti")
print()

# Top cotture
print(f"🍳 COTTURE PIÙ FREQUENTI:")
cottura_frequency = defaultdict(int)
for cotture_list in foods.values():
    for cottura in cotture_list:
        cottura_frequency[cottura] += 1

for cottura, freq in sorted(cottura_frequency.items(), key=lambda x: -x[1])[:15]:
    print(f"  {cottura}: {freq} volte")
print()

# Campione alimenti con poche cotture (candidati per espansione)
print(f"⚠️  ALIMENTI CON SINGOLA COTTURA (Candidati Verifica):")
single_cooking = {food: cotture[0] for food, cotture in foods.items() if len(cotture) == 1}
sample_single = list(single_cooking.items())[:10]
for food, cooking in sample_single:
    print(f"  • {food} → {cooking}")
if len(single_cooking) > 10:
    print(f"  ... e altri {len(single_cooking) - 10}")
print()

# Campione alimenti con molte cotture (validazione multi-cottura)
print(f"✅ ALIMENTI CON MULTIPLE COTTURE (Validazione Multi-State):")
multi_cooking = {food: cotture for food, cotture in foods.items() if len(cotture) > 3}
sample_multi = list(multi_cooking.items())[:8]
for food, cotture in sample_multi:
    print(f"  • {food}:")
    for c in cotture:
        print(f"      - {c}")
print()

# Proposta batch iniziale
print(f"🎯 PROPOSTA PRIMO BATCH:")
print(f"  Categoria: Carni (Pollame + Bovino)")
print(f"  Strategia: 5-7 alimenti x tutte le cotture disponibili")
print()

# Seleziona alimenti carnivori per primo batch
carni_candidates = [
    (food, cotture) for food, cotture in foods.items() 
    if any(keyword in food.lower() for keyword in ['pollo', 'manzo', 'tacchino', 'agnello', 'carne'])
]

print(f"  Alimenti carne disponibili: {len(carni_candidates)}")
print()
print(f"  ALIMENTI CANDIDATI PRIMO BATCH:")
for i, (food, cotture) in enumerate(sorted(carni_candidates)[:10], 1):
    print(f"    {i}. {food}")
    print(f"       Cotture: {', '.join(cotture)}")
    print(f"       Combinazioni: {len(cotture)}")
print()

print("=" * 80)
print("PROSSIMO STEP:")
print("1. Selezionare batch da validare su alimentinutrizione.it")
print("2. Per ogni alimento+cottura, cercare esatta pagina")
print("3. Estrarre: calorie, proteine, carboidrati, grassi, unità")
print("4. Validare: URL, excerpt, stato cottura, coerenza dati")
print("5. Importare: solo record VERIFICATI")
print("=" * 80)
