/**
 * MusicBrainz API Service
 * Queries MusicBrainz for canonical music identifiers (MBIDs)
 */

const MB_API_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'KaraokePipeline/1.0 (https://github.com/your-org)';

// Rate limit: 1 request/second for MusicBrainz
const RATE_LIMIT_MS = 1000;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });
}

export interface MBRecording {
  id: string; // MBID
  title: string;
  length?: number; // milliseconds
  isrcs?: string[];
  video?: boolean;
  'first-release-date'?: string;
  tags?: Array<{ name: string; count: number }>;
  'artist-credit'?: Array<{
    name: string;
    artist: {
      id: string;
      name: string;
      type?: string;
      genres?: Array<{ name: string; count: number }>;
      tags?: Array<{ name: string; count: number }>;
    };
  }>;
  relations?: Array<{
    type: string;
    direction: string;
    work?: {
      id: string;
      title: string;
      iswcs?: string[];
    };
  }>;
}

export interface MBWork {
  id: string; // MBID
  title: string;
  iswcs?: string[];
  type?: string;
  relations?: Array<{
    type: string;
    artist?: {
      id: string;
      name: string;
      type?: string;
    };
    attributes?: string[];
  }>;
}

export interface MBArtist {
  id: string; // MBID
  name: string;
  type?: string;
  country?: string;
  gender?: string;
  'life-span'?: {
    begin?: string;
    end?: string | null;
    ended: boolean;
  };
  begin_area?: { name: string };
  isnis?: string[];
  ipis?: string[];
  aliases?: Array<{
    name: string;
    locale?: string;  // Language code (e.g., 'lt', 'az', 'el', 'bg')
    type?: string;    // 'Artist name', 'Legal name', etc.
    'sort-name'?: string;
    primary?: boolean;
  }>;
  genres?: Array<{ id: string; name: string; count: number }>;
  tags?: Array<{ name: string; count: number }>;
  relations?: Array<{
    type: string;
    url?: { resource: string };
  }>;
}

/**
 * Look up recording by ISRC
 */
export async function lookupRecordingByISRC(isrc: string): Promise<MBRecording | null> {
  try {
    const url = `${MB_API_URL}/isrc/${isrc}?inc=artist-credits+work-rels+tags&fmt=json`;
    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    const data = await response.json();

    // ISRC lookup returns { recordings: [...] }
    if (data.recordings && data.recordings.length > 0) {
      return data.recordings[0]; // Return first match
    }

    return null;
  } catch (error: any) {
    console.error(`MusicBrainz ISRC lookup failed for ${isrc}:`, error.message);
    throw error;
  }
}

/**
 * Look up work by MBID
 */
export async function lookupWork(mbid: string): Promise<MBWork | null> {
  try {
    const url = `${MB_API_URL}/work/${mbid}?inc=artist-rels&fmt=json`;
    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`MusicBrainz work lookup failed for ${mbid}:`, error.message);
    throw error;
  }
}

/**
 * Look up work by ISWC
 */
export async function lookupWorkByISWC(iswc: string): Promise<MBWork | null> {
  try {
    const url = `${MB_API_URL}/iswc/${iswc}?inc=artist-rels&fmt=json`;
    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    const data = await response.json();

    // ISWC lookup returns { works: [...] }
    if (data.works && data.works.length > 0) {
      return data.works[0]; // Return first match
    }

    return null;
  } catch (error: any) {
    console.error(`MusicBrainz ISWC lookup failed for ${iswc}:`, error.message);
    throw error;
  }
}

/**
 * Look up artist by MBID
 */
export async function lookupArtist(mbid: string): Promise<MBArtist | null> {
  try {
    const url = `${MB_API_URL}/artist/${mbid}?inc=url-rels+genres+tags+aliases&fmt=json`;
    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`MusicBrainz artist lookup failed for ${mbid}:`, error.message);
    throw error;
  }
}

/**
 * Look up artist with artist relationships (for group members)
 */
export async function lookupArtistWithRelations(mbid: string): Promise<MBArtist | null> {
  try {
    const url = `${MB_API_URL}/artist/${mbid}?inc=url-rels+genres+tags+aliases+artist-rels&fmt=json`;
    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`MusicBrainz artist lookup with relations failed for ${mbid}:`, error.message);
    throw error;
  }
}

