/**
 * Step 3: Mint Artists to GRC-20
 * Fetches unminted artists from Neon and mints them to Songverse v2
 */

import { Graph, Ipfs, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import { config, validateConfig } from '../config';
import { query } from '../../src/db/neon';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🎨 Minting Artists to Songverse v2\n');

  validateConfig();

  if (!config.spaceId) {
    throw new Error('GRC20_SPACE_ID_V2 not found. Run: bun grc20-v2/scripts/01-setup-space.ts');
  }

  // Load type IDs
  const typeIdsPath = path.join(__dirname, '../type-ids.json');
  if (!fs.existsSync(typeIdsPath)) {
    throw new Error('Type IDs not found. Run: bun grc20-v2/scripts/02-define-types.ts');
  }
  const { types, properties } = JSON.parse(fs.readFileSync(typeIdsPath, 'utf-8'));

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

  // Fetch unminted artists with PKP and Lens accounts
  const artists = await query(`
    SELECT
      ga.*,
      pkp.pkp_address,
      pkp.pkp_token_id,
      lens.lens_handle,
      lens.lens_account_address
    FROM grc20_artists ga
    LEFT JOIN pkp_accounts pkp ON ga.pkp_account_id = pkp.id
    LEFT JOIN lens_accounts lens ON ga.lens_account_id = lens.id
    LEFT JOIN grc20_artist_mints gam ON ga.spotify_artist_id = gam.spotify_artist_id
    WHERE gam.grc20_entity_id IS NULL  -- Not yet minted
      AND ga.spotify_artist_id IS NOT NULL
      AND pkp.pkp_address IS NOT NULL
      AND lens.lens_handle IS NOT NULL
    ORDER BY ga.id
    LIMIT 100
  `);

  console.log(`📊 Found ${artists.length} unminted artists\n`);

  if (artists.length === 0) {
    console.log('✅ All artists already minted!');
    return;
  }

  const ops: any[] = [];
  const entityMap: Record<number, string> = {}; // DB ID → GRC-20 entity UUID

  for (const artist of artists) {
    console.log(`\n🎨 Minting: ${artist.name}`);

    // Build entity properties
    const entityProps: Record<string, any> = {};

    // Helper to add property if value exists
    const addProp = (grc20Name: string, dbValue: any) => {
      if (dbValue !== null && dbValue !== undefined && dbValue !== '') {
        // Handle JSONB fields (stringify arrays/objects)
        if (typeof dbValue === 'object') {
          entityProps[properties[grc20Name]] = JSON.stringify(dbValue);
        } else {
          entityProps[properties[grc20Name]] = String(dbValue);
        }
      }
    };

    // Core
    addProp('name', artist.name);

    // Industry IDs
    addProp('geniusId', artist.genius_artist_id);
    addProp('geniusUrl', artist.genius_url);
    addProp('spotifyId', artist.spotify_artist_id);
    addProp('spotifyUrl', artist.spotify_url);
    addProp('mbid', artist.mbid);
    addProp('wikidataId', artist.wikidata_id);
    addProp('wikidataUrl', artist.wikidata_url);
    addProp('discogsId', artist.discogs_id);
    addProp('discogsUrl', artist.discogs_url);
    addProp('isni', artist.isni);
    addProp('isniAll', artist.isni_all);
    addProp('ipi', artist.ipi);
    addProp('ipiAll', artist.ipi_all);
    addProp('viafId', artist.viaf_id);
    addProp('viafUrl', artist.viaf_url);
    addProp('gndId', artist.gnd_id);
    addProp('bnfId', artist.bnf_id);
    addProp('bnfUrl', artist.bnf_url);
    addProp('locId', artist.loc_id);
    addProp('locUrl', artist.loc_url);
    addProp('dnbUrl', artist.dnb_url);
    addProp('worldcatUrl', artist.worldcat_url);

    // Web3 (CRITICAL!)
    addProp('pkpAddress', artist.pkp_address);
    addProp('pkpTokenId', artist.pkp_token_id);
    addProp('lensHandle', artist.lens_handle);
    addProp('lensAccountAddress', artist.lens_account_address);

    // Social
    addProp('instagramHandle', artist.instagram_handle);
    addProp('tiktokHandle', artist.tiktok_handle);
    addProp('twitterHandle', artist.twitter_handle);
    addProp('facebookHandle', artist.facebook_handle);
    addProp('youtubeChannel', artist.youtube_channel);
    addProp('soundcloudHandle', artist.soundcloud_handle);
    addProp('weiboHandle', artist.weibo_handle);
    addProp('vkHandle', artist.vk_handle);

    // Images
    addProp('groveImageCid', artist.grove_image_cid);
    addProp('groveImageUrl', artist.grove_image_url);
    addProp('groveHeaderImageCid', artist.grove_header_image_cid);
    addProp('groveHeaderImageUrl', artist.grove_header_image_url);
    addProp('headerImageUrl', artist.header_image_url);

    // Metadata
    addProp('artistType', artist.artist_type);
    addProp('country', artist.country);
    addProp('gender', artist.gender);
    addProp('birthDate', artist.birth_date);
    addProp('genres', artist.genres);

    // Platform URLs
    addProp('deezerUrl', artist.deezer_url);
    addProp('tidalUrl', artist.tidal_url);
    addProp('qobuzUrl', artist.qobuz_url);
    addProp('soundcloudUrl', artist.soundcloud_url);
    addProp('youtubeMusicUrl', artist.youtube_music_url);
    addProp('yandexMusicUrl', artist.yandex_music_url);
    addProp('boomplayUrl', artist.boomplay_url);
    addProp('melonUrl', artist.melon_url);
    addProp('amazonMusicUrl', artist.amazon_music_url);
    addProp('itunesUrl', artist.itunes_url);
    addProp('napsterUrl', artist.napster_url);

    // Music DBs
    addProp('allmusicUrl', artist.allmusic_url);
    addProp('imdbUrl', artist.imdb_url);
    addProp('imvdbUrl', artist.imvdb_url);
    addProp('lastfmUrl', artist.lastfm_url);
    addProp('rateyourmusicUrl', artist.rateyourmusic_url);
    addProp('whosampledUrl', artist.whosampled_url);
    addProp('secondhandsongsUrl', artist.secondhandsongs_url);
    addProp('musixmatchUrl', artist.musixmatch_url);
    addProp('songmeaningsUrl', artist.songmeanings_url);
    addProp('jaxstaUrl', artist.jaxsta_url);
    addProp('themoviedbUrl', artist.themoviedb_url);
    addProp('openlibraryUrl', artist.openlibrary_url);

    // Live
    addProp('songkickUrl', artist.songkick_url);
    addProp('bandsintownUrl', artist.bandsintown_url);
    addProp('setlistfmUrl', artist.setlistfm_url);

    // Electronic
    addProp('beatportUrl', artist.beatport_url);

    // Other
    addProp('myspaceUrl', artist.myspace_url);
    addProp('officialWebsite', artist.official_website);

    // Create entity
    const { id: entityId, ops: entityOps } = Graph.createEntity({
      type: types.musicalArtist,
      properties: entityProps,
    });

    ops.push(...entityOps);
    entityMap[artist.id] = entityId;
    console.log(`   ✅ Entity ID: ${entityId}`);
    console.log(`   📊 Properties: ${Object.keys(entityProps).length}`);
  }

  console.log(`\n⏳ Publishing ${artists.length} artists to IPFS...`);
  const { cid } = await Ipfs.publishEdit({
    name: `Mint ${artists.length} artists to Songverse v2`,
    ops,
    author: address,
    network: config.network,
  });
  console.log(`   CID: ipfs://${cid}`);

  console.log('\n⏳ Getting transaction calldata...');
  const response = await fetch(`${config.graphApiOrigin}/space/${config.spaceId}/edit/calldata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid }),
  });
  const { to, data } = await response.json();

  console.log('\n⏳ Submitting transaction...');
  const txHash = await walletClient.sendTransaction({
    account: walletClient.account,
    to: to as `0x${string}`,
    value: 0n,
    data: data as `0x${string}`,
  });
  console.log(`   Transaction: ${txHash}`);

  console.log('\n💾 Saving entity IDs to grc20_artist_mints...');
  for (const [dbId, entityId] of Object.entries(entityMap)) {
    // Get spotify_artist_id for this artist
    const artist = artists.find(a => a.id === parseInt(dbId));
    if (!artist?.spotify_artist_id) {
      console.warn(`⚠️  Artist ${dbId} missing spotify_artist_id, skipping`);
      continue;
    }

    await query(
      `INSERT INTO grc20_artist_mints (spotify_artist_id, grc20_entity_id, minted_at, needs_update)
       VALUES ($1, $2, NOW(), FALSE)
       ON CONFLICT (spotify_artist_id) DO UPDATE SET
         grc20_entity_id = EXCLUDED.grc20_entity_id,
         minted_at = EXCLUDED.minted_at,
         needs_update = FALSE,
         updated_at = NOW()`,
      [artist.spotify_artist_id, entityId]
    );
  }

  console.log(`\n✅ Minted ${artists.length} artists!`);
  console.log(`   View at: https://testnet.geobrowser.io/space/${config.spaceId}`);

  // Show minting status
  const status = await query('SELECT * FROM grc20_minting_status');
  console.log('\n📊 Minting Status:');
  console.table(status);
}

main().catch(console.error);
