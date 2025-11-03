#!/bin/bash
# Validate Environment Setup
# Ensures dotenvx and all required .env files exist before running commands

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📋 Validating Karaoke School v1 Environment Setup..."
echo ""

# Check for root .env file
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo -e "${RED}❌ Missing root .env file${NC}"
  echo "   Location: $ROOT_DIR/.env"
  echo "   Solution: Create it from .env.example"
  echo "   Command: cp $ROOT_DIR/.env.example $ROOT_DIR/.env"
  exit 1
fi
echo -e "${GREEN}✅ Root .env exists${NC}"

# Check for karaoke-pipeline/.env
if [ ! -f "$ROOT_DIR/karaoke-pipeline/.env" ]; then
  echo -e "${RED}❌ Missing karaoke-pipeline/.env${NC}"
  echo "   Location: $ROOT_DIR/karaoke-pipeline/.env"
  exit 1
fi
echo -e "${GREEN}✅ karaoke-pipeline/.env exists${NC}"

# Check for app/.env (if exists)
if [ ! -f "$ROOT_DIR/app/.env" ]; then
  echo -e "${YELLOW}⚠️  app/.env not found (may not be required)${NC}"
else
  echo -e "${GREEN}✅ app/.env exists${NC}"
fi

# Check for required commands
if ! command -v dotenvx &> /dev/null; then
  echo -e "${RED}❌ dotenvx not installed${NC}"
  echo "   Install: npm install -g dotenvx"
  exit 1
fi
echo -e "${GREEN}✅ dotenvx installed${NC}"

# Check for bun
if ! command -v bun &> /dev/null; then
  echo -e "${RED}❌ bun not installed${NC}"
  echo "   Install: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi
echo -e "${GREEN}✅ bun installed${NC}"

# Check for node_modules in karaoke-pipeline
if [ ! -d "$ROOT_DIR/karaoke-pipeline/node_modules" ]; then
  echo -e "${YELLOW}⚠️  karaoke-pipeline/node_modules not found${NC}"
  echo "   Install: cd karaoke-pipeline && bun install"
fi

# Extract and validate key env vars using dotenvx
echo ""
echo "📝 Checking required environment variables..."

required_vars=(
  "NEON_PROJECT_ID"
  "NEON_DATABASE_URL"
  "SPOTIFY_CLIENT_ID"
  "SPOTIFY_CLIENT_SECRET"
)

missing_vars=()
for var in "${required_vars[@]}"; do
  value=$(cd "$ROOT_DIR" && dotenvx get "$var" 2>/dev/null || echo "")
  if [ -z "$value" ] || [ "$value" = "YOUR_"* ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo -e "${RED}❌ Missing required variables:${NC}"
  for var in "${missing_vars[@]}"; do
    echo "   - $var"
  done
  exit 1
fi

echo -e "${GREEN}✅ All required variables are set${NC}"

echo ""
echo -e "${GREEN}✅ Environment validation complete!${NC}"
echo ""
echo "You can now run commands from any directory:"
echo "  dotenvx run -- bun karaoke-pipeline/scripts/contracts/emit-segment-events.ts --limit=10"
echo ""
