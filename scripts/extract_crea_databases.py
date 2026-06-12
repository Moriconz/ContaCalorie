#!/usr/bin/env python3

import requests
from bs4 import BeautifulSoup
import re

url = "https://www.crea.gov.it/web/alimenti-e-nutrizione/banche-dati"

headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}

print("=" * 90)
print("🗄️  CREA — BANCHE DATI COMPOSIZIONE ALIMENTI")
print("=" * 90)
print()

try:
    resp = requests.get(url, headers=headers, timeout=15)
    soup = BeautifulSoup(resp.content, 'html.parser')
    
    # Estrai il contenuto principale
    main_content = soup.find('main') or soup.find('article') or soup.find(class_='content')
    
    if main_content:
        text = main_content.get_text()
    else:
        text = soup.get_text()
    
    # Cerca sezioni con parole chiave
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    print("📌 CONTENUTO DELLA PAGINA BANCHE DATI:\n")
    
    # Filtra righe rilevanti
    relevant = []
    for i, line in enumerate(lines):
        if any(kw in line.lower() for kw in ['composizione', 'tabella', 'alimento', 'nutrienti', 'alimenti', 'banca dati', 'database', 'download', 'accedi', 'tabelle']):
            if len(line) < 150:  # Evita righe troppo lunghe
                relevant.append(line)
    
    # Stampa le righe rilevanti (rimuovi duplicati)
    seen = set()
    for line in relevant[:30]:
        if line not in seen:
            print(f"  • {line}")
            seen.add(line)
    
    print()
    print("=" * 90)
    print("🔗 LINK NELLA PAGINA:\n")
    
    # Estrai link
    links = soup.find_all('a', href=True)
    link_texts = {}
    
    for link in links:
        href = link.get('href', '')
        text = link.get_text(strip=True)
        
        # Filtriamo per rilevanza
        if any(kw in text.lower() or kw in href.lower() for kw in ['composizione', 'tabella', 'alimento', 'download', 'accedi', 'banca', 'dati', 'database']):
            if text and len(text) < 100:
                if text not in link_texts:
                    link_texts[text] = href
    
    for text, href in sorted(link_texts.items())[:20]:
        full_url = href
        if not full_url.startswith('http'):
            if full_url.startswith('/'):
                full_url = 'https://www.crea.gov.it' + full_url
            else:
                full_url = 'https://www.crea.gov.it/web/alimenti-e-nutrizione/' + full_url
        
        print(f"  {text[:70]}")
        print(f"  → {full_url[:80]}\n")
    
    print("=" * 90)
    print("ℹ️  RIEPILOGO ALTERNATIVA")
    print("=" * 90)
    print()
    print("Opzioni disponibili:")
    print()
    print("1. ✅ FONTE CREA INTERNA: Mantenere i dati CREA attualmente nel database")
    print("   + Sono ufficiali CREA")
    print("   + Non richiedono scraping")
    print("   - Alcuni record hanno incoerenze logiche")
    print()
    print("2. 📥 CORREZIONE MANUALE: Tu mi fornisci i 4 record incoerenti")
    print("   + Preciso e verificato")
    print("   - Richiede ricerca manuale su CREA/alimentinutrizione")
    print()
    print("3. 🔍 DATABASE ESTERNO: Usare USDA FoodData Central (dati US, meno rilevante)")
    print("   + Accessibile via API")
    print("   - Dati USA, non italiani")
    print()

except Exception as e:
    print(f"Errore: {e}")

