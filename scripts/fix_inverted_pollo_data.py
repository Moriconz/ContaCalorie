#!/usr/bin/env python3
"""
Correggi gli errori CHIARAMENTE INVERTITI nel database Pollo
"""

import re

with open('js/typicalValuesCREA_byCooking.js', 'r', encoding='utf-8') as f:
    content = f.read()

print("=" * 90)
print("🔧 CORREZIONE ERRORI INVERTITI — POLLO")
print("=" * 90)
print()

# Problema 1: Pollo fuso cotto al forno — grassi invertiti (62/64)
print("1️⃣  Pollo fuso, con pelle, cotto al forno: 62g grassi")
print("   Pollo fuso, senza pelle, cotto al forno: 64g grassi")
print("   ❌ ILLOGICO: senza pelle ha PIÙ grassi di con pelle")
print("   ✅ CORREGGI: Scambia i valori (con pelle 64g, senza pelle 62g)")
print()

# Find e sostituisci
pattern1a = r'("fuso, con pelle, cotta, al forno":\s*{[^}]*"grassi":\s*)62,'
replacement1a = r'\g<1>64,'

pattern1b = r'("fuso, senza pelle, cotto, al forno":\s*{[^}]*"grassi":\s*)64,'
replacement1b = r'\g<1>62,'

content_new = re.sub(pattern1a, replacement1a, content)
content_new = re.sub(pattern1b, replacement1b, content_new)

print("✓ Applicato fix 1")
print()

# Problema 2: Pollo sovracoscia cotto al forno — grassi MASSICCIAMENTE invertiti
print("2️⃣  Pollo sovracoscia, con pelle, cotto al forno: 8.3g grassi")
print("   Pollo sovracoscia, senza pelle, cotto al forno: 81g grassi")
print("   ❌ ILLOGICO: senza pelle ha 10x più grassi di con pelle")
print("   ✅ CORREGGI: Scambia i valori (con pelle 81g, senza pelle 8.3g)")
print()

pattern2a = r'("sovracoscia, con pelle, cotto, al forno":\s*{[^}]*"grassi":\s*)8\.3,'
replacement2a = r'\g<1>81,'

pattern2b = r'("sovracoscia, senza pelle, cotto, al forno":\s*{[^}]*"grassi":\s*)81,'
replacement2b = r'\g<1>8.3,'

content_new = re.sub(pattern2a, replacement2a, content_new)
content_new = re.sub(pattern2b, replacement2b, content_new)

print("✓ Applicato fix 2")
print()

# Salva
with open('js/typicalValuesCREA_byCooking.js', 'w', encoding='utf-8') as f:
    f.write(content_new)

print("=" * 90)
print("✅ CORREZIONI APPLICATE")
print("=" * 90)
print()
print("Modifiche:")
print("  • Pollo fuso cotto: 62↔64 (grassi)")
print("  • Pollo sovracoscia cotto: 8.3↔81 (grassi)")
print()

# Verifica
print("VERIFICA POST-CORREZIONE:")
print()

with open('js/typicalValuesCREA_byCooking.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'fuso, con pelle, cotta, al forno' in line:
        # Cerca la riga grassi
        for j in range(i, min(i+10, len(lines))):
            if '"grassi"' in lines[j]:
                print(f"  Fuso con pelle cotto: {lines[j].strip()}")
                break
    elif 'fuso, senza pelle, cotto, al forno' in line:
        for j in range(i, min(i+10, len(lines))):
            if '"grassi"' in lines[j]:
                print(f"  Fuso senza pelle cotto: {lines[j].strip()}")
                break
    elif 'sovracoscia, con pelle, cotto, al forno' in line:
        for j in range(i, min(i+10, len(lines))):
            if '"grassi"' in lines[j]:
                print(f"  Sovracoscia con pelle cotto: {lines[j].strip()}")
                break
    elif 'sovracoscia, senza pelle, cotto, al forno' in line:
        for j in range(i, min(i+10, len(lines))):
            if '"grassi"' in lines[j]:
                print(f"  Sovracoscia senza pelle cotto: {lines[j].strip()}")
                break

