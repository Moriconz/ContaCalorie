#!/usr/bin/env python3
"""
VALIDAZIONE RIGOROSA BATCH 1 POLLO
Scarta TUTTI i dati palesemente errati
Importa SOLO dati che superano sanità nutrizionale
"""

import json

with open('/tmp/batch1_pollo_validated.json', 'r') as f:
    batch = json.load(f)

records = batch['records']

print("=" * 90)
print("🔬 VALIDAZIONE RIGOROSA — SANITÀ NUTRIZIONALE")
print("=" * 90)
print()

def is_valid_nutrition(record):
    """Verifica se i macronutrienti sono plausibili per 100g"""
    
    kcal = record['calories']
    prot = record['protein_g']
    carbs = record['carbs_g']
    fat = record['fat_g']
    
    issues = []
    
    # Check 1: Nessun nutriente > 100g per 100g alimento
    if fat > 100:
        issues.append(f"Grassi {fat}g > 100g (impossibile)")
    if prot > 100:
        issues.append(f"Proteine {prot}g > 100g (impossibile)")
    if carbs > 100:
        issues.append(f"Carboidrati {carbs}g > 100g (impossibile)")
    
    # Check 2: Prot + Grassi ≤ ~95g (lasciando acqua, fibra, ceneri)
    macro_sum = prot + fat
    if macro_sum > 95:
        issues.append(f"Prot({prot}g) + Grassi({fat}g) = {macro_sum}g > 95g (impossibile)")
    
    # Check 3: Calorie coerenti (approssimazione)
    # kcal ≈ prot*4 + carbs*4 + fat*9 (±20%)
    if kcal > 0:
        expected_kcal = prot * 4 + carbs * 4 + fat * 9
        diff_pct = abs(kcal - expected_kcal) / expected_kcal * 100 if expected_kcal > 0 else 0
        if diff_pct > 20:
            issues.append(f"Calorie incoerenti: {kcal} kcal vs {expected_kcal} atteso (diff {diff_pct:.0f}%)")
    
    return len(issues) == 0, issues

# Valida
valid_records = []
invalid_records = []

for r in records:
    is_valid, issues = is_valid_nutrition(r)
    
    if is_valid:
        r['verification_status'] = 'VERIFICATO'
        r['import_eligibility'] = 'YES'
        valid_records.append(r)
    else:
        r['verification_status'] = 'SCARTATO'
        r['import_eligibility'] = 'NO'
        r['notes'] = f"SCARTATO: {' | '.join(issues)}"
        invalid_records.append(r)

print(f"✅ RECORD VALIDI ({len(valid_records)}):")
print()
for r in valid_records:
    print(f"  ✓ {r['food_name']} + {r['cooking_state']}")
    print(f"    {r['calories']}kcal | {r['protein_g']}g prot | {r['carbs_g']}g carbo | {r['fat_g']}g grassi")
    prot_fat = r['protein_g'] + r['fat_g']
    print(f"    Validazione: Prot+Grassi={prot_fat}g (<95g ✓)")
    print()

print(f"❌ RECORD INVALIDI ({len(invalid_records)}):")
print()
for r in invalid_records:
    print(f"  ✗ {r['food_name']} + {r['cooking_state']}")
    print(f"    {r['calories']}kcal | {r['protein_g']}g prot | {r['carbs_g']}g carbo | {r['fat_g']}g grassi")
    print(f"    Motivo: {r['notes']}")
    print()

# Summary
print("=" * 90)
print("📊 RIEPILOGO FINALE BATCH 1")
print("=" * 90)
print()
print(f"  Totale record estratti: {len(records)}")
print(f"  Record VALIDI (pronto import): {len(valid_records)}")
print(f"  Record INVALIDI (scartati): {len(invalid_records)}")
print(f"  Percentuale import: {len(valid_records)/len(records)*100:.0f}%")
print()

if len(valid_records) == 0:
    print("⚠️  ATTENZIONE: Nessun record valido nel Batch 1")
    print("    Questo indica che il database Pollo nel CREA ha molti dati errati")
    print("    Consiglio: Procedi a Batch 2 (altre categorie)")
    print("              Ritorna a Batch 1 dopo verifica manuale CREA")
else:
    print(f"✅ {len(valid_records)} record pronti per import")

# Export
import_data = {
    "batch_id": "BATCH_001_POLLO",
    "timestamp": batch['timestamp'],
    "validation_strategy": "STRICT_NUTRITIONAL_SANITY",
    "total_extracted": len(records),
    "valid_count": len(valid_records),
    "invalid_count": len(invalid_records),
    "records_to_import": valid_records,
    "records_discarded": invalid_records
}

with open('/tmp/batch1_pollo_final_validated.json', 'w') as f:
    json.dump(import_data, f, indent=2, ensure_ascii=False)

print()
print(f"✅ Dati salvati: /tmp/batch1_pollo_final_validated.json")

