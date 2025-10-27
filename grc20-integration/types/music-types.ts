/**
 * GRC-20 Type Definitions for Music Knowledge Graph
 *
 * Hierarchy:
 * - Musical Work (composition/song as written) - ISWC optional
 * - Audio Recording (specific recorded version) - ISRC required
 * - Karaoke Segment (processed clip for practice) - derived work
 * - Musical Artist (performer/composer) - ISNI optional
 * - Performance (user's karaoke attempt) - graded on-chain
 *
 * References:
 * - MusicBrainz IDs are OPTIONAL properties (foreign keys)
 * - GRC-20 entity IDs are the primary keys
 */

import { Graph, Id } from '@graphprotocol/grc-20';
import type { Op } from '@graphprotocol/grc-20';

// ============ Property Definitions ============

export async function createMusicProperties() {
  const ops: Op[] = [];

  // Core metadata properties
  const { id: titleProperty, ops: titleOps } = Graph.createProperty({
    name: 'Title',
    dataType: 'STRING',
  });
  ops.push(...titleOps);

  const { id: descriptionProperty, ops: descOps } = Graph.createProperty({
    name: 'Description',
    dataType: 'STRING',
  });
  ops.push(...descOps);

  const { id: durationMsProperty, ops: durationOps } = Graph.createProperty({
    name: 'Duration (ms)',
    dataType: 'NUMBER',
  });
  ops.push(...durationOps);

  // External ID properties (MusicBrainz, ISRC, ISWC, etc.)
  const { id: mbidProperty, ops: mbidOps } = Graph.createProperty({
    name: 'MusicBrainz ID',
    dataType: 'STRING',
  });
  ops.push(...mbidOps);

  const { id: isrcProperty, ops: isrcOps } = Graph.createProperty({
    name: 'ISRC',
    dataType: 'STRING',
  });
  ops.push(...isrcOps);

  const { id: iswcProperty, ops: iswcOps } = Graph.createProperty({
    name: 'ISWC',
    dataType: 'STRING',
  });
  ops.push(...iswcOps);

  const { id: isniProperty, ops: isniOps } = Graph.createProperty({
    name: 'ISNI',
    dataType: 'STRING',
  });
  ops.push(...isniOps);

  const { id: spotifyIdProperty, ops: spotifyOps } = Graph.createProperty({
    name: 'Spotify ID',
    dataType: 'STRING',
  });
  ops.push(...spotifyOps);

  // Grove asset properties
  const { id: groveUriProperty, ops: groveOps } = Graph.createProperty({
    name: 'Grove URI',
    dataType: 'STRING',
  });
  ops.push(...groveOps);

  const { id: instrumentalUriProperty, ops: instrOps } = Graph.createProperty({
    name: 'Instrumental Audio URI',
    dataType: 'STRING',
  });
  ops.push(...instrOps);

  const { id: alignmentUriProperty, ops: alignOps } = Graph.createProperty({
    name: 'Word Alignment URI',
    dataType: 'STRING',
  });
  ops.push(...alignOps);

  // Segment timing properties
  const { id: startMsProperty, ops: startOps } = Graph.createProperty({
    name: 'Start Time (ms)',
    dataType: 'NUMBER',
  });
  ops.push(...startOps);

  const { id: endMsProperty, ops: endOps } = Graph.createProperty({
    name: 'End Time (ms)',
    dataType: 'NUMBER',
  });
  ops.push(...endOps);

  // Relation properties
  const { id: recordingOfProperty, ops: recOfOps } = Graph.createProperty({
    name: 'Recording Of',
    dataType: 'RELATION',
  });
  ops.push(...recOfOps);

  const { id: hasSegmentProperty, ops: hasSegOps } = Graph.createProperty({
    name: 'Has Segment',
    dataType: 'RELATION',
  });
  ops.push(...hasSegOps);

  const { id: performedByProperty, ops: perfByOps } = Graph.createProperty({
    name: 'Performed By',
    dataType: 'RELATION',
  });
  ops.push(...perfByOps);

  const { id: hasPerformanceProperty, ops: hasPerfOps } = Graph.createProperty({
    name: 'Has Performance',
    dataType: 'RELATION',
  });
  ops.push(...hasPerfOps);

  // Blockchain properties
  const { id: lensAccountProperty, ops: lensOps } = Graph.createProperty({
    name: 'Lens Account',
    dataType: 'STRING',
  });
  ops.push(...lensOps);

  const { id: pkpAddressProperty, ops: pkpOps } = Graph.createProperty({
    name: 'PKP Address',
    dataType: 'STRING',
  });
  ops.push(...pkpOps);

  const { id: performanceScoreProperty, ops: scoreOps } = Graph.createProperty({
    name: 'Performance Score',
    dataType: 'NUMBER',
  });
  ops.push(...scoreOps);

  const { id: lensPostUriProperty, ops: postOps } = Graph.createProperty({
    name: 'Lens Post URI',
    dataType: 'STRING',
  });
  ops.push(...postOps);

  return {
    ops,
    properties: {
      title: titleProperty,
      description: descriptionProperty,
      durationMs: durationMsProperty,
      mbid: mbidProperty,
      isrc: isrcProperty,
      iswc: iswcProperty,
      isni: isniProperty,
      spotifyId: spotifyIdProperty,
      groveUri: groveUriProperty,
      instrumentalUri: instrumentalUriProperty,
      alignmentUri: alignmentUriProperty,
      startMs: startMsProperty,
      endMs: endMsProperty,
      recordingOf: recordingOfProperty,
      hasSegment: hasSegmentProperty,
      performedBy: performedByProperty,
      hasPerformance: hasPerformanceProperty,
      lensAccount: lensAccountProperty,
      pkpAddress: pkpAddressProperty,
      performanceScore: performanceScoreProperty,
      lensPostUri: lensPostUriProperty,
    },
  };
}

