#!/bin/bash
set -e

VERSION="${1:-v1.0.0}"
IMAGE="t3333chn0000/bmi-service:$VERSION"

echo "🔨 Building $IMAGE..."
docker build -t "$IMAGE" .

echo "📤 Pushing $IMAGE..."
docker push "$IMAGE"

echo "✅ Done! Update deploy-akash.yaml with: $IMAGE"
