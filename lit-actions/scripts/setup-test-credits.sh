#!/bin/bash

# Setup test credits for audio-processor test
# This script grants credits and unlocks the test segment

set -e

# Configuration
CREDITS_CONTRACT="0x6de183934E68051c407266F877fafE5C20F74653"
RPC_URL="https://sepolia.base.org"
GENIUS_ID="378195"
SEGMENT_ID="verse-1"
SOURCE="1" # ContentSource.Genius

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🎫 Setting up test credits for audio-processor test"
echo "=================================================="

# Get test wallet address from .env PRIVATE_KEY
if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ PRIVATE_KEY not set. Add it to your .env file:"
  echo "   PRIVATE_KEY=40e9ed2b556418dc70af5b3512c03cd40b462872f444f71c18c35aedf9434d24"
  exit 1
fi

# Get wallet address
TEST_WALLET=$(cast wallet address --private-key "$PRIVATE_KEY")
echo -e "${GREEN}✓${NC} Test wallet: $TEST_WALLET"

# Check current credit balance
CREDITS=$(cast call $CREDITS_CONTRACT "getCredits(address)(uint256)" $TEST_WALLET --rpc-url $RPC_URL)
echo -e "${GREEN}✓${NC} Current credits: $CREDITS"

# Check if segment already owned
OWNED=$(cast call $CREDITS_CONTRACT \
  "ownsSegment(address,uint8,string,string)(bool)" \
  $TEST_WALLET $SOURCE "$GENIUS_ID" "$SEGMENT_ID" \
  --rpc-url $RPC_URL)

if [ "$OWNED" = "true" ]; then
  echo -e "${GREEN}✓${NC} Segment already owned! Ready to test."
  exit 0
fi

echo -e "${YELLOW}⚠${NC}  Segment not owned. Need to unlock it..."

# Check if user has credits
if [ "$CREDITS" = "0" ]; then
  echo ""
  echo "❌ No credits available. You need to either:"
  echo ""
  echo "Option 1: Grant credits via PKP (requires owner/PKP permissions)"
  echo "  cast send $CREDITS_CONTRACT \\"
  echo "    \"grantCredits(address,uint16,string)\" \\"
  echo "    $TEST_WALLET 5 \"test_setup\" \\"
  echo "    --rpc-url $RPC_URL \\"
  echo "    --private-key <OWNER_OR_PKP_PRIVATE_KEY>"
  echo ""
  echo "Option 2: Purchase credits with ETH"
  echo "  cast send $CREDITS_CONTRACT \\"
  echo "    \"purchaseCreditsETH(uint8)\" 0 \\"
  echo "    --value 0.0002ether \\"
  echo "    --rpc-url $RPC_URL \\"
  echo "    --private-key $PRIVATE_KEY"
  echo ""
  exit 1
fi

# User has credits - unlock the segment
echo -e "${GREEN}✓${NC} Have $CREDITS credits. Unlocking segment..."

cast send $CREDITS_CONTRACT \
  "useCredit(uint8,string,string)" \
  $SOURCE "$GENIUS_ID" "$SEGMENT_ID" \
  --rpc-url $RPC_URL \
  --private-key "$PRIVATE_KEY"

echo -e "${GREEN}✓${NC} Segment unlocked!"
echo ""
echo "✅ Setup complete! You can now deploy and test your lit actions:"
echo "   bun run scripts/upload-lit-action.mjs study/sat-it-back-v1.js 'Sat It Back v1'"
