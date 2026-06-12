#!/usr/bin/env python3
"""
Estrai informazioni sui dati nutrizionali dalla pagina CREA Alimenti e Nutrizione
"""

import requests
from bs4 import BeautifulSoup
import re

url = "https://www.crea.gov.it/web/alimenti-e-nutrizione"

headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}

print("=" * 90)
print("🥗 CREA ALIMENTI E NUTRIZIONE")
print("=" * 90)
print()

try:
    resp = requests.get(url, headers=headers, timeout=10)
    soup = BeautifulSoup(resp.content, 'html.parser')
    
    # Estrai testo
    text = soup.get_text()
    
    # Cerca menzioni di tabelle, database, download
    print("📋 MENZIONI DI RISORSE NEL TESTO:")
    print()
    
    if 'tabella' in text.lower():
        print("  ✓ Contiene riferimenti a 'tabelle'")
    if 'database' in text.lower() or 'banca dati' in text.lower():
        print("  ✓ Contiene riferimenti a 'database' o 'banca dati'")
    if 'excel' in text.lower() or 'csv' in text.lower() or 'download' in text.lower():
        print("  ✓ Contiene riferimenti a download/file")
    
    print()
    print("🔗 LINK PRINCIPALI SULLA PAGINA:")
    print()
    
    links = soup.find_all('a', href=True)
    
    # Filtra link interessanti
    interesting_links = {}
    for link in links:
        href = link.get('href', '')
        text = link.get_text(strip=True)
        
        # Parole chiave
        keywords = ['tabella', 'composizione', 'alimento', 'nutrizione', 'dati', 'download', 'file', 'banca']
        
        if any(kw in text.lower() or kw in href.lower() for kw in keywords):
            if text and len(text) < 100:  # Evita testi molto lunghi
                full_url = href if href.startswith('http') else ('https://www.crea.gov.it' + href if href.startswith('/') else None)
                if full_url:
                    interesting_links[text] = full_url
    
    # Stampa link unici
    for text, href in sorted(set(interesting_links.items()))[:20]:
        print(f"  • {text[:70]}")
        if href:
            print(f"    {href[:80]}")
        print()
    
    # Cerca sezione con informazioni su tabelle composizione
    print()
    print("=" * 90)
    print("📑 RICERCA SEZIONE 'TABELLE DI COMPOSIZIONE' O SIMILE")
    print("=" * 90)
    print()
    
    # Trova h2, h3 che contengono 'composizione' o 'tabella'
    headings = soup.find_all(['h2', 'h3', 'h1'])
    
    composition_sections = []
    for heading in headings:
        text = heading.get_text(strip=True)
        if any(kw in text.lower() for kw in ['composizione', 'tabella', 'alimenti', 'nutrienti']):
            composition_sections.append(text)
    
    if composition_sections:
        print("Sezioni trovate:")
        for section in composition_sections[:10]:
            print(f"  • {section}")
    else:
        print("Nessuna sezione specificamente intitolata trovata")
    
    print()
    print("=" * 90)
    print("💡 OPZIONI")
    print("=" * 90)
    print()
    print("1. Se CREA ha dati scaricabili: cerchiamo i file direttamente")
    print("2. Se CREA ha una ricerca online: proviamo a cercare 'pollo'")
    print("3. Se niente di cui sopra: usiamo i dati attuali + correzione manuale")

except Exception as e:
    print(f"❌ Errore: {e}")

