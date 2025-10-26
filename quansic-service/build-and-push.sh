#!/bin/bash
# Build and push Quansic service to Docker Hub

set -e

VERSION=${1:-v1.0}
IMAGE_NAME="t3333chn0000/quansic-service:$VERSION"

echo "🔨 Building Docker image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

echo "🚀 Pushing to Docker Hub..."
docker push "$IMAGE_NAME"

echo "✅ Done! Image pushed: $IMAGE_NAME"
echo ""
echo "Next steps:"
echo "1. Update deploy-akash.yaml with image: $IMAGE_NAME"
echo "2. Deploy to Akash with: akash tx deployment create deploy-akash.yaml --from YOUR_WALLET"
