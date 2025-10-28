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
  artist_credit?: Array<{
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
  begin_area?: { name: string };
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
    const url = `${MB_API_URL}/artist/${mbid}?inc=url-rels+genres+tags&fmt=json`;
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
 * Extract ISNI from artist relations
 */
export function extractISNI(artist: MBArtist): string | null {
  if (!artist.relations) return null;

  const isniRel = artist.relations.find(rel =>
    rel.type === 'isni' && rel.url?.resource
  );

  if (isniRel?.url?.resource) {
    // Extract ISNI from URL: https://isni.org/isni/0000000121331720
    const match = isniRel.url.resource.match(/\/([0-9X]{16})$/);
    return match ? match[1] : null;
  }

  return null;
}
