#!/bin/bash
# Test if Quansic supports ISWC entity search

AKASH_URL="${1:-http://localhost:3001}"
ISWC="T-910.940.292-8"  # Nightcall by Kavinsky

echo "Testing ISWC enrichment on Quansic service..."
echo "ISWC: $ISWC (Nightcall)"
echo ""

# Test 1: Try ISWC entity search
echo "Test 1: Entity search with entityType=iswc"
curl -s -X POST "$AKASH_URL/search-iswc" \
  -H "Content-Type: application/json" \
  -d "{\"iswc\": \"$ISWC\"}" \
  | python3 -m json.tool

echo ""
echo "---"
echo ""

# Test 2: Alternative - search for work
echo "Test 2: Work lookup with ISWC"
curl -s -X POST "$AKASH_URL/enrich-work" \
  -H "Content-Type: application/json" \
  -d "{\"iswc\": \"$ISWC\", \"title\": \"Nightcall\"}" \
  | python3 -m json.tool
