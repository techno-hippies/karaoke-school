/**
 * GRC-20 Configuration for Karaoke School v1
 *
 * This file defines the Geo Browser space configuration, including:
 * - Space ID, DAO, and contract addresses
 * - Type IDs for Artist and Work entities
 * - Property IDs for all metadata fields
 * - Relation IDs for entity relationships
 * - Legacy properties to remove from entities
 *
 * GRC-20 (Geo Resource Catalog) is a decentralized metadata standard.
 * All changes to this configuration require running setup-space.ts to sync
 * property definitions to the on-chain space.
 *
 * Network: Geo Testnet
 * Space: https://geobrowser.io/spaces/17f2f2af-2b70-4b98-8d7a-6b75401c6650
 */

export const GRC20_SPACE_ID = '17f2f2af-2b70-4b98-8d7a-6b75401c6650';

export const GRC20_SPACE_ADDRESSES = {
  dao: '0xbc0FD7bf55D90DC633a2F379d9d1Dfb3Bc9a1BE1',
  space: '0xEc62dF94EEB2Ce74843BaFB194D85C0480A62aCc',
  plugin: '0x590d8D7256abc5D70Ff9D7E46a4A698Df558Cdd2',
} as const;

export const GEO_TESTNET_RPC_URL =
  process.env.GEO_TESTNET_RPC_URL ?? 'https://rpc-geo-test-zc16z3tcvf.t.conduit.xyz';

export const GEO_GRAPHQL_ENDPOINT =
  process.env.GEO_GRAPHQL_ENDPOINT ?? 'https://api-testnet.geobrowser.io/graphql';

export const GRC20_TYPE_IDS = {
  artist: 'dfbf8c84-6526-4e2c-ba86-2039aa94d7da',
  work: 'ae5004a4-3415-4c72-8882-027c60b7cbea',
} as const;

export const GRC20_PROPERTY_IDS = {
  artistIsni: 'fc735ee5-e5a5-4172-8426-40a8e2dd9b5f',
  artistIsniAll: '1174ca96-5aba-47e7-a374-bf462ce2f6b8',
  artistSpotifyId: '32f9ea43-a8a3-445f-914f-a2dc3a935312',
  artistSpotifyUrl: 'cf36b56e-007a-4501-bb54-b74cf950a9c0',
  artistGeniusId: '86d58f90-f565-43a3-b201-923a5b591509',
  artistGeniusUrl: 'e1008559-39dd-49f4-ba62-93f3c889a2cf',
  artistWikidataUrl: 'daa04adb-c31a-40f0-8f2f-34614714d0eb',
  artistGenres: '43cb8b09-7455-45c4-9331-7070a2fb2e1c',
  artistCountry: 'fb498b6a-f261-4d1d-80a7-fa7c981360da',
  artistType: 'be743640-5af9-4240-a828-94ee399b626b',
  artistGroveImageUrl: '00019edd-9a87-4a16-8f6c-04ba9e5ad49f',
  artistOfficialWebsite: 'f60e36e1-2a2c-4c4a-aeed-854a572310a3',
  artistInstagramUrl: '8d6fc79d-6284-4af3-8e66-3d8c884b1f9a',
  artistTwitterUrl: '52ce581b-f70d-4703-b1b6-6865aa5d6c23',
  artistTiktokUrl: 'd824c133-1e01-4188-ab3f-455ef1ee6044',
  artistYoutubeUrl: 'b3d0c629-9a24-476d-a7e9-3e8d88477026',
  artistSoundcloudUrl: '2d43b080-52ab-4806-97c1-ce0aa278bdf0',
  artistFacebookUrl: '1bd4a55c-861e-4bc4-a5f0-6b074f2a3e6d',
  artistDeezerUrl: '29f25160-105b-4d30-a7c5-92df22f2c0ee',
  artistAppleMusicUrl: '130d310c-9db5-402c-b7bb-1424759508b5',
  artistWikipediaUrl: 'c6d9b696-5238-400b-9408-3387aeb1b9c1',
  artistWikipediaUrls: 'bace9909-a206-4543-9085-2316522736c3',
  artistLensHandle: '9cf8745d-6c0b-4fbf-9002-c063ba75cf9c',
  artistLibraryIds: '685d30e4-c085-471a-9b71-8ab1b679c406',
  artistExternalIds: 'c84089cc-505a-41ab-9911-801d2d1eb1b5',
  artistViafId: 'b71d55a8-3170-4bda-ae96-cc7f09fe6a5a',
  artistBnfId: '49299558-36ee-4bd4-8989-80261624218b',
  artistGndId: 'ca4a3fdd-9a9d-4150-acfa-1ec0324d2695',
  artistLocId: '2af94e35-f1be-40e5-8b50-0ffb6515906b',
  artistAliases: 'b001facc-cbcd-474c-ac41-1ccd1696b068',
  artistAlternateNames: '2e47ca79-abca-4fa0-afa2-40bc276c337d',
  artistDiscogsId: 'e1f47b08-36c2-409f-91eb-ba83cc1dfe33',
  artistBandcampUrl: '38bbe179-ab40-4fa2-8c6e-cecb5256e02b',
  artistSongkickUrl: '48b9f4ed-3abd-458c-a94a-bb9d18c9fd24',
  artistSetlistfmUrl: '9665d2b1-6004-40e0-a848-d90186c3ec9b',
  artistLastfmUrl: 'cc086829-bafe-4023-ad81-2b9c5c5dfb36',
  artistPitchforkUrl: 'cbd6519f-c5cf-45cc-a786-453c979e9abd',
  artistSongfactsUrl: '4614bd4a-078e-40e3-b875-43f11b7bdcd3',
  artistMusixmatchUrl: '9e4495bc-934f-4901-a1ab-602a523183cd',
  artistRateyourmusicUrl: '9d4e9fed-bd35-4e9b-b32c-0a1732567bef',
  artistDiscogsUrl: '740e1448-684c-462b-afeb-6e7a2776b458',
  artistAllmusicUrl: 'ade63e8c-ef00-491f-9dc3-05b4faa1ad1c',
  artistImdbUrl: '7cf8ecd8-54a7-4f0c-a2d6-0c25b1cc1e34',
  artistWeiboUrl: '40c78e85-4191-4e36-b230-8b0143fc3493',
  artistVkUrl: 'ee41321b-4deb-4083-b75f-e914c07cbdac',
  artistSubredditUrl: 'eaae809a-0e18-48c5-ba80-bf3074e7091e',
  artistCarnegieHallUrl: 'bf68b431-68fd-45e6-a5d7-3046cdb9543e',
  workIswc: '9a764a8c-a98f-41a8-9cfa-508375fdc6f8',
  workIswcSource: '3482c708-49b1-4c22-a2d6-464623f7fa01',
  workGeniusSongId: '472b6076-471d-4269-9cdd-f5cf23742ec8',
  workGeniusUrl: '44d889a2-5532-471e-8d57-70419a0595a1',
  workWikidataUrl: 'f4d83d10-a529-403b-b3a0-9ca6626faab2',
  workReleaseDate: 'e1fcaa22-8fa0-42c7-889c-10e518a21a29',
  workDurationMs: 'ab1d5c35-7a52-4a09-b66d-819f908d15c6',
  workLanguage: '17d4c9c0-1ea3-4e55-84c2-af20b70897d4',
  workGroveImageUrl: '2ab90c4a-ce2b-482e-9cda-6549ef31aeba',
  workAlternateTitles: 'fe6d118a-9549-45e6-ae24-a07e0fbbcd92',
} as const;

