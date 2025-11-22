/**
 * Spotify API Service
 * Fetches track and artist metadata
 */

import { SpotifyApi } from '@spotify/web-api-ts-sdk';

let spotifyClient: SpotifyApi | null = null;

/**
 * Get or create Spotify client
 */
function getClient(): SpotifyApi {
  if (!spotifyClient) {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
    }

    spotifyClient = SpotifyApi.withClientCredentials(clientId, clientSecret);
  }

  return spotifyClient;
}

export interface SpotifyAlbumInfo {
  name: string;
  image_url: string | null;
}

export interface SpotifyTrackInfo {
  spotify_track_id: string;
  title: string;
  artists: Array<{ name: string; id: string }>;
  album: SpotifyAlbumInfo | string;
  image_url: string | null;
  isrc: string | null;
  duration_ms: number;
  release_date: string | null;
  popularity: number;
  spotify_url: string;
  preview_url: string | null;
}

export interface SpotifyArtistInfo {
  spotify_artist_id: string;
  name: string;
  genres: string[];
  image_url: string | null;
  popularity: number;
  followers: number;
}

export interface SpotifyAudioFeatures {
  spotify_track_id: string;
  acousticness: number;
  danceability: number;
  energy: number;
  instrumentalness: number;
  liveness: number;
  loudness: number;
  speechiness: number;
  tempo: number;
  valence: number;
  time_signature: number;
  key: number;
  mode: number;
  duration_ms: number;
}

/**
 * Fetch track metadata from Spotify
 */
export async function getTrack(trackId: string): Promise<SpotifyTrackInfo | null> {
  try {
    const client = getClient();
    const track = await client.tracks.get(trackId);

    return {
      spotify_track_id: track.id,
      title: track.name,
      artists: track.artists.map(a => ({ name: a.name, id: a.id })),
      album: {
        name: track.album.name,
        image_url: track.album.images[0]?.url || null,
      },
      image_url: track.album.images[0]?.url || null,
      isrc: track.external_ids?.isrc || null,
      duration_ms: track.duration_ms,
      release_date: track.album.release_date || null,
      popularity: track.popularity,
      spotify_url: track.external_urls.spotify,
      preview_url: track.preview_url || null,
    };
  } catch (error: any) {
    if (error.status === 404) {
      console.warn(`Track ${trackId} not found on Spotify`);
      return null;
    }
    console.error(`Error fetching track ${trackId}:`, error);
    throw error;
  }
}

/**
 * Fetch artist metadata from Spotify
 */
export async function getArtist(artistId: string): Promise<SpotifyArtistInfo | null> {
  try {
    const client = getClient();
    const artist = await client.artists.get(artistId);

    return {
      spotify_artist_id: artist.id,
      name: artist.name,
      genres: artist.genres,
      image_url: artist.images[0]?.url || null,
      popularity: artist.popularity,
      followers: artist.followers.total,
    };
  } catch (error: any) {
    if (error.status === 404) {
      console.warn(`Artist ${artistId} not found on Spotify`);
      return null;
    }
    console.error(`Error fetching artist ${artistId}:`, error);
    throw error;
  }
}

/**
 * Fetch audio features for a track
 * Used for instrumental detection (instrumentalness > 0.5)
 */
export async function getAudioFeatures(trackId: string): Promise<SpotifyAudioFeatures | null> {
  try {
    const client = getClient();
    const features = await client.tracks.audioFeatures(trackId);

    if (!features) {
      console.warn(`No audio features available for track ${trackId}`);
      return null;
    }

    return {
      spotify_track_id: features.id,
      acousticness: features.acousticness,
      danceability: features.danceability,
      energy: features.energy,
      instrumentalness: features.instrumentalness,
      liveness: features.liveness,
      loudness: features.loudness,
      speechiness: features.speechiness,
      tempo: features.tempo,
      valence: features.valence,
      time_signature: features.time_signature,
      key: features.key,
      mode: features.mode,
      duration_ms: features.duration_ms,
    };
  } catch (error: any) {
    if (error.status === 404) {
      console.warn(`Audio features not found for track ${trackId}`);
      return null;
    }
    console.error(`Error fetching audio features for ${trackId}:`, error);
    throw error;
  }
}

/**
 * Fetch multiple tracks in batch (up to 50)
 */
export async function getTracks(trackIds: string[]): Promise<(SpotifyTrackInfo | null)[]> {
  if (trackIds.length === 0) return [];
  if (trackIds.length > 50) {
    throw new Error('Maximum 50 tracks per batch');
  }

  try {
    const client = getClient();
    const tracks = await client.tracks.get(trackIds);

    return tracks.map(track => {
      if (!track) return null;

      return {
        spotify_track_id: track.id,
        title: track.name,
        artists: track.artists.map(a => ({ name: a.name, id: a.id })),
        album: {
          name: track.album.name,
          image_url: track.album.images[0]?.url || null,
        },
        image_url: track.album.images[0]?.url || null,
        isrc: track.external_ids?.isrc || null,
        duration_ms: track.duration_ms,
        release_date: track.album.release_date || null,
        popularity: track.popularity,
        spotify_url: track.external_urls.spotify,
        preview_url: track.preview_url || null,
      };
    });
  } catch (error) {
    console.error('Error fetching tracks batch:', error);
    throw error;
  }
}

/**
 * Fetch multiple artists in batch (up to 50)
 */
export async function getArtists(artistIds: string[]): Promise<(SpotifyArtistInfo | null)[]> {
  if (artistIds.length === 0) return [];
  if (artistIds.length > 50) {
    throw new Error('Maximum 50 artists per batch');
  }

  try {
    const client = getClient();
    const artists = await client.artists.get(artistIds);

    return artists.map(artist => {
      if (!artist) return null;

      return {
        spotify_artist_id: artist.id,
        name: artist.name,
        genres: artist.genres,
        image_url: artist.images[0]?.url || null,
        popularity: artist.popularity,
        followers: artist.followers.total,
      };
    });
  } catch (error) {
    console.error('Error fetching artists batch:', error);
    throw error;
  }
}
