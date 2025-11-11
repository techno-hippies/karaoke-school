import 'dotenv/config';

import { Graph, Ipfs, getCalldataForSpaceGovernanceType, getWalletClient } from '@graphprotocol/grc-20';
import { createPublicClient, http } from 'viem';

import {
  GEO_NETWORK,
  GEO_TESTNET_RPC_URL,
  GRC20_SPACE_ADDRESSES,
  GRC20_LEGACY_ARTIST_PROPERTIES,
} from '../../config/grc20-space';
import { query } from '../../db/connection';
import {
  ARTIST_MANAGED_PROPERTY_IDS,
  ArtistMetadataRow,
  buildArtistValues,
} from './utils/artist-values';

type MintedArtistRow = ArtistMetadataRow & { grc20_entity_id: string };

async function getMintedArtists(): Promise<MintedArtistRow[]> {
  return query<MintedArtistRow>(
    `
      SELECT
        id,
        name,
        sort_name,
        alternate_names,
        discogs_id,
        isni,
        isni_all,
        spotify_artist_id,
        spotify_url,
        genius_artist_id,
        genius_url,
        wikidata_url,
        genres,
        country,
        artist_type,
        image_url,
        image_grove_url,
        official_website,
        instagram_url,
        twitter_url,
        tiktok_url,
        youtube_url,
        soundcloud_url,
        bandcamp_url,
        songkick_url,
        setlistfm_url,
        lastfm_url,
        pitchfork_url,
        songfacts_url,
        musixmatch_url,
        rateyourmusic_url,
        discogs_url,
        allmusic_url,
        imdb_url,
        facebook_url,
        deezer_url,
        apple_music_url,
        weibo_url,
        vk_url,
        subreddit_url,
        carnegie_hall_url,
        wikipedia_url,
        wikipedia_urls,
        lens_handle,
        library_ids,
        external_ids,
        viaf_id,
        bnf_id,
        gnd_id,
        loc_id,
        aliases,
        grc20_entity_id
      FROM grc20_artists
      WHERE grc20_entity_id IS NOT NULL
        AND needs_update = TRUE
      ORDER BY id
    `,
  );
}

async function submitOps(
  label: string,
  ops: ReturnType<typeof Graph.createEntity>['ops'],
  walletClient: Awaited<ReturnType<typeof getWalletClient>>,
  publicClient: ReturnType<typeof createPublicClient>,
) {
  if (!ops.length) {
    console.log('ℹ️  Nothing to submit');
    return;
  }

  const author = walletClient.account.address;
  const { cid } = await Ipfs.publishEdit({
    name: label,
    ops,
    author,
    network: GEO_NETWORK,
  });

  const calldata = getCalldataForSpaceGovernanceType({
    type: 'PERSONAL',
    cid,
    spacePluginAddress: GRC20_SPACE_ADDRESSES.space,
  });

  const hash = await walletClient.sendTransaction({
    account: walletClient.account,
    to: GRC20_SPACE_ADDRESSES.plugin,
    data: calldata,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ ${label} → ${cid} (${hash})`);
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is required');
  }

  const walletClient = await getWalletClient({ privateKey, rpcUrl: GEO_TESTNET_RPC_URL });
  const publicClient = createPublicClient({
    chain: walletClient.chain,
    transport: http(GEO_TESTNET_RPC_URL),
  });

  console.log('➡️  Loading minted artists');
  const artists = await getMintedArtists();

  const ops: ReturnType<typeof Graph.createEntity>['ops'] = [];

  for (const artist of artists) {
    const values = buildArtistValues(artist);
    const managedSet = new Set(values.map(v => v.property));
    const unset = ARTIST_MANAGED_PROPERTY_IDS.filter(id => !managedSet.has(id));

    if (unset.length) {
      const { ops: unsetOps } = Graph.unsetEntityValues({
        id: artist.grc20_entity_id,
        properties: unset,
      });
      ops.push(...unsetOps);
    }

    if (GRC20_LEGACY_ARTIST_PROPERTIES.length) {
      const { ops: legacyOps } = Graph.unsetEntityValues({
        id: artist.grc20_entity_id,
        properties: [...GRC20_LEGACY_ARTIST_PROPERTIES],
      });
      ops.push(...legacyOps);
    }

    if (values.length) {
      const { ops: updateOps } = Graph.updateEntity({
        id: artist.grc20_entity_id,
        values,
      });
      ops.push(...updateOps);
      console.log(`   → queued metadata refresh for #${artist.id} ${artist.name}`);
    }
  }

  await submitOps('Update artist metadata', ops, walletClient, publicClient);
  console.log('✅ Completed artist metadata refresh');
}

main().catch(error => {
  console.error('❌ Failed to update artist metadata');
  console.error(error);
  process.exit(1);
});
