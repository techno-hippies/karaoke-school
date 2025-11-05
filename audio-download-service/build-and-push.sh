#!/bin/bash
set -e

# Audio Download Service - Docker Build and Push Script
# Builds and pushes multi-arch image to Docker Hub

SERVICE_NAME="audio-download-service"
DOCKER_USERNAME="t3333chn0000"
VERSION="2.5.0"

echo "🏗️  Building ${SERVICE_NAME}:v${VERSION}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if logged in to Docker Hub
if ! docker info | grep -q "Username: ${DOCKER_USERNAME}"; then
  echo "⚠️  Not logged in to Docker Hub"
  echo "   Run: docker login"
  exit 1
fi

echo "✅ Logged in as ${DOCKER_USERNAME}"
echo ""

# Build image
echo "📦 Building image..."
docker build -t ${DOCKER_USERNAME}/${SERVICE_NAME}:v${VERSION} .

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo ""
echo "✅ Build complete"
echo ""

# Tag as latest
echo "🏷️  Tagging as latest..."
docker tag ${DOCKER_USERNAME}/${SERVICE_NAME}:v${VERSION} ${DOCKER_USERNAME}/${SERVICE_NAME}:latest

# Push versioned tag
echo ""
echo "📤 Pushing to Docker Hub..."
docker push ${DOCKER_USERNAME}/${SERVICE_NAME}:v${VERSION}

if [ $? -ne 0 ]; then
  echo "❌ Push failed"
  exit 1
fi

# Push latest tag
docker push ${DOCKER_USERNAME}/${SERVICE_NAME}:latest

echo ""
echo "✅ Successfully pushed:"
echo "   ${DOCKER_USERNAME}/${SERVICE_NAME}:v${VERSION}"
echo "   ${DOCKER_USERNAME}/${SERVICE_NAME}:latest"
echo ""
echo "📝 Update deploy-akash.yaml with: ${DOCKER_USERNAME}/${SERVICE_NAME}:v${VERSION}"
echo ""
