#!/usr/bin/env bun

import '../../env';

import { ethers } from 'ethers';
import {
  LENS_TESTNET_RPC,
} from '../../../../lit-actions/config/contracts.config.js';
import KaraokeEventsArtifact from '../../../../contracts/out/KaraokeEvents.sol/KaraokeEvents.json' assert { type: 'json' };

// KaraokeEvents contract address (replaces ClipEvents)
const KARAOKE_EVENTS_ADDRESS = '0x51aA6987130AA7E4654218859E075D8e790f4409';

import { query } from '../../db/connection';
import { GroveService } from '../../services/grove';
import { getLitNetworkConfig } from '../../config/lit';

interface ClipCandidate {
  spotify_track_id: string;
  title: string;
  clip_start_ms: number;
  clip_end_ms: number;
  clip_grove_url: string | null;
  fal_enhanced_grove_url: string | null;
  grc20_entity_id: string;
  artist_name: string;
  artist_lens_handle: string | null;
  cover_url: string | null;
  cover_thumbnail_url: string | null;
  encrypted_full_url: string | null;
  encryption_accs: any | null;
  has_hash?: boolean;
  lit_network: string | null;
  needs_reencrypt: boolean;
}

interface AlignmentRow {
  words: any[];
  total_words: number | null;
}

interface TranslationRow {
  language_code: string;
  lines: any;
  translator: string | null;
  quality_score: number | null;
}

interface KaraokeLineRow {
  line_id: string;
  line_index: number;
  original_text: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number | null;
  segment_hash?: any;
}

const grove = new GroveService();

