/**
 * Quansic Enrichment Service
 *
 * Provides HTTP API for:
 * - Authenticating with Quansic via Playwright
 * - Enriching artist data with ISNI lookups
 * - Session cookie caching
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { chromium, Browser, BrowserContext } from 'playwright';

const app = new Hono();

// Global state
let browser: Browser | null = null;
let sessionCookie: string | null = null;
let sessionExpiry: number = 0; // Timestamp when session expires
const SESSION_DURATION = 3600000; // 1 hour

interface QuansicArtistData {
  isni: string;
  musicbrainz_mbid?: string;
  ipn: string | null;
  luminate_id: string | null;
  gracenote_id: string | null;
  amazon_id: string | null;
  apple_music_id: string | null;
  name_variants: Array<{ name: string; language?: string }>;
  raw_data: Record<string, unknown>;
}

interface AuthRequest {
  email: string;
  password: string;
}

interface EnrichRequest {
  isni: string;
  musicbrainz_mbid?: string;
  spotify_artist_id?: string;
  force_reauth?: boolean;
}

interface SearchRequest {
  isni: string;
}

interface EnrichRecordingRequest {
  isrc: string;
  spotify_track_id?: string;
  recording_mbid?: string;
  force_reauth?: boolean;
}

interface EnrichWorkRequest {
  iswc: string;
  work_mbid?: string;
  force_reauth?: boolean;
}

/**
 * Initialize Playwright browser (headless Chrome)
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    console.log('🌐 Launching Playwright browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

/**
 * Authenticate with Quansic and get session cookie
 */
async function authenticate(email: string, password: string): Promise<string> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔐 Authenticating with Quansic...');

    // Navigate to login page (use domcontentloaded for Akash compatibility)
    await page.goto('https://explorer.quansic.com/app-login', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // Wait for form to be visible
    await page.waitForSelector('input[name="email"]', { timeout: 30000 });

    // Fill in credentials
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    // Click login button and wait for navigation
    await Promise.all([
      page.waitForURL(/explorer\.quansic\.com\/(?!app-login)/, {
        waitUntil: 'domcontentloaded',
        timeout: 90000
      }),
      page.click('button:has-text("Login")')
    ]);

    // Extract cookies
    const cookies = await context.cookies();
    const sessionCookieStr = cookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');

    console.log('✅ Authentication successful');

    return sessionCookieStr;

  } catch (error: any) {
    console.error('❌ Authentication failed:', error.message);
    throw new Error(`Quansic authentication failed: ${error.message}`);
  } finally {
    await context.close();
  }
}

/**
 * Check if current session is valid
 */
function isSessionValid(): boolean {
  return sessionCookie !== null && Date.now() < sessionExpiry;
}

/**
 * Ensure we have a valid session cookie
 */
async function ensureSession(forceReauth = false): Promise<string> {
  if (!forceReauth && isSessionValid() && sessionCookie) {
    return sessionCookie;
  }

  const email = process.env.QUANSIC_EMAIL;
  const password = process.env.QUANSIC_PASSWORD;

  if (!email || !password) {
    throw new Error('QUANSIC_EMAIL and QUANSIC_PASSWORD environment variables required');
  }

  sessionCookie = await authenticate(email, password);
  sessionExpiry = Date.now() + SESSION_DURATION;

  return sessionCookie;
}

/**
 * Fetch artist party data from Quansic
 */
