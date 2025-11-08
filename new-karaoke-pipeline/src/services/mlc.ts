/**
 * MLC (Mechanical Licensing Collective) Service Client
 * Fallback for ISWC discovery when Quansic and BMI don't have the work
 *
 * Strategy:
 * 1. Search by title and writer name
 * 2. Paginate through results
 * 3. Check each work's recordings for matching ISRC
 */

export interface MLCWriter {
  firstName: string;
  lastName: string;
  ipiNumber: string | null;
  roleCode: number;
  writerShare: number;
}

export interface MLCPublisher {
  publisherName: string;
  ipiNumber: string | null;
  publisherShare: number;
  administratorPublishers?: MLCPublisher[];
}

export interface MLCWork {
  songCode: string;
  iswc: string | null;
  title: string;
  writers: MLCWriter[];
  originalPublishers: MLCPublisher[];
}

export interface MLCWorkData {
  isrc: string;
  mlc_song_code: string;
  iswc: string | null;
  title: string;
  writers: Array<{
    name: string;
    ipi: string | null;
    role: 'Composer' | 'Writer';
    share: number;
  }>;
  publishers: Array<{
    name: string;
    ipi: string;
    share: number;
    administrators: Array<{
      name: string;
      ipi: string;
      share: number;
    }>;
  }>;
  total_publisher_share: number;
}

/**
 * Check if a work's recordings include the target ISRC
 * Fetches full recordings list via paginated API
 */
async function workHasISRC(songCode: string, targetIsrc: string, totalCount: number): Promise<boolean> {
  // If there are thousands of recordings, only check first few pages
  const maxRecordingsToCheck = 500; // Check first 10 pages (50 per page)
  const pagesToCheck = Math.min(Math.ceil(maxRecordingsToCheck / 50), Math.ceil(totalCount / 50));

  console.log(`     🔍 Checking ${Math.min(totalCount, maxRecordingsToCheck)} of ${totalCount} recordings`);

  for (let page = 1; page <= pagesToCheck; page++) {
    try {
      const recordingsUrl = `https://api.ptl.themlc.com/api/dsp-recording/matched/${songCode}?page=${page}&limit=50&order=matchedAmount&direction=desc`;

      const response = await fetch(recordingsUrl, {
        headers: {
          'Accept': 'application/json',
          'Origin': 'https://portal.themlc.com',
          'Referer': 'https://portal.themlc.com/',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const data = await response.json() as any;
      const recordings = data.recordings || [];

      // Check if any recording has our ISRC
      const hasMatch = recordings.some((r: any) => r.isrc === targetIsrc);
      if (hasMatch) {
        console.log(`     ✅ Found matching ISRC on page ${page}`);
        return true;
      }

      // Small delay between pages
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.log(`     ⚠️ Error checking page ${page}: ${err.message}`);
      continue;
    }
  }

  return false;
}

/**
 * Convert MLC API work response to our schema
 */
function convertMLCWork(work: MLCWork, isrc: string): MLCWorkData {
  // Calculate total publisher shares (direct + administrator)
  let directShare = 0;
  let adminShare = 0;

  for (const pub of work.originalPublishers || []) {
    directShare += pub.publisherShare || 0;
    for (const admin of pub.administratorPublishers || []) {
      adminShare += admin.publisherShare || 0;
    }
  }

  const totalShare = directShare + adminShare;

  return {
    isrc,
    mlc_song_code: work.songCode,
    iswc: work.iswc || null,
    title: work.title,
    writers: work.writers.map((w: MLCWriter) => ({
      name: `${w.firstName || ''} ${w.lastName || ''}`.trim() || 'Unknown',
      ipi: w.ipiNumber || null,
      role: w.roleCode === 11 ? 'Composer' : 'Writer',
      share: w.writerShare || 0,
    })),
    publishers: work.originalPublishers.map((p: MLCPublisher) => ({
      name: p.publisherName,
      ipi: p.ipiNumber || '',
      share: p.publisherShare || 0,
      administrators: (p.administratorPublishers || []).map((a: MLCPublisher) => ({
        name: a.publisherName,
        ipi: a.ipiNumber || '',
        share: a.publisherShare || 0,
      })),
    })),
    total_publisher_share: totalShare,
  };
}

/**
 * Sanitize search terms for MLC API
 * Remove special characters that might break search
 */
function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[()[\]{}]/g, '') // Remove brackets/parens
    .replace(/[""'']/g, '"')   // Normalize quotes
    .replace(/&/g, 'and')      // Replace ampersand
    .trim();
}

/**
 * Search MLC by title and artist/writer name
 * Returns ISWC if found by matching ISRC in work's recordings
 */
export async function searchMLC(
  isrc: string,
  title: string,
  artistName: string
): Promise<MLCWorkData | null> {
  try {
    // Sanitize inputs
    const cleanTitle = sanitizeSearchTerm(title);
    const cleanArtist = sanitizeSearchTerm(artistName);

    console.log(`  🔍 MLC fallback: "${cleanTitle}" by ${cleanArtist || '(title only)'} (ISRC: ${isrc})`);

    const searchUrl = 'https://api.ptl.themlc.com/api2v/public/search/works';

    let page = 0;
    const maxPages = 10; // Limit search to first 500 results (10 pages × 50)

    while (page < maxPages) {
      // Build search body - only include writerFullNames if we have a value
      const searchBody: any = { title: cleanTitle };
      if (cleanArtist) {
        searchBody.writerFullNames = cleanArtist;
      }

      const searchResponse = await fetch(`${searchUrl}?page=${page}&size=50`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchBody),
        signal: AbortSignal.timeout(30000),
      });

      if (!searchResponse.ok) {
        console.log(`     ❌ MLC search failed: ${searchResponse.status}`);
        return null;
      }

      const searchData = await searchResponse.json() as any;
      const works = searchData.content || [];

      if (page === 0) {
        console.log(`     📄 Found ${searchData.totalElements || works.length} total works in MLC`);
      }

      // Check each work's recordings for ISRC match
      for (const work of works) {
        const totalRecordings = work.matchedRecordings?.count || 0;
        const hasMatch = await workHasISRC(work.songCode, isrc, totalRecordings);

        if (hasMatch) {
          const converted = convertMLCWork(work, isrc);
          console.log(`     ✅ Found in MLC: ${work.title} (${work.songCode})`);
          console.log(`        ISWC: ${converted.iswc || 'N/A'}`);
          console.log(`        Writers: ${converted.writers.length}, Publishers: ${converted.publishers.length}`);
          return converted;
        }
      }

      // Check if there are more pages
      if (page + 1 >= searchData.totalPages || works.length === 0) {
        break;
      }

      page++;
      console.log(`     📄 Checking page ${page + 1}...`);
    }

    console.log(`     ❌ No MLC work found with matching ISRC`);
    return null;
  } catch (error: any) {
    console.error(`     ❌ MLC search error: ${error.message}`);
    return null;
  }
}

/**
 * Check MLC service health
 */
export async function checkMLCHealth(): Promise<boolean> {
  try {
    const response = await fetch('https://api.ptl.themlc.com/api/health', {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    // MLC doesn't have a health endpoint, so we'll just return true
    // and let the search fail if the service is down
    return true;
  }
}
