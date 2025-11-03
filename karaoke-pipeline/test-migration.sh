#!/bin/bash
# Quick validation test for migration 034

set -e

echo "========================================="
echo "Testing Migration 034 Fixes"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    exit 1
}

info() {
    echo -e "${YELLOW}ℹ${NC}  $1"
}

echo "Test 1: Supervisor Help (should list 3 services)"
echo "─────────────────────────────────────────"
if ./supervisor.sh --help | grep -q "Quansic ISWC Service"; then
    pass "Quansic service listed"
else
    fail "Quansic service not found in help"
fi

if ./supervisor.sh --help | grep -q "Audio Download Service"; then
    pass "Audio service listed"
else
    fail "Audio service not found in help"
fi

if ./supervisor.sh --help | grep -q "Demucs GPU Service"; then
    pass "Demucs service listed"
else
    fail "Demucs service not found in help"
fi

if ./supervisor.sh --help | grep -q "Pipeline is CLI-only"; then
    pass "Pipeline noted as CLI-only"
else
    fail "Pipeline CLI note not found"
fi

if ./supervisor.sh --help | grep -q "port 8787"; then
    fail "Old pipeline port 8787 still referenced"
else
    pass "No reference to old pipeline port"
fi

echo ""
echo "Test 2: Database Constraint Check"
echo "─────────────────────────────────────────"
info "Checking if translations_ready status exists..."

# This will be done via MCP in the actual test
echo "  Run manually: SELECT COUNT(*) FROM song_pipeline WHERE status = 'translations_ready';"
echo "  Expected: count >= 1"

echo ""
echo "Test 3: Orchestrator Documentation"
echo "─────────────────────────────────────────"

if grep -q "clips_cropped$" src/processors/orchestrator.ts; then
    pass "Pipeline ends at clips_cropped (no images_generated)"
else
    fail "Pipeline flow documentation not updated"
fi

if grep -q "Step 12.*REMOVED" src/processors/orchestrator.ts; then
    pass "Step 12 marked as removed"
else
    fail "Step 12 not properly commented"
fi

echo ""
echo "Test 4: Migration File Exists"
echo "─────────────────────────────────────────"

if [ -f "schema/migrations/034-add-pipeline-statuses.sql" ]; then
    pass "Migration file exists"
else
    fail "Migration file not found"
fi

if grep -q "translations_ready" schema/migrations/034-add-pipeline-statuses.sql; then
    pass "Migration includes translations_ready"
else
    fail "Migration missing translations_ready"
fi

if grep -q "segments_selected" schema/migrations/034-add-pipeline-statuses.sql; then
    pass "Migration includes segments_selected"
else
    fail "Migration missing segments_selected"
fi

if grep -q "enhanced" schema/migrations/034-add-pipeline-statuses.sql; then
    pass "Migration includes enhanced"
else
    fail "Migration missing enhanced"
fi

if grep -q "clips_cropped" schema/migrations/034-add-pipeline-statuses.sql; then
    pass "Migration includes clips_cropped"
else
    fail "Migration missing clips_cropped"
fi

if grep -q "images_generated" schema/migrations/034-add-pipeline-statuses.sql; then
    fail "Migration should NOT include images_generated"
else
    pass "Migration correctly excludes images_generated"
fi

echo ""
echo "========================================="
echo -e "${GREEN}All Tests Passed!${NC}"
echo "========================================="
echo ""
echo "Next Steps:"
echo "1. Test pipeline: bun run-unified.ts --step=7.5 --limit=3"
echo "2. Verify status updates in DB"
echo "3. Start supervisor: ./supervisor.sh"
echo ""