async function getArtistParty(isni: string, cookie: string): Promise<any> {
  const cleanIsni = isni.replace(/\s/g, '');
  const url = `https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::${cleanIsni}`;

  const response = await fetch(url, {
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Quansic API error ${response.status} for ISNI ${cleanIsni}:`, errorText.substring(0, 200));

    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    throw new Error(`Quansic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

/**
 * Fetch artist name variants
 */
async function getArtistNameVariants(isni: string, cookie: string): Promise<Array<{ name: string; language?: string }>> {
  const cleanIsni = isni.replace(/\s/g, '');
  const url = `https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::${cleanIsni}/nameVariants`;

  const response = await fetch(url, {
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    console.warn(`Failed to fetch name variants for ${isni}: ${response.status}`);
    return [];
  }

  const data = await response.json();
  const variants = data.results?.nameVariants || [];

  return variants.map((v: any) => ({
    name: v.fullname || v.name,
    language: v.language,
  }));
}

/**
 * Search for artist party by ISNI using entity search
 */
async function searchByISNI(isni: string, cookie: string): Promise<any> {
  const cleanIsni = isni.replace(/\s/g, '');
  const url = 'https://explorer.quansic.com/api/log/entitySearch';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      entityType: 'isni',
      searchTerm: cleanIsni,
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    const errorText = await response.text();
    console.error(`Entity search failed (${response.status}):`, errorText.substring(0, 200));
    return null;
  }

  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    return null;
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse entity search response');
    return null;
  }

  const parties = data.results?.parties;

  if (parties && parties.length > 0) {
    console.log(`Found via entity search! Primary ISNI: ${parties[0].ids.isnis[0]}`);
    return { party: parties[0] };
  }

  return null;
}

/**
 * Search for artist party by Spotify ID using entity search
 * Fallback when ISNI lookups fail (handles secondary ISNIs)
 */
async function searchBySpotifyId(spotifyId: string, cookie: string): Promise<any> {
  const url = 'https://explorer.quansic.com/api/log/entitySearch';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      entityType: 'spotifyId',
      searchTerm: spotifyId,
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    const errorText = await response.text();
    console.error(`Spotify entity search failed (${response.status}):`, errorText.substring(0, 200));
    return null;
  }

  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    return null;
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse Spotify entity search response');
    return null;
  }

  const parties = data.results?.parties;

  if (parties && parties.length > 0) {
    console.log(`Found via Spotify search! Primary ISNI: ${parties[0].ids.isnis?.[0] || 'N/A'}`);
    return { party: parties[0] };
  }

  return null;
}

/**
 * Enrich artist with complete Quansic data
 */
async function enrichArtist(
  isni: string,
  musicbrainzMbid?: string,
  spotifyArtistId?: string,
  forceReauth = false
): Promise<QuansicArtistData> {
  console.log(`Enriching ISNI ${isni}...`);

  const cookie = await ensureSession(forceReauth);
  let party = null;
  let actualIsni = isni;

  try {
    // Try direct ISNI lookup first
    party = await getArtistParty(isni, cookie);
  } catch (error: any) {
    // Session expired, retry with new session
    if (error.message === 'SESSION_EXPIRED') {
      console.log('Session expired, re-authenticating...');
      const newCookie = await ensureSession(true);
      party = await getArtistParty(isni, newCookie);
    } else if (error.message.includes('404')) {
      // If direct lookup fails, try entity search (finds secondary ISNIs)
      console.log(`Direct lookup failed, trying entity search for ${isni}...`);
      party = await searchByISNI(isni, cookie);

      // Extract the primary ISNI from Quansic data
      if (party?.party?.ids?.isnis?.length > 0) {
        actualIsni = party.party.ids.isnis[0];
        console.log(`Found via search! Primary Quansic ISNI: ${actualIsni}`);
      }

      // If still no party and we have Spotify ID, try Spotify search
      if (!party && spotifyArtistId) {
        console.log(`ISNI search failed, trying Spotify ID: ${spotifyArtistId}...`);
        party = await searchBySpotifyId(spotifyArtistId, cookie);

        // Extract the primary ISNI from Spotify search result
        if (party?.party?.ids?.isnis?.length > 0) {
          actualIsni = party.party.ids.isnis[0];
          console.log(`Found via Spotify! Primary ISNI: ${actualIsni}`);
        }
      }
    }

    // If still no party data, re-throw the error
    if (!party) {
      throw error;
    }
  }

  const nameVariants = await getArtistNameVariants(actualIsni, cookie);
  const ids = party.party?.ids || {};

  return {
    isni: actualIsni.replace(/\s/g, ''),
    musicbrainz_mbid: musicbrainzMbid,
    ipn: ids.ipns?.[0] || null,
    luminate_id: ids.luminateIds?.[0] || null,
    gracenote_id: ids.gracenoteIds?.[0] || null,
    amazon_id: ids.amazonIds?.[0] || null,
    apple_music_id: ids.appleIds?.[0] || null,
    name_variants: nameVariants,
    raw_data: party,
  };
}

/**
 * Enrich recording with ISRC lookup
 * Returns recording + work + contributors
 */
