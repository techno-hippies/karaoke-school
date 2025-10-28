/**
 * Step 3b: Import Musical Works to GRC-20
 *
 * Validates and mints musical works from grc20_works table
 * Links works to their artists via composedBy relation
 * Start with small batch for testing
 */

import { Graph, Ipfs, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import postgres from 'postgres';
import { config } from '../config';
import { MusicalWorkMintSchema } from '../types/validation-schemas';
import { validateBatch, formatValidationError } from '../types/validation-schemas';
import fs from 'fs';
import path from 'path';

interface GRC20Work {
  genius_song_id: number;
  title: string;
  iswc: string;
  genius_url: string;
  spotify_track_id: string | null;
  apple_music_id: string | null;
  wikidata_id: string | null;
  language: string | null;
  release_date: Date | null;
  annotation_count: number | null;
  pyongs_count: number | null;
  // Artist relation
  primary_artist_id: number;
  artist_entity_id: string; // GRC-20 entity ID (UUID)
  artist_name: string;
}

async function main() {
  console.log('🎵 Importing Musical Works to GRC-20...\n');

  // Validate config
  if (!config.privateKey) {
    throw new Error('Missing required config: privateKey');
  }

  if (!config.spaceId) {
    throw new Error('No GRC20_SPACE_ID found. Run: bun run setup');
  }

  if (!config.neonConnectionString) {
    throw new Error('Missing required config: DATABASE_URL');
  }

  // Get wallet client
  const privateKey = config.privateKey.startsWith('0x')
    ? config.privateKey
    : `0x${config.privateKey}`;
  const { address } = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = await getWalletClient({
    privateKey: privateKey as `0x${string}`,
  });

  console.log(`📝 Wallet: ${address}`);
  console.log(`🌐 Space: ${config.spaceId}`);
  console.log(`🌍 Network: ${config.network}\n`);

  // Load type IDs
  const typeIdsPath = path.join(__dirname, '../type-ids.json');
  if (!fs.existsSync(typeIdsPath)) {
    throw new Error('Type IDs not found. Run: bun run define-types');
  }

  const typeIds = JSON.parse(fs.readFileSync(typeIdsPath, 'utf-8'));
  console.log(`✅ Loaded type definitions`);
  console.log(`   Properties: ${Object.keys(typeIds.properties).length}`);
  console.log(`   Types: ${Object.keys(typeIds.types).length}\n`);

  // Connect to database
  const sql = postgres(config.neonConnectionString);

  try {
    // Fetch works with artist relations (MINT ALL REMAINING)
    const BATCH_SIZE = 250;
    console.log(`🔍 Fetching up to ${BATCH_SIZE} unminted works...\n`);

    const works = await sql<GRC20Work[]>`
      SELECT
        w.genius_song_id,
        w.title,
        w.iswc,
        COALESCE(
          NULLIF(TRIM(
            REGEXP_REPLACE(
              (w.field_consensus->>'genius_url')::text,
              '"',
              '',
              'g'
            )
          ), ''),
          'https://genius.com/songs/' || w.genius_song_id
        ) as genius_url,
        w.spotify_track_id,
        w.apple_music_id,
        (w.field_consensus->>'wikidata_id')::text as wikidata_id,
        w.language,
        w.release_date,
        (w.field_consensus->>'annotation_count')::int as annotation_count,
        (w.field_consensus->>'pyongs_count')::int as pyongs_count,
        w.primary_artist_id,
        a.grc20_entity_id as artist_entity_id,
        a.name as artist_name
      FROM grc20_works w
      JOIN grc20_artists a ON w.primary_artist_id = a.id
      WHERE w.iswc IS NOT NULL
        AND w.genius_song_id IS NOT NULL
        AND w.grc20_entity_id IS NULL  -- Not already minted
        AND a.grc20_entity_id IS NOT NULL  -- Artist must be minted first
      ORDER BY w.id
      LIMIT ${BATCH_SIZE}
    `;

    console.log(`   Found ${works.length} works with minted artists\n`);

    if (works.length === 0) {
      throw new Error('No mintable works found. Ensure artists are minted first.');
    }

    // Helper to format ISWC (converts T9214729972 → T-921472997-2)
    const formatISWC = (iswc: string | null) => {
      if (!iswc) return null;
      // If already formatted, return as-is
      if (iswc.includes('-')) return iswc;
      // Format: T + 9 digits + check digit → T-DDDDDDDDD-C
      const match = iswc.match(/^T(\d{9})(\d)$/);
      if (match) {
        return `T-${match[1]}-${match[2]}`;
      }
      return iswc; // Return unchanged if format doesn't match
    };

    // Validate works
    console.log('🔍 Validating works...');
    const worksToValidate = works.map(w => ({
      title: w.title,
      geniusId: w.genius_song_id,
      geniusUrl: w.genius_url,
      iswc: formatISWC(w.iswc),
      spotifyId: w.spotify_track_id,
      appleMusicId: w.apple_music_id,
      wikidataId: w.wikidata_id,
      language: w.language,
      releaseDate: w.release_date ? w.release_date.toISOString().split('T')[0] : null,
      geniusAnnotationCount: w.annotation_count,
      geniusPyongsCount: w.pyongs_count,
      composerMbids: [], // Not enforced yet
    }));

    const result = validateBatch(worksToValidate, MusicalWorkMintSchema);

    console.log(`   ✅ ${result.stats.validCount} valid`);
    console.log(`   ❌ ${result.stats.invalidCount} invalid\n`);

    if (result.invalid.length > 0) {
      console.log('❌ Validation errors:');
      result.invalid.forEach(({ item, errors }) => {
        console.log(`\n   Work: ${item.title}`);
        console.log(formatValidationError(errors));
      });
    }

    if (result.stats.validCount === 0) {
      throw new Error('No valid works to mint');
    }

    console.log(`\n✅ ${result.stats.validCount} works ready to mint\n`);

    // Build GRC-20 operations
    const ops: any[] = [];
    const entityMap: Record<number, string> = {}; // genius_song_id -> entity_id

    console.log('🏗️  Building GRC-20 entities...\n');

    for (let i = 0; i < result.stats.validCount; i++) {
      const validWork = result.valid[i];
      const originalWork = works[i];

      console.log(`   📝 ${validWork.title} by ${originalWork.artist_name}`);
      console.log(`      ISWC: ${validWork.iswc}`);
      console.log(`      Artist Entity: ${originalWork.artist_entity_id}`);

      // Build values array
      const values: Array<{ property: string; value: any }> = [];

      // Helper to safely add properties
      const addProp = (propName: string, value: any) => {
        const propId = (typeIds.properties as any)[propName];
        if (!propId || typeof propId !== 'string') {
          console.error(`      ⚠️  Invalid property ID for '${propName}'`);
          return;
        }
        values.push({ property: propId, value });
      };

      // Add all non-null properties
      if (validWork.title) addProp('title', validWork.title);
      if (validWork.geniusId) addProp('geniusId', validWork.geniusId.toString());
      if (validWork.geniusUrl) addProp('geniusUrl', validWork.geniusUrl);
      if (validWork.iswc) addProp('iswc', validWork.iswc);
      if (validWork.spotifyId) addProp('spotifyId', validWork.spotifyId);
      if (validWork.appleMusicId) addProp('appleMusicId', validWork.appleMusicId);
      if (validWork.wikidataId) addProp('wikidataId', validWork.wikidataId);
      if (validWork.language) addProp('language', validWork.language);
      if (validWork.releaseDate) addProp('releaseDate', validWork.releaseDate);
      if (validWork.geniusAnnotationCount) addProp('annotationCount', validWork.geniusAnnotationCount.toString());
      if (validWork.geniusPyongsCount) addProp('pyongsCount', validWork.geniusPyongsCount.toString());

      console.log(`      → ${values.length} properties`);

      // Create entity with artist relation
      const { id: entityId, ops: entityOps } = Graph.createEntity({
        name: validWork.title,
        types: [typeIds.types.musicalWork],
        values,
        relations: {
          [typeIds.properties.composedBy]: {
            toEntity: originalWork.artist_entity_id, // ← Links Work → Artist!
          },
        },
      });

      ops.push(...entityOps);
      entityMap[validWork.geniusId] = entityId;
      console.log(`      → Entity created with artist relation\n`);
    }

    console.log(`✅ Created ${result.stats.validCount} work entities\n`);

    // Upload to IPFS
    console.log('⏳ Publishing to IPFS...');
    const { cid } = await Ipfs.publishEdit({
      name: `Import ${result.stats.validCount} Musical Works`,
      ops,
      author: address,
      network: config.network,
    });

    console.log(`   CID: ${cid}`);

    // Get calldata
    console.log('\n⏳ Getting transaction calldata...');
    const response = await fetch(`${config.graphApiOrigin}/space/${config.spaceId}/edit/calldata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get calldata: ${response.statusText}`);
    }

    const { to, data } = await response.json();

    // Submit transaction
    console.log('\n⏳ Submitting transaction...');
    const txHash = await walletClient.sendTransaction({
      account: walletClient.account,
      to: to as `0x${string}`,
      value: 0n,
      data: data as `0x${string}`,
    });

    console.log(`   Transaction: ${txHash}`);
    console.log('   Waiting for confirmation...');

    // Save entity IDs back to database
    console.log('\n⏳ Saving entity IDs to database...');
    for (const [geniusId, entityId] of Object.entries(entityMap)) {
      await sql`
        UPDATE grc20_works
        SET grc20_entity_id = ${entityId}::uuid,
            minted_at = NOW()
        WHERE genius_song_id = ${parseInt(geniusId)}
      `;
    }
    console.log(`   ✅ Updated ${Object.keys(entityMap).length} work records`);

    // Save entity mapping to file (for reference)
    const mapPath = path.join(__dirname, '../work-entity-map.json');
    fs.writeFileSync(mapPath, JSON.stringify(entityMap, null, 2));

    const browserUrl = config.network === 'MAINNET'
      ? 'https://www.geobrowser.io'
      : 'https://testnet.geobrowser.io';

    console.log(`\n✅ Imported ${result.stats.validCount} musical works!`);
    console.log(`   Entity map saved to: work-entity-map.json`);
    console.log(`   View at: ${browserUrl}/space/${config.spaceId}`);

    console.log('\n📋 Next steps:');
    console.log('   1. Verify works and artist relations in GeoBrowser');
    console.log('   2. If successful, increase BATCH_SIZE and re-run');
    console.log('   3. Run: bun run import-segments (after all works minted)');

  } finally {
    await sql.end();
  }
}

main().catch(console.error);
