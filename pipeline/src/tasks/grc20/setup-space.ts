import 'dotenv/config';

import {
  Graph,
  Ipfs,
  SystemIds,
  getCalldataForSpaceGovernanceType,
  getWalletClient,
} from '@graphprotocol/grc-20';
import {
  GEO_GRAPHQL_ENDPOINT,
  GEO_NETWORK,
  GEO_TESTNET_RPC_URL,
  GRC20_PROPERTY_IDS,
  GRC20_RELATION_IDS,
  GRC20_SPACE_ADDRESSES,
  GRC20_TYPE_IDS,
  GRC20_LEGACY_WORK_PROPERTIES,
  GRC20_LEGACY_ARTIST_PROPERTIES,
} from '../../config/grc20-space';
import { createPublicClient, http } from 'viem';

type DataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'TIME' | 'RELATION';

interface BasePropertyDefinition {
  id: string;
  name: string;
  description: string;
  dataType: DataType;
}

interface RelationPropertyDefinition extends BasePropertyDefinition {
  dataType: 'RELATION';
  relationValueTypeIds: string[];
}

interface TypeDefinition {
  id: string;
  name: string;
  description: string;
  propertyIds: string[];
}

const basePropertyDefinitions: BasePropertyDefinition[] = [
  {
    id: GRC20_PROPERTY_IDS.artistIsni,
    name: 'ISNI',
    description: 'Primary International Standard Name Identifier',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistIsniAll,
    name: 'ISNI (All)',
    description: 'All ISNI identifiers associated with the artist',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistSpotifyId,
    name: 'Spotify Artist ID',
    description: 'Spotify artist identifier used for linking streaming profiles',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistSpotifyUrl,
    name: 'Spotify Artist URL',
    description: 'Direct Spotify URL for the artist profile',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistGeniusId,
    name: 'Genius Artist ID',
    description: 'Genius.com artist identifier',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistGeniusUrl,
    name: 'Genius Artist URL',
    description: 'Artist page on Genius.com',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistWikidataUrl,
    name: 'Wikidata URL',
    description: 'Canonical Wikidata entry for the artist',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistGenres,
    name: 'Genres',
    description: 'Comma-separated list of primary genres',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistCountry,
    name: 'Country',
    description: 'ISO 3166-1 alpha-2 country code',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistType,
    name: 'Artist Type',
    description: 'Artist type classification (Person, Group, etc.)',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistGroveImageUrl,
    name: 'Grove Image URL',
    description: 'Source Grove asset used to derive the minted cover image',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistOfficialWebsite,
    name: 'Official Website',
    description: 'Official artist website URL',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistInstagramUrl,
    name: 'Instagram URL',
    description: 'Instagram profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistTwitterUrl,
    name: 'Twitter URL',
    description: 'Twitter / X profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistTiktokUrl,
    name: 'TikTok URL',
    description: 'TikTok profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistYoutubeUrl,
    name: 'YouTube URL',
    description: 'Primary YouTube channel URL',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistSoundcloudUrl,
    name: 'SoundCloud URL',
    description: 'SoundCloud profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistFacebookUrl,
    name: 'Facebook URL',
    description: 'Facebook page link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistDeezerUrl,
    name: 'Deezer URL',
    description: 'Deezer artist profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistAppleMusicUrl,
    name: 'Apple Music URL',
    description: 'Apple Music artist profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistLensHandle,
    name: 'Lens Handle',
    description: 'Lens Protocol handle (e.g., @artist.kschool)',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistWikipediaUrl,
    name: 'Wikipedia URL',
    description: 'Canonical English Wikipedia URL',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistWikipediaUrls,
    name: 'Wikipedia URLs (Localized)',
    description: 'Localized Wikipedia URLs stored as JSON (lang → url)',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistLibraryIds,
    name: 'Library IDs',
    description: 'Library authority identifiers stored as JSON (viaf, bnf, gnd, loc, etc.)',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistExternalIds,
    name: 'External IDs',
    description: 'Aggregated external identifier map (JSON)',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistViafId,
    name: 'VIAF ID',
    description: 'Virtual International Authority File identifier',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistBnfId,
    name: 'BNF ID',
    description: 'Bibliothèque nationale de France identifier',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistGndId,
    name: 'GND ID',
    description: 'Gemeinsame Normdatei identifier',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistLocId,
    name: 'LCNAF ID',
    description: 'Library of Congress Name Authority identifier',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistAliases,
    name: 'Aliases',
    description: 'Localized aliases JSON (lang → [names])',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistAlternateNames,
    name: 'Alternate Names',
    description: 'Comma-separated list of alternate artist names (flattened from English aliases)',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistDiscogsId,
    name: 'Discogs ID',
    description: 'Discogs artist identifier',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistBandcampUrl,
    name: 'Bandcamp URL',
    description: 'Bandcamp artist profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistSongkickUrl,
    name: 'Songkick URL',
    description: 'Songkick concert listings profile',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistSetlistfmUrl,
    name: 'Setlist.fm URL',
    description: 'Setlist.fm concert setlists profile',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistLastfmUrl,
    name: 'Last.fm URL',
    description: 'Last.fm artist profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistPitchforkUrl,
    name: 'Pitchfork URL',
    description: 'Pitchfork artist profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistSongfactsUrl,
    name: 'Songfacts URL',
    description: 'Songfacts artist profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistMusixmatchUrl,
    name: 'Musixmatch URL',
    description: 'Musixmatch lyrics database artist profile',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistRateyourmusicUrl,
    name: 'RateYourMusic URL',
    description: 'RateYourMusic artist profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistDiscogsUrl,
    name: 'Discogs URL',
    description: 'Discogs artist profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistAllmusicUrl,
    name: 'AllMusic URL',
    description: 'AllMusic artist profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistImdbUrl,
    name: 'IMDb URL',
    description: 'IMDb artist profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistWeiboUrl,
    name: 'Weibo URL',
    description: 'Weibo (Chinese social media) profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistVkUrl,
    name: 'VK URL',
    description: 'VK (Russian social network) profile link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistSubredditUrl,
    name: 'Subreddit URL',
    description: 'Reddit community/subreddit link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.artistCarnegieHallUrl,
    name: 'Carnegie Hall URL',
    description: 'Carnegie Hall performance history link',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.workIswc,
    name: 'ISWC',
    description: 'International Standard Musical Work Code',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.workIswcSource,
    name: 'ISWC Source',
    description: 'Source resolver that supplied the ISWC (quansic, bmi, musicbrainz, mlc)',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.workGeniusSongId,
    name: 'Genius Song ID',
    description: 'Genius.com song identifier',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.workGeniusUrl,
    name: 'Genius Song URL',
    description: 'Song page on Genius.com',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.workWikidataUrl,
    name: 'Wikidata URL',
    description: 'Canonical Wikidata entry for the work',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.workReleaseDate,
    name: 'Release Date',
    description: 'Original release date for the track (ISO-8601)',
    dataType: 'TIME',
  },
  {
    id: GRC20_PROPERTY_IDS.workDurationMs,
    name: 'Duration (ms)',
    description: 'Track duration in milliseconds',
    dataType: 'NUMBER',
  },
  {
    id: GRC20_PROPERTY_IDS.workLanguage,
    name: 'Language',
    description: 'Primary language (ISO 639-1)',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.workGroveImageUrl,
    name: 'Grove Image URL',
    description: 'Source Grove asset used to derive the work cover image',
    dataType: 'STRING',
  },
  {
    id: GRC20_PROPERTY_IDS.workAlternateTitles,
    name: 'Alternate Titles',
    description: 'Comma-separated list of alternate titles',
    dataType: 'STRING',
  },
];

