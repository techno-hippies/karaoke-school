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

  // International Library IDs (PRIMARY FOCUS)
  viafId?: string;
  gndId?: string;
  bnfId?: string;
  locId?: string;
  sbnId?: string;
  bnmmId?: string;
  selibrId?: string;

  // Labels and aliases
  labels?: Record<string, string>;
  aliases?: Record<string, string[]>;

  // Other identifiers
  identifiers?: Record<string, any>;

  // Sitelinks
  sitelinks?: Record<string, string>;
}

/**
 * Property ID mappings for identifiers we care about
 */
const PROPERTY_MAP = {
  // International Libraries (PRIMARY)
  'P214': 'viaf',
  'P227': 'gnd',
  'P5361': 'bnf',
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
  'P6190': 'songmeanings',

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
 * Now async due to Gemini validation
 */
export async function parseWikidataArtist(entity: WikidataEntity): Promise<WikidataArtist> {
  const result: WikidataArtist = {
    wikidataId: entity.id,
  };

  // Extract labels - names in different languages/scripts
  // These ARE useful for international display/search
  const englishLabel = entity.labels?.en?.value || entity.id;
  if (entity.labels) {
    result.labels = {};
    for (const [lang, label] of Object.entries(entity.labels)) {
      result.labels[lang] = label.value;
    }
  }

  // Extract raw aliases
  const rawAliases: Record<string, string[]> = {};
  if (entity.aliases) {
    for (const [lang, aliasArray] of Object.entries(entity.aliases)) {
      rawAliases[lang] = aliasArray.map(a => a.value);
    }
  }

  // Validate aliases using Gemini (filters garbage, transliterations, etc.)
  if (Object.keys(rawAliases).length > 0) {
    result.aliases = await validateAliasesWithGemini(
      englishLabel,
      result.labels || {},
      rawAliases
    );
  }

  // Skip sitelinks - they're just Wikipedia article titles, not useful

  const claims = entity.claims || {};

  // Extract International Library IDs (PRIMARY)
  const viaf = extractClaimValues(claims, 'P214');
  if (viaf.length > 0) result.viafId = viaf[0];

  const gnd = extractClaimValues(claims, 'P227');
  if (gnd.length > 0) result.gndId = gnd[0];

  const bnf = extractClaimValues(claims, 'P5361');
  if (bnf.length > 0) result.bnfId = bnf[0];

  const loc = extractClaimValues(claims, 'P244');
  if (loc.length > 0) result.locId = loc[0];

  const sbn = extractClaimValues(claims, 'P396');
  if (sbn.length > 0) result.sbnId = sbn[0];

  const bnmm = extractClaimValues(claims, 'P1015');
  if (bnmm.length > 0) result.bnmmId = bnmm[0];

  const selibr = extractClaimValues(claims, 'P906');
  if (selibr.length > 0) result.selibrId = selibr[0];

  // Extract other identifiers into JSONB
  result.identifiers = {};

  for (const [propId, key] of Object.entries(PROPERTY_MAP)) {
    // Skip library IDs (already extracted above)
    if (['viaf', 'gnd', 'bnf', 'loc', 'sbn', 'bnmm', 'selibr'].includes(key)) {
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
export async function getWikidataArtist(wikidataId: string): Promise<WikidataArtist | null> {
  const entity = await getWikidataEntity(wikidataId);
  if (!entity) return null;
  return await parseWikidataArtist(entity);
}
