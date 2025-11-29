/**
 * Slugify Utility
 *
 * Converts strings to URL-safe slugs with proper unicode normalization.
 * Handles artist names like "Beyoncé" → "beyonce"
 */

/**
 * Convert a string to a URL-safe slug
 *
 * @param text - Input text (e.g., "Beyoncé", "The Weeknd", "AC/DC")
 * @returns URL-safe slug (e.g., "beyonce", "the-weeknd", "ac-dc")
 */
export function slugify(text: string): string {
  return (
    text
      // Normalize unicode (NFD = decompose accented chars)
      .normalize('NFD')
      // Remove diacritical marks (accents)
      .replace(/[\u0300-\u036f]/g, '')
      // Convert to lowercase
      .toLowerCase()
      // Replace non-alphanumeric with hyphens
      .replace(/[^a-z0-9]+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Collapse multiple hyphens
      .replace(/-{2,}/g, '-')
  );
}

/**
 * Generate a unique slug by appending a suffix if needed
 *
 * @param text - Input text
 * @param existingSlugs - Set of slugs that already exist
 * @returns Unique slug
 */
export function generateUniqueSlug(text: string, existingSlugs: Set<string>): string {
  const baseSlug = slugify(text);

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  // Append number suffix
  let counter = 2;
  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter++;
  }

  return `${baseSlug}-${counter}`;
}
