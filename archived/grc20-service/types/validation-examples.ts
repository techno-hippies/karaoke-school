/**
 * Usage Examples for GRC-20 Validation Schemas
 *
 * Shows how to use Zod schemas for pre-mint validation
 */

import {
  MusicalArtistMintSchema,
  MusicalWorkMintSchema,
  AudioRecordingMintSchema,
  validateBatch,
  formatValidationError,
  type MusicalArtistMint,
} from './validation-schemas';

// ============ Example 1: Validate Single Artist ============

export function validateArtistExample() {
  const taylorSwiftData = {
    name: 'Taylor Swift',
    mbid: '20244d07-534f-4eff-b4d4-930878889970',
    spotifyId: '06HL4z0CvFAxyc27GXpf02',
    geniusId: 1177,

    instagramHandle: 'taylorswift',
    tiktokHandle: 'taylorswift',
    twitterHandle: 'taylorswift13',

    geniusUrl: 'https://genius.com/artists/Taylor-swift',
    imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb...',

    genres: ['pop', 'country', 'indie'],
    spotifyFollowers: 100000000,
    isVerified: true,
  };

  try {
    const validated = MusicalArtistMintSchema.parse(taylorSwiftData);
    console.log('✅ Artist validation passed:', validated.name);
    return validated;
  } catch (error) {
    console.error('❌ Validation failed:');
    console.error(formatValidationError(error as any));
    return null;
  }
}

// ============ Example 2: Validate from Database Row ============

export function validateFromDB(dbRow: any): MusicalArtistMint | null {
  // Map DB columns to schema
  const artistData = {
    name: dbRow.name,
    mbid: dbRow.mbid,
    spotifyId: dbRow.spotify_artist_id,
    geniusId: dbRow.genius_artist_id,

    isni: dbRow.isnis?.[0], // Take first ISNI if array
    ipi: dbRow.ipi,

    alternateNames: dbRow.alternate_names,

    instagramHandle: dbRow.instagram_handle || dbRow.instagram_name,
    tiktokHandle: dbRow.tiktok_handle,
    twitterHandle: dbRow.twitter_handle || dbRow.twitter_name,
    facebookHandle: dbRow.facebook_handle || dbRow.facebook_name,
    youtubeChannel: dbRow.youtube_channel,
    soundcloudHandle: dbRow.soundcloud_handle,

    geniusUrl: dbRow.url || dbRow.genius_slug
      ? `https://genius.com/artists/${dbRow.genius_slug}`
      : undefined,

    imageUrl: dbRow.image_url,
    headerImageUrl: dbRow.header_image_url,

    type: dbRow.type,
    country: dbRow.country,
    gender: dbRow.gender,
    birthDate: dbRow.birth_date?.toISOString().split('T')[0],
    deathDate: dbRow.death_date?.toISOString().split('T')[0],

    genres: dbRow.genres,
    spotifyFollowers: dbRow.followers || dbRow.followers_count,
    spotifyPopularity: dbRow.popularity,
    isVerified: dbRow.is_verified,
  };

  const result = MusicalArtistMintSchema.safeParse(artistData);

  if (result.success) {
    return result.data;
  } else {
    console.warn(`⚠️  Skipping ${dbRow.name}:`);
    console.warn(formatValidationError(result.error));
    return null;
  }
}

// ============ Example 3: Batch Validation with Stats ============

export function validateArtistBatch(dbRows: any[]) {
  const mappedData = dbRows.map(row => ({
    name: row.name,
    mbid: row.mbid,
    spotifyId: row.spotify_artist_id,
    geniusId: row.genius_artist_id,
    instagramHandle: row.instagram_handle,
    tiktokHandle: row.tiktok_handle,
    imageUrl: row.image_url,
    geniusUrl: row.url,
    isVerified: row.is_verified,
  }));

  const result = validateBatch(mappedData, MusicalArtistMintSchema);

  console.log('\n📊 Validation Results:');
  console.log(`   Total: ${result.stats.total}`);
  console.log(`   ✅ Valid: ${result.stats.validCount} (${result.stats.validPercent}%)`);
  console.log(`   ❌ Invalid: ${result.stats.invalidCount}`);

  // Show first 5 errors
  if (result.invalid.length > 0) {
    console.log('\n❌ Sample errors:');
    result.invalid.slice(0, 5).forEach(({ item, errors }) => {
      console.log(`\n   ${item.name}:`);
      console.log(formatValidationError(errors));
    });
  }

  return result.valid;
}

// ============ Example 4: Pre-Mint Quality Check ============

export function checkMintReadiness(artistCount: number, workCount: number) {
  const MIN_ARTIST_QUALITY = 80; // 80% must pass validation
  const MIN_WORK_QUALITY = 70;   // 70% must pass validation

  console.log('🔍 Checking catalog quality before mint...\n');

  // In real usage, this would query from DB
  const artistValidPercent = 85; // Mock
  const workValidPercent = 72;   // Mock

  const artistReady = artistValidPercent >= MIN_ARTIST_QUALITY;
  const workReady = workValidPercent >= MIN_WORK_QUALITY;

  console.log(`Artists: ${artistValidPercent}% valid ${artistReady ? '✅' : '❌'}`);
  console.log(`Works: ${workValidPercent}% valid ${workReady ? '✅' : '❌'}`);

  if (artistReady && workReady) {
    console.log('\n✅ Catalog quality meets minting standards');
    return true;
  } else {
    console.log('\n❌ Improve data quality before minting to GRC-20');
    if (!artistReady) {
      console.log(`   → Need ${MIN_ARTIST_QUALITY - artistValidPercent}% more valid artists`);
    }
    if (!workReady) {
      console.log(`   → Need ${MIN_WORK_QUALITY - workValidPercent}% more valid works`);
    }
    return false;
  }
}

// ============ Example 5: Progressive Validation Levels ============

export type ValidationLevel = 'minimal' | 'standard' | 'premium';

export function getValidationLevel(artist: any): ValidationLevel {
  const result = MusicalArtistMintSchema.safeParse(artist);

  if (!result.success) return 'minimal';

  const data = result.data;

  // Count enrichment fields
  const socialLinks = [
    data.instagramHandle,
    data.tiktokHandle,
    data.twitterHandle,
    data.facebookHandle,
    data.youtubeChannel,
  ].filter(Boolean).length;

  const externalIds = [
    data.mbid,
    data.spotifyId,
    data.geniusId,
    data.wikidataId,
  ].filter(Boolean).length;

  // Premium: 3+ external IDs, 3+ social links, ISNI
  if (externalIds >= 3 && socialLinks >= 3 && data.isni) {
    return 'premium';
  }

  // Standard: 2+ external IDs, 2+ social links
  if (externalIds >= 2 && socialLinks >= 2) {
    return 'standard';
  }

  return 'minimal';
}
