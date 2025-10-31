#!/bin/bash
set -e

echo "🧪 Testing Quansic Service v2.0.0 with hrequests..."

# Check if environment is loaded
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env with your Quansic credentials before running tests"
    exit 1
fi

# Set Python path and run tests
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

echo "🔧 Installing dependencies with uv pip..."
uv pip install --system -e .

echo "🚀 Starting server for testing..."
python main.py &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 10

# Test health endpoint
echo "📊 Testing health endpoint..."
curl -f http://localhost:3000/health > /dev/null && echo "✅ Health check passed" || echo "❌ Health check failed"

# Test account pool status
echo "👥 Testing account pool status..."
curl -f http://localhost:3000/account-pool > /dev/null && echo "✅ Account pool check passed" || echo "❌ Account pool check failed"

# Test enrichment (requires valid Quansic credentials)
if [ -n "$QUANSIC_EMAIL" ] && [ -n "$QUANSIC_PASSWORD" ]; then
    echo "🎵 Testing artist enrichment..."
    curl -X POST http://localhost:3000/enrich \
        -H "Content-Type: application/json" \
        -d '{"isni": "0000000121331720", "force_reauth": true}' \
        > /dev/null 2>&1 && echo "✅ Enrichment test started" || echo "❌ Enrichment test failed"
else
    echo "⚠️  Skipping enrichment test - no credentials provided"
fi

# Kill test server
echo "🛑 Stopping test server..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "✅ Tests completed!"
