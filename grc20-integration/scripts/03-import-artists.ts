/**
 * Step 3: Import Artists to GRC-20
 *
 * Validates and mints musical artists from Neon DB to GRC-20
 * Start with small batch for testing
 */

import { Graph, Ipfs, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import postgres from 'postgres';
import { config } from '../config';
import { fetchAndValidateArtists } from '../utils/db-to-grc20-mapper';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🎵 Importing Artists to GRC-20...\n');

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
    // Fetch and validate artists (MINT ALL REMAINING)
    const BATCH_SIZE = 150;
    console.log(`🔍 Fetching up to ${BATCH_SIZE} unminted artists...\n`);

    const result = await fetchAndValidateArtists(sql, BATCH_SIZE);

    if (result.stats.validCount === 0) {
      throw new Error('No valid artists to mint');
    }

    console.log(`\n✅ ${result.stats.validCount} artists ready to mint\n`);

    // Build GRC-20 operations
    const ops: any[] = [];
    const entityMap: Record<number, string> = {};

    console.log('🏗️  Building GRC-20 entities...\n');

    for (const artist of result.valid) {
      console.log(`   📝 ${artist.name} (Genius ID: ${artist.geniusId})`);

      // Build values array (GRC-20 expects 'property' not 'id')
      const values: Array<{ property: string; value: any }> = [];

      // Helper to safely add properties
      const addProp = (propName: string, value: any) => {
        const propId = (typeIds.properties as any)[propName];
        if (!propId || typeof propId !== 'string') {
          console.error(`      ⚠️  Invalid property ID for '${propName}': ${propId} (type: ${typeof propId})`);
          return;
        }
        values.push({ property: propId, value });
      };

      // Add all non-null properties (convert all values to strings)
      if (artist.name) addProp('name', artist.name);
      if (artist.geniusId) addProp('geniusId', artist.geniusId.toString());
      if (artist.geniusUrl) addProp('geniusUrl', artist.geniusUrl);
      if (artist.spotifyId) addProp('spotifyId', artist.spotifyId);
      if (artist.spotifyUrl) addProp('spotifyUrl', artist.spotifyUrl);
      if (artist.mbid) addProp('mbid', artist.mbid);
      if (artist.wikidataId) addProp('wikidataId', artist.wikidataId);
      if (artist.discogsId) addProp('discogsId', artist.discogsId);

      // Industry IDs
      if (artist.isni) addProp('isni', artist.isni);
      if (artist.ipi) addProp('ipi', artist.ipi);

      // Social media
      if (artist.instagramHandle) addProp('instagramHandle', artist.instagramHandle);
      if (artist.tiktokHandle) addProp('tiktokHandle', artist.tiktokHandle);
      if (artist.twitterHandle) addProp('twitterHandle', artist.twitterHandle);
      if (artist.facebookHandle) addProp('facebookHandle', artist.facebookHandle);
      if (artist.youtubeChannel) addProp('youtubeChannel', artist.youtubeChannel);
      if (artist.soundcloudHandle) addProp('soundcloudHandle', artist.soundcloudHandle);

      // Images
      if (artist.imageUrl) addProp('imageUrl', artist.imageUrl);
      if (artist.headerImageUrl) addProp('headerImageUrl', artist.headerImageUrl);

      // Biographical
      if (artist.type) addProp('artistType', artist.type);
      if (artist.country) addProp('country', artist.country);
      if (artist.gender) addProp('gender', artist.gender);
      if (artist.birthDate) addProp('birthDate', artist.birthDate);
      if (artist.deathDate) addProp('deathDate', artist.deathDate);
      if (artist.disambiguation) addProp('disambiguation', artist.disambiguation);
      if (artist.sortName) addProp('sortName', artist.sortName);

      // Popularity (convert numbers to strings)
      if (artist.genres && artist.genres.length > 0) {
        addProp('genres', artist.genres.join(', '));
      }
      if (artist.spotifyFollowers) addProp('spotifyFollowers', artist.spotifyFollowers.toString());
      if (artist.spotifyPopularity) addProp('spotifyPopularity', artist.spotifyPopularity.toString());
      if (artist.geniusFollowers) addProp('geniusFollowers', artist.geniusFollowers.toString());
      if (artist.isVerified !== undefined) addProp('isVerified', artist.isVerified.toString());

      // App-specific
      if (artist.lensAccount) addProp('lensAccount', artist.lensAccount);

      console.log(`      → ${values.length} properties`);


      // Create entity
      const { id: entityId, ops: entityOps } = Graph.createEntity({
        name: artist.name,
        types: [typeIds.types.musicalArtist],
        values,
      });

      ops.push(...entityOps);
      entityMap[artist.geniusId] = entityId;
    }

    console.log(`\n✅ Created ${result.valid.length} artist entities`);

    // Upload to IPFS
    console.log('\n⏳ Publishing to IPFS...');
    const { cid } = await Ipfs.publishEdit({
      name: `Import ${result.valid.length} Artists`,
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
        UPDATE grc20_artists
        SET grc20_entity_id = ${entityId}::uuid,
            minted_at = NOW()
        WHERE genius_artist_id = ${parseInt(geniusId)}
      `;
    }
    console.log(`   ✅ Updated ${Object.keys(entityMap).length} artist records`);

    // Save entity mapping to file (for reference)
    const mapPath = path.join(__dirname, '../artist-entity-map.json');
    fs.writeFileSync(mapPath, JSON.stringify(entityMap, null, 2));

    const browserUrl = config.network === 'MAINNET'
      ? 'https://www.geobrowser.io'
      : 'https://testnet.geobrowser.io';

    console.log(`\n✅ Imported ${result.valid.length} musical artists!`);
    console.log(`   Entity map saved to: artist-entity-map.json`);
    console.log(`   View at: ${browserUrl}/space/${config.spaceId}`);

    console.log('\n📋 Next steps:');
    console.log('   1. Verify artists in GeoBrowser');
    console.log('   2. If successful, increase BATCH_SIZE and re-run');
    console.log('   3. Run: bun run import-works (after all artists minted)');

  } finally {
    await sql.end();
  }
}

main().catch(console.error);
