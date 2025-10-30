# BMI Service - Agent Guide

## Core Commands

• **Development**: `bun run dev` (starts server on port 3000)
• **Build**: `bun run build` (TypeScript compilation)
• **Test**: `curl -X POST http://localhost:3000/search/title -H "Content-Type: application/json" -d '{"title": "Espresso", "performer": "Sabrina Carpenter"}'`
• **Install Browsers**: `bunx playwright install chromium`

## Service Architecture

**Purpose**: Scrapes BMI's Songview database to extract ISWC codes and comprehensive work metadata for music industry identifiers.

**Core Dependencies**:
- **Playwright**: Browser automation for Songview scraping
- **Express**: HTTP server framework
- **TypeScript**: Type-safe development

## Key Patterns

**Scraping Strategy**:
```typescript
// Search by title + performer
const searchByTitle = async (title: string, performer?: string) => {
  const searchUrl = `https://www.bmi.com/songs/view/${encodeURIComponent(title)}`;
  // Parse BMI response for ISWC, writers, publishers
};

// Search by ISWC
const searchByISWC = async (iswc: string) => {
  const searchUrl = `https://www.bmi.com/songs/advanced_search?iswc=${iswc}`;
  // Extract comprehensive metadata
};
```

**Data Extraction**:
- **ISWC**: International Standard Musical Work Code
- **BMI/ASCAP Work IDs**: Internal identifiers
- **Writers**: Name, affiliation (BMI/ASCAP), IPI numbers
- **Publishers**: Name, affiliation, IPI, contact information
- **Ownership Shares**: Percentage controlled by each PRO
- **Status**: Reconciliation state (Reconciled/Under Review)

## Development Patterns

**Environment Setup**:
```bash
# Required for Playwright
export PLAYWRIGHT_BROWSERS_PATH=0
bunx playwright install chromium

# Run development server
bun run dev
```

**Testing Flow**:
1. Start dev server: `bun run dev`
2. Test title search: `curl -X POST http://localhost:3000/search/title`
3. Test ISWC search: `curl -X POST http://localhost:3000/search/iswc`
4. Health check: `curl http://localhost:3000/health`

## Critical Files

**Main Service**: `src/server.ts` - Express server with BMI scraping endpoints
**Scraping Logic**: `src/bmi-scraper.ts` - Playwright automation and parsing
**Types**: `src/types.ts` - TypeScript interfaces for BMI data

## Error Handling

**Common Issues**:
- **Network timeouts**: Increase Playwright navigation timeout
- **CAPTCHA detection**: Implement proxy rotation if needed
- **Search result parsing**: BMI may change HTML structure
- **Rate limiting**: Add delays between requests

**Debug Strategy**:
```typescript
// Enable Playwright debugging
const browser = await playwright.chromium.launch({
  headless: false,
  slowMo: 1000 // Slow down for debugging
});
```

## Integration Notes

**Use Case**: ISWC discovery when you have song title + performer, useful for validating against MLC publisher data and cross-referencing with ASCAP/SESAC.

**Output Format**: Returns structured JSON with all metadata needed for music rights tracking and publisher verification.

## Database Integration

**Neon PostgreSQL**: Service enriches music metadata in central database tables:
- `spotify_tracks`: Add ISWC, BMI work IDs
- `musicbrainz_works`: Cross-reference with PRO data
- `publishers`: New publisher records from BMI

**API Integration**: Called by Cloudflare Worker enrichment pipeline:
```typescript
// In cloudflare-worker-scraper
POST /enrich-bmi
{
  "track_id": "spotify_id",
  "title": "Song Title",
  "performer": "Artist Name"
}
```

## Deployment

**Docker**: `docker build -t bmi-service:v1.0 .`
**Akash**: Use `deploy-akash.yaml` with Playwright dependencies
**Environment**: Node.js 18+, Bun runtime

## Gotchas

**Playwright Requirements**:
- Must install Chromium browsers: `bunx playwright install chromium`
- Needs additional dependencies on Linux: `apt-get install -y libgtk-3-0 libnss3 libxss1 libasound2`

**BMI Website Changes**:
- Songview interface may change, requiring selector updates
- ISWC search vs title search return different result formats
- Handle "BMI Award Winning Song" prefixes in titles

**Data Quality**:
- BMI focuses on US repertoire, may not have international works
- Multiple versions of same song (live, remix) appear as separate entries
- Status field indicates reconciliation with other PROs
