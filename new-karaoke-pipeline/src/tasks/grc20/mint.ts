import 'dotenv/config';

import {
  Graph,
  IdUtils,
  Ipfs,
  getCalldataForSpaceGovernanceType,
  getWalletClient,
} from '@graphprotocol/grc-20';
import { createPublicClient, http } from 'viem';

import {
  GEO_NETWORK,
  GEO_TESTNET_RPC_URL,
  GRC20_PROPERTY_IDS,
  GRC20_RELATION_IDS,
  GRC20_SPACE_ADDRESSES,
  GRC20_TYPE_IDS,
} from '../../config/grc20-space';
import { query } from '../../db/connection';
import { ArtistMetadataRow, buildArtistValues } from './utils/artist-values';

type GraphOps = ReturnType<typeof Graph.createEntity>['ops'];

type ArtistRow = ArtistMetadataRow;

interface ArtistEntityPlan {
  artistId: number;
  entityId: string;
  ops: GraphOps;
}

interface WorkRow {
  id: number;
  title: string;
  alternate_titles: string | null;
  iswc: string | null;
  iswc_source: string | null;
  genius_song_id: number | null;
  genius_url: string | null;
  wikidata_url: string | null;
  release_date: string | null;
  duration_ms: number | null;
  language: string | null;
  image_url: string | null;
  image_grove_url: string | null;
  primary_artist_id: number;
}

interface WorkEntityPlan {
  workId: number;
  entityId: string;
  ops: GraphOps;
}

const ISWC_SOURCE_LABELS: Record<string, string> = {
  musicbrainz_work: 'MusicBrainz',
  wikidata_work: 'Wikidata',
  quansic: 'Quansic',
  mlc: 'MLC',
};

function formatIswcSource(source: string | null): string | null {
  if (!source) return null;
  return ISWC_SOURCE_LABELS[source] ?? source;
}

