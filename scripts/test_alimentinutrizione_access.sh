#!/bin/bash

echo "================================"
echo "🔍 TEST ACCESSO alimentinutrizione.it"
echo "================================"
echo ""

# Test 1: Home page
echo "TEST 1: Home page..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://www.alimentinutrizione.it/")
echo "  Status: $STATUS"
echo ""

# Test 2: Direct food URLs (vari pattern)
echo "TEST 2: Direct food URLs..."

URLS=(
  "https://www.alimentinutrizione.it/alimenti/pollo"
  "https://www.alimentinutrizione.it/alimenti/pollo-petto"
  "https://www.alimentinutrizione.it/alimenti/Pollo"
  "https://www.alimentinutrizione.it/?q=pollo"
  "https://www.alimentinutrizione.it/search?q=pollo"
)

for url in "${URLS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  echo "  $url → $STATUS"
done
echo ""

# Test 3: Prova con headers realistici
echo "TEST 3: Con User-Agent browser..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
  "https://www.alimentinutrizione.it/alimenti/pollo-petto")
echo "  Status: $STATUS"
echo ""

# Test 4: Estrai contenuto per vedere struttura
echo "TEST 4: Contenuto parziale alimentinutrizione.it..."
curl -s -H "User-Agent: Mozilla/5.0" "https://www.alimentinutrizione.it/" | head -c 500 | grep -o '<title>.*</title>'
echo ""

echo "================================"
echo "CONCLUSIONE TEST"
echo "================================"
