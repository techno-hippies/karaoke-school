#!/bin/bash
#
# Scrape all videos for a TikTok creator in batches
# Handles Cloudflare Workers free tier subrequest limits
#
# Usage: ./scripts/scrape-all.sh creator_handle [batch_size]
#

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <tiktok_handle> [batch_size]"
  echo "Example: $0 idazeile 30"
  exit 1
fi

HANDLE=$1
BATCH_SIZE=${2:-30}  # Default to 30 videos per batch
WORKER_URL="https://tiktok-scraper.deletion-backup782.workers.dev"

echo "🎬 Scraping all videos for @$HANDLE"
echo "   Batch size: $BATCH_SIZE videos"
echo ""

# First, get the total video count
echo "📊 Fetching profile..."
PROFILE=$(curl -s "$WORKER_URL/scrape/$HANDLE?limit=1")
echo "$PROFILE" | jq -r '
  if .creator then
    "   Creator: \(.creator.nickname)\n   Followers: \(.creator.followers)\n   Total videos in DB: \(.stats.totalVideos)"
  else
    "   Error: \(.error // "Unknown error")"
  end
'

TOTAL_VIDEOS=$(echo "$PROFILE" | jq -r '.creator.followers // 0')

if [ "$TOTAL_VIDEOS" -eq 0 ]; then
  echo "⚠️  Could not determine total videos. Proceeding with batch scraping..."
fi

echo ""
echo "🔄 Starting batch scrape..."
echo ""

OFFSET=0
BATCH_NUM=1
TOTAL_SCRAPED=0

while true; do
  echo "📦 Batch $BATCH_NUM (videos $OFFSET-$((OFFSET + BATCH_SIZE)))"

  RESPONSE=$(curl -s "$WORKER_URL/scrape/$HANDLE?limit=$BATCH_SIZE" 2>&1)

  # Check if successful
  if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    SCRAPED=$(echo "$RESPONSE" | jq -r '.scraped.videos')
    INSERTED=$(echo "$RESPONSE" | jq -r '.scraped.inserted')

    echo "   ✓ Fetched: $SCRAPED videos"
    echo "   ✓ Inserted: $INSERTED videos"

    TOTAL_SCRAPED=$((TOTAL_SCRAPED + SCRAPED))

    # If we got fewer videos than requested, we're done
    if [ "$SCRAPED" -lt "$BATCH_SIZE" ]; then
      echo ""
      echo "✅ Scraping complete! Reached end of video list."
      break
    fi
  else
    ERROR=$(echo "$RESPONSE" | jq -r '.error // .message // "Unknown error"')
    echo "   ✗ Error: $ERROR"

    # If error contains "not found" or we got 0 videos, we're done
    if [[ "$ERROR" =~ "not found" ]] || [ "$SCRAPED" -eq 0 ]; then
      echo ""
      echo "✅ Scraping complete!"
      break
    fi

    echo "   Continuing to next batch..."
  fi

  OFFSET=$((OFFSET + BATCH_SIZE))
  BATCH_NUM=$((BATCH_NUM + 1))

  # Rate limiting - 2 second delay between batches
  echo "   Waiting 2s..."
  sleep 2
  echo ""
done

echo ""
echo "📊 Final stats:"
curl -s "$WORKER_URL/stats/$HANDLE" | jq

echo ""
echo "🎉 Done! Scraped videos from @$HANDLE"
