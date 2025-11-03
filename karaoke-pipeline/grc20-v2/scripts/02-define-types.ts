/**
 * Step 2: Define Types and Properties
 * Creates the schema for Songverse v2 knowledge graph
 */

import { Graph, Ipfs, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import { config, validateConfig } from '../config';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('📐 Defining Types and Properties for Songverse v2\n');

  validateConfig();

  if (!config.spaceId) {
    throw new Error('GRC20_SPACE_ID_V2 not found. Run: bun grc20-v2/scripts/01-setup-space.ts');
  }

  const privateKey = config.privateKey!.startsWith('0x')
    ? config.privateKey!
    : `0x${config.privateKey!}`;
  const { address } = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = await getWalletClient({
    privateKey: privateKey as `0x${string}`
  });

  console.log(`📝 Wallet: ${address}`);
  console.log(`🌐 Space: ${config.spaceId}`);
  console.log(`🌍 Network: ${config.network}\n`);

  const ops: any[] = [];
  const properties: Record<string, string> = {};
  const types: Record<string, string> = {};

  console.log('🏗️  Creating properties...\n');

  // Helper to create property
  const createProp = (name: string, dataType: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'RELATION', description?: string) => {
    const { id, ops: propOps } = Graph.createProperty({
      name,
      dataType: dataType as any,
    });
    properties[name] = id;
    ops.push(...propOps);
    console.log(`   ✅ ${name} (${dataType})`);
    return id;
  };

  // === CORE PROPERTIES ===
  createProp('name', 'STRING');
  createProp('title', 'STRING');
  createProp('description', 'STRING');

  // === IDENTIFIERS ===
  console.log('\n   Identifiers:');
  createProp('geniusId', 'STRING');
  createProp('geniusUrl', 'STRING');
  createProp('spotifyId', 'STRING');
  createProp('spotifyUrl', 'STRING');
  createProp('appleMusicId', 'STRING');
  createProp('appleMusicUrl', 'STRING');
  createProp('mbid', 'STRING');  // MusicBrainz ID
  createProp('wikidataId', 'STRING');
  createProp('wikidataUrl', 'STRING');
  createProp('discogsId', 'STRING');
  createProp('discogsUrl', 'STRING');
  createProp('isrc', 'STRING');  // Recording identifier
  createProp('iswc', 'STRING');  // Work identifier
  createProp('isni', 'STRING');  // Artist identifier
  createProp('isniAll', 'STRING');  // All ISNI codes (JSONB in DB, stringified)
  createProp('ipi', 'STRING');   // Artist identifier
  createProp('ipiAll', 'STRING');  // All IPI codes (JSONB in DB, stringified)

  // Library/Archive IDs
  createProp('viafId', 'STRING');
  createProp('viafUrl', 'STRING');
  createProp('gndId', 'STRING');
  createProp('bnfId', 'STRING');
  createProp('bnfUrl', 'STRING');
  createProp('locId', 'STRING');
  createProp('locUrl', 'STRING');
  createProp('dnbUrl', 'STRING');
  createProp('worldcatUrl', 'STRING');

  // === LENS/PKP (NEW!) ===
  console.log('\n   Web3 Accounts:');
  createProp('lensHandle', 'STRING');
  createProp('lensAccountAddress', 'STRING');
  createProp('pkpAddress', 'STRING');
  createProp('pkpTokenId', 'STRING');

  // === SOCIAL MEDIA ===
  console.log('\n   Social Media:');
  createProp('instagramHandle', 'STRING');
  createProp('tiktokHandle', 'STRING');
  createProp('twitterHandle', 'STRING');
  createProp('facebookHandle', 'STRING');
  createProp('youtubeChannel', 'STRING');
  createProp('soundcloudHandle', 'STRING');
  createProp('weiboHandle', 'STRING');
  createProp('vkHandle', 'STRING');

  // === IMAGES ===
  console.log('\n   Images:');
  createProp('imageUrl', 'STRING');
  createProp('headerImageUrl', 'STRING');

  // Grove Storage
  createProp('groveImageCid', 'STRING');
  createProp('groveImageUrl', 'STRING');
  createProp('groveHeaderImageCid', 'STRING');
  createProp('groveHeaderImageUrl', 'STRING');

  // === ARTIST METADATA ===
  console.log('\n   Artist Metadata:');
  createProp('artistType', 'STRING');  // person, group, orchestra, etc.
  createProp('country', 'STRING');
  createProp('gender', 'STRING');
  createProp('birthDate', 'STRING');
  createProp('deathDate', 'STRING');
  createProp('disambiguation', 'STRING');
  createProp('sortName', 'STRING');
  createProp('alternateNames', 'STRING');

  // === WORK/RECORDING METADATA ===
  console.log('\n   Work/Recording Metadata:');
  createProp('language', 'STRING');
  createProp('releaseDate', 'STRING');
  createProp('album', 'STRING');
  createProp('durationMs', 'NUMBER');
  createProp('genres', 'STRING');
  createProp('explicitContent', 'BOOLEAN');

  // === POPULARITY ===
  console.log('\n   Popularity Metrics:');
  createProp('spotifyFollowers', 'NUMBER');
  createProp('spotifyPopularity', 'NUMBER');
  createProp('geniusFollowers', 'NUMBER');
  createProp('annotationCount', 'NUMBER');
  createProp('pyongsCount', 'NUMBER');
  createProp('isVerified', 'BOOLEAN');

  // === PLATFORM URLS ===
  console.log('\n   Platform URLs:');
  createProp('deezerUrl', 'STRING');
  createProp('tidalUrl', 'STRING');
  createProp('qobuzUrl', 'STRING');
  createProp('soundcloudUrl', 'STRING');
  createProp('youtubeMusicUrl', 'STRING');
  createProp('yandexMusicUrl', 'STRING');
  createProp('boomplayUrl', 'STRING');
  createProp('melonUrl', 'STRING');
  createProp('amazonMusicUrl', 'STRING');
  createProp('itunesUrl', 'STRING');
  createProp('napsterUrl', 'STRING');

  // Music databases
  createProp('allmusicUrl', 'STRING');
  createProp('imdbUrl', 'STRING');
  createProp('imvdbUrl', 'STRING');
  createProp('lastfmUrl', 'STRING');
  createProp('rateyourmusicUrl', 'STRING');
  createProp('whosampledUrl', 'STRING');
  createProp('secondhandsongsUrl', 'STRING');
  createProp('musixmatchUrl', 'STRING');
  createProp('songmeaningsUrl', 'STRING');
  createProp('jaxstaUrl', 'STRING');
  createProp('themoviedbUrl', 'STRING');
  createProp('openlibraryUrl', 'STRING');

  // Live music
  createProp('songkickUrl', 'STRING');
  createProp('bandsintownUrl', 'STRING');
  createProp('setlistfmUrl', 'STRING');

  // Electronic music
  createProp('beatportUrl', 'STRING');

  // Other
  createProp('myspaceUrl', 'STRING');
  createProp('officialWebsite', 'STRING');

  // === RELATIONS ===
  console.log('\n   Relations:');
  createProp('composedBy', 'RELATION');    // Work → Artist
  createProp('performedBy', 'RELATION');   // Recording → Artist
  createProp('recordingOf', 'RELATION');   // Recording → Work

  console.log(`\n✅ Created ${Object.keys(properties).length} properties\n`);

  // === CREATE TYPES ===
  console.log('🏗️  Creating types...\n');

  // Musical Artist Type
  const artistProps = [
    // Core
    'name',
    // Industry IDs
    'geniusId', 'geniusUrl', 'spotifyId', 'spotifyUrl', 'mbid',
    'wikidataId', 'wikidataUrl', 'discogsId', 'discogsUrl',
    'isni', 'isniAll', 'ipi', 'ipiAll',
    'viafId', 'viafUrl', 'gndId', 'bnfId', 'bnfUrl', 'locId', 'locUrl',
    'dnbUrl', 'worldcatUrl',
    // Web3
    'lensHandle', 'lensAccountAddress', 'pkpAddress', 'pkpTokenId',
    // Social
    'instagramHandle', 'tiktokHandle', 'twitterHandle', 'facebookHandle',
    'youtubeChannel', 'soundcloudHandle', 'weiboHandle', 'vkHandle',
    // Images
    'imageUrl', 'headerImageUrl',
    'groveImageCid', 'groveImageUrl', 'groveHeaderImageCid', 'groveHeaderImageUrl',
    // Metadata
    'artistType', 'country', 'gender', 'birthDate', 'deathDate',
    'disambiguation', 'sortName', 'alternateNames', 'genres',
    // Metrics
    'spotifyFollowers', 'spotifyPopularity', 'geniusFollowers', 'isVerified',
    // Platform URLs
    'deezerUrl', 'tidalUrl', 'qobuzUrl', 'soundcloudUrl', 'youtubeMusicUrl',
    'yandexMusicUrl', 'boomplayUrl', 'melonUrl', 'amazonMusicUrl',
    'itunesUrl', 'napsterUrl',
    // Music DBs
    'allmusicUrl', 'imdbUrl', 'imvdbUrl', 'lastfmUrl', 'rateyourmusicUrl',
    'whosampledUrl', 'secondhandsongsUrl', 'musixmatchUrl', 'songmeaningsUrl',
    'jaxstaUrl', 'themoviedbUrl', 'openlibraryUrl',
    // Live
    'songkickUrl', 'bandsintownUrl', 'setlistfmUrl',
    // Electronic
    'beatportUrl',
    // Other
    'myspaceUrl', 'officialWebsite',
  ];

  const { id: artistTypeId, ops: artistTypeOps } = Graph.createType({
    name: 'Musical Artist',
    properties: artistProps.map(p => properties[p]),
  });
  types.musicalArtist = artistTypeId;
  ops.push(...artistTypeOps);
  console.log(`   ✅ Musical Artist (${artistProps.length} properties)`);

  // Musical Work Type
  const workProps = [
    'title', 'geniusId', 'geniusUrl', 'iswc', 'spotifyId', 'appleMusicId',
    'wikidataId', 'language', 'releaseDate', 'genres',
    'annotationCount', 'pyongsCount', 'explicitContent',
    'composedBy',  // Relation to Artist
  ];

  const { id: workTypeId, ops: workTypeOps } = Graph.createType({
    name: 'Musical Work',
    properties: workProps.map(p => properties[p]),
  });
  types.musicalWork = workTypeId;
  ops.push(...workTypeOps);
  console.log(`   ✅ Musical Work (${workProps.length} properties)`);

  // Audio Recording Type
  const recordingProps = [
    'title', 'spotifyId', 'spotifyUrl', 'isrc', 'mbid',
    'appleMusicUrl', 'deezerUrl', 'tidalUrl', 'qobuzUrl',
    'soundcloudUrl', 'youtubeMusicUrl', 'melonUrl', 'amazonMusicUrl',
    'releaseDate', 'durationMs', 'album', 'imageUrl',
    'recordingOf',   // Relation to Work
    'performedBy',   // Relation to Artist
  ];

  const { id: recordingTypeId, ops: recordingTypeOps } = Graph.createType({
    name: 'Audio Recording',
    properties: recordingProps.map(p => properties[p]),
  });
  types.audioRecording = recordingTypeId;
  ops.push(...recordingTypeOps);
  console.log(`   ✅ Audio Recording (${recordingProps.length} properties)`);

  console.log(`\n✅ Created ${Object.keys(types).length} types\n`);

  // === PUBLISH TO IPFS ===
  console.log('⏳ Publishing to IPFS...');
  const { cid } = await Ipfs.publishEdit({
    name: 'Define Songverse v2 Schema',
    ops,
    author: address,
    network: config.network,
  });
  console.log(`   CID: ${cid}`);

  // === GET CALLDATA ===
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

  // === SUBMIT TRANSACTION ===
  console.log('\n⏳ Submitting transaction...');
  const txHash = await walletClient.sendTransaction({
    account: walletClient.account,
    to: to as `0x${string}`,
    value: 0n,
    data: data as `0x${string}`,
  });

  console.log(`   Transaction: ${txHash}`);

  // === SAVE TYPE IDS ===
  const typeIds = {
    properties,
    types,
    spaceId: config.spaceId,
    network: config.network,
    timestamp: new Date().toISOString(),
  };

  const typeIdsPath = path.join(__dirname, '../type-ids.json');
  fs.writeFileSync(typeIdsPath, JSON.stringify(typeIds, null, 2));

  const browserUrl = config.network === 'MAINNET'
    ? 'https://www.geobrowser.io'
    : 'https://testnet.geobrowser.io';

  console.log(`\n✅ Schema defined!`);
  console.log(`   Type IDs saved to: grc20-v2/type-ids.json`);
  console.log(`   View at: ${browserUrl}/space/${config.spaceId}\n`);

  console.log('📋 Next steps:');
  console.log('   1. Verify types in GeoBrowser');
  console.log('   2. Run: bun grc20-v2/scripts/03-mint-artists.ts');
}

main().catch(console.error);