function getPrivateKey(): `0x${string}` {
  const rawKey = process.env.PRIVATE_KEY?.trim();
  if (!rawKey) {
    throw new Error('PRIVATE_KEY must be set to emit clip events');
  }

  return (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
}

function requireAddress(address?: string): string {
  if (!address || address === ethers.ZeroAddress) {
    throw new Error('KARAOKE_EVENTS_ADDRESS not configured');
  }

  return ethers.getAddress(address);
}

async function fetchClipCandidates(limit: number, trackId?: string): Promise<ClipCandidate[]> {
  const { litNetwork } = getLitNetworkConfig();

  if (trackId) {
    return query(
      `SELECT
         t.spotify_track_id,
         COALESCE(gw.title, t.title) AS title,
         ks.clip_start_ms,
         ks.clip_end_ms,
         ks.clip_grove_url,
         ks.fal_enhanced_grove_url,
         gw.grc20_entity_id,
         gw.primary_artist_name AS artist_name,
         ga.lens_handle AS artist_lens_handle,
         gw.image_url AS cover_url,
         gw.image_thumbnail_url AS cover_thumbnail_url,
         ks.encrypted_full_url,
         ks.encryption_accs,
         ks.lit_network,
         ks.needs_reencrypt,
         COALESCE(line_state.has_hash, FALSE) AS has_hash
       FROM tracks t
       JOIN karaoke_segments ks ON ks.spotify_track_id = t.spotify_track_id
       JOIN grc20_works gw ON gw.spotify_track_id = t.spotify_track_id
       LEFT JOIN grc20_artists ga ON ga.id = gw.primary_artist_id
       LEFT JOIN LATERAL (
         SELECT BOOL_OR(segment_hash IS NOT NULL) AS has_hash
           FROM karaoke_lines kl
          WHERE kl.spotify_track_id = t.spotify_track_id
       ) AS line_state ON TRUE
       WHERE t.spotify_track_id = $1
         AND ks.clip_start_ms IS NOT NULL
         AND ks.clip_end_ms IS NOT NULL
         AND ks.fal_enhanced_grove_url IS NOT NULL
         AND ks.encrypted_full_url IS NOT NULL
         AND ks.encryption_accs IS NOT NULL
         AND ks.lit_network = $2
         AND ks.needs_reencrypt = FALSE
         AND gw.grc20_entity_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM song_translation_questions q
           WHERE q.spotify_track_id = t.spotify_track_id
         )
         AND (
           EXISTS (
             SELECT 1 FROM song_trivia_questions tq
             WHERE tq.spotify_track_id = t.spotify_track_id
           )
           OR NOT EXISTS (
             SELECT 1 FROM genius_songs gs
             JOIN genius_song_referents gr ON gr.genius_song_id = gs.genius_song_id
             WHERE gs.spotify_track_id = t.spotify_track_id
           )
         )`,
      [trackId, litNetwork]
    );
  }

  return query(
    `SELECT
       t.spotify_track_id,
       COALESCE(gw.title, t.title) AS title,
       ks.clip_start_ms,
       ks.clip_end_ms,
       ks.clip_grove_url,
       ks.fal_enhanced_grove_url,
       gw.grc20_entity_id,
       gw.primary_artist_name AS artist_name,
       ga.lens_handle AS artist_lens_handle,
       gw.image_url AS cover_url,
       gw.image_thumbnail_url AS cover_thumbnail_url,
       ks.encrypted_full_url,
       ks.encryption_accs,
       ks.lit_network,
       ks.needs_reencrypt,
       COALESCE(line_state.has_hash, FALSE) AS has_hash
     FROM tracks t
     JOIN karaoke_segments ks ON ks.spotify_track_id = t.spotify_track_id
     JOIN grc20_works gw ON gw.spotify_track_id = t.spotify_track_id
     LEFT JOIN grc20_artists ga ON ga.id = gw.primary_artist_id
     LEFT JOIN LATERAL (
       SELECT BOOL_OR(segment_hash IS NOT NULL) AS has_hash
         FROM karaoke_lines kl
        WHERE kl.spotify_track_id = t.spotify_track_id
     ) AS line_state ON TRUE
     WHERE ks.clip_start_ms IS NOT NULL
       AND ks.clip_end_ms IS NOT NULL
       AND ks.fal_enhanced_grove_url IS NOT NULL
       AND ks.encrypted_full_url IS NOT NULL
       AND ks.encryption_accs IS NOT NULL
       AND ks.lit_network = $2
       AND ks.needs_reencrypt = FALSE
       AND gw.grc20_entity_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM song_translation_questions q
         WHERE q.spotify_track_id = t.spotify_track_id
       )
       AND (
         EXISTS (
           SELECT 1 FROM song_trivia_questions tq
           WHERE tq.spotify_track_id = t.spotify_track_id
         )
         OR NOT EXISTS (
           SELECT 1 FROM genius_songs gs
           JOIN genius_song_referents gr ON gr.genius_song_id = gs.genius_song_id
           WHERE gs.spotify_track_id = t.spotify_track_id
         )
       )
     ORDER BY COALESCE(line_state.has_hash, FALSE) ASC, t.updated_at ASC
     LIMIT $1` ,
    [limit, litNetwork]
  );
}

async function fetchAlignment(spotifyTrackId: string): Promise<AlignmentRow | null> {
  const rows = await query<AlignmentRow>(
    `SELECT words, total_words FROM elevenlabs_word_alignments WHERE spotify_track_id = $1`,
    [spotifyTrackId]
  );

  return rows[0] ?? null;
}

async function fetchTranslations(spotifyTrackId: string): Promise<TranslationRow[]> {
  return query<TranslationRow>(
    `SELECT language_code, lines, translator, quality_score
       FROM lyrics_translations
      WHERE spotify_track_id = $1
      ORDER BY language_code ASC`,
    [spotifyTrackId]
  );
}

async function fetchLines(spotifyTrackId: string): Promise<KaraokeLineRow[]> {
  return query<KaraokeLineRow>(
    `SELECT line_id, line_index, original_text, start_ms, end_ms, duration_ms, segment_hash
       FROM karaoke_lines
      WHERE spotify_track_id = $1
      ORDER BY line_index ASC`,
    [spotifyTrackId]
  );
}

async function fetchClipLines(spotifyTrackId: string): Promise<KaraokeLineRow[]> {
  return query<KaraokeLineRow>(
    `SELECT line_id, clip_line_index as line_index, original_text,
            clip_relative_start_ms as start_ms, clip_relative_end_ms as end_ms,
            duration_ms, segment_hash
       FROM clip_lines
      WHERE spotify_track_id = $1
      ORDER BY clip_line_index ASC`,
    [spotifyTrackId]
  );
}

function toHexClipHash(spotifyTrackId: string, startMs: number): string {
  return ethers.solidityPackedKeccak256(['string', 'uint32'], [spotifyTrackId, startMs]);
}

function bytesToHex(value: any): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      return value;
    }
    if (value.startsWith('\\x')) {
      return `0x${value.slice(2)}`;
    }
    return `0x${Buffer.from(value, 'utf8').toString('hex')}`;
  }

  if (value instanceof Uint8Array) {
    return `0x${Buffer.from(value).toString('hex')}`;
  }

  if (Buffer.isBuffer(value)) {
    return `0x${value.toString('hex')}`;
  }

  return null;
}

