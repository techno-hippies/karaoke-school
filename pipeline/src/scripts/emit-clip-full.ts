#!/usr/bin/env bun
/**
 * Emit Full Clip Pipeline
 *
 * Emits all clip-related events to KaraokeEvents contract:
 * - ClipRegistered: Basic clip metadata
 * - ClipProcessed: Audio/alignment URIs
 * - SongEncrypted: Encryption metadata for subscribers (REQUIRED)
 *
 * Prerequisites (ALL REQUIRED - no skip options):
 * - Song with clip_end_ms set (run select-clip.ts)
 * - Free clip created (run create-clip.ts)
 * - Full audio encrypted (run encrypt-audio.ts) ← MANDATORY
 * - Cover images uploaded to Grove (done in add-song.ts, or use --upload-images)
 *
 * Usage:
 *   bun src/scripts/emit-clip-full.ts --iswc=T0101545054
 *   bun src/scripts/emit-clip-full.ts --iswc=T0101545054 --env=mainnet
 *   bun src/scripts/emit-clip-full.ts --iswc=T0101545054 --dry-run
 *   bun src/scripts/emit-clip-full.ts --iswc=T0101545054 --upload-images
 */

import { parseArgs } from 'util';
import { ethers } from 'ethers';
import { getSongByISWC, getArtistById, getLyricsBySong } from '../db/queries';
import { query } from '../db/connection';
import { uploadToGrove, downloadAndUploadImageToGrove } from '../services/grove';
import { uploadJsonToLayers, printUploadResults } from '../services/storage';
import { getEnvironment, type Environment } from '../config/networks';
import { ClipMetadataSchema, formatZodErrors, type ClipMetadata } from '../lib/schemas';
import { callOpenRouter } from '../services/openrouter';
import type { Song, Artist, Lyric, StorageManifest } from '../types';

// ============================================================================
// AD LIB FILTERING
// ============================================================================

/**
 * Strip trailing ad libs from lyrics for display
 * "I'm just a poor boy (Ooh, poor boy)" → "I'm just a poor boy"
 */
function stripTrailingAdLibs(text: string): string {
  const stripped = text.replace(/\s*\([^)]*\)\s*$/, '').trim();
  // If stripping leaves nothing, return original text (minus outer parens if that's all there is)
  if (!stripped) {
    // Check if entire line is just parenthetical - extract content
    const match = text.match(/^\(([^)]+)\)$/);
    return match ? match[1] : text;
  }
  return stripped;
}

// Contract config - KaraokeEvents handles both clip lifecycle and grading
// V6: JSON localizations for 12 languages (zh, vi, id, ja, ko, es, pt, ar, tr, ru, hi, th)
const KARAOKE_EVENTS_ADDRESS = '0xd942eB51C86c46Db82678627d19Aa44630F901aE';
const LENS_RPC = 'https://rpc.testnet.lens.xyz';

// SongAccess contract addresses (per-song ETH purchase - single contract for all songs)
const SONG_ACCESS_CONTRACT = {
  testnet: {
    address: '0x7856C6121b3Fb861C31cb593a65236858d789bDB',
    chainId: 84532, // Base Sepolia
  },
  mainnet: {
    address: '0x0000000000000000000000000000000000000000', // TODO: Deploy to Base
    chainId: 8453,
  },
};

const KARAOKE_EVENTS_ABI = [
  // Clip lifecycle events - updated with slug fields for direct subgraph indexing
  'function emitClipRegistered(bytes32 clipHash, string spotifyTrackId, string iswc, string title, string artist, string artistSlug, string songSlug, string coverUri, string thumbnailUri, uint32 clipStartMs, uint32 clipEndMs, string metadataUri) external',
  'function emitClipProcessed(bytes32 clipHash, string instrumentalUri, string alignmentUri, uint8 translationCount, string metadataUri) external',
  // V3: Removed unlock params - access control now stored in encryption manifest metadata
  'function emitSongEncrypted(bytes32 clipHash, string spotifyTrackId, string encryptedFullUri, string encryptedManifestUri, string metadataUri) external',
  // Karaoke session grading
  'function emitKaraokeSessionStarted(bytes32 sessionId, bytes32 clipHash, address performer) external',
];

