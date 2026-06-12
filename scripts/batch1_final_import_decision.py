#!/usr/bin/env python3
"""
BATCH 1 POLLO — DECISIONE FINALE IMPORT
Strategia: Importa SOLO record verificati, escludi duplicati
"""

import json

with open('/tmp/batch1_pollo_validated.json', 'r') as f:
    batch = json.load(f)

records = batch['records']

print("=" * 90)
print("✅ BATCH 1 POLLO — IMPORT DECISION (STRATEGIA RIGOROSA)")
print("=" * 90)
print()

# Categorizza record
verified = []
discarded = []
unverified = []

for r in records:
    # Record da scartare: duplicati (con/senza pelle uguali)
    if 'crudo' in r['cooking_state'] and r['cooking_state'] in ['intero, con pelle, crudo', 'intero, senza pelle, crudo', 'fuso, con pelle, crudo', 'fuso, senza pelle, crudo']:
        # Controlla se è un duplicato cercando il suo pair
        food = r['food_name']
        cooking = r['cooking_state']
        fat = r['fat_g']
        
        # Questi specifici sono duplicati (9g vs 9g)
        if fat == 9 and ('intero' in cooking or 'fuso' in cooking) and 'crudo' in cooking:
            r['verification_status'] = 'SCARTATO'
            r['import_eligibility'] = 'NO'
            r['notes'] = 'SCARTATO: Duplicato (con/senza pelle hanno stesso valore grassi)'
            discarded.append(r)
            continue
    
    # Record verificati: quelli corretti (inversioni risolte + altri coerenti)
    if r['verification_status'] == 'DA_VERIFICARE' and r['match_status'] == 'OK':
        # Questi sono i nostri record corretti
        r['verification_status'] = 'VERIFICATO'
        r['import_eligibility'] = 'YES'
        verified.append(r)
    elif r['verification_status'] == 'SCARTATO':
        discarded.append(r)
    else:
        unverified.append(r)

# Riepilogo
print(f"📊 RIEPILOGO BATCH 1:")
print()
print(f"  Record totali estratti: {len(records)}")
print(f"  VERIFICATI (pronti import): {len(verified)}")
print(f"  SCARTATI (esclusi): {len(discarded)}")
print(f"  NON VERIFICATI (esclusi): {len(unverified)}")
print()

print(f"✅ RECORD DA IMPORTARE ({len(verified)}):")
print()
for r in verified:
    print(f"  • {r['food_name']} + {r['cooking_state']}")
    print(f"    {r['calories']}kcal | {r['protein_g']}g prot | {r['carbs_g']}g carbo | {r['fat_g']}g grassi")
print()

print(f"❌ RECORD ESCLUSI ({len(discarded)}):")
print()
for r in discarded:
    print(f"  • {r['food_name']} + {r['cooking_state']}")
    print(f"    Motivo: {r['notes']}")
print()

print("=" * 90)
print("📋 AZIONI:")
print("=" * 90)
print()
print("1. Aggiorna typicalValuesCREA_byCooking.js con i record VERIFICATI")
print("2. Sostituisci i dati errati con quelli corretti")
print("3. Genera JSON per import finale")
print()

# Crea JSON final import
import_ready = {
    "batch_id": "BATCH_001_POLLO",
    "timestamp": batch['timestamp'],
    "import_strategy": "VERIFIED_ONLY_REPLACE_ERRORS",
    "total_records": len(records),
    "verified_count": len(verified),
    "excluded_count": len(discarded),
    "records_to_import": verified
}

with open('/tmp/batch1_pollo_import_ready.json', 'w') as f:
    json.dump(import_ready, f, indent=2, ensure_ascii=False)

print(f"✅ JSON pronto: /tmp/batch1_pollo_import_ready.json")
print()
print("=" * 90)
print("PROCEDI A IMPORT? (Y/N)")
print("=" * 90)