/**
 * Validates that a clip has all required data for emission
 * Ensures encryption is complete before emitting to blockchain
 */
function validateEmissionReadiness(clip: ClipCandidate): { ready: boolean; reason?: string } {
  // Validate clip timing (check for null/undefined, not falsy - 0 is valid)
  if (clip.clip_start_ms === null || clip.clip_start_ms === undefined ||
      clip.clip_end_ms === null || clip.clip_end_ms === undefined) {
    return { ready: false, reason: 'Missing clip timing' };
  }

  // Validate instrumental audio
  if (!clip.fal_enhanced_grove_url) {
    return { ready: false, reason: 'Missing enhanced instrumental audio' };
  }

  // Validate GRC-20 integration
  if (!clip.grc20_entity_id) {
    return { ready: false, reason: 'Missing GRC-20 entity ID' };
  }

  // CRITICAL: Validate encryption completion
  if (!clip.encrypted_full_url) {
    return { ready: false, reason: 'Missing encrypted full track URL' };
  }

  if (!clip.encryption_accs) {
    return { ready: false, reason: 'Missing encryption access conditions' };
  }

  // Validate encryption_accs structure
  try {
    const accs = typeof clip.encryption_accs === 'string'
      ? JSON.parse(clip.encryption_accs)
      : clip.encryption_accs;

    if (!accs.unlock?.lockAddress) {
      return { ready: false, reason: 'Missing Unlock lock address in encryption_accs' };
    }

    if (!accs.unlock?.chainId) {
      return { ready: false, reason: 'Missing Unlock chain ID in encryption_accs' };
    }
  } catch (error) {
    return { ready: false, reason: 'Invalid encryption_accs JSON structure' };
  }

  return { ready: true };
}

