#!/bin/bash

echo "Testing CURRENT endpoint (what service uses):"
echo "GET /api/q/lookup/recording/isrc/{isrc}"
echo ""

curl -s "https://jutf5ip5d9e9d0nvmpv2k9l6kk.ingress.d3akash.cloud/enrich-recording" \
  -H 'Content-Type: application/json' \
  -d '{"isrc":"USRC11902726"}' | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
print('Current endpoint returns:')
print(f'  iswc: {data[\"data\"][\"iswc\"]}')
print(f'  work_title: {data[\"data\"][\"work_title\"]}')
print(f'  composers: {data[\"data\"][\"composers\"]}')
print(f'  Has raw_data.recording.works? {\"works\" in data[\"data\"][\"raw_data\"].get(\"recording\", {})}')
"

echo ""
echo "---"
echo ""
echo "Testing NEW endpoint (with /works/0):"
echo "GET /api/q/lookup/recording/isrc/{isrc}/works/0"
echo ""

# We need to test this directly against Quansic (needs auth)
echo "This endpoint requires authentication - cannot test without session cookie"
echo "But you showed it returns: {\"iswc\": \"T9109402928\", \"title\": \"Nightcall\", ...}"