function formatReleaseDate(dateValue: string | null): string | null {
  if (!dateValue) return null;
  try {
    // dateValue may already be in YYYY-MM-DD (from Postgres) or ISO string
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${date.getUTCDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateValue;
  }
}

async function fetchUnmintedArtists(): Promise<ArtistRow[]> {
  return query<ArtistRow>(
    `
      SELECT
        id,
        name,
        sort_name,
        alternate_names,
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
        facebook_url,
        deezer_url,
        apple_music_url,
        wikipedia_url,
        wikipedia_urls,
        lens_handle,
        library_ids,
        external_ids,
        viaf_id,
        bnf_id,
        gnd_id,
        loc_id,
        aliases
      FROM grc20_artists
      WHERE grc20_entity_id IS NULL
      ORDER BY id
    `,
  );
}

async function fetchAllArtistEntityIds(): Promise<Map<number, string>> {
  const rows = await query<{ id: number; grc20_entity_id: string }>(
    'SELECT id, grc20_entity_id FROM grc20_artists WHERE grc20_entity_id IS NOT NULL',
  );

  return new Map(rows.map(row => [row.id, row.grc20_entity_id]));
}

async function fetchUnmintedWorks(): Promise<WorkRow[]> {
  return query<WorkRow>(
    `
      SELECT
        id,
        title,
        alternate_titles,
        iswc,
        iswc_source,
        genius_song_id,
        genius_url,
        wikidata_url,
        release_date::text,
        duration_ms,
        language,
        image_url,
        image_grove_url,
        primary_artist_id
      FROM grc20_works
      WHERE grc20_entity_id IS NULL
      ORDER BY id
    `,
  );
}

function pushStringValue(values: { property: string; value: string }[], property: string, value: string | null) {
  if (value && value.trim().length > 0) {
    values.push({ property, value });
  }
}

function pushNumberValue(values: { property: string; value: string }[], property: string, value: number | null) {
  if (value !== null && value !== undefined) {
    values.push({ property, value: value.toString() });
  }
}

async function buildArtistPlan(artist: ArtistRow): Promise<ArtistEntityPlan> {
  const entityId = IdUtils.generate();
  const values = buildArtistValues(artist);

  const ops: GraphOps = [];

  let coverId: string | undefined;
  if (artist.image_url) {
    const image = await Graph.createImage({
      url: artist.image_url,
      name: `${artist.name} Cover`,
      network: GEO_NETWORK,
    });
    coverId = image.id;
    ops.push(...image.ops);
  }

  const entity = Graph.createEntity({
    id: entityId,
    name: artist.name,
    description: artist.sort_name ?? undefined,
    cover: coverId,
    values,
    types: [GRC20_TYPE_IDS.artist],
  });

  ops.push(...entity.ops);

  return { artistId: artist.id, entityId, ops };
}

async function buildWorkPlan(
  work: WorkRow,
  artistEntityId: string,
): Promise<WorkEntityPlan> {
  const entityId = IdUtils.generate();
  const values: { property: string; value: string }[] = [];

  pushStringValue(values, GRC20_PROPERTY_IDS.workIswc, work.iswc);
  pushStringValue(values, GRC20_PROPERTY_IDS.workIswcSource, formatIswcSource(work.iswc_source));
  pushNumberValue(values, GRC20_PROPERTY_IDS.workGeniusSongId, work.genius_song_id);
  pushStringValue(values, GRC20_PROPERTY_IDS.workGeniusUrl, work.genius_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.workWikidataUrl, work.wikidata_url);

  pushStringValue(values, GRC20_PROPERTY_IDS.workReleaseDate, formatReleaseDate(work.release_date));

  pushNumberValue(values, GRC20_PROPERTY_IDS.workDurationMs, work.duration_ms);
  pushStringValue(values, GRC20_PROPERTY_IDS.workLanguage, work.language);
  pushStringValue(values, GRC20_PROPERTY_IDS.workGroveImageUrl, work.image_grove_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.workAlternateTitles, work.alternate_titles);

  const ops: GraphOps = [];
  let coverId: string | undefined;

  if (work.image_url) {
    const image = await Graph.createImage({
      url: work.image_url,
      name: `${work.title} Cover`,
      network: GEO_NETWORK,
    });
    coverId = image.id;
    ops.push(...image.ops);
  }

  const relations = {
    [GRC20_RELATION_IDS.primaryArtist]: {
      toEntity: artistEntityId,
    },
  } satisfies Parameters<typeof Graph.createEntity>[0]['relations'];

  const entity = Graph.createEntity({
    id: entityId,
    name: work.title,
    cover: coverId,
    values,
    types: [GRC20_TYPE_IDS.work],
    relations,
  });

  ops.push(...entity.ops);

  return { workId: work.id, entityId, ops };
}

async function submitOps(
  label: string,
  ops: GraphOps,
  walletClient: Awaited<ReturnType<typeof getWalletClient>>,
  publicClient: ReturnType<typeof createPublicClient>,
) {
  if (!ops.length) {
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

async function updateArtistEntities(plans: ArtistEntityPlan[]) {
  if (!plans.length) {
    return;
  }

  const updates = plans.map(plan =>
    query(
      'UPDATE grc20_artists SET grc20_entity_id = $1::uuid, minted_at = NOW(), needs_update = FALSE WHERE id = $2',
      [plan.entityId, plan.artistId],
    ),
  );

  await Promise.all(updates);
}

async function updateWorkEntities(plans: WorkEntityPlan[]) {
  if (!plans.length) {
    return;
  }

  const updates = plans.map(plan =>
    query(
      'UPDATE grc20_works SET grc20_entity_id = $1::uuid, minted_at = NOW(), needs_update = FALSE WHERE id = $2',
      [plan.entityId, plan.workId],
    ),
  );

  await Promise.all(updates);
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is required');
  }

  if (!process.env.NEON_DATABASE_URL && !process.env.DATABASE_URL) {
    throw new Error('NEON_DATABASE_URL or DATABASE_URL is required');
  }

  const walletClient = await getWalletClient({ privateKey, rpcUrl: GEO_TESTNET_RPC_URL });
  const publicClient = createPublicClient({
    chain: walletClient.chain,
    transport: http(GEO_TESTNET_RPC_URL),
  });

  console.log('➡️  Fetching unminted artists');
  const unmintedArtists = await fetchUnmintedArtists();
  const artistPlans: ArtistEntityPlan[] = [];

  for (const artist of unmintedArtists) {
    const plan = await buildArtistPlan(artist);
    artistPlans.push(plan);
  }

  const artistOps: GraphOps = artistPlans.flatMap(plan => plan.ops);
  await submitOps('Mint artists batch', artistOps, walletClient, publicClient);
  await updateArtistEntities(artistPlans);

  const artistEntityMap = await fetchAllArtistEntityIds();
  for (const plan of artistPlans) {
    artistEntityMap.set(plan.artistId, plan.entityId);
  }

  console.log('➡️  Fetching unminted works');
  const unmintedWorks = await fetchUnmintedWorks();
  const workPlans: WorkEntityPlan[] = [];

  for (const work of unmintedWorks) {
    const artistEntityId = artistEntityMap.get(work.primary_artist_id);
    if (!artistEntityId) {
      throw new Error(`Missing artist entity for primary_artist_id=${work.primary_artist_id}`);
    }
    const plan = await buildWorkPlan(work, artistEntityId);
    workPlans.push(plan);
  }

  const workOps: GraphOps = workPlans.flatMap(plan => plan.ops);
  await submitOps('Mint works batch', workOps, walletClient, publicClient);
  await updateWorkEntities(workPlans);

  console.log('✅ Minting completed');
}

main().catch(error => {
  console.error('❌ Failed to mint GRC-20 entities');
  console.error(error);
  process.exit(1);
});
