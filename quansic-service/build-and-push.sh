#!/bin/bash
set -e

echo "🐳 Building Quansic Service v2.0.5 with hrequests + /lookup-artist endpoint..."

# Build Docker image with no-cache to force fresh build
docker build --no-cache -t quansic-service:v2.0.5 .

echo "✅ Docker image built: quansic-service:v2.0.5"

# Tag for push
docker tag quansic-service:v2.0.5 t3333chn0000/quansic-service:v2.0.5

echo "🏷️ Tagged for Docker Hub"

# Push to Docker Hub (versioned tag only, avoid cache issues with "latest")
docker push t3333chn0000/quansic-service:v2.0.5

echo "🎉 Successfully pushed to Docker Hub!"
echo "📦 Pushed v2.0.5 tag"
echo "⚠️  Update deploy-akash.yaml with image: t3333chn0000/quansic-service:v2.0.5"
