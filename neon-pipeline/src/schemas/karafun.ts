/**
 * Karafun Catalog Entry Schema
 *
 * Validates raw Karafun CSV data before processing.
 * CSV Format: Id;Title;Artist;Year;Duo;Explicit;Date Added;Styles;Languages
 */

import { z } from 'zod';

/**
 * Raw Karafun CSV row
 */
export const KarafunEntrySchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  artist: z.string().min(1),
  year: z.number().int().min(1500).max(2100)
    .nullable()
    .transform(val => val && val >= 1900 ? val : null), // NULL for pre-1900 (traditional songs)
  duo: z.boolean(),
  explicit: z.boolean(),
  dateAdded: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  styles: z.array(z.string()),                        // ["Pop", "Rock"]
  languages: z.array(z.string()),                     // ["English"]
});

export type KarafunEntry = z.infer<typeof KarafunEntrySchema>;

/**
 * Normalized Karafun entry (ready for DB insert)
 */
export const NormalizedKarafunEntrySchema = KarafunEntrySchema.extend({
  // Normalized artist name for matching
  artistNormalized: z.string(),
  titleNormalized: z.string(),

  // Popularity score (lower ID = earlier addition = more popular)
  popularityScore: z.number().int().positive(),
});

export type NormalizedKarafunEntry = z.infer<typeof NormalizedKarafunEntrySchema>;

/**
 * Helper: Normalize string for matching
 * - Lowercase
 * - Remove punctuation
 * - Remove extra whitespace
 * - Remove "feat.", "ft.", etc.
 */
export function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\b(feat|ft|featuring|vs|versus|with)\b\.?/gi, ' ')
    .replace(/\s+/g, ' ')       // Collapse whitespace
    .trim();
}

/**
 * Helper: Parse Karafun CSV row
 * CSV Format: Id;Title;Artist;Year;Duo;Explicit;Date Added;Styles;Languages
 */
export function parseKarafunRow(row: string[]): KarafunEntry {
  const [
    id,
    title,
    artist,
    year,
    duo,
    explicit,
    dateAdded,
    styles,
    languages
  ] = row;

  return KarafunEntrySchema.parse({
    id: parseInt(id, 10),
    title: title.trim(),
    artist: artist.trim(),
    year: year ? parseInt(year, 10) : null,
    duo: duo === '1',
    explicit: explicit === '1',
    dateAdded,
    styles: styles ? styles.split(',').map(s => s.trim()) : [],
    languages: languages ? languages.split(',').map(l => l.trim()) : [],
  });
}

/**
 * Helper: Normalize entry for database insert
 */
export function normalizeEntry(entry: KarafunEntry): NormalizedKarafunEntry {
  return {
    ...entry,
    artistNormalized: normalizeForMatching(entry.artist),
    titleNormalized: normalizeForMatching(entry.title),
    popularityScore: 100000 - entry.id, // Lower ID = higher score
  };
}

/**
 * Helper: Check if entry is English-only
 */
export function isEnglishOnly(entry: KarafunEntry): boolean {
  return entry.languages.length === 1 && entry.languages[0] === 'English';
}

/**
 * Helper: Check if entry contains English
 */
export function containsEnglish(entry: KarafunEntry): boolean {
  return entry.languages.includes('English');
}
