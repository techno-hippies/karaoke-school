/**
 * KaraokeCatalogV2 ABI
 * Optimized contract for Base Sepolia (17.5KB, under 24KB limit)
 *
 * Changes from V1:
 * - Removed: getAllSongs(), getSegmentsForSong()
 * - Removed from Song struct: geniusArtistId, segmentHashes[], languages
 * - Added: getSegment(), getSegmentHash()
 */

export const KARAOKE_CATALOG_ABI = [
  // === Song Read Functions ===
  {
    name: 'getSongById',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'string' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'string' },
          { name: 'geniusId', type: 'uint32' },
          { name: 'title', type: 'string' },
          { name: 'artist', type: 'string' },
          { name: 'duration', type: 'uint32' },
          { name: 'soundcloudPath', type: 'string' },
          { name: 'hasFullAudio', type: 'bool' },
          { name: 'requiresPayment', type: 'bool' },
          { name: 'audioUri', type: 'string' },
          { name: 'metadataUri', type: 'string' },
          { name: 'coverUri', type: 'string' },
          { name: 'thumbnailUri', type: 'string' },
          { name: 'musicVideoUri', type: 'string' },
          { name: 'sectionsUri', type: 'string' },
          { name: 'alignmentUri', type: 'string' },
          { name: 'enabled', type: 'bool' },
          { name: 'addedAt', type: 'uint64' },
        ],
      },
    ],
  },
  {
    name: 'getSongByGeniusId',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusId', type: 'uint32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'string' },
          { name: 'geniusId', type: 'uint32' },
          { name: 'title', type: 'string' },
          { name: 'artist', type: 'string' },
          { name: 'duration', type: 'uint32' },
          { name: 'soundcloudPath', type: 'string' },
          { name: 'hasFullAudio', type: 'bool' },
          { name: 'requiresPayment', type: 'bool' },
          { name: 'audioUri', type: 'string' },
          { name: 'metadataUri', type: 'string' },
          { name: 'coverUri', type: 'string' },
          { name: 'thumbnailUri', type: 'string' },
          { name: 'musicVideoUri', type: 'string' },
          { name: 'sectionsUri', type: 'string' },
          { name: 'alignmentUri', type: 'string' },
          { name: 'enabled', type: 'bool' },
          { name: 'addedAt', type: 'uint64' },
        ],
      },
    ],
  },
  {
    name: 'songExistsById',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'string' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'songExistsByGeniusId',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusId', type: 'uint32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getTotalSongs',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // === Translation Read Functions ===
  {
    name: 'getTranslation',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'geniusId', type: 'uint32' },
      { name: 'languageCode', type: 'string' },
    ],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'hasTranslation',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'geniusId', type: 'uint32' },
      { name: 'languageCode', type: 'string' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getAvailableLanguages',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusId', type: 'uint32' }],
    outputs: [{ name: '', type: 'string[]' }],
  },

  // === Segment Read Functions ===
  {
    name: 'getSegmentHash',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'geniusId', type: 'uint32' },
      { name: 'songId', type: 'string' },
      { name: 'segmentId', type: 'string' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'getSegment',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'segmentHash', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'geniusId', type: 'uint32' },
          { name: 'songId', type: 'string' },
          { name: 'segmentId', type: 'string' },
          { name: 'sectionType', type: 'string' },
          { name: 'startTime', type: 'uint32' },
          { name: 'endTime', type: 'uint32' },
          { name: 'duration', type: 'uint32' },
          { name: 'vocalsUri', type: 'string' },
          { name: 'drumsUri', type: 'string' },
          { name: 'audioSnippetUri', type: 'string' },
          { name: 'processed', type: 'bool' },
          { name: 'requiresPayment', type: 'bool' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'processedAt', type: 'uint64' },
          { name: 'createdBy', type: 'address' },
        ],
      },
    ],
  },

  // === Events ===
  {
    name: 'SongAdded',
    type: 'event',
    inputs: [
      { indexed: true, name: 'id', type: 'string' },
      { indexed: true, name: 'geniusId', type: 'uint32' },
      { indexed: false, name: 'title', type: 'string' },
      { indexed: false, name: 'artist', type: 'string' },
      { indexed: false, name: 'hasFullAudio', type: 'bool' },
      { indexed: false, name: 'requiresPayment', type: 'bool' },
    ],
  },
  {
    name: 'SegmentCreated',
    type: 'event',
    inputs: [
      { indexed: true, name: 'segmentHash', type: 'bytes32' },
      { indexed: true, name: 'geniusId', type: 'uint32' },
      { indexed: false, name: 'segmentId', type: 'string' },
      { indexed: false, name: 'sectionType', type: 'string' },
      { indexed: false, name: 'startTime', type: 'uint32' },
      { indexed: false, name: 'endTime', type: 'uint32' },
      { indexed: false, name: 'createdBy', type: 'address' },
    ],
  },
  {
    name: 'SegmentProcessed',
    type: 'event',
    inputs: [
      { indexed: true, name: 'segmentHash', type: 'bytes32' },
      { indexed: false, name: 'vocalsUri', type: 'string' },
      { indexed: false, name: 'drumsUri', type: 'string' },
      { indexed: false, name: 'audioSnippetUri', type: 'string' },
      { indexed: false, name: 'timestamp', type: 'uint64' },
    ],
  },
  {
    name: 'SegmentsBatchProcessed',
    type: 'event',
    inputs: [
      { indexed: false, name: 'segmentCount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint64' },
    ],
  },
] as const
