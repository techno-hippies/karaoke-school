#!/bin/bash
set -e

echo "🔧 Installing dependencies for artist-profile-service..."

# Install Bun (needed for pkp-lens-flow TypeScript scripts)
echo "📦 Installing Bun..."
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# Install Node dependencies for artist-profile-service
echo "📦 Installing artist-profile-service dependencies..."
cd /opt/render/project/src/artist-profile-service
npm install --production

# Install Bun dependencies for pkp-lens-flow
echo "📦 Installing pkp-lens-flow dependencies..."
cd /opt/render/project/src/pkp-lens-flow
bun install --production

# Install Python dependencies for TikTok crawler
echo "📦 Installing Python dependencies..."
cd /opt/render/project/src/pkp-lens-flow/services/crawler
pip3 install -r requirements.txt

echo "✅ Build complete!"
