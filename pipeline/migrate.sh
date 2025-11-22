#!/bin/bash
set -e

echo "🔄 Running database migrations..."
echo ""

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

cd "$(dirname "$0")"

for file in schema/*.sql; do
  echo "   📄 Applying $(basename "$file")..."
  psql "$DATABASE_URL" -f "$file" -v ON_ERROR_STOP=1 > /dev/null 2>&1
  echo "   ✅ $(basename "$file") applied successfully"
done

echo ""
echo "✨ All migrations applied successfully!"
echo ""
