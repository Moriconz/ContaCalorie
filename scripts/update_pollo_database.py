#!/usr/bin/env python3
"""
AGGIORNA il database Pollo con dati corretti
"""

import re
import json

# Dati corretti
POLLO_CORRECTED = {
    "intero, con pelle, crudo": {"kcal": 165, "proteine": 18.0, "carboidrati": 0, "grassi": 9.9},
    "intero, con pelle, cotto, al forno": {"kcal": 209, "proteine": 26.0, "carboidrati": 0, "grassi": 10.6},
    "intero, senza pelle, crudo": {"kcal": 121, "proteine": 20.9, "carboidrati": 0, "grassi": 3.6},
    "intero, senza pelle, cotto, al forno": {"kcal": 165, "proteine": 31.0, "carboidrati": 0, "grassi": 3.6},
    "intero, con pelle, cotto, arrosto": {"kcal": 253, "proteine": 27.0, "carboidrati": 0, "grassi": 15.1},
    "intero, senza pelle, cotto, arrosto": {"kcal": 209, "proteine": 28.2, "carboidrati": 0, "grassi": 9.9},
    "ala, con pelle, crudo": {"kcal": 213, "proteine": 18.3, "carboidrati": 0, "grassi": 15.9},
    "ala, con pelle, cotta, al forno": {"kcal": 269, "proteine": 27.7, "carboidrati": 0, "grassi": 16.6},
    "fuso, con pelle, crudo": {"kcal": 209, "proteine": 18.3, "carboidrati": 0, "grassi": 15.1},
    "fuso, con pelle, cotto, al forno": {"kcal": 253, "proteine": 26.3, "carboidrati": 0, "grassi": 15.1},
    "fuso, senza pelle, crudo": {"kcal": 134, "proteine": 20.9, "carboidrati": 0, "grassi": 5.3},
    "fuso, senza pelle, cotto, al forno": {"kcal": 184, "proteine": 27.5, "carboidrati": 0, "grassi": 7.7},
    "petto, crudo": {"kcal": 105, "proteine": 23.1, "carboidrati": 0, "grassi": 0.8},
    "petto, cotto, in padella": {"kcal": 200, "proteine": 29.0, "carboidrati": 0, "grassi": 9.0},
    "sovracoscia, con pelle, crudo": {"kcal": 209, "proteine": 18.3, "carboidrati": 0, "grassi": 15.1},
    "sovracoscia, con pelle, cotto, al forno": {"kcal": 253, "proteine": 26.3, "carboidrati": 0, "grassi": 15.1},
    "sovracoscia, senza pelle, crudo": {"kcal": 134, "proteine": 20.9, "carboidrati": 0, "grassi": 5.3},
    "sovracoscia, senza pelle, cotto, al forno": {"kcal": 184, "proteine": 27.5, "carboidrati": 0, "grassi": 7.7},
}

# Leggi database
with open('js/typicalValuesCREA_byCooking.js', 'r', encoding='utf-8') as f:
    content = f.read()

print("=" * 90)
print("🔄 AGGIORNAMENTO DATABASE POLLO")
print("=" * 90)
print()

# Aggiorna ogni cottura
updated_count = 0
for cooking, values in POLLO_CORRECTED.items():
    # Pattern: "COOKING": { ... "kcal": XXX, ... "grassi": YYY, ...
    # Cerchiamo la sezione specifica per questa cottura
    
    # Crea pattern che cattura la sezione pollo + cottura
    pattern = rf'("Pollo":\s*{{[^}}]*?"' + re.escape(cooking) + r'":\s*{{[^}}]*?"kcal":\s*)\d+\.?\d*,'
    
    if re.search(pattern, content):
        # Sostituisci kcal
        content = re.sub(
            rf'("' + re.escape(cooking) + r'":\s*{{[^}}]*?"kcal":\s*)\d+\.?\d*,',
            rf'\g<1>{values["kcal"]},',
            content
        )
        
        # Sostituisci proteine
        content = re.sub(
            rf'("' + re.escape(cooking) + r'":\s*{{[^}}]*?"proteine":\s*)\d+\.?\d*,',
            rf'\g<1>{values["proteine"]},',
            content
        )
        
        # Sostituisci carboidrati
        content = re.sub(
            rf'("' + re.escape(cooking) + r'":\s*{{[^}}]*?"carboidrati":\s*)\d+\.?\d*,',
            rf'\g<1>{values["carboidrati"]},',
            content
        )
        
        # Sostituisci grassi
        content = re.sub(
            rf'("' + re.escape(cooking) + r'":\s*{{[^}}]*?"grassi":\s*)\d+\.?\d*,',
            rf'\g<1>{values["grassi"]},',
            content
        )
        
        updated_count += 1
        print(f"✓ {cooking}")
        print(f"  → {values['kcal']} kcal | {values['proteine']}g prot | {values['grassi']}g grassi")
    else:
        print(f"✗ {cooking} (non trovato nel database)")

print()
print(f"✅ Aggiornati {updated_count}/{len(POLLO_CORRECTED)} record")
print()

# Salva
with open('js/typicalValuesCREA_byCooking.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("=" * 90)
print("✅ DATABASE AGGIORNATO")
print("=" * 90)

