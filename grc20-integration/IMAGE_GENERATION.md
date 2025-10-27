# Artist Image Generation for GRC-20

## Overview

Artists require images before minting to GRC-20. To avoid copyright issues, we generate **derivative works** using fal.ai's Seedream model.

## Process

### 1. Source Images

Get original images from:
- **Genius**: `genius_artists.image_url`
- **Wikipedia**: Via Wikidata ID
- **Spotify**: `spotify_artists.images` (lower quality)

### 2. Generate Derivative via fal.ai Seedream

```typescript
import { FalImageService } from './services/fal-image';

const falService = new FalImageService({
  apiKey: process.env.FAL_KEY
});

// Generate abstract derivative
const result = await falService.generateDerivativeCoverArt(
  geniusImageUrl,
  42 // seed for reproducibility
);

console.log('Generated image:', result.images[0].url);
```

**What it does:**
- Transforms into abstract painting
- Maintains general composition/shapes
- Creates derivative work (copyright-free)
- Costs ~$0.01-0.05 per image

### 3. Store in Database

```sql
INSERT INTO artist_generated_images (
  genius_artist_id,
  source_image_url,
  source_type,
  generated_image_url,
  prompt,
  seed,
  status
) VALUES (
  1177, -- Taylor Swift
  'https://genius.com/images/taylor-swift-123.jpg',
  'genius',
  'https://fal.media/files/generated-abc123.jpg',
  'Convert this album cover into an abstract painting...',
  42,
  'completed'
);
```

### 4. Optional: Upload to Grove/Irys

For permanent storage (immutable URI):

```typescript
// Upload to Irys (Grove)
const groveUri = await uploadToGrove(result.images[0].url);

// Update DB
await sql`
  UPDATE artist_generated_images
  SET grove_uri = ${groveUri},
      status = 'uploaded_to_grove'
  WHERE id = ${imageId}
`;
```

### 5. Manual Approval

Review generated images before using in GRC-20:

```sql
-- Approve image for GRC-20 use
UPDATE artist_generated_images
SET is_approved = true,
    approved_at = NOW()
WHERE id = 123;

-- Query approved images ready for minting
SELECT
  agi.genius_artist_id,
  ga.name,
  agi.generated_image_url,
  agi.grove_uri
FROM artist_generated_images agi
JOIN genius_artists ga ON ga.genius_artist_id = agi.genius_artist_id
WHERE agi.is_approved = true
  AND agi.status = 'completed'
  AND agi.is_used_in_grc20 = false;
```

## Database Schema

```sql
CREATE TABLE artist_generated_images (
  id SERIAL PRIMARY KEY,
  genius_artist_id INTEGER NOT NULL REFERENCES genius_artists(genius_artist_id),

  -- Source
  source_image_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('genius', 'wikipedia', 'spotify', 'manual')),

  -- Generated
  generated_image_url TEXT NOT NULL UNIQUE,
  grove_uri TEXT,

  -- Generation params
  prompt TEXT NOT NULL,
  seed INTEGER,

  -- Status & quality
  status TEXT NOT NULL DEFAULT 'pending',
  is_approved BOOLEAN DEFAULT false,
  is_used_in_grc20 BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  minted_at TIMESTAMPTZ
);
```

## Batch Generation Script

```typescript
import postgres from 'postgres';
import { FalImageService } from './services/fal-image';

const sql = postgres(process.env.DATABASE_URL);
const falService = new FalImageService();

async function generateMissingArtistImages(limit = 100) {
  // Find artists without approved images
  const artists = await sql`
    SELECT ga.genius_artist_id, ga.name, ga.image_url
    FROM genius_artists ga
    LEFT JOIN artist_generated_images agi
      ON agi.genius_artist_id = ga.genius_artist_id
      AND agi.is_approved = true
    WHERE ga.image_url IS NOT NULL
      AND agi.id IS NULL
    LIMIT ${limit}
  `;

  console.log(`Generating images for ${artists.length} artists...`);

  for (const artist of artists) {
    try {
      console.log(`\n🎨 ${artist.name}...`);

      // Generate derivative
      const result = await falService.generateDerivativeCoverArt(
        artist.image_url,
        artist.genius_artist_id // Use artist ID as seed for consistency
      );

      // Store in DB
      await sql`
        INSERT INTO artist_generated_images (
          genius_artist_id,
          source_image_url,
          source_type,
          generated_image_url,
          prompt,
          seed,
          status,
          generated_at
        ) VALUES (
          ${artist.genius_artist_id},
          ${artist.image_url},
          'genius',
          ${result.images[0].url},
          'Abstract artistic transformation for derivative work',
          ${result.seed},
          'completed',
          NOW()
        )
      `;

      console.log(`   ✓ Generated: ${result.images[0].url.slice(0, 60)}...`);

      // Rate limiting (fal.ai allows ~10 req/min)
      await new Promise(resolve => setTimeout(resolve, 6000));

    } catch (error) {
      console.error(`   ✗ Failed: ${error.message}`);

      // Log failure
      await sql`
        INSERT INTO artist_generated_images (
          genius_artist_id,
          source_image_url,
          source_type,
          status,
          error_message
        ) VALUES (
          ${artist.genius_artist_id},
          ${artist.image_url},
          'genius',
          'failed',
          ${error.message}
        )
        ON CONFLICT (genius_artist_id) WHERE status = 'failed' DO NOTHING
      `;
    }
  }

  await sql.end();
}

// Run
generateMissingArtistImages(100);
```

## Cost Estimation

- **fal.ai Seedream**: ~$0.02 per image
- **1,000 artists**: ~$20
- **10,000 artists**: ~$200

## Manual Review UI (Future)

Build a simple review interface:

```typescript
// GET /api/admin/review-images
const pendingImages = await sql`
  SELECT
    agi.*,
    ga.name as artist_name,
    ga.image_url as original_url
  FROM artist_generated_images agi
  JOIN genius_artists ga ON ga.genius_artist_id = agi.genius_artist_id
  WHERE agi.status = 'completed'
    AND agi.is_approved = false
  ORDER BY agi.created_at DESC
  LIMIT 50
`;

// POST /api/admin/approve-image/:id
await sql`
  UPDATE artist_generated_images
  SET is_approved = true, approved_at = NOW()
  WHERE id = ${imageId}
`;
```

## Integration with GRC-20 Minting

```typescript
import { MusicalArtistMintSchema } from './types/validation-schemas';

// Get artist with approved image
const artist = await sql`
  SELECT
    ga.*,
    agi.generated_image_url,
    agi.grove_uri
  FROM genius_artists ga
  LEFT JOIN artist_generated_images agi
    ON agi.genius_artist_id = ga.genius_artist_id
    AND agi.is_approved = true
  WHERE ga.genius_artist_id = ${artistId}
`;

// Validate
const validated = MusicalArtistMintSchema.parse({
  name: artist.name,
  geniusId: artist.genius_artist_id,
  imageUrl: artist.generated_image_url || artist.grove_uri,
  // ... other fields
});

// Mint to GRC-20
await mintArtistToGRC20(validated);

// Mark as used
await sql`
  UPDATE artist_generated_images
  SET is_used_in_grc20 = true,
      minted_at = NOW()
  WHERE genius_artist_id = ${artistId}
    AND is_approved = true
`;
```

## Next Steps

1. ✅ Create `artist_generated_images` table
2. ⏳ Copy `FalImageService` from master-pipeline to cloudflare-worker-scraper
3. ⏳ Create batch generation script
4. ⏳ Generate images for top 100 artists
5. ⏳ Manual review & approval
6. ⏳ Integrate with GRC-20 import scripts
