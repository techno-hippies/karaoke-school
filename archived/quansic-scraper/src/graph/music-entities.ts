import { Graph, Id } from '@graphprotocol/grc-20';
import type { Artist, Release, Recording } from '../types';

// Standard music property IDs that might already exist
const MUSIC_PROPERTIES = {
  // Artist properties
  ISNI: 'isni',
  IPI: 'ipi',
  SPOTIFY_ID: 'spotify_id',
  MUSICBRAINZ_ID: 'musicbrainz_id',
  
  // Song/Recording properties
  ISRC: 'isrc',
  ISWC: 'iswc',
  DURATION: 'duration',
  RELEASE_DATE: 'release_date',
  
  // Streaming platforms
  SPOTIFY_TRACK_ID: 'spotify_track_id',
  APPLE_MUSIC_ID: 'apple_music_id',
  DEEZER_ID: 'deezer_id',
  SOUNDCLOUD_URL: 'soundcloud_url',
  
  // Release properties
  UPC: 'upc',
  LABEL: 'label',
  
  // Relations
  PERFORMED_BY: 'performed_by',
  COMPOSED_BY: 'composed_by',
  PRODUCED_BY: 'produced_by',
  FEATURED_ON: 'featured_on',
  PART_OF_RELEASE: 'part_of_release',
};

export class MusicEntityCreator {
  private ops: any[] = [];
  private propertyIds: Map<string, string> = new Map();
  private typeIds: Map<string, string> = new Map();

  async createMusicSchema() {
    console.log('Creating music schema properties and types...');
    
    // Create properties for identifiers
    const { id: isniProp, ops: isniOps } = Graph.createProperty({
      name: 'ISNI',
      dataType: 'STRING',
    });
    this.propertyIds.set('isni', isniProp);
    this.ops.push(...isniOps);

    const { id: isrcProp, ops: isrcOps } = Graph.createProperty({
      name: 'ISRC',
      dataType: 'STRING',
    });
    this.propertyIds.set('isrc', isrcProp);
    this.ops.push(...isrcOps);

    const { id: iswcProp, ops: iswcOps } = Graph.createProperty({
      name: 'ISWC',
      dataType: 'STRING',
    });
    this.propertyIds.set('iswc', iswcProp);
    this.ops.push(...iswcOps);

    const { id: upcProp, ops: upcOps } = Graph.createProperty({
      name: 'UPC',
      dataType: 'STRING',
    });
    this.propertyIds.set('upc', upcProp);
    this.ops.push(...upcOps);

    const { id: spotifyIdProp, ops: spotifyOps } = Graph.createProperty({
      name: 'Spotify ID',
      dataType: 'STRING',
    });
    this.propertyIds.set('spotify_id', spotifyIdProp);
    this.ops.push(...spotifyOps);

    const { id: releaseDateProp, ops: releaseDateOps } = Graph.createProperty({
      name: 'Release Date',
      dataType: 'TIME',
    });
    this.propertyIds.set('release_date', releaseDateProp);
    this.ops.push(...releaseDateOps);

    const { id: durationProp, ops: durationOps } = Graph.createProperty({
      name: 'Duration',
      dataType: 'NUMBER',
    });
    this.propertyIds.set('duration', durationProp);
    this.ops.push(...durationOps);

    // Create relation properties
    const { id: performedByProp, ops: performedByOps } = Graph.createProperty({
      name: 'Performed By',
      dataType: 'RELATION',
    });
    this.propertyIds.set('performed_by', performedByProp);
    this.ops.push(...performedByOps);

    const { id: partOfReleaseProp, ops: partOfReleaseOps } = Graph.createProperty({
      name: 'Part of Release',
      dataType: 'RELATION',
    });
    this.propertyIds.set('part_of_release', partOfReleaseProp);
    this.ops.push(...partOfReleaseOps);

    // Create types
    const { id: artistTypeId, ops: artistTypeOps } = Graph.createType({
      name: 'Music Artist',
      properties: [
        this.propertyIds.get('isni')!,
        this.propertyIds.get('spotify_id')!,
      ],
    });
    this.typeIds.set('artist', artistTypeId);
    this.ops.push(...artistTypeOps);

    const { id: songTypeId, ops: songTypeOps } = Graph.createType({
      name: 'Song',
      properties: [
        this.propertyIds.get('isrc')!,
        this.propertyIds.get('iswc')!,
        this.propertyIds.get('duration')!,
        this.propertyIds.get('release_date')!,
        this.propertyIds.get('performed_by')!,
        this.propertyIds.get('part_of_release')!,
      ],
    });
    this.typeIds.set('song', songTypeId);
    this.ops.push(...songTypeOps);

    const { id: releaseTypeId, ops: releaseTypeOps } = Graph.createType({
      name: 'Music Release',
      properties: [
        this.propertyIds.get('upc')!,
        this.propertyIds.get('release_date')!,
      ],
    });
    this.typeIds.set('release', releaseTypeId);
    this.ops.push(...releaseTypeOps);

    return this.ops;
  }