// ============ Type Definitions ============

export async function createMusicTypes(properties: ReturnType<typeof createMusicProperties> extends Promise<infer T> ? T['properties'] : never) {
  const ops: Op[] = [];

  // Musical Work Type (composition)
  const { id: musicalWorkType, ops: workTypeOps } = Graph.createType({
    name: 'Musical Work',
    properties: [
      properties.title,
      properties.description,
      properties.durationMs,
      properties.iswc,           // Optional: ISWC for composition
      properties.mbid,            // Optional: MusicBrainz work MBID
      properties.spotifyId,       // Spotify track ID (most common lookup)
      properties.groveUri,        // Grove metadata URI
    ],
  });
  ops.push(...workTypeOps);

  // Audio Recording Type (specific recording)
  const { id: audioRecordingType, ops: recordingTypeOps } = Graph.createType({
    name: 'Audio Recording',
    properties: [
      properties.title,
      properties.isrc,            // ISRC for recording
      properties.mbid,            // MusicBrainz recording MBID
      properties.durationMs,
      properties.groveUri,
      properties.recordingOf,     // Relation to Musical Work
    ],
  });
  ops.push(...recordingTypeOps);

  // Karaoke Segment Type (processed clip)
  const { id: karaokeSegmentType, ops: segmentTypeOps } = Graph.createType({
    name: 'Karaoke Segment',
    properties: [
      properties.title,
      properties.startMs,
      properties.endMs,
      properties.durationMs,
      properties.instrumentalUri, // PRIMARY: fal.ai enhanced instrumental
      properties.alignmentUri,    // ElevenLabs word-level timing
      properties.groveUri,        // Segment metadata
      properties.recordingOf,     // Relation to Recording (parent)
    ],
  });
  ops.push(...segmentTypeOps);

  // Musical Artist Type
  const { id: musicalArtistType, ops: artistTypeOps } = Graph.createType({
    name: 'Musical Artist',
    properties: [
      properties.title,           // Artist name
      properties.description,     // Bio
      properties.isni,            // Optional: ISNI for artist
      properties.mbid,            // MusicBrainz artist MBID
      properties.spotifyId,       // Spotify artist ID
      properties.lensAccount,     // Lens account address
      properties.pkpAddress,      // PKP address
      properties.groveUri,        // Artist metadata
    ],
  });
  ops.push(...artistTypeOps);

  // Performance Type (user karaoke attempt)
  const { id: performanceType, ops: perfTypeOps } = Graph.createType({
    name: 'Karaoke Performance',
    properties: [
      properties.title,
      properties.performanceScore,  // 0-10000 basis points
      properties.groveUri,           // Performance video/audio
      properties.lensPostUri,        // Lens post ID
      properties.hasPerformance,     // Relation to segment
      properties.performedBy,        // Relation to artist/user
    ],
  });
  ops.push(...perfTypeOps);

  return {
    ops,
    types: {
      musicalWork: musicalWorkType,
      audioRecording: audioRecordingType,
      karaokeSegment: karaokeSegmentType,
      musicalArtist: musicalArtistType,
      performance: performanceType,
    },
  };
}

// ============ Export Helper ============

export async function defineAllMusicTypes() {
  const { ops: propertyOps, properties } = await createMusicProperties();
  const { ops: typeOps, types } = await createMusicTypes(properties);

  return {
    ops: [...propertyOps, ...typeOps],
    properties,
    types,
  };
}

// ============ Type Guards ============

export function isMusicalWork(entity: any): boolean {
  return entity.types?.includes('Musical Work');
}

export function isAudioRecording(entity: any): boolean {
  return entity.types?.includes('Audio Recording');
}

export function isKaraokeSegment(entity: any): boolean {
  return entity.types?.includes('Karaoke Segment');
}

export function isMusicalArtist(entity: any): boolean {
  return entity.types?.includes('Musical Artist');
}

export function isPerformance(entity: any): boolean {
  return entity.types?.includes('Karaoke Performance');
}
