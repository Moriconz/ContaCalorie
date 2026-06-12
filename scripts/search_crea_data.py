#!/usr/bin/env python3
"""
Cerca dataset pubblici CREA accessibili
"""

import requests
from bs4 import BeautifulSoup
import re

print("=" * 80)
print("🔍 RICERCA DATASET CREA PUBBLICI")
print("=" * 80)
print()

# Pagine CREA potenzialmente utili
crea_pages = [
    "https://www.crea.gov.it/",
    "https://www.crea.gov.it/web/alimenti-e-nutrizione",
    "https://www.crea.gov.it/web/alimenti-nutrizione/alimentazione-e-salute",
    "https://www.crea.gov.it/web/alimenti-nutrizione",
]

headers = {'User-Agent': 'Mozilla/5.0'}

print("1️⃣  Cercando pagine dataset CREA...")
print()

for url in crea_pages:
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            print(f"✓ {url}")
            
            # Cerca link a dataset/download
            soup = BeautifulSoup(resp.content, 'html.parser')
            
            # Cerca link che contengono parole chiave
            links = soup.find_all('a', href=True)
            dataset_links = [
                link for link in links 
                if any(kw in link.get('href', '').lower() for kw in ['download', 'dataset', 'csv', 'excel', 'dati', 'tabelle', 'file'])
            ]
            
            if dataset_links:
                print(f"  Dataset links trovati: {len(dataset_links)}")
                for link in dataset_links[:3]:
                    href = link.get('href', '')
                    text = link.get_text(strip=True)[:50]
                    print(f"    • {text}... → {href[:60]}")
            print()
    except Exception as e:
        pass

print()
print("2️⃣  Cercando referenze a 'Tabelle di Composizione'...")
print()

# Pagina specifica CREA tabelle
try:
    url = "https://www.crea.gov.it/web/alimenti-nutrizione/tabelle-di-composizione"
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code == 200:
        print(f"✓ TROVATA: Tabelle di Composizione")
        print(f"  URL: {url}")
        print()
        
        # Estrai content per cercare link a dati
        soup = BeautifulSoup(resp.content, 'html.parser')
        text = soup.get_text()
        
        # Cerca menzioni di pollo, dati, excel, csv
        if 'pollo' in text.lower():
            print("  ✓ Contiene dati su Pollo")
        if 'excel' in text.lower() or 'csv' in text.lower() or 'download' in text.lower():
            print("  ✓ Disponibili per download")
        
        # Cerca tutti i link
        links = soup.find_all('a', href=True)
        print(f"  Link totali: {len(links)}")
        
        # Filtra per link interessanti
        data_links = []
        for link in links:
            href = link.get('href', '')
            text = link.get_text(strip=True)
            if any(x in href.lower() or x in text.lower() for x in ['download', 'file', 'excel', 'csv', 'allegato']):
                data_links.append((text, href))
        
        if data_links:
            print(f"\n  Link download/dati ({len(data_links)}):")
            for text, href in data_links[:5]:
                if not href.startswith('http'):
                    href = f"https://www.crea.gov.it{href}" if href.startswith('/') else f"https://www.crea.gov.it/web/alimenti-nutrizione/{href}"
                print(f"    • {text[:50]} → {href[:70]}")
except Exception as e:
    print(f"  Pagina non trovata o errore: {e}")

print()
print("=" * 80)
print("3️⃣  Verifica accesso diretto file")
print("=" * 80)
print()

# Prova URL diretti comuni per CREA dataset
test_files = [
    "https://www.crea.gov.it/documents/20126/0/Tabelle+di+composizione+alimenti.xls",
    "https://www.crea.gov.it/web/alimenti-nutrizione/composizione-alimenti",
    "https://www.crea.gov.it/web/alimenti-nutrizione/-/composizione-alimenti-lista",
]

for url in test_files:
    try:
        resp = requests.head(url, headers=headers, timeout=5, allow_redirects=True)
        status = resp.status_code
        if status == 200:
            print(f"✓ {url} → {status}")
        elif status in [301, 302, 303, 307, 308]:
            print(f"↗ {url} → {status} (redirect)")
        else:
            print(f"✗ {url} → {status}")
    except Exception as e:
        print(f"✗ {url} → Errore")

