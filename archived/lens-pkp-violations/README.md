# Archived: grc20_artists Violation Scripts

These scripts were archived because they violate the architectural rule:

**grc20_artists tables are WRITE-ONLY accumulation tables and should NEVER be read from.**

## Archived Files

- `create-artist-lens.ts` - Reads FROM grc20_artists (line 53)
- `mint-artist-pkps.ts` - Reads FROM grc20_artists (line 47)
- `update-artist-lens-pictures.ts` - Reads FROM grc20_artists (line 51)

## Why This Is Wrong

grc20_artists is the final consolidation table that accumulates data from:
- spotify_artists
- musicbrainz_artists
- quansic_artists
- genius_artists
- wikidata_artists

Any code that needs artist data should query these source tables directly, NOT grc20_artists.

## Refactoring Required

If these blockchain operations (Lens Protocol, PKP) are needed, they should:
1. Query from spotify_artists + JOIN the enrichment tables
2. OR run AFTER Step 13 consolidation and use a separate read-only view/materialized view
3. Never directly query grc20_artists within the pipeline

Archived: November 2025
