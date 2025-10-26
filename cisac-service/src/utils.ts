/**
 * Converts ISWC from MusicBrainz format to CISAC API format
 *
 * @param iswc - ISWC in database format (e.g., "T-910.940.292-8")
 * @returns ISWC in CISAC format (e.g., "T9109402928")
 *
 * @example
 * convertISWCFormat("T-910.940.292-8") // Returns: "T9109402928"
 * convertISWCFormat("T-061.239.697-0") // Returns: "T0612396970"
 */
export function convertISWCFormat(iswc: string): string {
  // Remove dashes and dots from MusicBrainz format
  // T-XXX.XXX.XXX-X → TXXXXXXXXXX
  return iswc.replace(/[-\.]/g, '');
}

/**
 * Validates ISWC format (both MusicBrainz and CISAC formats)
 *
 * @param iswc - ISWC to validate
 * @returns true if valid format, false otherwise
 *
 * @example
 * isValidISWC("T-910.940.292-8") // true (MusicBrainz)
 * isValidISWC("T9109402928")     // true (CISAC)
 * isValidISWC("invalid")         // false
 */
export function isValidISWC(iswc: string): boolean {
  // MusicBrainz format: T-XXX.XXX.XXX-X
  const musicbrainzFormat = /^T-\d{3}\.\d{3}\.\d{3}-\d$/;

  // CISAC format: TXXXXXXXXXX (11 characters total)
  const cisacFormat = /^T\d{10}$/;

  return musicbrainzFormat.test(iswc) || cisacFormat.test(iswc);
}
