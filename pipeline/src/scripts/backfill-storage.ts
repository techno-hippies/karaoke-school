#!/usr/bin/env bun
/**
 * Backfill Storage Layers (Full Redundancy)
 *
 * Ensures all content exists on all three storage layers:
 * - Grove (primary) - already there
 * - Arweave (permanent) - free <100KB
 * - Lighthouse (IPFS + Filecoin) - 5GB free
 *
 * Usage:
 *   bun src/scripts/backfill-storage.ts --type=metadata     # Metadata → Arweave + Lighthouse
 *   bun src/scripts/backfill-storage.ts --type=audio        # Audio → Lighthouse (Arweave needs $AR)
 *   bun src/scripts/backfill-storage.ts --type=all          # Both
 *   bun src/scripts/backfill-storage.ts --dry-run
 *   bun src/scripts/backfill-storage.ts --limit=5
 */

import { parseArgs } from 'util';
import { createHash } from 'crypto';
import { query } from '../db/connection';
import { uploadToArweave, getArweaveUrls, getTurboBalance } from '../services/arweave';
import { uploadToLighthouse, getIpfsUrls, getLighthouseBalance } from '../services/lighthouse';
import { StorageManifestSchema, formatZodErrors } from '../lib/schemas';
import type { StorageManifest } from '../types';

const ARWEAVE_WALLET_PATH = './arweave-wallet.json';
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v6-json-localizations';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    type: { type: 'string', default: 'metadata' }, // metadata | audio | all
    'dry-run': { type: 'boolean', default: false },
    limit: { type: 'string' },
    iswc: { type: 'string' }, // Process single song
  },
  strict: true,
});

interface ClipWithMetadata {
  clip_id: string;
  song_id: string;
  iswc: string;
  title: string;
  spotify_track_id: string;
  metadata_uri: string | null;
  metadata_arweave_uri: string | null;
  metadata_lighthouse_uri: string | null;
  clip_instrumental_url: string | null;
  storage_manifest: StorageManifest | null;
}

/**
 * Fetch metadata JSON from Grove
 */
async function fetchGroveMetadata(url: string): Promise<{ data: unknown; size: number }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const text = await response.text();
  return {
    data: JSON.parse(text),
    size: Buffer.byteLength(text, 'utf8'),
  };
}

/**
 * Fetch audio file from Grove
 */
