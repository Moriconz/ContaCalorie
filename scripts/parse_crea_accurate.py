#!/usr/bin/env python3
"""
Parsing accurato del database CREA JavaScript
"""

import re
import json
from collections import defaultdict

with open('js/typicalValuesCREA_byCooking.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Estrai il contenuto tra TYPICAL_VALUES_CREA_BY_COOKING = { ... }
pattern = r'export const TYPICAL_VALUES_CREA_BY_COOKING = (\{.*\});'
match = re.search(pattern, content, re.DOTALL)

if match:
    json_str = match.group(1)
    
    # Pulisci: rimuovi commenti JS, converte in JSON valido
    json_str = re.sub(r',\s*}', '}', json_str)  # Virgole finali
    json_str = re.sub(r',\s*\]', ']', json_str)  # Virgole finali in array
    
    # Tenta parsing
    try:
        data = json.loads(json_str)
        
        print("=" * 80)
        print("✅ DATABASE CREA PARSING ACCURATO")
        print("=" * 80 + "\n")
        
        # Analizza struttura
        total_foods = len(data)
        total_cooking_combos = sum(len(v) for v in data.values())
        
        print(f"📊 STRUTTURA:")
        print(f"  Alimenti unici: {total_foods}")
        print(f"  Combinazioni alimento×cottura: {total_cooking_combos}")
        print()
        
        # Distribuzione cotture
        cooking_dist = defaultdict(int)
        for food, cooking_methods in data.items():
            cooking_dist[len(cooking_methods)] += 1
        
        print(f"📈 COTTURE PER ALIMENTO:")
        for num in sorted(cooking_dist.keys()):
            count = cooking_dist[num]
            print(f"  {num} cottura/e: {count} alimenti")
        print()
        
        # Alimenti con più cotture
        multi_cooking = {
            food: list(methods.keys()) 
            for food, methods in data.items() 
            if len(methods) > 2
        }
        
        print(f"✅ ALIMENTI CON 3+ COTTURE ({len(multi_cooking)}):")
        for food, cookings in sorted(multi_cooking.items())[:10]:
            print(f"  • {food}:")
            for c in cookings[:5]:
                print(f"      {c}")
            if len(cookings) > 5:
                print(f"      ... e altri {len(cookings) - 5}")
        print()
        
        # Alimenti con 1-2 cotture (candidati verifica)
        single_double = [
            (f, list(m.keys())) 
            for f, m in data.items() 
            if len(m) <= 2
        ]
        
        print(f"⚠️  ALIMENTI CON 1-2 COTTURE ({len(single_double)}) — Candidati Verifica:")
        for food, cookings in sorted(single_double)[:15]:
            print(f"  • {food}: {', '.join(cookings)}")
        if len(single_double) > 15:
            print(f"  ... e altri {len(single_double) - 15}")
        print()
        
        # Campione di dati per validazione
        print(f"🔍 CAMPIONE DATI (Pollo):")
        if "Pollo" in data:
            pollo = data["Pollo"]
            for cooking, values in list(pollo.items())[:3]:
                print(f"  {cooking}:")
                print(f"    kcal: {values.get('kcal')}")
                print(f"    proteine: {values.get('proteine')}")
                print(f"    carboidrati: {values.get('carboidrati')}")
                print(f"    grassi: {values.get('grassi')}")
                print()
        
        # Proposta batch
        print("=" * 80)
        print("🎯 PIANO BATCH INIZIALE")
        print("=" * 80)
        print()
        print("BATCH 1 — CARNI BIANCHE & ROSSE")
        print("  Scopo: Verificare dati animali su alimentinutrizione.it")
        print("  Per ogni alimento: tutte le cotture disponibili nel CREA")
        print()
        
        # Seleziona carni
        carni = [
            (f, m) for f, m in data.items() 
            if any(x in f.lower() for x in ['pollo', 'manzo', 'tacchino', 'agnello', 'vitello'])
        ]
        
        print(f"  Alimenti carne trovati: {len(carni)}")
        print()
        
        batch_1 = sorted(carni)[:7]
        
        total_combos_batch1 = sum(len(methods) for _, methods in batch_1)
        
        print("  ALIMENTI BATCH 1:")
        for i, (food, methods) in enumerate(batch_1, 1):
            print(f"    {i}. {food}")
            print(f"       Cotture ({len(methods)}): {', '.join(list(methods.keys())[:3])}")
            if len(methods) > 3:
                print(f"                    ... + {len(methods)-3} altre")
        
        print()
        print(f"  TOTALE COMBINAZIONI: {total_combos_batch1}")
        print()
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON Parse Error: {e}")
        print("File non è JSON puro, contiene caratteri JS")
else:
    print("❌ Pattern non trovato")