async function enrichRecording(isrc: string, spotifyTrackId?: string, recordingMbid?: string, forceReauth = false) {
  console.log(`Enriching ISRC ${isrc}...`);

  const cookie = await ensureSession(forceReauth);
  const cleanIsrc = isrc.replace(/\s/g, '');
  const url = `https://explorer.quansic.com/api/q/lookup/recording/isrc/${cleanIsrc}`;

  const response = await fetch(url, {
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Quansic ISRC lookup error ${response.status}:`, errorText.substring(0, 200));

    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    if (response.status === 404) {
      throw new Error(`ISRC not found: ${cleanIsrc}`);
    }
    throw new Error(`Quansic API error: ${response.status}`);
  }

  const data = await response.json();
  const recording = data.results?.recording;

  if (!recording) {
    throw new Error('No recording data in response');
  }

  // Fetch work data separately (not included in recording endpoint)
  let work = null;
  const worksUrl = `https://explorer.quansic.com/api/q/lookup/recording/isrc/${cleanIsrc}/works/0`;

  try {
    const worksResponse = await fetch(worksUrl, {
      headers: {
        'cookie': cookie,
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-instance': 'default',
      },
    });

    if (worksResponse.ok) {
      const worksData = await worksResponse.json();
      if (worksData.results?.data?.length > 0) {
        work = worksData.results.data[0]; // First work
        console.log(`✓ Found work: ${work.iswc} - ${work.title}`);
      }
    } else {
      console.log(`No work data found for ${cleanIsrc} (${worksResponse.status})`);
    }
  } catch (error: any) {
    console.log(`Failed to fetch work data: ${error.message}`);
  }

  return {
    isrc: cleanIsrc,
    spotify_track_id: spotifyTrackId,
    recording_mbid: recordingMbid,

    // Recording metadata
    title: recording.title,
    subtitle: recording.subtitle || null,
    duration_ms: recording.durationMs || null,
    release_date: recording.releaseDate || null,

    // Work data (embedded)
    iswc: work?.iswc?.replace(/\s/g, '') || null,
    work_title: work?.title || null,

    // Artists (MainArtist contributors)
    artists: recording.contributors?.filter((c: any) => c.contributorType === 'MainArtist').map((a: any) => ({
      name: a.name,
      isni: a.ids?.isnis?.[0] || null,
      ipi: a.ids?.ipis?.[0] || null,
      role: a.contributorType,
      ids: a.ids || {},
    })) || [],

    // Composers (from work)
    composers: work?.contributors?.map((c: any) => ({
      name: c.name,
      isni: c.ids?.isnis?.[0] || null,
      ipi: c.ids?.ipis?.[0] || null,
      role: c.role,
      birthdate: c.birthdate || null,
    })) || [],

    // Platform IDs
    platform_ids: {
      spotify: recording.spotifyId || null,
      apple: recording.appleId || null,
      musicbrainz: recording.musicBrainzId || null,
      luminate: recording.luminateId || null,
      gracenote: recording.gracenoteId || null,
    },

    // Quality score
    q2_score: recording.q2Score || null,

    raw_data: {
      recording: data.results,
      works: work ? [work] : [],
    },
  };
}

/**
 * Enrich work with ISWC lookup
 * Returns work + composers + all recordings (for verification)
 */
async function enrichWork(iswc: string, workMbid?: string, forceReauth = false) {
  console.log(`Enriching ISWC ${iswc}...`);

  const cookie = await ensureSession(forceReauth);
  const cleanIswc = iswc.replace(/[-.\s]/g, '');  // Remove dashes, dots, and spaces
  const url = `https://explorer.quansic.com/api/q/lookup/work/iswc/${cleanIswc}`;

  const response = await fetch(url, {
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Quansic ISWC lookup error ${response.status}:`, errorText.substring(0, 200));

    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    if (response.status === 404) {
      throw new Error(`ISWC not found: ${cleanIswc}`);
    }
    throw new Error(`Quansic API error: ${response.status}`);
  }

  const data = await response.json();
  const work = data.results?.work;

  if (!work) {
    throw new Error('No work data in response');
  }

  return {
    iswc: cleanIswc,
    work_mbid: workMbid,

    title: work.title,

    // Composers/Writers
    contributors: work.contributors?.map((c: any) => ({
      name: c.name,
      isni: c.ids?.isnis?.[0] || null,
      ipi: c.ids?.ipis?.[0] || null,
      role: c.role,
      birthdate: c.birthdate || null,
      nationality: c.nationality || null,
    })) || [],

    // Verification metadata
    recording_count: work.recordings?.length || 0,
    q1_score: work.q1Score || null,

    // Sample recordings (first 5, for verification)
    sample_recordings: work.recordings?.slice(0, 5).map((r: any) => ({
      isrc: r.isrc,
      title: r.title,
      subtitle: r.subtitle,
      artists: r.contributors?.filter((c: any) => c.contributorType === 'MainArtist').map((a: any) => a.name) || [],
    })) || [],

    raw_data: data.results,
  };
}

// Middleware
app.use('*', cors());

// Routes
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    uptime: process.uptime(),
    session_valid: isSessionValid(),
    session_expires_in: sessionExpiry > 0 ? Math.max(0, sessionExpiry - Date.now()) : 0,
    service: 'quansic-enrichment-service',
    version: '1.1.0'
  });
});

app.post('/auth', async (c) => {
  try {
    const body: AuthRequest = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'email and password required' }, 400);
    }

    const cookie = await authenticate(email, password);
    sessionCookie = cookie;
    sessionExpiry = Date.now() + SESSION_DURATION;

    return c.json({
      success: true,
      message: 'Authenticated successfully',
      session_expires_in: SESSION_DURATION
    });
  } catch (error: any) {
    console.error('Auth error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get('/session-status', (c) => {
  return c.json({
    valid: isSessionValid(),
    expires_in: sessionExpiry > 0 ? Math.max(0, sessionExpiry - Date.now()) : 0,
    has_cookie: sessionCookie !== null
  });
});

app.post('/enrich', async (c) => {
  try {
    const body: EnrichRequest = await c.req.json();
    const { isni, musicbrainz_mbid, spotify_artist_id, force_reauth } = body;

    if (!isni) {
      return c.json({ error: 'isni required' }, 400);
    }

    console.log(`📊 Enrichment request: ISNI ${isni}${spotify_artist_id ? ` (Spotify: ${spotify_artist_id})` : ''}`);

    const enriched = await enrichArtist(isni, musicbrainz_mbid, spotify_artist_id, force_reauth);

    return c.json({
      success: true,
      data: enriched
    });
  } catch (error: any) {
    console.error('Enrichment error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/search', async (c) => {
  try {
    const body: SearchRequest = await c.req.json();
    const { isni } = body;

    if (!isni) {
      return c.json({ error: 'isni required' }, 400);
    }

    console.log(`🔍 Search request: ISNI ${isni}`);

    const cookie = await ensureSession();
    const result = await searchByISNI(isni, cookie);

    if (!result) {
      return c.json({ error: 'No results found' }, 404);
    }

    return c.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /enrich-recording - Enrich recording by ISRC
app.post('/enrich-recording', async (c) => {
  try {
    const body = await c.req.json<EnrichRecordingRequest>();
    const { isrc, spotify_track_id, recording_mbid, force_reauth } = body;

    if (!isrc) {
      return c.json({ error: 'isrc is required' }, 400);
    }

    console.log(`🎵 Recording enrichment: ISRC ${isrc}`);

    const result = await enrichRecording(isrc, spotify_track_id, recording_mbid, force_reauth);

    if (!result) {
      return c.json({ error: 'No recording found for this ISRC' }, 404);
    }

    return c.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Recording enrichment error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /enrich-work - Enrich work by ISWC
app.post('/enrich-work', async (c) => {
  try {
    const body = await c.req.json<EnrichWorkRequest>();
    const { iswc, work_mbid, force_reauth } = body;

    if (!iswc) {
      return c.json({ error: 'iswc is required' }, 400);
    }

    console.log(`📝 Work enrichment: ISWC ${iswc}`);

    const result = await enrichWork(iswc, work_mbid, force_reauth);

    if (!result) {
      return c.json({ error: 'No work found for this ISWC' }, 404);
    }

    return c.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Work enrichment error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start server
const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Quansic Enrichment Service running on port ${port}`);
console.log(`🌐 Playwright browser will be initialized on first auth request`);

export default {
  port,
  fetch: app.fetch,
};
