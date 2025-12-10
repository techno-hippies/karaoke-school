#!/usr/bin/env bun
/**
 * Emit Clip Localizations
 *
 * Emits ClipLocalizationUpdated events for existing clips to populate
 * subgraph with translated titles/artist names.
 *
 * Uses JSON-based localization format for flexible language support:
 * { "title_zh": "...", "artist_zh": "...", "title_es": "...", ... }
 *
 * Supported languages: zh, vi, id, ja, ko, es, pt, ar, tr, ru, hi, th
 *
 * Usage:
 *   bun src/scripts/emit-localizations.ts --all
 *   bun src/scripts/emit-localizations.ts --iswc=T0101545054
 *   bun src/scripts/emit-localizations.ts --all --dry-run
 */

import { parseArgs } from 'util';
import { ethers } from 'ethers';
import { query } from '../db/connection';

const KARAOKE_EVENTS_ADDRESS = '0xd942eB51C86c46Db82678627d19Aa44630F901aE'; // V6 - JSON localizations
const LENS_RPC = 'https://rpc.testnet.lens.xyz';

// V6 ABI with JSON localizations param
const KARAOKE_EVENTS_ABI = [
  'function emitClipLocalizationUpdated(bytes32 clipHash, string localizations, string genres) external',
];

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    all: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    limit: { type: 'string', default: '100' },
  },
  strict: true,
});

interface SongWithLocalization {
  iswc: string;
  spotify_track_id: string;
  title: string;
  // Title localizations
  title_zh: string | null;
  title_vi: string | null;
  title_id: string | null;
  title_ja: string | null;
  title_ko: string | null;
  title_es: string | null;
  title_pt: string | null;
  title_ar: string | null;
  title_tr: string | null;
  title_ru: string | null;
  title_hi: string | null;
  title_th: string | null;
  // Artist localizations
  artist_name: string;
  artist_name_zh: string | null;
  artist_name_vi: string | null;
  artist_name_id: string | null;
  artist_name_ja: string | null;
  artist_name_ko: string | null;
  artist_name_es: string | null;
  artist_name_pt: string | null;
  artist_name_ar: string | null;
  artist_name_tr: string | null;
  artist_name_ru: string | null;
  artist_name_hi: string | null;
  artist_name_th: string | null;
  artist_genres: string[];
  clip_end_ms: number | null;
}

function generateClipHash(spotifyTrackId: string, clipStartMs: number): string {
  return ethers.solidityPackedKeccak256(
    ['string', 'uint32'],
    [spotifyTrackId, clipStartMs]
  );
}

/**
 * Build JSON localizations object from song data
 * Only includes non-null values to minimize gas costs
 */
function buildLocalizationsJson(song: SongWithLocalization): string {
  const localizations: Record<string, string> = {};

  // Title localizations
  if (song.title_zh) localizations.title_zh = song.title_zh;
  if (song.title_vi) localizations.title_vi = song.title_vi;
  if (song.title_id) localizations.title_id = song.title_id;
  if (song.title_ja) localizations.title_ja = song.title_ja;
  if (song.title_ko) localizations.title_ko = song.title_ko;
  if (song.title_es) localizations.title_es = song.title_es;
  if (song.title_pt) localizations.title_pt = song.title_pt;
  if (song.title_ar) localizations.title_ar = song.title_ar;
  if (song.title_tr) localizations.title_tr = song.title_tr;
  if (song.title_ru) localizations.title_ru = song.title_ru;
  if (song.title_hi) localizations.title_hi = song.title_hi;
  if (song.title_th) localizations.title_th = song.title_th;

  // Artist localizations
  if (song.artist_name_zh) localizations.artist_zh = song.artist_name_zh;
  if (song.artist_name_vi) localizations.artist_vi = song.artist_name_vi;
  if (song.artist_name_id) localizations.artist_id = song.artist_name_id;
  if (song.artist_name_ja) localizations.artist_ja = song.artist_name_ja;
  if (song.artist_name_ko) localizations.artist_ko = song.artist_name_ko;
  if (song.artist_name_es) localizations.artist_es = song.artist_name_es;
  if (song.artist_name_pt) localizations.artist_pt = song.artist_name_pt;
  if (song.artist_name_ar) localizations.artist_ar = song.artist_name_ar;
  if (song.artist_name_tr) localizations.artist_tr = song.artist_name_tr;
  if (song.artist_name_ru) localizations.artist_ru = song.artist_name_ru;
  if (song.artist_name_hi) localizations.artist_hi = song.artist_name_hi;
  if (song.artist_name_th) localizations.artist_th = song.artist_name_th;

  return JSON.stringify(localizations);
}

async function main() {
  if (!values.all && !values.iswc) {
    console.error('❌ Must specify --all or --iswc=T...');
    process.exit(1);
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey && !values['dry-run']) {
    console.error('❌ PRIVATE_KEY env var required');
    process.exit(1);
  }

  // Query songs with localizations (all 12 languages)
  let sql = `
    SELECT
      s.iswc,
      s.spotify_track_id,
      s.title,
      s.title_zh, s.title_vi, s.title_id, s.title_ja, s.title_ko,
      s.title_es, s.title_pt, s.title_ar, s.title_tr, s.title_ru, s.title_hi, s.title_th,
      a.name as artist_name,
      a.name_zh as artist_name_zh, a.name_vi as artist_name_vi, a.name_id as artist_name_id,
      a.name_ja as artist_name_ja, a.name_ko as artist_name_ko,
      a.name_es as artist_name_es, a.name_pt as artist_name_pt, a.name_ar as artist_name_ar,
      a.name_tr as artist_name_tr, a.name_ru as artist_name_ru, a.name_hi as artist_name_hi,
      a.name_th as artist_name_th,
      a.genres as artist_genres,
      s.clip_end_ms
    FROM songs s
    JOIN artists a ON s.artist_id = a.id
    WHERE s.clip_end_ms IS NOT NULL
      AND s.spotify_track_id IS NOT NULL
  `;

  if (values.iswc) {
    sql += ` AND s.iswc = '${values.iswc}'`;
  }

  sql += ` ORDER BY s.created_at DESC LIMIT ${values.limit}`;

  const songs = await query<SongWithLocalization>(sql);

  if (songs.length === 0) {
    console.log('No songs found with clips');
    return;
  }

  console.log(`Found ${songs.length} songs with clips\n`);

  // Setup contract
  let contract: ethers.Contract | null = null;
  if (!values['dry-run']) {
    const provider = new ethers.JsonRpcProvider(LENS_RPC);
    const wallet = new ethers.Wallet(privateKey!, provider);
    contract = new ethers.Contract(KARAOKE_EVENTS_ADDRESS, KARAOKE_EVENTS_ABI, wallet);
  }

  for (const song of songs) {
    const clipHash = generateClipHash(song.spotify_track_id, 0);
    const genresJson = JSON.stringify(song.artist_genres || []);
    const localizationsJson = buildLocalizationsJson(song);

    console.log(`\n📍 ${song.title} (${song.iswc})`);
    console.log(`   clipHash: ${clipHash}`);
    console.log(`   localizations: ${localizationsJson}`);
    console.log(`   genres: ${genresJson}`);

    if (values['dry-run']) {
      console.log('   [DRY RUN - skipping emit]');
      continue;
    }

    try {
      const tx = await contract!.emitClipLocalizationUpdated(
        clipHash,
        localizationsJson,
        genresJson
      );
      console.log(`   ✅ TX: ${tx.hash}`);
      await tx.wait();
      console.log(`   ✅ Confirmed`);
    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  console.log('\n✅ Done');
}

main().catch(console.error);
