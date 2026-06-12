#!/usr/bin/env python3
"""
BATCH 1 — POLLO
Estrazione dati CREA per validazione
Ruolo: Data Ingestion & Validation Agent
"""

import json
import re
from datetime import datetime

with open('js/typicalValuesCREA_byCooking.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Parse database
pattern = r'export const TYPICAL_VALUES_CREA_BY_COOKING = (\{.*\});'
match = re.search(pattern, content, re.DOTALL)
json_str = match.group(1)
json_str = re.sub(r',\s*}', '}', json_str)
json_str = re.sub(r',\s*\]', ']', json_str)
data = json.loads(json_str)

# Batch 1: POLLO
pollo_variants = [k for k in data.keys() if 'Pollo' in k]

print("=" * 90)
print("📦 BATCH 1 EXTRACTION — POLLO")
print("=" * 90)
print()

batch_records = []

for variant_name in sorted(pollo_variants):
    variant_data = data[variant_name]
    
    print(f"🍗 {variant_name}")
    print(f"   Cotture disponibili: {len(variant_data)}")
    print()
    
    for cooking, values in variant_data.items():
        record = {
            "food_name": variant_name,
            "source_food_name": variant_name,
            "cooking_state": cooking,
            "calories": values.get('kcal'),
            "protein_g": values.get('proteine'),
            "carbs_g": values.get('carboidrati'),
            "fat_g": values.get('grassi'),
            "fiber_g": values.get('fibra'),
            "sugars_g": values.get('zuccheri'),
            "reference_unit": "per 100g",
            "source_name": "CREA (typicalValuesCREA_byCooking.js)",
            "source_url": "N/A - Database locale",
            "source_excerpt": json.dumps(values),
            "code": values.get('code'),
            "match_status": "OK",  # Database interno, match garantito
            "verification_status": "DA_VERIFICARE",  # Deve essere validato contro alimentinutrizione.it
            "import_eligibility": "NO",  # Non importare finché non verificato
            "notes": "CREA data da database locale. Verifica necessaria contro alimentinutrizione.it ufficiale."
        }
        
        # Validazione campi obbligatori
        required = ['calories', 'protein_g', 'carbs_g', 'fat_g']
        missing = [f for f in required if not record[f] and record[f] != 0]
        
        if missing:
            record['match_status'] = 'CAMPO NON TROVATO'
            record['notes'] += f" CAMPI MANCANTI: {', '.join(missing)}"
        
        # Sanity check
        if record['fat_g'] and record['fat_g'] > 100:
            record['match_status'] = 'AMBIGUO'
            record['notes'] += f" ALERT: Grassi {record['fat_g']}g (>100g per 100g = impossibile)"
        
        batch_records.append(record)
        
        print(f"  ✓ {cooking}")
        print(f"    {record['calories']} kcal | {record['protein_g']}g prot | {record['carbs_g']}g carbo | {record['fat_g']}g grassi")
        print()

print()
print("=" * 90)
print(f"📊 RIEPILOGO BATCH 1")
print("=" * 90)
print(f"  Alimenti Pollo trovati: {len(pollo_variants)}")
print(f"  Record totali: {len(batch_records)}")
print()

# Conteggi status
ok_count = sum(1 for r in batch_records if r['match_status'] == 'OK')
missing_count = sum(1 for r in batch_records if r['match_status'] == 'CAMPO NON TROVATO')
ambiguo_count = sum(1 for r in batch_records if r['match_status'] == 'AMBIGUO')

print(f"  Match Status:")
print(f"    OK: {ok_count}")
print(f"    CAMPO NON TROVATO: {missing_count}")
print(f"    AMBIGUO: {ambiguo_count}")
print()

# Verification status
ver_count = sum(1 for r in batch_records if r['verification_status'] == 'VERIFICATO')
unver_count = sum(1 for r in batch_records if r['verification_status'] == 'DA_VERIFICARE')
scartato_count = sum(1 for r in batch_records if r['verification_status'] == 'SCARTATO')

print(f"  Verification Status:")
print(f"    DA_VERIFICARE: {unver_count}")
print(f"    VERIFICATO: {ver_count}")
print(f"    SCARTATO: {scartato_count}")
print()

# Import eligibility
eligible = sum(1 for r in batch_records if r['import_eligibility'] == 'YES')
not_eligible = sum(1 for r in batch_records if r['import_eligibility'] == 'NO')

print(f"  Import Eligibility:")
print(f"    YES (Pronto import): {eligible}")
print(f"    NO (Richiede verifica): {not_eligible}")
print()

print("=" * 90)
print("NEXT STEPS:")
print("1. Verificare ogni record AMBIGUO o con CAMPO NON TROVATO")
print("2. Validare match_status = OK contra alimentinutrizione.it (se accessibile)")
print("3. Se verificato, impostare verification_status = VERIFICATO, import_eligibility = YES")
print("4. Esportare solo record con import_eligibility = YES per import finale")
print("=" * 90)

# Salva JSON
output = {
    "batch_id": "BATCH_001_POLLO",
    "batch_name": "Pollo - Validazione CREA",
    "timestamp": datetime.now().isoformat(),
    "source": "CREA (typicalValuesCREA_byCooking.js)",
    "foods_count": len(pollo_variants),
    "records_count": len(batch_records),
    "records": batch_records
}

with open('/tmp/batch1_pollo_extraction.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print()
print(f"✅ JSON salvato: /tmp/batch1_pollo_extraction.json")