async function uploadAlignment(
  spotifyTrackId: string,
  alignment: AlignmentRow
): Promise<string> {
  const payload = {
    spotify_track_id: spotifyTrackId,
    total_words: alignment.total_words ?? alignment.words?.length ?? 0,
    words: alignment.words ?? [],
    generated_at: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  const buffer = Buffer.from(JSON.stringify(payload, null, 2));
  const result = await grove.uploadFile(buffer, `${spotifyTrackId}-alignment.json`, 'application/json');
  return result.url;
}

async function uploadTranslation(
  spotifyTrackId: string,
  translation: TranslationRow,
  clipStartMs: number,
  clipEndMs: number
): Promise<{ languageCode: string; groveUrl: string; clipGroveUrl: string }> {
  // Full song translation
  const fullPayload = {
    spotify_track_id: spotifyTrackId,
    language_code: translation.language_code,
    translator: translation.translator,
    quality_score: translation.quality_score,
    lines: translation.lines,
    generated_at: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  const fullBuffer = Buffer.from(JSON.stringify(fullPayload, null, 2));
  const fullResult = await grove.uploadFile(
    fullBuffer,
    `${spotifyTrackId}-${translation.language_code}-translation.json`,
    'application/json'
  );

  // Clip-only translation (filter lines within clip time window AND offset to clip start)
  const clipStartSec = clipStartMs / 1000;
  const clipEndSec = clipEndMs / 1000;
  const clipLines = Array.isArray(translation.lines)
    ? translation.lines
        .filter((line: any) => {
          // Include line if it overlaps with clip window
          return line.start < clipEndSec && line.end > clipStartSec;
        })
        .map((line: any) => ({
          ...line,
          // Offset timing to be relative to clip start (0-based)
          start: Math.max(0, line.start - clipStartSec),
          end: line.end - clipStartSec,
          words: line.words?.map((word: any) => ({
            ...word,
            start: Math.max(0, word.start - clipStartSec),
            end: word.end - clipStartSec,
          })),
        }))
    : [];

  const clipPayload = {
    spotify_track_id: spotifyTrackId,
    language_code: translation.language_code,
    translator: translation.translator,
    quality_score: translation.quality_score,
    lines: clipLines,
    generated_at: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  const clipBuffer = Buffer.from(JSON.stringify(clipPayload, null, 2));
  const clipResult = await grove.uploadFile(
    clipBuffer,
    `${spotifyTrackId}-${translation.language_code}-clip-translation.json`,
    'application/json'
  );

  return {
    languageCode: translation.language_code,
    groveUrl: fullResult.url,
    clipGroveUrl: clipResult.url
  };
}

async function uploadClipMetadata(
  clip: ClipCandidate,
  clipHash: string,
  alignmentUri: string,
  translations: Array<{ languageCode: string; groveUrl: string; clipGroveUrl: string }>,
  lines: KaraokeLineRow[],
  clipLines: KaraokeLineRow[]
): Promise<string> {
  const clipDuration = clip.clip_end_ms - clip.clip_start_ms;

  // Strip @ prefix from lens handle if present
  const artistLensHandle = clip.artist_lens_handle?.startsWith('@')
    ? clip.artist_lens_handle.slice(1)
    : clip.artist_lens_handle;

  // Parse encryption_accs to extract lock address and chain ID
  const encryptionAccs = typeof clip.encryption_accs === 'string'
    ? JSON.parse(clip.encryption_accs)
    : clip.encryption_accs;

  const payload = {
    version: '2.0.0',
    type: 'karaoke-clip',
    clip_hash: clipHash,
    segment_hash: clipHash,
    grc20_work_id: clip.grc20_entity_id,
    spotify_track_id: clip.spotify_track_id,
    title: clip.title,
    artist: clip.artist_name,
    artistLensHandle: artistLensHandle,
    coverUri: clip.cover_thumbnail_url ?? clip.cover_url,
    timing: {
      full_segment_start_ms: clip.clip_start_ms,
      full_segment_end_ms: clip.clip_end_ms,
      full_segment_duration_ms: clipDuration,
      tiktok_clip_start_ms: clip.clip_start_ms,
      tiktok_clip_end_ms: clip.clip_end_ms,
      tiktok_clip_duration_ms: clipDuration,
    },
    assets: {
      instrumental: clip.clip_grove_url ?? clip.fal_enhanced_grove_url,
      full_instrumental: clip.fal_enhanced_grove_url,
      alignment: alignmentUri,
    },
    // Encryption data - required for subscription access
    encryption: {
      encryptedFullUri: clip.encrypted_full_url,
      unlockLockAddress: encryptionAccs.unlock?.lockAddress,
      unlockChainId: encryptionAccs.unlock?.chainId,
    },
    translations: translations.map((entry) => ({
      language_code: entry.languageCode,
      grove_url: entry.groveUrl,
      clip_grove_url: entry.clipGroveUrl,
    })),
    karaoke_lines: lines.map((line) => ({
      line_id: line.line_id,
      line_index: line.line_index,
      original_text: line.original_text,
      start_ms: line.start_ms,
      end_ms: line.end_ms,
      duration_ms: line.duration_ms,
    })),
    clip_lines: clipLines.map((line) => ({
      line_id: line.line_id,
      line_index: line.line_index,
      original_text: line.original_text,
      start_ms: line.start_ms,
      end_ms: line.end_ms,
      duration_ms: line.duration_ms,
    })),
    generated_at: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  const buffer = Buffer.from(JSON.stringify(payload, null, 2));
  const result = await grove.uploadFile(buffer, `${clip.spotify_track_id}-clip.json`, 'application/json');
  return result.url;
}

async function updateLineClipHashes(spotifyTrackId: string, clipHash: string): Promise<void> {
  const bytes = clipHash.replace(/^0x/, '');
  await query(
    `UPDATE karaoke_lines
        SET segment_hash = decode($2, 'hex'), updated_at = NOW()
      WHERE spotify_track_id = $1`,
    [spotifyTrackId, bytes]
  );
}

async function emitClipEvents(
  contract: ethers.Contract,
  clip: ClipCandidate,
  clipHash: string,
  metadataUri: string,
  alignmentUri: string,
  translationCount: number,
  dryRun: boolean
): Promise<void> {
  const startMs = clip.clip_start_ms;
  const endMs = clip.clip_end_ms;
  const instrumentalUri = clip.clip_grove_url ?? clip.fal_enhanced_grove_url ?? '';

  // Parse encryption_accs to extract lock data
  const encryptionAccs = typeof clip.encryption_accs === 'string'
    ? JSON.parse(clip.encryption_accs)
    : clip.encryption_accs;

  if (!dryRun) {
    const tx1 = await contract.emitClipRegistered(
      clipHash,
      clip.grc20_entity_id,
      clip.spotify_track_id,
      startMs,
      endMs,
      metadataUri
    );
    console.log(`    ⏳ ClipRegistered submitted: ${tx1.hash}`);
    const receipt1 = await tx1.wait();
    console.log(`    ✅ ClipRegistered confirmed: ${receipt1?.hash ?? tx1.hash}`);

    const tx2 = await contract.emitClipProcessed(
      clipHash,
      instrumentalUri,
      alignmentUri,
      translationCount,
      metadataUri
    );
    console.log(`    ⏳ ClipProcessed submitted: ${tx2.hash}`);
    const receipt2 = await tx2.wait();
    console.log(`    ✅ ClipProcessed confirmed: ${receipt2?.hash ?? tx2.hash}`);

    // CRITICAL: Emit SongEncrypted event so subgraph indexes encryption metadata
    const encryptedManifestUri = encryptionAccs.manifest?.url ?? '';
    const tx3 = await contract.emitSongEncrypted(
      clipHash,
      clip.spotify_track_id,
      clip.encrypted_full_url,
      encryptedManifestUri,
      encryptionAccs.unlock?.lockAddress,
      encryptionAccs.unlock?.chainId,
      metadataUri
    );
    console.log(`    ⏳ SongEncrypted submitted: ${tx3.hash}`);
    const receipt3 = await tx3.wait();
    console.log(`    ✅ SongEncrypted confirmed: ${receipt3?.hash ?? tx3.hash}`);
  } else {
    console.log('    [dry-run] Would emit ClipRegistered, ClipProcessed, and SongEncrypted events');
  }
}

async function processClip(
  contract: ethers.Contract,
  clip: ClipCandidate,
  dryRun: boolean
): Promise<void> {
  console.log(`\n🎵 ${clip.title} (${clip.spotify_track_id})`);

  // CRITICAL: Pre-flight validation - ensures encryption is complete
  const validation = validateEmissionReadiness(clip);
  if (!validation.ready) {
    console.warn(`   ⚠️  Not ready for emission: ${validation.reason}`);
    return;
  }

  const alignment = await fetchAlignment(clip.spotify_track_id);
  if (!alignment) {
    console.warn('   ⚠️  Missing alignment data, skipping');
    return;
  }

  const translations = await fetchTranslations(clip.spotify_track_id);
  if (translations.length === 0) {
    console.warn('   ⚠️  No translations found, skipping');
    return;
  }

  const lines = await fetchLines(clip.spotify_track_id);
  if (lines.length === 0) {
    console.warn('   ⚠️  No karaoke lines found, skipping');
    return;
  }

  const clipLines = await fetchClipLines(clip.spotify_track_id);
  if (clipLines.length === 0) {
    console.warn('   ⚠️  No clip lines found, skipping');
    return;
  }

  const clipHash = toHexClipHash(clip.spotify_track_id, clip.clip_start_ms);
  console.log(`   🔑 Clip hash: ${clipHash}`);

  if (!dryRun) {
    const existingHash = bytesToHex(lines[0]?.segment_hash);
    if (existingHash && existingHash.toLowerCase() === clipHash.toLowerCase()) {
      console.log('   ⚠️  Clip already processed (hash present). Skipping to avoid duplicate emission.');
      return;
    }
  }

  // Log encryption metadata confirmation
  const encryptionAccs = typeof clip.encryption_accs === 'string'
    ? JSON.parse(clip.encryption_accs)
    : clip.encryption_accs;
  console.log(`   🔒 Unlock lock: ${encryptionAccs.unlock?.lockAddress} (chain ${encryptionAccs.unlock?.chainId})`);
  console.log(`   🔐 Encrypted full track: ${clip.encrypted_full_url?.substring(0, 50)}...`);

  const alignmentUri = dryRun ? 'https://api.grove.storage/dry-run-alignment' : await uploadAlignment(clip.spotify_track_id, alignment);
  console.log(`   📼 Alignment URI: ${alignmentUri}`);

  const translationUploads: Array<{ languageCode: string; groveUrl: string; clipGroveUrl: string }> = [];
  for (const translation of translations) {
    const uploadResult = dryRun
      ? { languageCode: translation.language_code, groveUrl: `https://api.grove.storage/dry-run-${translation.language_code}`, clipGroveUrl: `https://api.grove.storage/dry-run-${translation.language_code}-clip` }
      : await uploadTranslation(clip.spotify_track_id, translation, clip.clip_start_ms, clip.clip_end_ms);
    console.log(`   🌐 Translation ${translation.language_code}: ${uploadResult.groveUrl} (clip: ${uploadResult.clipGroveUrl})`);
    translationUploads.push(uploadResult);
  }

  const metadataUri = dryRun
    ? 'https://api.grove.storage/dry-run-clip-metadata'
    : await uploadClipMetadata(clip, clipHash, alignmentUri, translationUploads, lines, clipLines);

  console.log(`   🗃️  Metadata URI: ${metadataUri}`);

  if (!dryRun) {
    await updateLineClipHashes(clip.spotify_track_id, clipHash);
    console.log('   📝 Updated karaoke_lines with clip hash');
  }

  await emitClipEvents(
    contract,
    clip,
    clipHash,
    metadataUri,
    alignmentUri,
    translationUploads.length,
    dryRun
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const trackArg = args.find(arg => arg.startsWith('--trackId='));
  const dryRun = args.includes('--dry-run');
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5;
  const trackId = trackArg ? trackArg.split('=')[1] : undefined;

  const normalizedLimit = Number.isNaN(limit) ? 5 : Math.max(1, limit);

  const clips = await fetchClipCandidates(normalizedLimit, trackId);

  if (clips.length === 0) {
    console.log('No clip candidates found.');
    return;
  }

  console.log(`Found ${clips.length} clip(s) to process${dryRun ? ' [dry run]' : ''}.`);

  const address = requireAddress(KARAOKE_EVENTS_ADDRESS);

  const contract = (() => {
    if (dryRun) {
      return new ethers.Contract(address, KaraokeEventsArtifact.abi);
    }

    const provider = new ethers.JsonRpcProvider(LENS_TESTNET_RPC);
    const wallet = new ethers.Wallet(getPrivateKey(), provider);
    return new ethers.Contract(address, KaraokeEventsArtifact.abi, wallet);
  })();

  for (const clip of clips) {
    try {
      await processClip(contract, clip, dryRun);
    } catch (error) {
      console.error(`   ✗ Failed to process ${clip.spotify_track_id}:`, error);
    }
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Fatal error emitting segment events:', error);
    process.exit(1);
  });
}

export { main as emitClipEventsTask };
