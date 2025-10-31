#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DEMUCS_DIR="$SCRIPT_DIR"
PIPELINE_DIR="$REPO_ROOT/karaoke-pipeline"

echo "🚀 Deploying demucs-cpu to Akash with Grove+Neon integration"
echo ""

# Get Neon database URL securely from karaoke-pipeline .env
echo "[1/5] Retrieving Neon database URL..."
cd "$PIPELINE_DIR"
NEON_DATABASE_URL=$(dotenvx get NEON_DATABASE_URL)

if [ -z "$NEON_DATABASE_URL" ]; then
    echo "❌ Error: NEON_DATABASE_URL not found in environment"
    exit 1
fi

echo "✅ Retrieved Neon database URL (${#NEON_DATABASE_URL} chars)"
echo ""

# Create temporary deployment manifest
echo "[2/5] Creating deployment manifest with environment variables..."
TEMP_MANIFEST=$(mktemp /tmp/demucs-deploy-XXXXXX.yaml)
cp "$DEMUCS_DIR/deploy-akash.yaml" "$TEMP_MANIFEST"

# Add NEON_DATABASE_URL to the manifest - replace the commented line
# Escape special characters for sed
ESCAPED_NEON=$(printf '%s\n' "$NEON_DATABASE_URL" | sed 's/[\/&]/\\&/g')
sed -i "s|# - NEON_DATABASE_URL=.*|      - NEON_DATABASE_URL=$ESCAPED_NEON|" "$TEMP_MANIFEST"

echo "✅ Manifest created: $TEMP_MANIFEST"
echo ""

# Show what will be deployed
echo "[3/5] Deployment configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -A 20 "services:" "$TEMP_MANIFEST" | head -25
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "[4/5] Prerequisites for deployment:"
echo ""
echo "Set these environment variables:"
echo "  export AKASH_KEYNAME=mykey"
echo "  export AKASH_CHAINID=akashnet-2"
echo "  export AKASH_RPC=https://rpc.akashnet.net:443"
echo "  export AKASH_NODE=https://rpc.akashnet.net:443"
echo "  export AKASH_GAS=auto"
echo "  export AKASH_GAS_ADJUSTMENT=1.25"
echo ""

echo "[5/5] Deployment commands:"
echo ""
echo "A) CREATE new deployment:"
echo "   provider-services deployment create '$TEMP_MANIFEST'"
echo ""
echo "B) UPDATE existing deployment (if already deployed):"
echo "   provider-services deployment update '$TEMP_MANIFEST' --dseq <DSEQ>"
echo ""
echo "C) Check deployment status:"
echo "   provider-services deployment get --dseq <DSEQ>"
echo ""
echo "D) Shell into running container:"
echo "   provider-services lease-shell --dseq <DSEQ> --gseq 1 --oseq 1 --provider <PROVIDER>"
echo ""

echo "✅ Ready to deploy!"
echo ""
echo "📋 Manifest saved at: $TEMP_MANIFEST"
echo "⚠️  Keep this file until deployment is complete"
echo ""
echo "Next: Run the CREATE or UPDATE command above"
echo ""
