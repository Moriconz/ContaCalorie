#!/usr/bin/env python3
"""
Accedi a CREA Banche Dati e cerca database composizione alimenti
"""

import requests
from bs4 import BeautifulSoup
import re

url = "https://www.crea.gov.it/banche-dati"

headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}

print("=" * 90)
print("📊 CREA — BANCHE DATI COMPOSIZIONE ALIMENTI")
print("=" * 90)
print()

try:
    resp = requests.get(url, headers=headers, timeout=10)
    
    if resp.status_code == 200:
        print(f"✅ Pagina accessibile: {url}\n")
        
        soup = BeautifulSoup(resp.content, 'html.parser')
        
        # Cerca tutti i link
        links = soup.find_all('a', href=True)
        
        # Filtra per link che sembrano database
        data_links = []
        for link in links:
            href = link.get('href', '')
            text = link.get_text(strip=True)
            
            # Se contiene parole chiave, lo salviamo
            if any(kw in text.lower() or kw in href.lower() for kw in ['compos', 'alimentare', 'aliment', 'nutri', 'tabella', 'banca']):
                full_url = href if href.startswith('http') else ('https://www.crea.gov.it' + href if href.startswith('/') else url.rsplit('/', 1)[0] + '/' + href)
                data_links.append((text, full_url))
        
        # Rimuovi duplicati
        data_links = list(set(data_links))
        
        print(f"🔗 DATABASE/RISORSE TROVATI ({len(data_links)}):\n")
        
        for i, (text, href) in enumerate(sorted(data_links)[:15], 1):
            print(f"{i}. {text}")
            print(f"   {href}\n")
        
        # Prova ad accedere ai link più promettenti
        print("\n" + "=" * 90)
        print("🎯 TESTING ACCESSO DIRECT LINK")
        print("=" * 90 + "\n")
        
        # Filtra per link che contengono "composizione" o "tabelle"
        promising = [
            (t, h) for t, h in data_links 
            if any(x in t.lower() for x in ['composiz', 'tabella', 'nutri']) and 'http' in h
        ]
        
        for text, href in promising[:5]:
            resp2 = requests.head(href, headers=headers, timeout=5, allow_redirects=True)
            status = "✅" if resp2.status_code == 200 else "⚠️"
            print(f"{status} {text[:60]}")
            print(f"   {href[:80]}")
            print(f"   Status: {resp2.status_code}\n")
            
            # Se è un file Excel/CSV, potrebbe essere interessante
            if 'xls' in href.lower() or 'csv' in href.lower() or 'pdf' in href.lower():
                print(f"   📎 File: {resp2.headers.get('content-type', 'N/A')}\n")
        
    else:
        print(f"❌ Errore: Status {resp.status_code}")

except Exception as e:
    print(f"❌ Errore di connessione: {e}")

