/**
 * GRC-20 Entity Type Definitions
 *
 * Defines entity types (Musical Artist, Musical Work, Audio Recording)
 * using the comprehensive property set
 */

import { Graph, type Op } from '@graphprotocol/grc-20';
import { createMusicProperties } from './music-properties';

export async function createMusicEntityTypes() {
  // First create all properties
  const { ops: propertyOps, properties: props } = await createMusicProperties();

  const ops: Op[] = [...propertyOps];
  const types: Record<string, string> = {};

  // ============ Musical Artist Type ============
  const { id: artistTypeId, ops: artistTypeOps } = Graph.createType({
    name: 'Musical Artist',
    properties: [
      // Core identity
      props.name,

      // External IDs
      props.geniusId,
      props.geniusUrl,
      props.spotifyId,
      props.spotifyUrl,
      props.appleMusicId,
      props.appleMusicUrl,
      props.mbid,
      props.wikidataId,
      props.discogsId,

      // Industry IDs
      props.isni,
      props.ipi,

      // Social media
      props.instagramHandle,
      props.tiktokHandle,
      props.twitterHandle,
      props.facebookHandle,
      props.youtubeChannel,
      props.soundcloudHandle,

      // Visual
      props.imageUrl,
      props.headerImageUrl,

      // Biographical
      props.artistType,
      props.country,
      props.gender,
      props.birthDate,
      props.deathDate,
      props.disambiguation,
      props.alternateNames,
      props.sortName,

      // Popularity
      props.genres,
      props.spotifyFollowers,
      props.spotifyPopularity,
      props.geniusFollowers,
      props.isVerified,

      // App-specific
      props.lensAccount,
    ],
  });
  ops.push(...artistTypeOps);
  types.musicalArtist = artistTypeId;

  // ============ Musical Work Type ============
  const { id: workTypeId, ops: workTypeOps } = Graph.createType({
    name: 'Musical Work',
    properties: [
      // Core identity
      props.title,
      props.description,

      // External IDs
      props.geniusId,
      props.geniusUrl,
      props.spotifyId,
      props.spotifyUrl,
      props.appleMusicId,
      props.appleMusicUrl,
      props.wikidataId,
      props.mbid,

      // Industry IDs
      props.iswc,

      // Metadata
      props.language,
      props.releaseDate,
      props.annotationCount,
      props.pyongsCount,

      // Relations
      props.composedBy, // → Musical Artist
    ],
  });
  ops.push(...workTypeOps);
  types.musicalWork = workTypeId;

  // ============ Audio Recording Type ============
  const { id: recordingTypeId, ops: recordingTypeOps } = Graph.createType({
    name: 'Audio Recording',
    properties: [
      // Core identity
      props.title,

      // External IDs
      props.spotifyId,
      props.spotifyUrl,
      props.appleMusicId,
      props.appleMusicUrl,
      props.mbid,

      // Industry IDs
      props.isrc,

      // Technical
      props.durationMs,
      props.album,
      props.releaseDate,

      // Popularity
      props.spotifyPopularity,

      // Relations
      props.recordingOf, // → Musical Work
      props.performedBy, // → Musical Artist
    ],
  });
  ops.push(...recordingTypeOps);
  types.audioRecording = recordingTypeId;

  return {
    ops,
    types,
    properties: props,
  };
}
