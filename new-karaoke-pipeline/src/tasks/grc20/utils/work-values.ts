/**
 * Work Value Builder for GRC-20 Entities
 *
 * This module builds property-value pairs for work (song) entities in the GRC-20 space.
 * It handles:
 * - Date formatting (ISO 8601 YYYY-MM-DD without time components)
 * - Type conversions (numbers -> string, null handling)
 * - ISWC source label mapping (musicbrainz_work -> "MusicBrainz")
 *
 * Usage:
 *   const values = buildWorkValues(workRow);
 *   Graph.updateEntity({ id: entityId, values });
 *
 * Date Formatting:
 * Release dates are formatted as ISO 8601 date-only (YYYY-MM-DD) to prevent
 * timezone interpretation. Example: "2020-03-20" not "2020-03-20T00:00:00.000Z"
 *
 * Property Exclusions:
 * - workIsrc/workSpotifyTrackId/workSpotifyUrl/workImageSource: Legacy, moved to separate tracking
 */

import {
  GRC20_PROPERTY_IDS,
} from '../../../config/grc20-space';

export interface WorkMetadataRow {
  id: number;
  title: string;
  alternate_titles: string | null;
  iswc: string | null;
  iswc_source: string | null;
  genius_song_id: number | null;
  genius_url: string | null;
  wikidata_url: string | null;
  release_date: string | null;
  duration_ms: number | null;
  language: string | null;
  image_grove_url: string | null;
}

type PropertyValue = { property: string; value: string };

export const WORK_MANAGED_PROPERTY_IDS: string[] = [
  GRC20_PROPERTY_IDS.workIswc,
  GRC20_PROPERTY_IDS.workIswcSource,
  GRC20_PROPERTY_IDS.workGeniusSongId,
  GRC20_PROPERTY_IDS.workGeniusUrl,
  GRC20_PROPERTY_IDS.workWikidataUrl,
  GRC20_PROPERTY_IDS.workReleaseDate,
  GRC20_PROPERTY_IDS.workDurationMs,
  GRC20_PROPERTY_IDS.workLanguage,
  GRC20_PROPERTY_IDS.workGroveImageUrl,
  GRC20_PROPERTY_IDS.workAlternateTitles,
];

const ISWC_SOURCE_LABELS: Record<string, string> = {
  musicbrainz_work: 'MusicBrainz',
  wikidata_work: 'Wikidata',
  quansic: 'Quansic',
  mlc: 'MLC',
};

function pushStringValue(values: PropertyValue[], property: string, value: string | null) {
  if (value && value.trim().length > 0) {
    values.push({ property, value });
  }
}

function pushNumberValue(values: PropertyValue[], property: string, value: number | null) {
  if (value !== null && value !== undefined) {
    values.push({ property, value: value.toString() });
  }
}

function formatIswcSource(source: string | null): string | null {
  if (!source) return null;
  return ISWC_SOURCE_LABELS[source] ?? source;
}

function formatReleaseDate(dateValue: string | null): string | null {
  if (!dateValue) return null;
  try {
    // dateValue may be ISO string with time, or YYYY-MM-DD
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }
    // Always return date-only format (YYYY-MM-DD)
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${date.getUTCDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateValue;
  }
}

export function buildWorkValues(work: WorkMetadataRow): PropertyValue[] {
  const values: PropertyValue[] = [];

  pushStringValue(values, GRC20_PROPERTY_IDS.workIswc, work.iswc);
  pushStringValue(values, GRC20_PROPERTY_IDS.workIswcSource, formatIswcSource(work.iswc_source));
  pushNumberValue(values, GRC20_PROPERTY_IDS.workGeniusSongId, work.genius_song_id);
  pushStringValue(values, GRC20_PROPERTY_IDS.workGeniusUrl, work.genius_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.workWikidataUrl, work.wikidata_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.workReleaseDate, formatReleaseDate(work.release_date));
  pushNumberValue(values, GRC20_PROPERTY_IDS.workDurationMs, work.duration_ms);
  pushStringValue(values, GRC20_PROPERTY_IDS.workLanguage, work.language);
  pushStringValue(values, GRC20_PROPERTY_IDS.workGroveImageUrl, work.image_grove_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.workAlternateTitles, work.alternate_titles);

  return values;
}
