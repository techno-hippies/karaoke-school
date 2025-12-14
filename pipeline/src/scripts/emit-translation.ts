#!/usr/bin/env bun
/**
 * Emit Translation Script
 *
 * Emits lyric translations via TranslationEvents contract.
 * This allows adding new languages without re-emitting clips.
 *
 * Usage:
 *   # Emit existing translation from DB
 *   bun src/scripts/emit-translation.ts --iswc=T0112199333 --language=ja
 *
 *   # Emit all translations for a song (vi, id, etc.)
 *   bun src/scripts/emit-translation.ts --iswc=T0112199333 --all
 *
 *   # Dry run (validate and preview without emitting)
 *   bun src/scripts/emit-translation.ts --iswc=T0112199333 --language=ja --dry-run
 *
 *   # Update existing translation (re-emit with new content)
 *   bun src/scripts/emit-translation.ts --iswc=T0112199333 --language=ja --update
 */

import { parseArgs } from 'util';
import { ethers } from 'ethers';
import { query, queryOne } from '../db/connection';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv } from '../config';
import { uploadMetadataToGrove } from '../services/grove';
import {
  validateTranslationMetadata,
  formatZodErrors,
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  type SupportedLanguage,
  type TranslationMetadata,
} from '../lib/schemas';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    language: { type: 'string' },
    all: { type: 'boolean', default: false },
    update: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

// Contract config
const TRANSLATION_EVENTS_ADDRESS = '0xB524A8A996CE416484eB4fd8f18D9c04a147FdeD';
const RPC_URL = 'https://rpc.testnet.lens.xyz';

const TRANSLATION_EVENTS_ABI = [
  'function emitTranslationAdded(bytes32 segmentHash, string languageCode, string translationUri) external',
  'function emitTranslationUpdated(bytes32 segmentHash, string languageCode, string translationUri, bool validated) external',
];

interface SongData {
  id: string;
  iswc: string;
  spotify_track_id: string;
  title: string;
}

interface ClipData {
  id: string;
  song_id: string;
  start_ms: number;
  end_ms: number;
  clip_hash: string | null;
  emitted_at: string | null;
}

interface LyricData {
  id: string;
  song_id: string;
  line_index: number;
  language: string;
  text: string;
  start_ms: number | null;
  end_ms: number | null;
}

