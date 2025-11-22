/**
 * MusicBrainz API Service
 * Queries MusicBrainz for canonical music identifiers (MBIDs)
 */

const MB_API_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'KaraokePipeline/1.0 (https://github.com/your-org)';

// Rate limit: 1 request/second for MusicBrainz
const RATE_LIMIT_MS = 1000;
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout
const MAX_RETRIES = 3;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string, retries = MAX_RETRIES): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    // Retry on network errors (socket closed, timeout, etc.)
    if (retries > 0 && (
      error.name === 'AbortError' ||
      error.message?.includes('socket') ||
      error.message?.includes('connection') ||
      error.message?.includes('ECONNRESET')
    )) {
      console.log(`MusicBrainz fetch failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
      return rateLimitedFetch(url, retries - 1);
    }
    throw error;
  }
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
    // MusicBrainz requires uppercase ISRCs
    const normalizedIsrc = isrc.toUpperCase();
    const url = `${MB_API_URL}/isrc/${normalizedIsrc}?inc=artist-credits+work-rels+tags&fmt=json`;
    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    const data = await response.json();

    // ISRC lookup returns { recordings: [...] }
    if (data.recordings && data.recordings.length > 0) {
      // Prefer recordings with work relations (for ISWC/writer data)
      const withWork = data.recordings.find((r: any) =>
        r.relations?.some((rel: any) => rel.type === 'performance' && rel.work)
      );
      return withWork || data.recordings[0]; // Fallback to first if none have works
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
    // Include url-rels to get Wikidata URLs
    const url = `${MB_API_URL}/work/${mbid}?inc=artist-rels+url-rels&fmt=json`;
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
    // Include url-rels to get Wikidata URLs
    const url = `${MB_API_URL}/iswc/${iswc}?inc=artist-rels+url-rels&fmt=json`;
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
 * Returns full artist data including ISNIs, IPIs, members, and URLs
 */
export async function lookupArtist(mbid: string): Promise<MBArtist | null> {
  try {
    // Include artist-rels for member/member-of relationships
    // Note: isnis and ipis are returned automatically in base response (not inc params)
    const url = `${MB_API_URL}/artist/${mbid}?inc=url-rels+genres+tags+aliases+artist-rels&fmt=json`;
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