const relationPropertyDefinition: RelationPropertyDefinition = {
  id: GRC20_RELATION_IDS.primaryArtist,
  name: 'Primary Artist',
  description: 'Links a musical work to its primary artist entity',
  dataType: 'RELATION',
  relationValueTypeIds: [GRC20_TYPE_IDS.artist],
};

const typeDefinitions: TypeDefinition[] = [
  {
    id: GRC20_TYPE_IDS.artist,
    name: 'Artist',
    description: 'Performer or songwriter represented in Karaoke School v2',
    propertyIds: [
      GRC20_PROPERTY_IDS.artistIsni,
      GRC20_PROPERTY_IDS.artistIsniAll,
      GRC20_PROPERTY_IDS.artistSpotifyId,
      GRC20_PROPERTY_IDS.artistSpotifyUrl,
      GRC20_PROPERTY_IDS.artistGeniusId,
      GRC20_PROPERTY_IDS.artistGeniusUrl,
      GRC20_PROPERTY_IDS.artistWikidataUrl,
      GRC20_PROPERTY_IDS.artistGenres,
      GRC20_PROPERTY_IDS.artistCountry,
      GRC20_PROPERTY_IDS.artistType,
      GRC20_PROPERTY_IDS.artistGroveImageUrl,
      GRC20_PROPERTY_IDS.artistOfficialWebsite,
      GRC20_PROPERTY_IDS.artistInstagramUrl,
      GRC20_PROPERTY_IDS.artistTwitterUrl,
      GRC20_PROPERTY_IDS.artistTiktokUrl,
      GRC20_PROPERTY_IDS.artistYoutubeUrl,
      GRC20_PROPERTY_IDS.artistSoundcloudUrl,
      GRC20_PROPERTY_IDS.artistFacebookUrl,
      GRC20_PROPERTY_IDS.artistDeezerUrl,
      GRC20_PROPERTY_IDS.artistAppleMusicUrl,
      GRC20_PROPERTY_IDS.artistLensHandle,
      GRC20_PROPERTY_IDS.artistWikipediaUrl,
      GRC20_PROPERTY_IDS.artistWikipediaUrls,
      GRC20_PROPERTY_IDS.artistLibraryIds,
      GRC20_PROPERTY_IDS.artistExternalIds,
      GRC20_PROPERTY_IDS.artistViafId,
      GRC20_PROPERTY_IDS.artistBnfId,
      GRC20_PROPERTY_IDS.artistGndId,
      GRC20_PROPERTY_IDS.artistLocId,
      GRC20_PROPERTY_IDS.artistAliases,
      GRC20_PROPERTY_IDS.artistAlternateNames,
      GRC20_PROPERTY_IDS.artistDiscogsId,
      GRC20_PROPERTY_IDS.artistBandcampUrl,
      GRC20_PROPERTY_IDS.artistSongkickUrl,
      GRC20_PROPERTY_IDS.artistSetlistfmUrl,
      GRC20_PROPERTY_IDS.artistLastfmUrl,
      GRC20_PROPERTY_IDS.artistPitchforkUrl,
      GRC20_PROPERTY_IDS.artistSongfactsUrl,
      GRC20_PROPERTY_IDS.artistMusixmatchUrl,
      GRC20_PROPERTY_IDS.artistRateyourmusicUrl,
      GRC20_PROPERTY_IDS.artistDiscogsUrl,
      GRC20_PROPERTY_IDS.artistAllmusicUrl,
      GRC20_PROPERTY_IDS.artistImdbUrl,
      GRC20_PROPERTY_IDS.artistWeiboUrl,
      GRC20_PROPERTY_IDS.artistVkUrl,
      GRC20_PROPERTY_IDS.artistSubredditUrl,
      GRC20_PROPERTY_IDS.artistCarnegieHallUrl,
    ],
  },
  {
    id: GRC20_TYPE_IDS.work,
    name: 'Musical Work',
    description: 'Minted karaoke work entity linked to primary recordings',
    propertyIds: [
      GRC20_PROPERTY_IDS.workIswc,
      GRC20_PROPERTY_IDS.workIswcSource,
      GRC20_PROPERTY_IDS.workGeniusSongId,
      GRC20_PROPERTY_IDS.workGeniusUrl,
      GRC20_PROPERTY_IDS.workWikidataUrl,
      GRC20_PROPERTY_IDS.workReleaseDate,
      GRC20_PROPERTY_IDS.workDurationMs,
      GRC20_PROPERTY_IDS.workLanguage,
      GRC20_PROPERTY_IDS.workGroveImageUrl,
      GRC20_PROPERTY_IDS.workAlternateTitles,
      GRC20_RELATION_IDS.primaryArtist,
    ],
  },
];

