/**
 * CISAC ISWC Network Service
 * Handles CISAC API calls via Akash service
 * CISAC is the authoritative source for ISWCs (International Standard Musical Work Codes)
 */

export interface CISACInterestedParty {
  name: string;
  lastName: string;
  nameNumber?: number;
  baseNumber?: string;
  affiliation?: string;
  role: string; // C=Composer, A=Author, E=Publisher
  legalEntityType?: string;
}

export interface CISACWorkData {
  iswc: string;
  title: string;
  iswc_status: string; // "Preferred", etc.
  composers: CISACInterestedParty[];
  authors: CISACInterestedParty[];
  publishers: CISACInterestedParty[];
  performers?: CISACInterestedParty[];
  other_titles?: Array<{ title: string; type: string }>;
}

export interface CISACSearchResult {
  iswc: string;
  title: string;
  creators: string;
  status: string;
}

/**
 * Normalize title for better matching:
 * - Remove (feat. ...), (ft. ...), (with ...)
 * - Remove version suffixes (- Remix, - Remaster, etc.)
 * - Trim whitespace
 */
function normalizeTitle(title: string): string {
  return title
    // Remove featuring credits
    .replace(/\s*\(feat\.?\s+[^)]+\)/gi, '')
    .replace(/\s*\(ft\.?\s+[^)]+\)/gi, '')
    .replace(/\s*\(with\s+[^)]+\)/gi, '')
    .replace(/\s*\[feat\.?\s+[^\]]+\]/gi, '')
    .replace(/\s*\[ft\.?\s+[^\]]+\]/gi, '')
    // Remove version info
    .replace(/\s*-\s*(Single|Album|Deluxe|Explicit|Clean)\s+Version/gi, '')
    .replace(/\s*-\s*\d{4}\s+Remaster(ed)?/gi, '')
    .replace(/\s*-\s*Remaster(ed)?(\s+\d{4})?/gi, '')
    .replace(/\s*-\s*(Radio|Extended|Original)\s+(Edit|Mix|Version)/gi, '')
    .replace(/\s*-\s*Remix/gi, '')
    .replace(/\s*-\s*Live(\s+\d{4})?/gi, '')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize artist/performer name for fuzzy matching:
 * - Lowercase
 * - Remove "the" prefix
 * - Remove punctuation and extra spaces
 */
