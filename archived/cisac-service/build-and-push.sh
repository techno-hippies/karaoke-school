#!/bin/bash

# CISAC Service Docker Build & Push Script

set -e

VERSION=${1:-v1.0.0}
IMAGE_NAME="t3333chn0000/cisac-service"
FULL_IMAGE="${IMAGE_NAME}:${VERSION}"

echo "🔨 Building ${FULL_IMAGE}..."
docker build -t "${FULL_IMAGE}" .

echo "🚀 Pushing ${FULL_IMAGE}..."
docker push "${FULL_IMAGE}"

echo "✅ Done! Image pushed: ${FULL_IMAGE}"
echo ""
echo "To deploy to Akash:"
echo "  1. Update deploy-akash.yaml with image: ${FULL_IMAGE}"
echo "  2. Run: akash tx deployment create deploy-akash.yaml --from YOUR_WALLET"
