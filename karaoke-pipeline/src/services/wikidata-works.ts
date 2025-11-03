/**
 * Wikidata Works API Service
 * Queries Wikidata for musical work/composition metadata
 */

import { getWikidataEntity, type WikidataEntity } from './wikidata';

export interface WikidataWork {
  wikidataId: string;

  // Core metadata
  title?: string;
  iswc?: string;
  language?: string;

  // Labels and aliases (multi-language titles)
  labels?: Record<string, string>;
  aliases?: Record<string, string[]>;

  // Relations (Wikidata QIDs)
  composers?: Array<{ wikidataId: string; name: string }>;
  lyricists?: Array<{ wikidataId: string; name: string }>;
  performers?: Array<{ wikidataId: string; name: string }>;

  // Other identifiers
  identifiers?: Record<string, any>;
}

/**
 * Property ID mappings for musical works
 */
const WORK_PROPERTY_MAP = {
  // Core identifiers
  'P435': 'musicbrainz_work',   // MusicBrainz work ID
  'P6722': 'iswc',                // International Standard Musical Work Code
  'P1651': 'youtube_video',       // YouTube video ID
  'P407': 'language',             // Language of work or name (returns entity ID)

  // Relations
  'P86': 'composer',              // Composer (returns entity IDs)
  'P676': 'lyricist',             // Lyricist/lyrics by (returns entity IDs)
  'P175': 'performer',            // Performer (returns entity IDs)

  // Dates
  'P577': 'publication_date',     // Publication date
  'P571': 'inception',            // Inception/creation date

  // Other work properties
  'P941': 'inspired_by',          // Inspired by (returns entity IDs)
  'P144': 'based_on',             // Based on (returns entity IDs)
  'P674': 'characters',           // Characters (for musical theater)
  'P136': 'genre',                // Genre (returns entity IDs)

  // Music industry
  'P2207': 'isrc',                // ISRC (sometimes works have this too)
  'P264': 'record_label',         // Record label (returns entity IDs)
} as const;

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
    } else if (value.time) {
      // Time value
      return value.time;
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
 * Parse Wikidata entity into structured work data
 */
export async function parseWikidataWork(entity: WikidataEntity): Promise<WikidataWork> {
  const result: WikidataWork = {
    wikidataId: entity.id,
  };

  // Extract labels (multi-language titles)
  if (entity.labels) {
    result.labels = {};
    result.title = entity.labels.en?.value || entity.id;
    for (const [lang, label] of Object.entries(entity.labels)) {
      result.labels[lang] = label.value;
    }
  }

  // Extract aliases (alternate titles)
  if (entity.aliases) {
    result.aliases = {};
    for (const [lang, aliasArray] of Object.entries(entity.aliases)) {
      result.aliases[lang] = aliasArray.map(a => a.value);
    }
  }

  const claims = entity.claims || {};

  // Extract ISWC
  const iswc = extractClaimValues(claims, 'P6722');
  if (iswc.length > 0) result.iswc = iswc[0];

  // Extract language (returns entity ID like Q1860 for English)
  const languageIds = extractClaimValues(claims, 'P407');
  if (languageIds.length > 0) {
    result.language = languageIds[0]; // Store Wikidata language entity ID
  }

  // Extract composers (entity IDs)
  const composerIds = extractClaimValues(claims, 'P86');
  if (composerIds.length > 0) {
    result.composers = composerIds.map(id => ({
      wikidataId: id,
      name: '', // Can be enriched later by fetching entity
    }));
  }

  // Extract lyricists (entity IDs)
  const lyricistIds = extractClaimValues(claims, 'P676');
  if (lyricistIds.length > 0) {
    result.lyricists = lyricistIds.map(id => ({
      wikidataId: id,
      name: '', // Can be enriched later
    }));
  }

  // Extract performers (entity IDs)
  const performerIds = extractClaimValues(claims, 'P175');
  if (performerIds.length > 0) {
    result.performers = performerIds.map(id => ({
      wikidataId: id,
      name: '', // Can be enriched later
    }));
  }

  // Extract other identifiers into JSONB
  result.identifiers = {};

  for (const [propId, key] of Object.entries(WORK_PROPERTY_MAP)) {
    // Skip relation properties (already extracted above)
    if (['composer', 'lyricist', 'performer', 'language'].includes(key)) {
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
 * Convenience function: fetch and parse work in one call
 */
export async function getWikidataWork(wikidataId: string): Promise<WikidataWork | null> {
  const entity = await getWikidataEntity(wikidataId);
  if (!entity) return null;
  return await parseWikidataWork(entity);
}
