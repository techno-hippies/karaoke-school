#!/bin/bash
###############################################################################
# Complete Creator Pipeline
#
# Runs full pipeline for a TikTok creator:
# 1. Mint PKP on Lit Protocol
# 2. Create Lens account
# 3. Scrape TikTok videos
# 4. Identify songs
# 5. Process videos (download, match, separate, upload)
# 6. Mint Story Protocol derivatives
# 7. Post to Lens
#
# Usage:
#   ./scripts/process-creator-full.sh @brookemonk_ brookemonk
#   ./scripts/process-creator-full.sh @karaokeking99
#
# Arguments:
#   $1 - TikTok handle (with or without @)
#   $2 - Lens handle (optional, defaults to TikTok handle without @ and _)
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Missing TikTok handle${NC}"
    echo ""
    echo "Usage:"
    echo "  ./scripts/process-creator-full.sh @brookemonk_ brookemonk"
    echo "  ./scripts/process-creator-full.sh @karaokeking99"
    echo ""
    echo "Arguments:"
    echo "  \$1 - TikTok handle (with or without @)"
    echo "  \$2 - Lens handle (optional, defaults to TikTok handle without @ and _)"
    exit 1
fi

TIKTOK_HANDLE="$1"
LENS_HANDLE="${2:-}"

# Clean handles
CLEAN_TIKTOK=$(echo "$TIKTOK_HANDLE" | sed 's/@//')
if [ -z "$LENS_HANDLE" ]; then
    # Default: remove @ and _ from TikTok handle
    LENS_HANDLE=$(echo "$CLEAN_TIKTOK" | sed 's/_//g')
fi

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}           COMPLETE CREATOR PIPELINE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}TikTok Handle:${NC} @$CLEAN_TIKTOK"
echo -e "${GREEN}Lens Handle:${NC} @$LENS_HANDLE"
echo ""

# Navigate to master-pipeline directory
cd "$(dirname "$0")/.."

###############################################################################
# Step 1: Mint PKP
###############################################################################

echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 1: Mint PKP on Lit Protocol${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

bun run modules/creators/01-mint-pkp.ts \
    --tiktok-handle "@$CLEAN_TIKTOK" \
    --lens-handle "$LENS_HANDLE"

echo -e "\n${GREEN}✓ PKP minted${NC}"

###############################################################################
# Step 2: Create Lens Account
###############################################################################

echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 2: Create Lens Account${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

bun run modules/creators/02-create-lens.ts \
    --tiktok-handle "@$CLEAN_TIKTOK" \
    --lens-handle "$LENS_HANDLE"

echo -e "\n${GREEN}✓ Lens account created${NC}"

###############################################################################
# Step 3: Scrape Videos
###############################################################################

echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 3: Scrape TikTok Videos${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

bun run modules/creators/03-scrape-videos.ts \
    --tiktok-handle "@$CLEAN_TIKTOK"

echo -e "\n${GREEN}✓ Videos scraped${NC}"

###############################################################################
# Step 4: Identify Songs
###############################################################################

echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 4: Identify Songs${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

bun run modules/creators/04-identify-songs.ts \
    --tiktok-handle "@$CLEAN_TIKTOK"

echo -e "\n${GREEN}✓ Songs identified${NC}"

###############################################################################
# Step 5: Process Videos (Interactive Loop)
###############################################################################

echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Step 5: Process Videos${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Load identified videos to get video IDs
IDENTIFIED_FILE="data/creators/$CLEAN_TIKTOK/identified_videos.json"

if [ ! -f "$IDENTIFIED_FILE" ]; then
    echo -e "${RED}Error: Identified videos file not found: $IDENTIFIED_FILE${NC}"
    exit 1
fi

# Extract video IDs (both copyrighted and copyright-free)
VIDEO_IDS=$(cat "$IDENTIFIED_FILE" | jq -r '.copyrighted[].id, .copyright_free[].id' | head -10)

if [ -z "$VIDEO_IDS" ]; then
    echo -e "${YELLOW}No videos found to process${NC}"
    exit 0
fi

# Count videos
VIDEO_COUNT=$(echo "$VIDEO_IDS" | wc -l)
echo -e "${GREEN}Found $VIDEO_COUNT videos to process${NC}"
echo ""

# Ask user which videos to process
echo -e "${YELLOW}Process videos? (options: all, none, <number>, or comma-separated IDs)${NC}"
echo -e "  all    - Process all $VIDEO_COUNT videos"
echo -e "  none   - Skip video processing"
echo -e "  <num>  - Process first N videos (e.g., 3)"
echo -e "  <ids>  - Process specific video IDs (e.g., 7123,7456,7789)"
echo ""
read -p "Choice [all]: " PROCESS_CHOICE
PROCESS_CHOICE=${PROCESS_CHOICE:-all}

# Determine which videos to process
if [ "$PROCESS_CHOICE" = "none" ]; then
    echo -e "${YELLOW}Skipping video processing${NC}"
    exit 0
elif [ "$PROCESS_CHOICE" = "all" ]; then
    VIDEOS_TO_PROCESS="$VIDEO_IDS"
elif [[ "$PROCESS_CHOICE" =~ ^[0-9]+$ ]]; then
    VIDEOS_TO_PROCESS=$(echo "$VIDEO_IDS" | head -n "$PROCESS_CHOICE")
else
    # Assume comma-separated IDs
    VIDEOS_TO_PROCESS=$(echo "$PROCESS_CHOICE" | tr ',' '\n')
fi

PROCESS_COUNT=$(echo "$VIDEOS_TO_PROCESS" | wc -l)
echo -e "${GREEN}Processing $PROCESS_COUNT videos${NC}\n"

# Process each video
VIDEO_NUM=1
for VIDEO_ID in $VIDEOS_TO_PROCESS; do
    echo -e "\n${CYAN}─────────────────────────────────────────────────────────${NC}"
    echo -e "${CYAN}Processing video $VIDEO_NUM/$PROCESS_COUNT: $VIDEO_ID${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────────${NC}\n"

    # Step 5: Process video
    echo -e "${YELLOW}▸ Downloading and processing...${NC}"
    bun run modules/creators/05-process-video.ts \
        --tiktok-handle "@$CLEAN_TIKTOK" \
        --video-id "$VIDEO_ID"

    # Get video hash from manifest
    VIDEO_HASH=$(cat "data/creators/$CLEAN_TIKTOK/videos/"*/manifest.json 2>/dev/null | \
                 jq -r "select(.tiktokVideoId == \"$VIDEO_ID\") | .videoHash" | head -1)

    if [ -z "$VIDEO_HASH" ]; then
        echo -e "${RED}Error: Could not find video hash for video $VIDEO_ID${NC}"
        ((VIDEO_NUM++))
        continue
    fi

    echo -e "${GREEN}✓ Video processed (hash: $VIDEO_HASH)${NC}"

    # Step 6: Mint Story Protocol derivative
    echo -e "\n${YELLOW}▸ Minting Story Protocol derivative...${NC}"
    bun run modules/creators/06-mint-derivative.ts \
        --tiktok-handle "@$CLEAN_TIKTOK" \
        --video-hash "$VIDEO_HASH"

    echo -e "${GREEN}✓ Story Protocol derivative minted${NC}"

    # Step 7: Post to Lens
    echo -e "\n${YELLOW}▸ Posting to Lens...${NC}"
    bun run modules/creators/07-post-lens.ts \
        --tiktok-handle "@$CLEAN_TIKTOK" \
        --video-hash "$VIDEO_HASH"

    echo -e "${GREEN}✓ Posted to Lens${NC}"

    ((VIDEO_NUM++))
done

###############################################################################
# Complete
###############################################################################

echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ CREATOR PIPELINE COMPLETE! ✨${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${GREEN}Creator:${NC} @$CLEAN_TIKTOK"
echo -e "${GREEN}Lens:${NC} @$LENS_HANDLE"
echo -e "${GREEN}Videos Processed:${NC} $PROCESS_COUNT"
echo ""
echo -e "${CYAN}Data Directory:${NC} data/creators/$CLEAN_TIKTOK"
echo -e "${CYAN}Feed Address:${NC} 0x5941b291E69069769B8e309746b301928C816fFa"
echo ""