async function fetchGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(GEO_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GraphQL request failed with status ${response.status}: ${text}`);
  }

  const payload = await response.json();

  if (payload.errors?.length) {
    throw new Error(`GraphQL error: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data as T;
}

async function propertyExists(id: string): Promise<boolean> {
  const data = await fetchGraphQL<{ property: { id: string } | null }>(
    'query ($id: UUID!) { property(id: $id) { id } }',
    { id },
  );
  return Boolean(data.property?.id);
}

async function getTypePropertyIds(id: string): Promise<Set<string>> {
  const data = await fetchGraphQL<{ entity: { properties: { id: string }[] | null } | null }>(
    'query ($id: UUID!) { entity(id: $id) { properties { id } } }',
    { id },
  );

  if (!data.entity?.properties) {
    return new Set();
  }

  return new Set(data.entity.properties.map(p => p.id));
}

async function typeExists(id: string): Promise<boolean> {
  const data = await fetchGraphQL<{ entity: { id: string } | null }>(
    'query ($id: UUID!) { entity(id: $id) { id } }',
    { id },
  );
  return Boolean(data.entity?.id);
}

async function submitOps(
  label: string,
  ops: ReturnType<typeof Graph.createEntity>['ops'],
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

async function ensureProperty(
  definition: BasePropertyDefinition | RelationPropertyDefinition,
  walletClient: Awaited<ReturnType<typeof getWalletClient>>,
  publicClient: ReturnType<typeof createPublicClient>,
) {
  const exists = await propertyExists(definition.id);
  if (exists) {
    return;
  }

  const { ops } = Graph.createProperty(
    definition.dataType === 'RELATION'
      ? {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          dataType: 'RELATION',
          relationValueTypes: (definition as RelationPropertyDefinition).relationValueTypeIds,
        }
      : {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          dataType: definition.dataType,
        },
  );

  await submitOps(`Create property: ${definition.name}`, ops, walletClient, publicClient);
}

async function ensureRelationValueTypes(
  relationId: string,
  relationValueTypeIds: string[],
  walletClient: Awaited<ReturnType<typeof getWalletClient>>,
  publicClient: ReturnType<typeof createPublicClient>,
) {
  const current = await fetchGraphQL<{ property: { relationValueTypeIds: string[] } | null }>(
    'query ($id: UUID!) { property(id: $id) { relationValueTypeIds } }',
    { id: relationId },
  );

  const existing = new Set(current.property?.relationValueTypeIds ?? []);
  const missing = relationValueTypeIds.filter(id => !existing.has(id));

  if (!missing.length) {
    return;
  }

  const ops: ReturnType<typeof Graph.createEntity>['ops'] = [];

  for (const typeId of missing) {
    const relation = Graph.createRelation({
      fromEntity: relationId,
      toEntity: typeId,
      type: SystemIds.RELATION_VALUE_RELATIONSHIP_TYPE,
    });
    ops.push(...relation.ops);
  }

  await submitOps('Link relation value types', ops, walletClient, publicClient);
}

async function ensureType(
  definition: TypeDefinition,
  walletClient: Awaited<ReturnType<typeof getWalletClient>>,
  publicClient: ReturnType<typeof createPublicClient>,
) {
  const exists = await typeExists(definition.id);

  if (!exists) {
    const { ops } = Graph.createType({
      id: definition.id,
      name: definition.name,
      description: definition.description,
      properties: definition.propertyIds,
    });

    await submitOps(`Create type: ${definition.name}`, ops, walletClient, publicClient);
    return;
  }

  const existingPropertyIds = await getTypePropertyIds(definition.id);
  const missingPropertyIds = definition.propertyIds.filter(id => !existingPropertyIds.has(id));

  if (!missingPropertyIds.length) {
    return;
  }

  const ops: ReturnType<typeof Graph.createEntity>['ops'] = [];

  for (const propertyId of missingPropertyIds) {
    const relation = Graph.createRelation({
      fromEntity: definition.id,
      toEntity: propertyId,
      type: SystemIds.PROPERTIES,
    });
    ops.push(...relation.ops);
  }

  await submitOps(`Attach properties to type: ${definition.name}`, ops, walletClient, publicClient);
}

async function detachWorkRecordingProperties(
  walletClient: Awaited<ReturnType<typeof getWalletClient>>,
  publicClient: ReturnType<typeof createPublicClient>,
) {
  const data = await fetchGraphQL<{
    entity: {
      relations: { nodes: { id: string; typeId: string; toEntityId: string }[] } | null;
    } | null;
  }>(
    'query ($id: UUID!) { entity(id: $id) { relations { nodes { id typeId toEntityId } } } }',
    { id: GRC20_TYPE_IDS.work },
  );

  const relations = data.entity?.relations?.nodes ?? [];
  const legacySet = new Set(GRC20_LEGACY_WORK_PROPERTIES);
  const legacyRelations = relations.filter(
    relation => relation.typeId === SystemIds.PROPERTIES && legacySet.has(relation.toEntityId),
  );

  if (!legacyRelations.length) {
    return;
  }

  const ops: ReturnType<typeof Graph.createEntity>['ops'] = [];

  for (const relation of legacyRelations) {
    const { ops: deleteOps } = Graph.deleteRelation({ id: relation.id });
    ops.push(...deleteOps);
  }

  await submitOps('Detach work recording properties', ops, walletClient, publicClient);
}

async function detachArtistLegacyProperties(
  walletClient: Awaited<ReturnType<typeof getWalletClient>>,
  publicClient: ReturnType<typeof createPublicClient>,
) {
  if (!GRC20_LEGACY_ARTIST_PROPERTIES.length) {
    return;
  }

  const data = await fetchGraphQL<{
    entity: {
      relations: { nodes: { id: string; typeId: string; toEntityId: string }[] } | null;
    } | null;
  }>(
    'query ($id: UUID!) { entity(id: $id) { relations { nodes { id typeId toEntityId } } } }',
    { id: GRC20_TYPE_IDS.artist },
  );

  const relations = data.entity?.relations?.nodes ?? [];
  const legacySet = new Set(GRC20_LEGACY_ARTIST_PROPERTIES);
  const legacyRelations = relations.filter(
    relation => relation.typeId === SystemIds.PROPERTIES && legacySet.has(relation.toEntityId),
  );

  if (!legacyRelations.length) {
    return;
  }

  const ops: ReturnType<typeof Graph.createEntity>['ops'] = [];

  for (const relation of legacyRelations) {
    const { ops: deleteOps } = Graph.deleteRelation({ id: relation.id });
    ops.push(...deleteOps);
  }

  await submitOps('Detach artist legacy properties', ops, walletClient, publicClient);
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

  console.log('➡️  Ensuring base properties');
  for (const definition of basePropertyDefinitions) {
    await ensureProperty(definition, walletClient, publicClient);
  }

  console.log('➡️  Ensuring artist type');
  await ensureType(typeDefinitions[0], walletClient, publicClient);
  await detachArtistLegacyProperties(walletClient, publicClient);

  console.log('➡️  Ensuring relation property');
  await ensureProperty(relationPropertyDefinition, walletClient, publicClient);
  await ensureRelationValueTypes(
    relationPropertyDefinition.id,
    relationPropertyDefinition.relationValueTypeIds,
    walletClient,
    publicClient,
  );

  console.log('➡️  Ensuring work type');
  await ensureType(typeDefinitions[1], walletClient, publicClient);
  await detachWorkRecordingProperties(walletClient, publicClient);

  console.log('✅ Space schema ready');
}

main().catch(error => {
  console.error('❌ Failed to set up GRC-20 space schema');
  console.error(error);
  process.exit(1);
});