  async createArtistEntity(artist: Artist) {
    // Upload image if available
    let coverId;
    if (artist.image) {
      const { id: imageId, ops: imageOps } = await Graph.createImage({
        url: artist.image,
      });
      coverId = imageId;
      this.ops.push(...imageOps);
    }

    const values = [];
    
    if (artist.identifiers.isni) {
      values.push({
        property: this.propertyIds.get('isni')!,
        value: artist.identifiers.isni,
      });
    }
    
    if (artist.identifiers.spotifyId) {
      values.push({
        property: this.propertyIds.get('spotify_id')!,
        value: artist.identifiers.spotifyId,
      });
    }

    const { id: artistId, ops: artistOps } = Graph.createEntity({
      name: artist.name,
      description: artist.comments || `${artist.type} music artist`,
      types: [this.typeIds.get('artist')!],
      cover: coverId,
      values,
    });

    this.ops.push(...artistOps);
    return artistId;
  }

  async createReleaseEntity(release: Release, artistId: string) {
    const values = [];
    
    if (release.upc) {
      values.push({
        property: this.propertyIds.get('upc')!,
        value: release.upc,
      });
    }
    
    if (release.year) {
      values.push({
        property: this.propertyIds.get('release_date')!,
        value: Graph.serializeDate(new Date(`${release.year}-01-01`)),
      });
    }

    const { id: releaseId, ops: releaseOps } = Graph.createEntity({
      name: release.title,
      description: `${release.type || 'Album'} by artist`,
      types: [this.typeIds.get('release')!],
      values,
    });

    this.ops.push(...releaseOps);
    return releaseId;
  }

  async createSongEntity(
    songName: string,
    artistId: string,
    releaseId?: string,
    metadata?: {
      isrc?: string;
      iswc?: string;
      duration?: string;
      year?: string;
    }
  ) {
    const values = [];
    const relations: any = {};
    
    if (metadata?.isrc) {
      values.push({
        property: this.propertyIds.get('isrc')!,
        value: metadata.isrc,
      });
    }
    
    if (metadata?.iswc) {
      values.push({
        property: this.propertyIds.get('iswc')!,
        value: metadata.iswc,
      });
    }
    
    if (metadata?.duration) {
      // Convert MM:SS to seconds
      const [minutes, seconds] = metadata.duration.split(':').map(Number);
      const totalSeconds = minutes * 60 + seconds;
      values.push({
        property: this.propertyIds.get('duration')!,
        value: Graph.serializeNumber(totalSeconds),
      });
    }
    
    if (metadata?.year) {
      values.push({
        property: this.propertyIds.get('release_date')!,
        value: Graph.serializeDate(new Date(`${metadata.year}-01-01`)),
      });
    }

    // Add relations
    relations[this.propertyIds.get('performed_by')!] = {
      toEntity: artistId,
    };
    
    if (releaseId) {
      relations[this.propertyIds.get('part_of_release')!] = {
        toEntity: releaseId,
      };
    }

    const { id: songId, ops: songOps } = Graph.createEntity({
      name: songName,
      description: `Song performed by artist`,
      types: [this.typeIds.get('song')!],
      values,
      relations,
    });

    this.ops.push(...songOps);
    return songId;
  }

  getOps() {
    return this.ops;
  }
}