function normalizeArtist(artist: string): string {
  return artist
    .toLowerCase()
    .replace(/^the\s+/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class CISACService {
  constructor(private cisacServiceUrl: string) {}

  /**
   * Search CISAC by IPI name number (comprehensive work discovery)
   * Returns ALL works by this creator (50-100+ results per IPI)
   * Name number = IPI with leading zeros stripped: "00453265264" → 453265264
   */
  async searchByNameNumber(nameNumber: number): Promise<CISACWorkData[]> {
    try {
      console.log(`🔍 CISAC: Searching by name number (IPI) ${nameNumber}`);

      const response = await fetch(`${this.cisacServiceUrl}/search/name-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameNumber }),
        signal: AbortSignal.timeout(60000), // Name number search can return 50-100+ works
      });

      if (!response.ok) {
        console.log(`  ❌ CISAC name number search failed (${response.status})`);
        return [];
      }

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data)) {
        // Transform to CISACWorkData format
        const works = result.data.map((work: any) => this.transformWorkData(work));
        console.log(`  ✅ CISAC found ${works.length} works for name number ${nameNumber}`);
        return works;
      }

      return [];
    } catch (error) {
      console.error('CISAC name number search error:', error);
      return [];
    }
  }

  /**
   * Search CISAC by ISWC (corroboration/verification)
   */
  async searchByISWC(iswc: string): Promise<CISACWorkData | null> {
    try {
      console.log(`🔍 CISAC: Searching by ISWC ${iswc}`);

      const response = await fetch(`${this.cisacServiceUrl}/search/iswc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iswc }),
        signal: AbortSignal.timeout(45000), // CISAC can be slower than BMI
      });

      if (!response.ok) {
        console.log(`  ❌ CISAC ISWC not found (${response.status})`);
        return null;
      }

      const result = await response.json();
      if (result.success && result.data) {
        // Transform to CISACWorkData format
        const work = this.transformWorkData(result.data);
        console.log(`  ✅ CISAC ISWC found: ${work.title}`);
        return work;
      }

      return null;
    } catch (error) {
      console.error('CISAC ISWC search error:', error);
      return null;
    }
  }

  /**
   * Search CISAC by title (ISWC discovery)
   * Optional artist parameter is used for verification only, not filtering
   */
  async searchByTitle(title: string, artist?: string): Promise<CISACWorkData | null> {
    try {
      // Normalize title for better matching
      const cleanTitle = normalizeTitle(title);
      console.log(`🔍 CISAC: Searching "${cleanTitle}"${artist ? ` (will verify against ${artist})` : ''}${cleanTitle !== title ? ` (cleaned from "${title}")` : ''}`);

      // Search by title only - CISAC needs individual creator surnames, not band names
      const response = await fetch(`${this.cisacServiceUrl}/search/title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle }),
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        console.log(`  ❌ CISAC title search failed (${response.status})`);
        return null;
      }

      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        // Use first result (most relevant)
        const firstResult = result.data[0] as CISACSearchResult;

        // Fetch full work details by ISWC
        const fullWork = await this.searchByISWC(firstResult.iswc);
        if (fullWork) {
          // If artist provided, verify it matches performers
          if (artist && !this.verifyPerformer(fullWork, artist)) {
            console.log(`  ❌ CISAC: Found "${fullWork.title}" but performer mismatch (expected ${artist})`);
            return null;
          }

          console.log(`  ✅ CISAC found: ${fullWork.title} (ISWC: ${fullWork.iswc})`);
          return fullWork;
        }
      }

      console.log(`  ❌ CISAC: No results for "${title}"`);
      return null;
    } catch (error) {
      console.error('CISAC title search error:', error);
      return null;
    }
  }

  /**
   * Verify that the expected artist matches one of the performers in the CISAC data
   * Uses fuzzy matching (normalized comparison)
   */
  private verifyPerformer(work: CISACWorkData, expectedArtist: string): boolean {
    if (!work.performers || work.performers.length === 0) {
      // No performers to verify against - accept the result
      return true;
    }

    const normalizedExpected = normalizeArtist(expectedArtist);

    for (const performer of work.performers) {
      const performerName = performer.lastName || performer.name || '';
      const normalizedPerformer = normalizeArtist(performerName);

      // Check if names match (either direction contains the other)
      if (normalizedPerformer.includes(normalizedExpected) || normalizedExpected.includes(normalizedPerformer)) {
        console.log(`  ✓ Performer verified: "${performerName}" ≈ "${expectedArtist}"`);
        return true;
      }
    }

    return false;
  }

  /**
   * Transform raw CISAC API response to CISACWorkData
   */
  private transformWorkData(rawData: any): CISACWorkData {
    const composers: CISACInterestedParty[] = [];
    const authors: CISACInterestedParty[] = [];
    const publishers: CISACInterestedParty[] = [];
    const performers: CISACInterestedParty[] = [];

    // Parse interestedParties
    if (rawData.interestedParties && Array.isArray(rawData.interestedParties)) {
      for (const party of rawData.interestedParties) {
        const ip: CISACInterestedParty = {
          name: party.name || '',
          lastName: party.lastName || '',
          nameNumber: party.nameNumber,
          baseNumber: party.baseNumber,
          affiliation: party.affiliation,
          role: party.role,
          legalEntityType: party.legalEntityType,
        };

        if (party.role === 'C') {
          composers.push(ip);
        } else if (party.role === 'A') {
          authors.push(ip);
        } else if (party.role === 'E') {
          publishers.push(ip);
        }
      }
    }

    // Parse performers (separate field in CISAC response)
    if (rawData.performers && Array.isArray(rawData.performers)) {
      for (const perf of rawData.performers) {
        performers.push({
          name: perf.name || '',
          lastName: perf.lastName || '',
          nameNumber: perf.nameNumber,
          baseNumber: perf.baseNumber,
          affiliation: perf.affiliation,
          role: perf.role || 'P', // P for Performer
          legalEntityType: perf.legalEntityType,
        });
      }
    }

    return {
      iswc: rawData.iswc,
      title: rawData.originalTitle || rawData.title,
      iswc_status: rawData.iswcStatus || rawData.status,
      composers,
      authors,
      publishers,
      performers: performers.length > 0 ? performers : undefined,
      other_titles: rawData.otherTitles || [],
    };
  }
}
