/**
 * Wikidata API Service
 * Queries Wikidata for international library IDs and cross-platform identifiers
 */

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const USER_AGENT = 'KaraokePipeline/1.0 (https://github.com/your-org)';

// Rate limit: ~60 requests/minute (be respectful)
const RATE_LIMIT_MS = 1000;
let lastRequestTime = 0;

// Gemini rate limit (separate from Wikidata)
let lastGeminiRequestTime = 0;

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

export interface WikidataEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, Array<{ value: string }>>;
  claims?: Record<string, any[]>;
  sitelinks?: Record<string, { title: string }>;
}

export interface WikidataArtist {
  wikidataId: string;
  name: string; // English label

  // Core library IDs (match simplified schema)
  viafId?: string;
  isni?: string;
  musicBrainzId?: string;

  // Labels and aliases as JSONB
  labels?: Record<string, string>;
  aliases?: Record<string, string[]>;

  // All other identifiers as JSONB
  identifiers?: Record<string, any>;
  wikipediaSitelinks?: Record<string, string>;
}

/**
 * Property ID mappings for identifiers we care about
 */
const PROPERTY_MAP = {
  // International Libraries (PRIMARY)
  'P214': 'viaf',
  'P213': 'isni',
  'P227': 'gnd',
  'P268': 'bnf',  // FIX: Was P5361 (BNF thesaurus), should be P268 (BNF authority ID)
  'P244': 'loc',
  'P396': 'sbn',
  'P1015': 'bnmm',
  'P906': 'selibr',

  // Music Industry IDs
  'P434': 'musicbrainz',
  'P1953': 'discogs',
  'P2850': 'spotify_old',
  'P1728': 'allmusic',
  'P5830': 'whosampled',
  'P10600': 'rateyourmusic',

  // Social Media
  'P2002': 'twitter',
  'P2003': 'instagram',
  'P4003': 'facebook',
  'P2397': 'youtube',
  'P7085': 'tiktok',
  'P3040': 'soundcloud',
  'P2850': 'weibo',
  'P3267': 'vk',
  'P3984': 'subreddit',

  // Concert/Ticketing (for AI ticket buying)
  'P1004': 'songkick',
  'P3222': 'setlistfm',
  'P3545': 'bandsintown',

  // Lyrics/Translation (VERY HIGH VALUE for karaoke)
  'P2033': 'musixmatch',
  'P7704': 'lyricstranslate',
  'P7200': 'songmeanings',

  // Music Journalism/Context
  'P1989': 'pitchfork',
  'P3953': 'nme',
  'P6571': 'songfacts',

  // Asian Market
  'P8407': 'naver_vibe',
  'P8513': 'line_music',
  'P9673': 'namuwiki',
  'P5828': 'douban_musician',
  'P4529': 'douban_personage',

  // Copyright/Rights
  'P1330': 'ipi',

  // Universal Identifiers
  'P2671': 'google_kg',
  'P1417': 'britannica',
  'P3314': 'billboard',

  // Other
  'P345': 'imdb',
  'P2949': 'wikitree',
  'P4104': 'carnegie_hall',
  'P1254': 'lastfm',
} as const;

/**
 * Fetch Wikidata entity by ID
 */
