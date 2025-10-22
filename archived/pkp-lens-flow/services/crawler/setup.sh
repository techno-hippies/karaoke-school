#!/bin/bash
# Setup Python environment for TikTok crawler using uv

set -e

echo "🐍 Setting up Python environment with uv..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv not found. Install it with: pip install uv"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    uv venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install dependencies using uv pip (much faster!)
echo "⚡ Installing dependencies with uv pip..."
uv pip install -r requirements.txt

echo "✅ Setup complete!"
echo ""
echo "To activate the environment:"
echo "  source services/crawler/.venv/bin/activate"
