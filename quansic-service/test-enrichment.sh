#!/bin/bash
# Test the new ISRC and ISWC enrichment endpoints

QUANSIC_URL="${1:-http://localhost:3000}"

echo "Testing Quansic enrichment endpoints..."
echo "Service URL: $QUANSIC_URL"
echo ""

# Test 1: ISRC enrichment (Bass Down Low)
echo "=== Test 1: ISRC Enrichment ==="
echo "ISRC: USUM71104634 (Bass Down Low - The Cataracs)"
curl -s -X POST "$QUANSIC_URL/enrich-recording" \
  -H "Content-Type: application/json" \
  -d '{
    "isrc": "USUM71104634",
    "spotify_track_id": "1Dfr9xzgKmp4XcKylFgx4H"
  }' | python3 -m json.tool

echo ""
echo "---"
echo ""

# Test 2: ISWC enrichment (Bass Down Low work)
echo "=== Test 2: ISWC Enrichment ==="
echo "ISWC: T9113870874 (Bass Down Low work)"
curl -s -X POST "$QUANSIC_URL/enrich-work" \
  -H "Content-Type: application/json" \
  -d '{
    "iswc": "T9113870874"
  }' | python3 -m json.tool

echo ""
echo "---"
echo ""

# Test 3: ISNI enrichment (The Cataracs)
echo "=== Test 3: ISNI Enrichment ==="
echo "ISNI: 000000046891516X (The Cataracs)"
curl -s -X POST "$QUANSIC_URL/enrich" \
  -H "Content-Type: application/json" \
  -d '{
    "isni": "000000046891516X",
    "musicbrainz_mbid": "50d9d3ee-8947-4079-9d73-b01dd3e71d8a"
  }' | python3 -m json.tool

echo ""
echo "Done!"
