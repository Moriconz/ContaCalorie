#!/bin/bash

echo "================================"
echo "🔍 TEST FONTI ALTERNATIVE"
echo "================================"
echo ""

# Test 1: CREA ufficiale
echo "1️⃣  CREA (www.crea.gov.it)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://www.crea.gov.it/")
echo "   Status: $STATUS"

# Cerca pagina dati
curl -s "https://www.crea.gov.it/" | grep -o '<a[^>]*href="[^"]*"[^>]*>[^<]*pollo\|<a[^>]*href="[^"]*"[^>]*>[^<]*aliment\|<a[^>]*href="[^"]*"[^>]*>[^<]*dati' | head -3
echo ""

# Test 2: BDA
echo "2️⃣  BDA (Banca Dati Alimenti)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://bda.inran.it/")
echo "   Status: $STATUS"
echo ""

# Test 3: USDA
echo "3️⃣  USDA FoodData Central"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://fdc.nal.usda.gov/")
echo "   Status: $STATUS"
echo ""

# Test 4: CREA dataset CSV/download
echo "4️⃣  CREA - Ricerca dataset pubblico"
curl -s "https://www.crea.gov.it/" | grep -i 'download\|dataset\|csv\|excel' | head -3
echo ""

# Test 5: Direct search CREA food
echo "5️⃣  CREA - Search API"
curl -s -o /dev/null -w "Status: %{http_code}\n" "https://www.crea.gov.it/web/alimenti-nutrizione/alimentazione-e-salute"
echo ""

echo "================================"
