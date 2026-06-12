#!/usr/bin/env python3
"""
FASE 6 — RECORD DECISION
Validazione rigorosa ogni record Pollo
"""

import json

# Carica extraction
with open('/tmp/batch1_pollo_extraction.json', 'r') as f:
    batch = json.load(f)

records = batch['records']

print("=" * 90)
print("🔍 FIELD VALIDATION — BATCH 1 POLLO")
print("=" * 90)
print()

# Validazione 1: Fat > 100g
invalid_fat = [r for r in records if r['fat_g'] > 100]
if invalid_fat:
    print(f"❌ RECORDS CON FAT > 100g ({len(invalid_fat)}):")
    for r in invalid_fat:
        print(f"  • {r['food_name']} + {r['cooking_state']}")
        print(f"    Fat: {r['fat_g']}g (IMPOSSIBILE su 100g)")
        r['verification_status'] = 'SCARTATO'
        r['import_eligibility'] = 'NO'
        r['notes'] += ' | SCARTATO: Fat > 100g è fisicamente impossibile'
    print()

# Validazione 2: Incoerenza cottura (con/senza pelle dovrebbe avere grassi diversi)
print("⚠️  INCOERENZE POSSIBILI (Con Pelle vs Senza Pelle):")
print()

# Raggruppa per cottura, confronta con/senza pelle
cotture_variants = {}
for r in records:
    cooking = r['cooking_state']
    if 'con pelle' in r['food_name'] or 'con pelle' in cooking:
        key = cooking.replace('con pelle', '').replace('senza pelle', '').strip()
        if key not in cotture_variants:
            cotture_variants[key] = {}
        cotture_variants[key]['con_pelle'] = r
    elif 'senza pelle' in r['food_name'] or 'senza pelle' in cooking:
        key = cooking.replace('con pelle', '').replace('senza pelle', '').strip()
        if key not in cotture_variants:
            cotture_variants[key] = {}
        cotture_variants[key]['senza_pelle'] = r

for cooking_key, variants in cotture_variants.items():
    if 'con_pelle' in variants and 'senza_pelle' in variants:
        r_con = variants['con_pelle']
        r_senza = variants['senza_pelle']
        
        fat_con = r_con['fat_g']
        fat_senza = r_senza['fat_g']
        
        # Con pelle dovrebbe avere più grassi
        if fat_con and fat_senza:
            if fat_con <= fat_senza:
                print(f"  ⚠️  {r_con['food_name']} + {cooking_key}:")
                print(f"      Con pelle: {fat_con}g")
                print(f"      Senza pelle: {fat_senza}g")
                print(f"      INCOERENZA: con pelle dovrebbe avere PIÙ grassi!")
                # Mark as ambiguous but not discard yet (potrebbe essere errore dati)
                r_con['verification_status'] = 'DA_VERIFICARE'
                r_senza['verification_status'] = 'DA_VERIFICARE'
                r_con['notes'] += ' | INCOERENZA: grasso con pelle <= senza pelle'
                r_senza['notes'] += ' | INCOERENZA: grasso senza pelle >= con pelle'
                print()

# Validazione 3: Proteina reasonableness
print("ℹ️  VALIDAZIONE PROTEINE (pollo 100g dovrebbe essere 20-40g tipicamente):")
print()

for r in records:
    prot = r['protein_g']
    if prot < 20 or prot > 100:
        status = '✓' if 20 <= prot <= 100 else '⚠️ SOSPETTO'
        print(f"  {status} {r['cooking_state']}: {prot}g")
        if prot > 100:
            r['verification_status'] = 'SCARTATO'
            r['import_eligibility'] = 'NO'
            r['notes'] += ' | SCARTATO: Proteine > 100g impossibile'
print()

# Riepilogo decisioni
print("=" * 90)
print("📋 RIEPILOGO DECISIONI")
print("=" * 90)
print()

verify_count = sum(1 for r in records if r['verification_status'] == 'DA_VERIFICARE')
scartato_count = sum(1 for r in records if r['verification_status'] == 'SCARTATO')
verified_count = sum(1 for r in records if r['verification_status'] == 'VERIFICATO')

print(f"  DA_VERIFICARE: {verify_count}")
print(f"  SCARTATO: {scartato_count}")
print(f"  VERIFICATO: {verified_count}")
print()

if scartato_count > 0:
    print("❌ RECORD SCARTATI:")
    for r in records:
        if r['verification_status'] == 'SCARTATO':
            print(f"  • {r['food_name']} + {r['cooking_state']}")
            print(f"    Motivo: {r['notes']}")
    print()

print("=" * 90)
print("AZIONE RICHIESTA:")
print("  Verificare i record AMBIGUO/INCOERENTI contro fonte alimentinutrizione.it")
print("  Fino a verifica, tutti rimangono import_eligibility = NO")
print("=" * 90)

# Salva validazione
batch['validation_results'] = {
    'total_records': len(records),
    'verified': verified_count,
    'unverified': verify_count,
    'discarded': scartato_count
}

with open('/tmp/batch1_pollo_validated.json', 'w') as f:
    json.dump(batch, f, indent=2, ensure_ascii=False)

print()
print("✅ Validazione salvata: /tmp/batch1_pollo_validated.json")