export const GRC20_RELATION_IDS = {
  primaryArtist: 'eb9d9278-215c-49d4-9911-cde08371ff98',
} as const;

/**
 * Legacy Work Properties
 *
 * These properties are removed from work entities during updates.
 * Reasons: moved to separate tracking systems or deprecated.
 */
export const GRC20_LEGACY_WORK_PROPERTIES = [
  '6e0f490c-b27e-42c2-9a77-a34f2173000d', // workIsrc
  '4960472c-6947-4c25-8a26-9278d5ef9259', // workSpotifyTrackId
  '45d1dc79-d760-464c-a6e1-8877112b7790', // workSpotifyUrl
  'ee3f6d7c-5148-4d0b-9dcc-f3f4907a98f7', // workImageSource
] as const;

/**
 * Legacy Artist Properties
 *
 * These properties are removed from artist entities during updates.
 * Reasons:
 * - artistWikipediaUrls: Too large (70+ languages), queryable from Wikidata instead
 * - artistExternalIds: Redundant with individual URL properties
 * - artistLibraryIds: Redundant with separate VIAF/BNF/GND/LOC properties
 * - artistMembers/MemberOf/SocialLinks: Deprecated, replaced by specific URL fields
 */
export const GRC20_LEGACY_ARTIST_PROPERTIES = [
  'bab8bbe9-b707-42d9-a643-e78b57a4d046', // artistImageSource
  'bca1de65-9e29-4bba-aaa1-044249240f11', // artistMembers
  '69b890e6-cd1e-48d9-9e96-0276a8215fd8', // artistMemberOf
  'a839a2cd-03e3-4715-a227-83215c9262d7', // artistSocialLinks
  'bace9909-a206-4543-9085-2316522736c3', // artistWikipediaUrls (removed - too large)
  'c84089cc-505a-41ab-9911-801d2d1eb1b5', // artistExternalIds (removed - redundant)
  '685d30e4-c085-471a-9b71-8ab1b679c406', // artistLibraryIds (removed - redundant with individual ID fields)
] as const;

export const GEO_NETWORK = 'TESTNET' as const;