export async function getWikidataEntity(wikidataId: string): Promise<WikidataEntity | null> {
  try {
    const url = new URL(WIKIDATA_API);
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', wikidataId);
    url.searchParams.set('props', 'labels|aliases|claims|sitelinks');
    url.searchParams.set('languages', 'en|zh|es|fr|de|ja|ko|pt|ru|ar|it|nl|pl|sv|tr');
    url.searchParams.set('format', 'json');

    const response = await rateLimitedFetch(url.toString());

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Wikidata API error: ${response.status}`);
    }

    const data = await response.json();
    return data.entities[wikidataId];
  } catch (error: any) {
    console.error(`Wikidata lookup failed for ${wikidataId}:`, error.message);
    throw error;
  }
}

/**
 * Extract value from a Wikidata claim
 */
function extractClaimValue(claim: any): string | null {
  try {
    const mainsnak = claim.mainsnak;
    if (!mainsnak?.datavalue) return null;

    const value = mainsnak.datavalue.value;

    // Handle different value types
    if (typeof value === 'string') {
      return value;
    } else if (value.id) {
      // Entity reference
      return value.id;
    } else {
      return String(value);
    }
  } catch {
    return null;
  }
}

/**
 * Extract all values for a property (some properties have multiple values)
 */
function extractClaimValues(claims: Record<string, any[]>, propertyId: string): string[] {
  if (!claims[propertyId]) return [];

  return claims[propertyId]
    .map(claim => extractClaimValue(claim))
    .filter((v): v is string => v !== null);
}

/**
 * Validate aliases using Gemini Flash 2.5 Lite with structured outputs
 * Filters out garbage data (tour names, albums, redundant transliterations)
 */
async function validateAliasesWithGemini(
  artistName: string,
  labels: Record<string, string>,
  rawAliases: Record<string, string[]>
): Promise<Record<string, string[]>> {
  // Rate limit Gemini requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastGeminiRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }
  lastGeminiRequestTime = Date.now();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  OPENROUTER_API_KEY not set, skipping alias validation');
    return {}; // Return empty aliases if no API key
  }

  try {
    const prompt = `Artist: "${artistName}"

Labels (name in different languages):
${JSON.stringify(labels, null, 2)}

Raw aliases from Wikidata:
${JSON.stringify(rawAliases, null, 2)}

Question: Is each alias a correct variation, translation, or transliteration of this person's name?

If YES (correct name variant), KEEP it.
If NO (not a name variant), FILTER it out.

Examples of CORRECT aliases to KEEP:
- Legal/birth names: "Billie Eilish Pirate Baird O'Connell"
- Stage names: "Ye", "Yeezy" (for Kanye West)
- Nicknames: "Breezy" (for Chris Brown)
- Translations: "بيلي إيليش" (Arabic), "ビリー・アイリッシュ" (Japanese)
- Transliterations: "比莉·艾利什" (Chinese), "Билли Айлиш" (Russian)
- Name variations: "Phil Collins", "Philip Collins"

Examples of INCORRECT aliases to FILTER OUT:
- Tour names: "Seriously, Live!世界巡迴演唱會", "Both Sides of the World Tour"
- Album titles: "Face Value", "No Jacket Required"
- Concert series: "Live at Montreux"
- Event names containing: "Tour", "Live!", "Concert", "巡迴", "演唱會"

Return only the valid name variants. When in doubt, keep it.`;

    const response = await fetch(OPENROUTER_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/karaoke-school',
        'X-Title': 'Karaoke Pipeline - Wikidata Validation'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite', // Flash 2.5 Lite
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'filtered_aliases',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                validAliases: {
                  type: 'object',
                  description: 'Filtered aliases by language code (all scripts - Latin, Arabic, Cyrillic, CJK, etc. - with garbage removed)',
                  additionalProperties: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                }
              },
              required: ['validAliases'],
              additionalProperties: false
            }
          }
        }
      })
    });

    if (!response.ok) {
      console.error(`Gemini validation failed: ${response.status}`);
      return {}; // Return empty on error
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const result = JSON.parse(content);
    return result.validAliases;
  } catch (error: any) {
    console.error(`Gemini validation error: ${error.message}`);
    return {}; // Return empty on error
  }
}

/**
 * Parse Wikidata entity into structured artist data
 * Adapted for simplified schema: only viaf, isni, musicbrainz_id as columns
 */
export async function parseWikidataArtist(entity: WikidataEntity): Promise<WikidataArtist> {
  const result: WikidataArtist = {
    wikidataId: entity.id,
    name: entity.labels?.en?.value || entity.id,
  };

  // Extract labels - names in different languages/scripts
  const englishLabel = entity.labels?.en?.value || entity.id;
  if (entity.labels) {
    result.labels = {};
    for (const [lang, label] of Object.entries(entity.labels)) {
      result.labels[lang] = label.value;
    }
  }

  // Extract raw aliases (NO Gemini validation to avoid API costs)
  if (entity.aliases) {
    result.aliases = {};
    for (const [lang, aliasArray] of Object.entries(entity.aliases)) {
      result.aliases[lang] = aliasArray.map(a => a.value);
    }
  }

  if (entity.sitelinks) {
    result.wikipediaSitelinks = {};
    for (const [key, site] of Object.entries(entity.sitelinks)) {
      if (!site || typeof site !== 'object' || !('title' in site)) continue;
      const title = (site as any).title as string;

      if (key === 'commonswiki') {
        result.wikipediaSitelinks.commons = `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
        continue;
      }

      if (key.endsWith('wiki')) {
        const lang = key.replace(/wiki$/, '');
        const normalizedLang = lang.replace(/_/g, '-');
        result.wikipediaSitelinks[normalizedLang] = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      }
    }

    if (Object.keys(result.wikipediaSitelinks).length === 0) {
      delete result.wikipediaSitelinks;
    }
  }

  const claims = entity.claims || {};

  // Extract core library IDs (match simplified schema columns)
  const viaf = extractClaimValues(claims, 'P214');
  if (viaf.length > 0) result.viafId = viaf[0];

  const isni = extractClaimValues(claims, 'P213');
  if (isni.length > 0) result.isni = isni[0];

  const musicbrainz = extractClaimValues(claims, 'P434');
  if (musicbrainz.length > 0) result.musicBrainzId = musicbrainz[0];

  // Extract ALL other identifiers into JSONB
  result.identifiers = {};

  for (const [propId, key] of Object.entries(PROPERTY_MAP)) {
    // Skip already extracted columns
    if (['viaf', 'isni', 'musicbrainz'].includes(key)) {
      continue;
    }

    const values = extractClaimValues(claims, propId);
    if (values.length > 0) {
      result.identifiers[key] = values.length === 1 ? values[0] : values;
    }
  }

  // Remove identifiers if empty
  if (Object.keys(result.identifiers).length === 0) {
    delete result.identifiers;
  }

  return result;
}

/**
 * Convenience function: fetch and parse in one call
 */
export async function getWikidataArtist(wikidataId: string, fallbackName?: string): Promise<WikidataArtist | null> {
  const entity = await getWikidataEntity(wikidataId);
  if (!entity) return null;
  const artist = await parseWikidataArtist(entity);
  if ((!artist.name || artist.name === artist.wikidataId) && fallbackName) {
    artist.name = fallbackName;
  }
  return artist;
}
