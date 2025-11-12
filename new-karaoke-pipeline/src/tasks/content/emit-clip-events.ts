#!/usr/bin/env bun

import '../../env';

import { ethers } from 'ethers';
import {
  CLIP_EVENTS_ADDRESS,
  LENS_TESTNET_RPC,
} from '../../../../lit-actions/config/contracts.config.js';
import ClipEventsArtifact from '../../../../contracts/out/ClipEvents.sol/ClipEvents.json' assert { type: 'json' };

import { query } from '../../db/connection';
import { GroveService } from '../../services/grove';

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
  has_hash?: boolean;
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
    throw new Error('CLIP_EVENTS_ADDRESS not configured');
  }

  return ethers.getAddress(address);
}

async function fetchClipCandidates(limit: number): Promise<ClipCandidate[]> {
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
       AND gw.grc20_entity_id IS NOT NULL
     ORDER BY COALESCE(line_state.has_hash, FALSE) ASC, t.updated_at ASC
     LIMIT $1` ,
    [limit]
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
  translation: TranslationRow
): Promise<{ languageCode: string; groveUrl: string }> {
  const payload = {
    spotify_track_id: spotifyTrackId,
    language_code: translation.language_code,
    translator: translation.translator,
    quality_score: translation.quality_score,
    lines: translation.lines,
    generated_at: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  const buffer = Buffer.from(JSON.stringify(payload, null, 2));
  const result = await grove.uploadFile(
    buffer,
    `${spotifyTrackId}-${translation.language_code}-translation.json`,
    'application/json'
  );

  return { languageCode: translation.language_code, groveUrl: result.url };
}

async function uploadClipMetadata(
  clip: ClipCandidate,
  clipHash: string,
  alignmentUri: string,
  translations: Array<{ languageCode: string; groveUrl: string }>,
  lines: KaraokeLineRow[]
): Promise<string> {
  const clipDuration = clip.clip_end_ms - clip.clip_start_ms;

  // Strip @ prefix from lens handle if present
  const artistLensHandle = clip.artist_lens_handle?.startsWith('@')
    ? clip.artist_lens_handle.slice(1)
    : clip.artist_lens_handle;

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
    translations: translations.map((entry) => ({
      language_code: entry.languageCode,
      grove_url: entry.groveUrl,
    })),
    karaoke_lines: lines.map((line) => ({
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
  } else {
    console.log('    [dry-run] Would emit ClipRegistered and ClipProcessed events');
  }
}

async function processClip(
  contract: ethers.Contract,
  clip: ClipCandidate,
  dryRun: boolean
): Promise<void> {
  console.log(`\n🎵 ${clip.title} (${clip.spotify_track_id})`);

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

  const clipHash = toHexClipHash(clip.spotify_track_id, clip.clip_start_ms);
  console.log(`   🔑 Clip hash: ${clipHash}`);

  if (!dryRun) {
    const existingHash = bytesToHex(lines[0]?.segment_hash);
    if (existingHash && existingHash.toLowerCase() === clipHash.toLowerCase()) {
      console.log('   ⚠️  Clip already processed (hash present). Skipping to avoid duplicate emission.');
      return;
    }
  }

  const alignmentUri = dryRun ? 'https://api.grove.storage/dry-run-alignment' : await uploadAlignment(clip.spotify_track_id, alignment);
  console.log(`   📼 Alignment URI: ${alignmentUri}`);

  const translationUploads: Array<{ languageCode: string; groveUrl: string }> = [];
  for (const translation of translations) {
    const uploadResult = dryRun
      ? { languageCode: translation.language_code, groveUrl: `https://api.grove.storage/dry-run-${translation.language_code}` }
      : await uploadTranslation(clip.spotify_track_id, translation);
    console.log(`   🌐 Translation ${translation.language_code}: ${uploadResult.groveUrl}`);
    translationUploads.push(uploadResult);
  }

  const metadataUri = dryRun
    ? 'https://api.grove.storage/dry-run-clip-metadata'
    : await uploadClipMetadata(clip, clipHash, alignmentUri, translationUploads, lines);

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
  const dryRun = args.includes('--dry-run');
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5;

  const normalizedLimit = Number.isNaN(limit) ? 5 : Math.max(1, limit);

  const clips = await fetchClipCandidates(normalizedLimit);

  if (clips.length === 0) {
    console.log('No clip candidates found.');
    return;
  }

  console.log(`Found ${clips.length} clip(s) to process${dryRun ? ' [dry run]' : ''}.`);

  const address = requireAddress(CLIP_EVENTS_ADDRESS);

  const contract = (() => {
    if (dryRun) {
      return new ethers.Contract(address, ClipEventsArtifact.abi);
    }

    const provider = new ethers.JsonRpcProvider(LENS_TESTNET_RPC);
    const wallet = new ethers.Wallet(getPrivateKey(), provider);
    return new ethers.Contract(address, ClipEventsArtifact.abi, wallet);
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
