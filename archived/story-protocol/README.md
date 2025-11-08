# Story Protocol Integration - Archived

## Overview
This directory contains the archived Story Protocol integration that was previously part of the karaoke-pipeline.

## Archived Date
2025-11-07

## What Was Removed
- **Processor**: `mint-story-derivatives.ts` - Step 13 processor for minting TikTok creator videos as Story Protocol IP Assets
- **Schema**: `story-protocol-metadata.ts` - Metadata schema for Story Protocol derivative videos
- **Migrations**: 
  - `052-add-story-protocol-lens-tracking.sql` - Added Story Protocol and Lens tracking columns
  - `055-fix-story-minting-view-robust-joins.sql` - View fixes for Story minting
  - `055-fix-story-view-simple.sql` - Simplified Story view

## What Was Modified
- **orchestrator.ts**: Removed Step 13 (Story Protocol Derivatives) and import
- **post-lens-feed.ts**: Removed Story Protocol references from metadata attributes
- **package.json**: Removed `@story-protocol/core-sdk` dependency
- **scripts/validation/check-pipeline-integrity.ts**: Removed Story Protocol-specific checks
- **AGENTS.md**: Updated BLOCK 4 documentation

## Database Columns (Still Present)
The following columns remain in the `tiktok_videos` table but are no longer actively used:
- `story_ip_id`
- `story_metadata_uri`
- `story_tx_hash`
- `story_license_terms_ids`
- `story_royalty_vault`
- `story_minted_at`
- `story_mint_attempts`
- `story_last_error`

## Why Removed
Story Protocol integration was removed from the pipeline to simplify the architecture. The integration can be re-added from this archive if needed in the future.

## Restoration Instructions
If you need to restore Story Protocol integration:

1. Copy files back to original locations:
   ```bash
   cp mint-story-derivatives.ts ../karaoke-pipeline/src/processors/
   cp story-protocol-metadata.ts ../karaoke-pipeline/src/schemas/
   cp 052-*.sql ../karaoke-pipeline/schema/migrations/
   cp 055-*.sql ../karaoke-pipeline/schema/migrations/
   ```

2. Restore package dependency:
   ```bash
   cd ../karaoke-pipeline
   bun add @story-protocol/core-sdk
   ```

3. Add import to orchestrator.ts:
   ```typescript
   import { processStoryDerivatives } from './mint-story-derivatives';
   ```

4. Add Step 13 back to the steps array in orchestrator.ts

5. Restore metadata attributes in post-lens-feed.ts

## Original Functionality
The Story Protocol integration allowed minting TikTok creator videos as derivative IP Assets with:
- 18% revenue share for creators
- 82% for original rights holders
- Commercial Remix license (PILFlavor)
- Metadata stored on Grove/IPFS
- Integration with Lens Protocol custom feed

## Related Documentation
- Story Protocol: https://docs.story.foundation
- Aeneid Testnet Explorer: https://aeneid.explorer.story.foundation
