#!/bin/bash

echo "📊 KUZU GRAPH ANALYSIS COMMANDS"
echo "================================"
echo ""
echo "To run the full analysis:"
echo "  bun run src/db/kuzu-analysis.ts"
echo ""
echo "To run specific Kuzu queries directly:"
echo ""

echo "1. Find orphaned recordings (no work):"
echo "bun -e \"import * as kuzu from 'kuzu'; const db = new kuzu.Database('kuzu-music.db'); const conn = new kuzu.Connection(db); const q = await conn.prepare('MATCH (r:Recording) WHERE NOT EXISTS {MATCH (r)-[:RECORDING_OF]->(:Work)} RETURN r.id, r.title LIMIT 20'); const result = await conn.execute(q); console.table(await result.getAll());\""
echo ""

echo "2. Works missing ISWCs:"
echo "bun -e \"import * as kuzu from 'kuzu'; const db = new kuzu.Database('kuzu-music.db'); const conn = new kuzu.Connection(db); const q = await conn.prepare('MATCH (w:Work) WHERE w.iswcs IS NULL OR SIZE(w.iswcs) = 0 RETURN w.id, w.title LIMIT 20'); const result = await conn.execute(q); console.table(await result.getAll());\""
echo ""

echo "3. Graph statistics:"
echo "bun -e \"import * as kuzu from 'kuzu'; const db = new kuzu.Database('kuzu-music.db'); const conn = new kuzu.Connection(db); const q = await conn.prepare('MATCH (n) RETURN labels(n)[1] as type, COUNT(n) as count'); const result = await conn.execute(q); console.table(await result.getAll());\""
echo ""

echo "4. Relationship counts:"
echo "bun -e \"import * as kuzu from 'kuzu'; const db = new kuzu.Database('kuzu-music.db'); const conn = new kuzu.Connection(db); const q = await conn.prepare('MATCH ()-[r:RECORDING_OF]->() RETURN COUNT(r) as recording_of'); const result = await conn.execute(q); console.table(await result.getAll());\""
echo ""

echo "5. Find recordings with both Spotify and Genius data:"
echo "bun -e \"import * as kuzu from 'kuzu'; const db = new kuzu.Database('kuzu-music.db'); const conn = new kuzu.Connection(db); const q = await conn.prepare('MATCH (r:Recording) WHERE r.spotify_id IS NOT NULL RETURN COUNT(r) as spotify_enriched'); const result = await conn.execute(q); console.table(await result.getAll());\""