async function fetchGroveAudio(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Backfill metadata to Arweave + Lighthouse (full redundancy)
 */
async function backfillMetadata(dryRun: boolean, limit?: number, iswc?: string) {
  console.log('\n📋 Backfilling Metadata (Full Redundancy)');
  console.log('─'.repeat(50));

  // Check Turbo balance
  try {
    const balance = await getTurboBalance(ARWEAVE_WALLET_PATH);
    console.log(`Turbo Balance: ${balance.ar.toFixed(6)} AR (${balance.winc} winc)`);
  } catch (e) {
    console.log('Turbo Balance: Using free credits (<100KB)');
  }

  // Query clips that need metadata backfill (missing Arweave OR Lighthouse)
  let queryText = `
    SELECT
      c.id as clip_id,
      c.song_id,
      s.iswc,
      s.title,
      s.spotify_track_id,
      c.metadata_uri,
      c.metadata_arweave_uri,
      c.metadata_lighthouse_uri,
      s.storage_manifest
    FROM clips c
    JOIN songs s ON c.song_id = s.id
    WHERE c.emitted_at IS NOT NULL
      AND (c.metadata_arweave_uri IS NULL OR c.metadata_lighthouse_uri IS NULL)
  `;

  if (iswc) {
    queryText += ` AND s.iswc = '${iswc}'`;
  }

  queryText += ' ORDER BY c.created_at DESC';

  if (limit) {
    queryText += ` LIMIT ${limit}`;
  }

  const clips = await query<ClipWithMetadata>(queryText);

  if (clips.length === 0) {
    console.log('✅ No clips need metadata backfill');
    return;
  }

  console.log(`Found ${clips.length} clips needing metadata backfill\n`);

  // We need to get metadata URIs from the subgraph since they're not in our DB
  const subgraphQuery = `
    query GetClipMetadata($spotifyIds: [String!]!) {
      clips(where: { spotifyTrackId_in: $spotifyIds }) {
        spotifyTrackId
        metadataUri
      }
    }
  `;

  const spotifyIds = clips.map(c => c.spotify_track_id).filter(Boolean);

  const subgraphResponse = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: subgraphQuery,
      variables: { spotifyIds },
    }),
  });

  const subgraphData = await subgraphResponse.json() as any;
  const metadataMap = new Map<string, string>();

  for (const clip of subgraphData.data?.clips || []) {
    metadataMap.set(clip.spotifyTrackId, clip.metadataUri);
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const clip of clips) {
    const metadataUri = metadataMap.get(clip.spotify_track_id);

    if (!metadataUri) {
      console.log(`⏭️  ${clip.title} - No metadata URI in subgraph`);
      skipped++;
      continue;
    }

    const needsArweave = !clip.metadata_arweave_uri;
    const needsLighthouse = !clip.metadata_lighthouse_uri;

    console.log(`\n📦 ${clip.title} (${clip.iswc})`);
    console.log(`   Grove: ${metadataUri}`);
    console.log(`   Needs: ${[needsArweave ? 'Arweave' : null, needsLighthouse ? 'Lighthouse' : null].filter(Boolean).join(', ') || 'Nothing'}`);

    if (!needsArweave && !needsLighthouse) {
      console.log(`   ✅ Already on all layers`);
      continue;
    }

    try {
      // Fetch metadata from Grove
      const { data, size } = await fetchGroveMetadata(metadataUri);
      console.log(`   Size: ${(size / 1024).toFixed(2)} KB`);

      const buffer = Buffer.from(JSON.stringify(data, null, 2));
      const contentHash = createHash('sha256').update(buffer).digest('hex');

      // Start building manifest from existing or fresh
      const existingManifest: Partial<StorageManifest> = clip.storage_manifest ?? {};
      const manifest: StorageManifest = {
        ...existingManifest,
        contentHash,
        sizeBytes: size,
        mimeType: 'application/json',
        uploadedAt: new Date().toISOString(),
        grove: existingManifest.grove || {
          cid: metadataUri.split('/').pop()!,
          url: metadataUri,
        },
      };

      if (dryRun) {
        if (needsArweave && size <= 100 * 1024) console.log(`   🔍 DRY RUN - would upload to Arweave`);
        if (needsArweave && size > 100 * 1024) console.log(`   ⚠️  Too large for free Arweave (>100KB)`);
        if (needsLighthouse) console.log(`   🔍 DRY RUN - would upload to Lighthouse`);
        success++;
        continue;
      }

      // Upload to Arweave if needed and size allows
      if (needsArweave) {
        if (size <= 100 * 1024) {
          const arweaveResult = await uploadToArweave(
            buffer,
            `${clip.iswc}-metadata.json`,
            { contentType: 'application/json' },
            ARWEAVE_WALLET_PATH
          );
          console.log(`   ✅ Arweave: ${arweaveResult.url}`);

          await query(
            `UPDATE clips SET metadata_arweave_uri = $1 WHERE id = $2`,
            [arweaveResult.url, clip.clip_id]
          );

          manifest.arweave = {
            txId: arweaveResult.txId,
            url: arweaveResult.url,
            urls: arweaveResult.urls,
          };
        } else {
          console.log(`   ⚠️  Too large for free Arweave (>100KB) - skipping Arweave`);
        }
      }

      // Upload to Lighthouse if needed
      if (needsLighthouse) {
        const lighthouseResult = await uploadToLighthouse(buffer, `${clip.iswc}-metadata.json`);
        console.log(`   ✅ Lighthouse: ${lighthouseResult.url}`);

        await query(
          `UPDATE clips SET metadata_lighthouse_uri = $1 WHERE id = $2`,
          [lighthouseResult.url, clip.clip_id]
        );

        manifest.lighthouse = {
          cid: lighthouseResult.cid,
          url: lighthouseResult.url,
          urls: lighthouseResult.urls,
        };
      }

      // Save manifest
      const validation = StorageManifestSchema.safeParse(manifest);
      if (!validation.success) {
        console.log(`   ⚠️  Manifest validation failed:`);
        console.log(formatZodErrors(validation.error));
      } else {
        await query(
          `UPDATE songs SET storage_manifest = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(manifest), clip.song_id]
        );
      }

      success++;
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      failed++;
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
}

/**
 * Backfill audio to Lighthouse
 */
async function backfillAudioToLighthouse(dryRun: boolean, limit?: number, iswc?: string) {
  console.log('\n🎵 Backfilling Audio to Lighthouse');
  console.log('─'.repeat(50));

  // Check Lighthouse balance
  try {
    const balance = await getLighthouseBalance();
    const usedGB = (balance.dataUsed / 1024 / 1024 / 1024).toFixed(2);
    const limitGB = (balance.dataLimit / 1024 / 1024 / 1024).toFixed(2);
    console.log(`Lighthouse Usage: ${usedGB} GB / ${limitGB} GB`);
  } catch (e) {
    console.log('Lighthouse Balance: Could not fetch');
  }

  // Query songs with clip_instrumental_url but no lighthouse backup
  let queryText = `
    SELECT
      id,
      iswc,
      title,
      clip_instrumental_url,
      storage_manifest
    FROM songs
    WHERE clip_instrumental_url IS NOT NULL
      AND (storage_manifest IS NULL OR storage_manifest->'lighthouse' IS NULL)
  `;

  if (iswc) {
    queryText += ` AND iswc = '${iswc}'`;
  }

  queryText += ' ORDER BY created_at DESC';

  if (limit) {
    queryText += ` LIMIT ${limit}`;
  }

  const songs = await query<{
    id: string;
    iswc: string;
    title: string;
    clip_instrumental_url: string;
    storage_manifest: StorageManifest | null;
  }>(queryText);

  if (songs.length === 0) {
    console.log('✅ No songs need audio backfill');
    return;
  }

  console.log(`Found ${songs.length} songs needing audio backfill\n`);

  let success = 0;
  let failed = 0;

  for (const song of songs) {
    console.log(`\n🎵 ${song.title} (${song.iswc})`);
    console.log(`   Grove: ${song.clip_instrumental_url}`);

    try {
      // Fetch audio from Grove
      const audioBuffer = await fetchGroveAudio(song.clip_instrumental_url);
      const sizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
      console.log(`   Size: ${sizeMB} MB`);

      if (dryRun) {
        console.log(`   🔍 DRY RUN - would upload to Lighthouse`);
        success++;
        continue;
      }

      // Upload to Lighthouse
      const lighthouseResult = await uploadToLighthouse(
        audioBuffer,
        `${song.iswc}-clip.mp3`
      );

      console.log(`   ✅ Lighthouse: ${lighthouseResult.url}`);

      // Update storage manifest
      const contentHash = createHash('sha256').update(audioBuffer).digest('hex');
      const existingManifest: Partial<StorageManifest> = song.storage_manifest ?? {};

      const manifest: StorageManifest = {
        ...existingManifest,
        contentHash,
        sizeBytes: audioBuffer.length,
        mimeType: 'audio/mpeg',
        uploadedAt: new Date().toISOString(),
        grove: existingManifest.grove || {
          cid: song.clip_instrumental_url.split('/').pop()!,
          url: song.clip_instrumental_url,
        },
        lighthouse: {
          cid: lighthouseResult.cid,
          url: lighthouseResult.url,
          urls: lighthouseResult.urls,
        },
      };

      await query(
        `UPDATE songs SET storage_manifest = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(manifest), song.id]
      );

      success++;
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      failed++;
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
}

async function main() {
  const type = values.type as string;
  const dryRun = values['dry-run'];
  const limit = values.limit ? parseInt(values.limit) : undefined;
  const iswc = values.iswc;

  console.log('\n🗄️  Storage Backfill');
  console.log('═'.repeat(50));
  console.log(`Type: ${type}`);
  if (dryRun) console.log('Mode: DRY RUN');
  if (limit) console.log(`Limit: ${limit}`);
  if (iswc) console.log(`ISWC: ${iswc}`);

  if (type === 'metadata' || type === 'all') {
    await backfillMetadata(dryRun, limit, iswc);
  }

  if (type === 'audio' || type === 'all') {
    await backfillAudioToLighthouse(dryRun, limit, iswc);
  }

  console.log('\n✅ Backfill complete!');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