/**
 * Convert text to URL-safe slug
 * Normalizes accented characters (é → e, ñ → n, etc.)
 */
function slugify(text: string): string {
  return text
    .normalize('NFD') // Decompose accents (é → e + combining accent)
    .replace(/[\u0300-\u036f]/g, '') // Remove combining accents
    .toLowerCase()
    .replace(/['']/g, '') // Remove apostrophes
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Trim hyphens from start/end
    .replace(/-+/g, '-'); // Collapse multiple hyphens
}


// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    env: { type: 'string', default: 'testnet' },
    'dry-run': { type: 'boolean', default: false },
    'upload-images': { type: 'boolean', default: false },
  },
  strict: true,
});

/**
 * Calculate clip hash: keccak256(spotifyTrackId, clipStartMs)
 */
function generateClipHash(spotifyTrackId: string, clipStartMs: number): string {
  return ethers.solidityPackedKeccak256(
    ['string', 'uint32'],
    [spotifyTrackId, clipStartMs]
  );
}

/**
 * Generate Chinese translation for a single line using AI
 */
async function translateLineToZh(englishText: string): Promise<string> {
  const messages = [
    {
      role: 'system' as const,
      content: `You are a professional translator. Translate English song lyrics to Simplified Chinese.
Rules:
- Output ONLY the Chinese translation, nothing else
- Use natural, fluent Simplified Chinese
- Preserve the meaning and emotional tone
- Do NOT include any English text in output`,
    },
    {
      role: 'user' as const,
      content: `Translate this English lyric to Simplified Chinese:\n"${englishText}"`,
    },
  ];

  const response = await callOpenRouter(messages);

  // Clean up response - remove quotes if present
  return response.trim().replace(/^["']|["']$/g, '');
}

/**
 * Batch translate multiple lines to Chinese
 * Uses AI to generate translations if not in database
 */
async function ensureChineseTranslations(
  enLyrics: Lyric[],
  zhLyrics: Lyric[]
): Promise<Map<number, string>> {
  const translations = new Map<number, string>();

  // First, use existing translations from database
  for (const zhLine of zhLyrics) {
    translations.set(zhLine.line_index, zhLine.text);
  }

  // Find lines missing translations
  const missingLines = enLyrics.filter(en => !translations.has(en.line_index));

  if (missingLines.length === 0) {
    console.log('   ✅ All Chinese translations exist in database');
    return translations;
  }

  console.log(`   🌐 Generating ${missingLines.length} Chinese translations via AI...`);

  // Generate missing translations
  for (const enLine of missingLines) {
    try {
      // Strip ad libs before translating to avoid translating background vocals
      const cleanText = stripTrailingAdLibs(enLine.text);
      const zhText = await translateLineToZh(cleanText);
      translations.set(enLine.line_index, zhText);
      console.log(`   ${enLine.line_index}: "${cleanText.slice(0, 30)}..." → "${zhText.slice(0, 30)}..."`);
    } catch (error: any) {
      console.error(`   ⚠️ Failed to translate line ${enLine.line_index}: ${error.message}`);
      // Use placeholder to not break validation
      translations.set(enLine.line_index, `[Translation pending: ${enLine.text}]`);
    }
  }

  return translations;
}

/**
 * Upload missing cover images to Grove from Spotify CDN
 * Returns updated URLs
 */
async function ensureGroveImages(
  song: Song,
  iswc: string
): Promise<{ coverGroveUrl: string; thumbnailGroveUrl: string }> {
  let coverGroveUrl = song.cover_grove_url;
  let thumbnailGroveUrl = song.thumbnail_grove_url;

  // Upload cover if missing
  if (!coverGroveUrl && song.spotify_images?.[0]?.url) {
    console.log('   Uploading cover image to Grove...');
    const result = await downloadAndUploadImageToGrove(
      song.spotify_images[0].url,
      `${iswc}-cover.jpg`
    );
    coverGroveUrl = result.url;

    // Save to DB
    await query(
      `UPDATE songs SET cover_grove_url = $1, updated_at = NOW() WHERE iswc = $2`,
      [coverGroveUrl, iswc]
    );
    console.log(`   Cover: ${coverGroveUrl}`);
  }

  // Upload thumbnail if missing (use 300x300 from Spotify)
  if (!thumbnailGroveUrl && song.spotify_images?.[1]?.url) {
    console.log('   Uploading thumbnail to Grove...');
    const result = await downloadAndUploadImageToGrove(
      song.spotify_images[1].url,
      `${iswc}-thumb.jpg`
    );
    thumbnailGroveUrl = result.url;

    // Save to DB
    await query(
      `UPDATE songs SET thumbnail_grove_url = $1, updated_at = NOW() WHERE iswc = $2`,
      [thumbnailGroveUrl, iswc]
    );
    console.log(`   Thumbnail: ${thumbnailGroveUrl}`);
  }

  if (!coverGroveUrl || !thumbnailGroveUrl) {
    throw new Error('Missing cover images - ensure spotify_images exists or run with --upload-images');
  }

  return { coverGroveUrl, thumbnailGroveUrl };
}

/**
 * Build comprehensive clip metadata for Grove upload
 * Validated with Zod before returning
 */
async function buildClipMetadata(
  song: Song,
  artist: Artist,
  lyrics: Lyric[],
  clipHash: string,
  coverGroveUrl: string,
  thumbnailGroveUrl: string,
  env: Environment
): Promise<ClipMetadata> {
  // Get encryption info for this environment
  const encryptedFullUrl = env === 'testnet'
    ? song.encrypted_full_url_testnet
    : song.encrypted_full_url_mainnet;
  const encryptionManifestUrl = env === 'testnet'
    ? song.encryption_manifest_url_testnet
    : song.encryption_manifest_url_mainnet;
  const litNetwork = env === 'testnet'
    ? song.lit_network_testnet
    : song.lit_network_mainnet;

  // Group lyrics by line_index, with all language translations
  const enLyrics = lyrics.filter(l => l.language === 'en');
  const zhLyrics = lyrics.filter(l => l.language === 'zh');
  const viLyrics = lyrics.filter(l => l.language === 'vi');
  const idLyrics = lyrics.filter(l => l.language === 'id');

  // Filter EN lyrics within clip window (use EN as base for timing)
  const clipEnLyrics = enLyrics
    .filter(l => l.start_ms !== null && l.start_ms < song.clip_end_ms!)
    .sort((a, b) => a.line_index - b.line_index);

  // Ensure Chinese translations exist (auto-generate if missing)
  console.log('\n🌐 Checking Chinese translations...');
  const zhTranslations = await ensureChineseTranslations(clipEnLyrics, zhLyrics);

  // Helper to build karaoke line object
  const buildKaraokeLine = (enLine: Lyric) => {
    const viLine = viLyrics.find(l => l.line_index === enLine.line_index);
    const idLine = idLyrics.find(l => l.line_index === enLine.line_index);

    // Convert word timings from seconds to milliseconds
    // Filter out ad lib words (starting with parenthesis) and unnecessary spaces
    const words = enLine.word_timings
      ?.filter(w => !w.text.startsWith('(')) // Remove ad libs like "(Ooh, poor boy)"
      .map(w => ({
        text: w.text,
        start_ms: Math.round(w.start * 1000),
        end_ms: Math.round(w.end * 1000),
      }))
      .filter((w, i, arr) => {
        // Remove trailing spaces (space at the end with no following word)
        if (w.text === ' ' && i === arr.length - 1) return false;
        return true;
      });

    // Strip ad libs from display text (but keep original for reference)
    const cleanText = stripTrailingAdLibs(enLine.text);

    return {
      line_index: enLine.line_index,
      start_ms: enLine.start_ms!,
      end_ms: enLine.end_ms || enLine.start_ms! + 5000,
      original_text: cleanText, // Cleaned for display
      text: cleanText, // For compatibility
      words, // Word-level timing for highlighting
      zh_text: zhTranslations.get(enLine.line_index) || undefined,
      vi_text: viLine?.text ? stripTrailingAdLibs(viLine.text) : undefined,
      id_text: idLine?.text ? stripTrailingAdLibs(idLine.text) : undefined,
    };
  };

  // Build karaoke_lines for CLIP (free tier)
  const karaoke_lines = clipEnLyrics.map(buildKaraokeLine);

  // Build full_karaoke_lines for FULL SONG (subscribers only)
  // Include ALL lyrics with timing, not just clip window
  const fullEnLyrics = enLyrics
    .filter(l => l.start_ms !== null)
    .sort((a, b) => a.line_index - b.line_index);

  // Generate translations for full lyrics (only if we have more lines than clip)
  let fullZhTranslations = zhTranslations;
  if (fullEnLyrics.length > clipEnLyrics.length) {
    console.log(`\n🌐 Checking Chinese translations for full song (${fullEnLyrics.length} lines)...`);
    fullZhTranslations = await ensureChineseTranslations(fullEnLyrics, zhLyrics);
  }

  // Rebuild helper with full translations
  const buildFullKaraokeLine = (enLine: Lyric) => {
    const viLine = viLyrics.find(l => l.line_index === enLine.line_index);
    const idLine = idLyrics.find(l => l.line_index === enLine.line_index);

    const words = enLine.word_timings
      ?.filter(w => !w.text.startsWith('('))
      .map(w => ({
        text: w.text,
        start_ms: Math.round(w.start * 1000),
        end_ms: Math.round(w.end * 1000),
      }))
      .filter((w, i, arr) => {
        if (w.text === ' ' && i === arr.length - 1) return false;
        return true;
      });

    const cleanText = stripTrailingAdLibs(enLine.text);

    return {
      line_index: enLine.line_index,
      start_ms: enLine.start_ms!,
      end_ms: enLine.end_ms || enLine.start_ms! + 5000,
      original_text: cleanText,
      text: cleanText,
      words,
      zh_text: fullZhTranslations.get(enLine.line_index) || undefined,
      vi_text: viLine?.text ? stripTrailingAdLibs(viLine.text) : undefined,
      id_text: idLine?.text ? stripTrailingAdLibs(idLine.text) : undefined,
    };
  };

  const full_karaoke_lines = fullEnLyrics.map(buildFullKaraokeLine);

  const metadata = {
    version: '2.0.0' as const,
    type: 'karaoke-clip' as const,
    generatedAt: new Date().toISOString(),

    // Identifiers
    clipHash,
    iswc: song.iswc,
    spotifyTrackId: song.spotify_track_id!,

    // Song info
    title: song.title,
    // 12 language translations
    title_zh: song.title_zh || undefined,
    title_vi: song.title_vi || undefined,
    title_id: song.title_id || undefined,
    title_ja: song.title_ja || undefined,
    title_ko: song.title_ko || undefined,
    title_es: song.title_es || undefined,
    title_pt: song.title_pt || undefined,
    title_ar: song.title_ar || undefined,
    title_tr: song.title_tr || undefined,
    title_ru: song.title_ru || undefined,
    title_hi: song.title_hi || undefined,
    title_th: song.title_th || undefined,
    artist: artist.name,
    // 12 language translations/transliterations
    artist_zh: artist.name_zh || undefined,
    artist_vi: artist.name_vi || undefined,
    artist_id: artist.name_id || undefined,
    artist_ja: artist.name_ja || undefined,
    artist_ko: artist.name_ko || undefined,
    artist_es: artist.name_es || undefined,
    artist_pt: artist.name_pt || undefined,
    artist_ar: artist.name_ar || undefined,
    artist_tr: artist.name_tr || undefined,
    artist_ru: artist.name_ru || undefined,
    artist_hi: artist.name_hi || undefined,
    artist_th: artist.name_th || undefined,
    artistSlug: artist.slug!,
    artistImageUri: artist.image_grove_url!, // Artist image from Spotify (REQUIRED - run fix-artist-images.ts if missing)
    genres: artist.genres?.length ? artist.genres : undefined, // Spotify genres for filtering/search

    // Cover images - MUST be on Grove, validated by Zod
    coverUri: coverGroveUrl,
    thumbnailUri: thumbnailGroveUrl,

    // Timing
    timing: {
      clipStartMs: 0,
      clipEndMs: song.clip_end_ms!,
      fullDurationMs: song.duration_ms,
    },

    // Assets - Free tier
    // IMPORTANT: Do NOT include fullInstrumental - that would leak unencrypted audio!
    // Full audio is only accessible via encryption.encryptionMetadataUri
    assets: {
      clipInstrumental: song.clip_instrumental_url!,
      clipLyrics: song.clip_lyrics_url || null,
      alignment: null,
    },

    // Encryption v2.1 - Premium tier (hybrid AES-GCM + Lit Protocol)
    // encryptionMetadataUri points to JSON with encrypted key + audio URL + access control
    // Frontend decrypts key with Lit (32 bytes - no 413!), then decrypts audio locally
    // Access control: SongAccess ERC-721 (single contract for all songs)
    encryption: encryptionManifestUrl ? {
      version: '2.1.0' as const,
      environment: env,
      encryptionMetadataUri: encryptionManifestUrl!, // v2+: Points to encryption metadata
      encryptedFullUri: encryptedFullUrl || null, // v1 (deprecated): encrypted blob
      manifestUri: null, // Deprecated in v2+
      litNetwork: litNetwork!,
      // SongAccess ERC-721: Single contract for all songs (per-song USDC purchase)
      songAccessAddress: SONG_ACCESS_CONTRACT[env].address,
      songAccessChainId: SONG_ACCESS_CONTRACT[env].chainId,
    } : null,

    // Lyrics preview (first few lines for list display)
    lyricsPreview: clipEnLyrics.slice(0, 5).map(l => ({
      index: l.line_index,
      text: stripTrailingAdLibs(l.text), // Clean ad libs from preview too
      startMs: l.start_ms!,
      endMs: l.end_ms || l.start_ms! + 5000,
    })),

    // Full karaoke lyrics for playback
    karaoke_lines,

    // Full song lyrics for subscribers
    full_karaoke_lines,

    // Stats
    stats: {
      totalLyricsLines: enLyrics.length,
      clipLyricsLines: clipEnLyrics.length,
      fullLyricsLines: fullEnLyrics.length,
    },
  };

  // Validate with Zod - throws if invalid
  const result = ClipMetadataSchema.safeParse(metadata);
  if (!result.success) {
    console.error('\n❌ Metadata validation failed:');
    console.error(formatZodErrors(result.error));
    throw new Error('Invalid clip metadata - see errors above');
  }

  return result.data;
}

async function main() {
  const iswc = values.iswc;
  const env = (values.env as Environment) || getEnvironment();
  const dryRun = values['dry-run'];
  const uploadImages = values['upload-images'];

  if (!iswc) {
    console.error('❌ Must specify --iswc');
    process.exit(1);
  }

  console.log('\n📤 Emit Full Clip Pipeline');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Environment: ${env}`);
  if (dryRun) console.log('   Mode: DRY RUN');
  if (uploadImages) console.log('   Will upload missing images');

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error('❌ Song not found');
    process.exit(1);
  }

  console.log(`\n🎵 ${song.title}`);

  // Validate prerequisites
  const errors: string[] = [];

  if (!song.clip_end_ms) errors.push('No clip_end_ms - run select-clip.ts');
  if (!song.clip_instrumental_url) errors.push('No clip_instrumental_url - run create-clip.ts');
  if (!song.spotify_track_id) errors.push('No spotify_track_id');
  if (!song.artist_id) errors.push('No artist linked');

  // Check for Grove images (unless --upload-images is set)
  if (!uploadImages) {
    if (!song.cover_grove_url) errors.push('No cover_grove_url - run with --upload-images or re-run add-song.ts');
    if (!song.thumbnail_grove_url) errors.push('No thumbnail_grove_url - run with --upload-images or re-run add-song.ts');
  }

  if (errors.length > 0) {
    console.error('\n❌ Prerequisites not met:');
    errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  // Get artist
  const artist = await getArtistById(song.artist_id!);
  if (!artist) {
    console.error('❌ Artist not found');
    process.exit(1);
  }

  // Validate artist has image (required by Zod schema)
  if (!artist.image_grove_url) {
    console.error('❌ Artist missing image_grove_url');
    console.error('   Run: bun src/scripts/fix-artist-images.ts');
    process.exit(1);
  }

  console.log(`   Artist: ${artist.name}`);
  console.log(`   Artist Image: ${artist.image_grove_url}`);
  if (artist.genres?.length) {
    console.log(`   Genres: ${artist.genres.join(', ')}`);
  }
  console.log(`   Clip: 0 → ${song.clip_end_ms}ms (${(song.clip_end_ms! / 1000).toFixed(1)}s)`);

  // Ensure Grove images exist (upload if --upload-images)
  console.log('\n🖼️  Checking cover images...');
  let coverGroveUrl: string;
  let thumbnailGroveUrl: string;

  if (uploadImages || !song.cover_grove_url || !song.thumbnail_grove_url) {
    const images = await ensureGroveImages(song, iswc);
    coverGroveUrl = images.coverGroveUrl;
    thumbnailGroveUrl = images.thumbnailGroveUrl;
  } else {
    coverGroveUrl = song.cover_grove_url;
    thumbnailGroveUrl = song.thumbnail_grove_url;
    console.log(`   Cover: ${coverGroveUrl}`);
    console.log(`   Thumbnail: ${thumbnailGroveUrl}`);
  }

  // Get encryption info for this environment (REQUIRED)
  const encryptedFullUrl = env === 'testnet'
    ? song.encrypted_full_url_testnet
    : song.encrypted_full_url_mainnet;
  const encryptionManifestUrl = env === 'testnet'
    ? song.encryption_manifest_url_testnet
    : song.encryption_manifest_url_mainnet;

  // SongAccess ERC-721 is the access control model
  const songAccessAddress = SONG_ACCESS_CONTRACT[env].address;
  const hasSongAccess = songAccessAddress !== '0x0000000000000000000000000000000000000000';

  // Encryption is REQUIRED - no skip option
  if (!encryptionManifestUrl) {
    console.error(`\n❌ No encryption_manifest_url for ${env} environment`);
    console.error('   Run: bun src/scripts/encrypt-audio.ts --iswc=' + iswc);
    process.exit(1);
  }

  if (!hasSongAccess) {
    console.error(`\n❌ No SongAccess contract configured for ${env}`);
    process.exit(1);
  }

  console.log(`   Encryption: ✅ (manifest exists)`);
  console.log(`   SongAccess: ${songAccessAddress}`);

  // Get ALL lyrics for metadata (all languages)
  const allLyrics = await getLyricsBySong(song.id);
  const enLyrics = allLyrics.filter(l => l.language === 'en');

  // Generate clip hash (starts at 0)
  const clipHash = generateClipHash(song.spotify_track_id!, 0);
  console.log(`   Clip hash: ${clipHash}`);

  // Build and validate metadata
  console.log('\n📋 Building clip metadata...');
  const metadata = await buildClipMetadata(
    song,
    artist,
    allLyrics,
    clipHash,
    coverGroveUrl,
    thumbnailGroveUrl,
    env
  );
  console.log('   ✅ Metadata validated');

  if (dryRun) {
    console.log('\n📋 Metadata preview:');
    console.log(JSON.stringify(metadata, null, 2));
    console.log('\n✅ Dry run complete - metadata is valid');
    process.exit(0);
  }

  // Upload metadata to Grove + Arweave (multi-layer)
  // Metadata is small (<100KB) so Arweave upload is free via Turbo
  console.log('\n☁️  Uploading metadata to Grove + Arweave...');
  const metadataUploadResult = await uploadJsonToLayers(
    metadata,
    `${iswc}-clip-metadata.json`
  );
  printUploadResults(metadataUploadResult);

  // Primary URL is Grove (backwards compatible)
  const metadataUrl = metadataUploadResult.primaryUrl;
  const metadataArweaveUrl = metadataUploadResult.manifest.arweave?.url;
  console.log(`   Primary (Grove): ${metadataUrl}`);
  if (metadataArweaveUrl) {
    console.log(`   Arweave: ${metadataArweaveUrl}`);
  }

  // Connect to Lens testnet
  console.log('\n🔗 Connecting to Lens testnet...');
  const provider = new ethers.JsonRpcProvider(LENS_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const clipContract = new ethers.Contract(KARAOKE_EVENTS_ADDRESS, KARAOKE_EVENTS_ABI, wallet);
  const karaokeContract = new ethers.Contract(KARAOKE_EVENTS_ADDRESS, KARAOKE_EVENTS_ABI, wallet);
  console.log(`   Wallet: ${wallet.address}`);

  // Generate slugs for URL routing
  const artistSlug = slugify(artist.name);
  const songSlug = slugify(song.title);
  console.log(`   Artist slug: ${artistSlug}`);
  console.log(`   Song slug: ${songSlug}`);

  // 1. Emit ClipRegistered with all fields for direct subgraph indexing
  console.log('\n📤 Emitting ClipRegistered...');
  const tx1 = await clipContract.emitClipRegistered(
    clipHash,
    song.spotify_track_id,
    song.iswc,
    song.title,
    artist.name,
    artistSlug,
    songSlug,
    coverGroveUrl,
    thumbnailGroveUrl,
    0, // clipStartMs = 0
    song.clip_end_ms,
    metadataUrl
  );
  console.log(`   TX: ${tx1.hash}`);
  const receipt1 = await tx1.wait();
  console.log(`   Confirmed in block ${receipt1.blockNumber}`);

  // 2. Emit ClipProcessed
  console.log('\n📤 Emitting ClipProcessed...');
  const tx2 = await clipContract.emitClipProcessed(
    clipHash,
    song.clip_instrumental_url!,
    song.clip_lyrics_url || '', // alignment URI
    1, // translation count
    metadataUrl
  );
  console.log(`   TX: ${tx2.hash}`);
  const receipt2 = await tx2.wait();
  console.log(`   Confirmed in block ${receipt2.blockNumber}`);

  // 3. Emit SongEncrypted (REQUIRED)
  // V3: Access control info is stored in the encryption manifest, not on-chain
  console.log('\n📤 Emitting SongEncrypted...');
  const tx3 = await clipContract.emitSongEncrypted(
    clipHash,
    song.spotify_track_id,
    encryptedFullUrl!,
    encryptionManifestUrl,
    metadataUrl
  );
  console.log(`   TX: ${tx3.hash}`);
  const receipt3 = await tx3.wait();
  console.log(`   Confirmed in block ${receipt3.blockNumber}`);

  // Update song stage and storage manifest
  await query(
    `UPDATE songs SET stage = 'ready', storage_manifest = $1, updated_at = NOW() WHERE iswc = $2`,
    [JSON.stringify(metadataUploadResult.manifest), iswc]
  );

  // Store Arweave URI on clip if available
  if (metadataArweaveUrl) {
    await query(
      `UPDATE clips SET metadata_arweave_uri = $1 WHERE song_id = (SELECT id FROM songs WHERE iswc = $2) AND start_ms = 0`,
      [metadataArweaveUrl, iswc]
    );
  }

  console.log('\n✅ Clip pipeline complete!');
  console.log(`   ClipRegistered: ${tx1.hash}`);
  console.log(`   ClipProcessed: ${tx2.hash}`);
  console.log(`   SongEncrypted: ${tx3.hash}`);
  console.log(`   Metadata (Grove): ${metadataUrl}`);
  if (metadataArweaveUrl) {
    console.log(`   Metadata (Arweave): ${metadataArweaveUrl}`);
  }
  console.log(`   Explorer: https://block-explorer.testnet.lens.dev/tx/${tx1.hash}`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
