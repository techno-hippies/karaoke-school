#!/bin/bash
set -e

echo "🐳 Building Quansic Service v2.0.2 with hrequests..."

# Build Docker image
docker build -t quansic-service:v2.0.2 .

echo "✅ Docker image built: quansic-service:v2.0.2"

# Tag for push
docker tag quansic-service:v2.0.2 t3333chn0000/quansic-service:v2.0.2

echo "🏷️ Tagged for Docker Hub"

# Push to Docker Hub (versioned tag only, avoid cache issues with "latest")
docker push t3333chn0000/quansic-service:v2.0.2

echo "🎉 Successfully pushed to Docker Hub!"
echo "📦 Pushed v2.0.2 tag"
echo "⚠️  Update deploy-akash.yaml with image: t3333chn0000/quansic-service:v2.0.2"
