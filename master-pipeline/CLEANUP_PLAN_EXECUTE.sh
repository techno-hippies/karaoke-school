#!/usr/bin/env bash
#
# Master Pipeline Cleanup - Executable Script
# Run this after reviewing CLEANUP_ANALYSIS.md
#

set -e

echo "======================================================================"
echo "Master Pipeline Cleanup"
echo "======================================================================"
echo ""
echo "⚠️  WARNING: This will delete files. Review changes before running!"
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Phase 1: Delete Confirmed Dead Code
# ====================================================================
echo ""
echo "[Phase 1] Deleting obsolete V1 contract files..."
echo ""

echo "❌ Deleting modules/artists/01-register-artist.ts (V1 contract, superseded)"
rm -v modules/artists/01-register-artist.ts

echo "❌ Deleting modules/segments/02-register-segment.ts (V1 contract, superseded)"
rm -v modules/segments/02-register-segment.ts

echo ""
echo "[Phase 1] Deleting test files mixed in production code..."
echo ""

echo "❌ Deleting modules/creators/test-mint.ts (test script)"
rm -v modules/creators/test-mint.ts

echo "❌ Deleting services/test-segment-selector.ts (test script)"
rm -v services/test-segment-selector.ts

echo "❌ Deleting services/test-spotdl.ts (test script)"
rm -v services/test-spotdl.ts

echo ""
echo "[Phase 1] Deleting superseded workflows..."
echo ""

echo "❌ Deleting workflows/add-video-segment.ts (superseded by auto-create-segment)"
rm -v workflows/add-video-segment.ts

# Phase 2: Archive One-Time Utilities
# ====================================================================
echo ""
echo "[Phase 2] Archiving one-time utility scripts..."
echo ""

echo "📦 Creating archived/utilities directory..."
mkdir -p archived/utilities

echo "→ Moving scripts/update-artist-avatar.ts"
mv -v scripts/update-artist-avatar.ts archived/utilities/

echo "→ Moving scripts/set-metadata-uri.ts"
mv -v scripts/set-metadata-uri.ts archived/utilities/

# Create README for archived utilities
cat > archived/utilities/README.md << 'EOF'
# Archived Utilities

These are one-time scripts that were used during development but are not part of the regular pipeline.

## Scripts

### update-artist-avatar.ts
Updates an existing Lens account's metadata to include avatar from Genius.
**Usage**: One-time fix for artists missing avatars.

### set-metadata-uri.ts
Sets Lens account metadata URI directly.
**Usage**: Manual metadata updates when needed.

## Why Archived?

These scripts are not part of the automated pipeline but may be useful for manual operations or debugging.
EOF

echo "✅ Created archived/utilities/README.md"

# Phase 3: Clean Up Empty Directories
# ====================================================================
echo ""
echo "[Phase 3] Cleaning up empty directories..."
echo ""

# Remove workflows directory if empty
if [ -z "$(ls -A workflows)" ]; then
    echo "🗑️  Removing empty workflows directory"
    rmdir -v workflows
else
    echo "ℹ️  workflows directory not empty, keeping"
fi

# Phase 4: Git Operations
# ====================================================================
echo ""
echo "[Phase 4] Git operations..."
echo ""

echo "📝 Staging deleted files..."
git add -u

echo "📝 Staging new archived files..."
git add archived/

echo ""
echo "======================================================================"
echo "✅ Cleanup Complete!"
echo "======================================================================"
echo ""
echo "Summary of changes:"
echo "  • Deleted 6 obsolete files"
echo "  • Archived 2 utility scripts"
echo "  • Cleaned up empty directories"
echo ""
echo "Next steps:"
echo "  1. Review changes: git status"
echo "  2. Check diff: git diff --cached"
echo "  3. Commit: git commit -m 'chore: Clean up obsolete files and archive utilities'"
echo ""
echo "Files ready to commit!"
echo ""