async function main() {
  validateEnv(['DATABASE_URL', 'PRIVATE_KEY']);

  if (!values.iswc) {
    console.error('Usage: bun src/scripts/emit-translation.ts --iswc=T0112199333 --language=ja');
    console.error('       bun src/scripts/emit-translation.ts --iswc=T0112199333 --all');
    process.exit(1);
  }

  if (!values.language && !values.all) {
    console.error('❌ Must specify --language=<code> or --all');
    console.error(`   Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const dryRun = values['dry-run'];
  const isUpdate = values.update;

  console.log('\n📤 Emit Translation');
  console.log(`   ISWC: ${iswc}`);
  if (dryRun) console.log('   Mode: DRY RUN');
  if (isUpdate) console.log('   Mode: UPDATE (re-emit)');

  // Get song
  const song = await queryOne<SongData>(
    `SELECT id, iswc, spotify_track_id, title FROM songs WHERE iswc = $1`,
    [iswc]
  );

  if (!song) {
    console.error(`❌ Song not found: ${iswc}`);
    process.exit(1);
  }

  console.log(`   Song: ${song.title}`);
  console.log(`   Spotify: ${song.spotify_track_id}`);

  // Get emitted clip (we need the clipHash)
  const clip = await queryOne<ClipData>(
    `SELECT id, song_id, start_ms, end_ms, clip_hash, emitted_at FROM clips WHERE song_id = $1`,
    [song.id]
  );

  if (!clip) {
    console.error(`❌ No clip found for song. Run emit-clip-full.ts first.`);
    process.exit(1);
  }

  if (!clip.emitted_at) {
    console.error(`❌ Clip not emitted yet. Run emit-clip-full.ts first.`);
    process.exit(1);
  }

  // Calculate clipHash if not stored (should match KaraokeEvents.getClipHash)
  const clipHash = clip.clip_hash || ethers.solidityPackedKeccak256(
    ['string', 'uint32'],
    [song.spotify_track_id, clip.start_ms]
  );

  console.log(`   Clip: ${clip.start_ms}ms - ${clip.end_ms}ms`);
  console.log(`   ClipHash: ${clipHash}`);

  // Determine which languages to emit
  let languagesToEmit: SupportedLanguage[] = [];

  if (values.all) {
    // Get all non-English languages that have lyrics in DB
    const availableLangs = await query<{ language: string }>(
      `SELECT DISTINCT language FROM lyrics WHERE song_id = $1 AND language != 'en'`,
      [song.id]
    );
    languagesToEmit = availableLangs
      .map(l => l.language as SupportedLanguage)
      .filter(l => SUPPORTED_LANGUAGES.includes(l));
  } else {
    const lang = values.language as SupportedLanguage;
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      console.error(`❌ Unsupported language: ${lang}`);
      console.error(`   Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
      process.exit(1);
    }
    languagesToEmit = [lang];
  }

  if (languagesToEmit.length === 0) {
    console.log('\n✅ No translations to emit');
    return;
  }

  console.log(`\n📋 Languages to emit: ${languagesToEmit.join(', ')}`);

  // Connect to Lens testnet
  console.log('\n🔗 Connecting to Lens testnet...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(TRANSLATION_EVENTS_ADDRESS, TRANSLATION_EVENTS_ABI, wallet);

  console.log(`   Wallet: ${wallet.address}`);
  console.log(`   Contract: ${TRANSLATION_EVENTS_ADDRESS}`);

  let emitted = 0;
  let failed = 0;

  for (const languageCode of languagesToEmit) {
    try {
      console.log(`\n📝 Processing ${languageCode} (${LANGUAGE_NAMES[languageCode].english})`);

      // Get lyrics for this language
      const lyrics = await query<LyricData>(
        `SELECT id, song_id, line_index, language, text, start_ms, end_ms
         FROM lyrics
         WHERE song_id = $1 AND language = $2
         ORDER BY line_index`,
        [song.id, languageCode]
      );

      if (lyrics.length === 0) {
        console.log(`   ⚠️ No lyrics found for ${languageCode}, skipping`);
        continue;
      }

      console.log(`   Found ${lyrics.length} lines`);

      // Build translation metadata
      const metadata: TranslationMetadata = {
        version: '1.0.0',
        clipHash,
        spotifyTrackId: song.spotify_track_id,
        iswc: song.iswc,
        languageCode,
        languageName: LANGUAGE_NAMES[languageCode].native,
        generatedAt: new Date().toISOString(),
        validated: false,
        lines: lyrics.map(l => ({
          line_index: l.line_index,
          text: l.text,
        })),
        lineCount: lyrics.length,
      };

      // Validate metadata
      try {
        validateTranslationMetadata(metadata);
        console.log('   ✓ Metadata validated');
      } catch (error: any) {
        console.error(`   ❌ Validation failed:`);
        console.error(formatZodErrors(error));
        failed++;
        continue;
      }

      if (dryRun) {
        console.log('   [DRY RUN] Would upload metadata and emit event');
        console.log(`   Preview: ${JSON.stringify(metadata, null, 2).substring(0, 500)}...`);
        emitted++;
        continue;
      }

      // Upload metadata to Grove
      console.log('   Uploading metadata to Grove...');
      const result = await uploadMetadataToGrove(
        metadata,
        `translation-${song.iswc}-${languageCode}.json`
      );
      const translationUri = result.url;
      console.log(`   URI: ${translationUri}`);

      // Emit event
      let tx;
      if (isUpdate) {
        console.log('   Emitting TranslationUpdated...');
        tx = await contract.emitTranslationUpdated(
          clipHash,
          languageCode,
          translationUri,
          false // validated
        );
      } else {
        console.log('   Emitting TranslationAdded...');
        tx = await contract.emitTranslationAdded(
          clipHash,
          languageCode,
          translationUri
        );
      }

      console.log(`   Transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`   Confirmed in block ${receipt.blockNumber}`);

      emitted++;
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log('\n📊 Summary');
  console.log(`   Emitted: ${emitted}`);
  console.log(`   Failed: ${failed}`);

  if (emitted > 0 && !dryRun) {
    console.log(`\n✅ Translations emitted successfully`);
    console.log(`   View on subgraph: translations for clipHash ${clipHash}`);
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
