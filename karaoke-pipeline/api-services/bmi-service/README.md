# BMI Songview Scraper Service

TypeScript service for scraping BMI's Songview database to extract ISWC codes and work metadata.

## Features

- 🔍 Search by **title + performer**
- 🆔 Search by **ISWC**
- 📋 Extract comprehensive work metadata:
  - ISWC
  - BMI/ASCAP Work IDs
  - Writers (name, affiliation, IPI)
  - Publishers (name, affiliation, IPI, contact info)
  - Performers
  - Ownership shares (% controlled)
  - Status (Reconciled/Under Review)

## API Endpoints

### `POST /search/title`

Search for a work by title and optional performer.

**Request:**
```json
{
  "title": "Espresso",
  "performer": "Sabrina Carpenter"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "ESPRESSO",
    "iswc": "T3247460062",
    "bmi_work_id": "67023628",
    "ascap_work_id": "924593983",
    "writers": [
      {
        "name": "CARPENTER SABRINA ANNLYNN",
        "affiliation": "BMI",
        "ipi": "00662307358"
      }
    ],
    "publishers": [...],
    "performers": ["SABRINA CARPENTER", ...],
    "shares": {
      "BMI": "50.01%",
      "ASCAP": "50%"
    },
    "status": "RECONCILED"
  }
}
```

### `POST /search/iswc`

Search for a work by ISWC code.

**Request:**
```json
{
  "iswc": "T3247460062"
}
```

**Response:** Same as `/search/title`

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 1234.56,
  "service": "bmi-songview-service",
  "version": "1.0.0"
}
```

## Local Development

```bash
# Install dependencies
bun install

# Install Playwright browsers
bunx playwright install chromium

# Run in dev mode
bun run dev

# Test the service
curl -X POST http://localhost:3000/search/title \
  -H "Content-Type: application/json" \
  -d '{"title": "Espresso", "performer": "Sabrina Carpenter"}'
```

## Docker Build & Deploy

```bash
# Build Docker image
docker build -t t3333chn0000/bmi-service:v1.0.0 .

# Push to Docker Hub
docker push t3333chn0000/bmi-service:v1.0.0

# Deploy to Akash
akash tx deployment create deploy-akash.yaml --from mykey
```

## Use Case: ISWC Discovery

BMI Songview is useful for finding ISWCs when you have:
- Song title + performer name
- Need to validate against MLC publisher data
- Cross-referencing with other PRO databases (ASCAP, SESAC)

The service returns comprehensive metadata that can be used for:
- Publisher verification
- Writer/composer identification
- Ownership share validation
- Cross-PRO reconciliation

## Notes

- BMI Songview doesn't support ISRC search (recordings)
- Returns first best match based on title/performer normalization
- Handles "BMI Award Winning Song" prefixes automatically
- Status indicates reconciliation state with other PROs
