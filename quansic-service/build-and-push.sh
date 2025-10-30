#!/bin/bash
set -e

echo "🐳 Building Quansic Service v2.0.1 with hrequests..."

# Build Docker image
docker build -t quansic-service:v2.0.1 .

echo "✅ Docker image built: quansic-service:v2.0.1"

# Tag for push (update with your registry)
echo "📦 Tagging for registry..."
docker tag quansic-service:v2.0.1 your-dockerhub-username/quansic-service:v2.0.1

echo "🏗️ Build completed!"
echo "Next steps:"
echo "1. Push to registry: docker push your-dockerhub-username/quansic-service:v2.0.1"
echo "2. Update deploy-akash.yaml with your registry"
echo "3. Deploy: akash provider send-manifest deploy-akash.yaml --dseq YOUR_DEPLOYMENT --provider YOUR_PROVIDER"
