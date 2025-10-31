#!/bin/bash
set -e

echo "🐳 Building Quansic Service v2.0.1 with hrequests..."

# Build Docker image
docker build -t quansic-service:v2.0.1 .

echo "✅ Docker image built: quansic-service:v2.0.1"

# Tag for push
docker tag quansic-service:v2.0.1 t3333chn0000/quansic-service:v2.0.1
docker tag quansic-service:v2.0.1 t3333chn0000/quansic-service:latest

echo "🏷️ Tagged for Docker Hub"

# Push to Docker Hub
docker push t3333chn0000/quansic-service:v2.0.1
docker push t3333chn0000/quansic-service:latest

echo "🎉 Successfully pushed to Docker Hub!"
echo "📦 Pushed both v2.0.1 and latest tags"
echo "🚀 For Akash GUI: Just redeploy with the same deploy-akash.yaml (uses latest tag)"
