/**
 * SongFacts Scraper Service
 *
 * Scrape song trivia from songfacts.com (no API required)
 * URL pattern: https://www.songfacts.com/facts/{artist-slug}/{song-slug}
 */

const SONGFACTS_BASE_URL = 'https://www.songfacts.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface SongFact {
  text: string;
  html: string; // Original HTML with links preserved
}

export interface SongFactsResult {
  artist: string;
  title: string;
  album?: string;
  year?: number;
  facts: SongFact[];
  url: string;
}

/**
 * Convert a string to URL slug
 * "Taylor Swift" -> "taylor-swift"
 * "Don't Blame Me" -> "dont-blame-me"
 */
export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[''"]/g, '') // Remove apostrophes and quotes
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dashes
    .replace(/^-+|-+$/g, '') // Trim leading/trailing dashes
    .replace(/-+/g, '-'); // Collapse multiple dashes
}

/**
 * Build SongFacts URL from artist and title
 */
export function buildSongFactsUrl(artist: string, title: string): string {
  return `${SONGFACTS_BASE_URL}/facts/${toSlug(artist)}/${toSlug(title)}`;
}

/**
 * Fetch and parse facts from a SongFacts page
 */
export async function fetchSongFacts(
  artist: string,
  title: string
): Promise<SongFactsResult | null> {
  const url = buildSongFactsUrl(artist, title);

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (response.status === 404) {
    return null; // Song not found
  }

  if (!response.ok) {
    throw new Error(`SongFacts fetch failed: ${response.status}`);
  }

  const html = await response.text();
  return parseSongFactsPage(html, url);
}

/**
 * Fetch facts by direct URL (for when slug doesn't match)
 */
export async function fetchSongFactsByUrl(
  url: string
): Promise<SongFactsResult | null> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`SongFacts fetch failed: ${response.status}`);
  }

  const html = await response.text();
  return parseSongFactsPage(html, url);
}

/**
 * Search SongFacts for a song (scrapes search results page)
 */
export async function searchSongFacts(
  query: string
): Promise<Array<{ artist: string; title: string; url: string }>> {
  const searchUrl = `${SONGFACTS_BASE_URL}/search/songs/${encodeURIComponent(query)}`;

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    throw new Error(`SongFacts search failed: ${response.status}`);
  }

  const html = await response.text();
  const results: Array<{ artist: string; title: string; url: string }> = [];

  // Parse search results - look for links to /facts/ pages
  // Pattern: <a href="/facts/artist/song">Song Title</a> by <a href="/songs/artist">Artist</a>
  const songLinkPattern =
    /<a\s+href="(\/facts\/[^"]+)"[^>]*>([^<]+)<\/a>\s*(?:by\s*)?<a\s+href="\/songs\/[^"]+">([^<]+)<\/a>/gi;

  let match;
  while ((match = songLinkPattern.exec(html)) !== null) {
    results.push({
      url: `${SONGFACTS_BASE_URL}${match[1]}`,
      title: decodeHtmlEntities(match[2].trim()),
      artist: decodeHtmlEntities(match[3].trim()),
    });
  }

  return results;
}

/**
 * Parse a SongFacts page HTML
 */
function parseSongFactsPage(
  html: string,
  url: string
): SongFactsResult | null {
  // Extract title from <h3>Song Title<div class="details-header-artistdiv">
  const titleMatch = html.match(
    /<h3>([^<]+)<div class="details-header-artistdiv">/
  );
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';

  // Extract artist from <a class="title-artist" href="/songs/...">Artist</a>
  const artistMatch = html.match(
    /<a class="title-artist"[^>]*>([^<]+)<\/a>/
  );
  const artist = artistMatch ? decodeHtmlEntities(artistMatch[1].trim()) : '';

  // Extract album and year from <div class="albumheader">
  // <b>Album: </b> Album Name (<a href="/browse/years/2025">2025</a>)
  const albumMatch = html.match(
    /<div class="albumheader"><b>Album:\s*<\/b>\s*([^<(]+)\s*\(<a[^>]+>(\d{4})<\/a>\)/
  );
  const album = albumMatch ? decodeHtmlEntities(albumMatch[1].trim()) : undefined;
  const year = albumMatch ? parseInt(albumMatch[2], 10) : undefined;

  // Extract facts from <ul class="songfacts-results"><li><div class="inner">...</div></li>
  const factsListMatch = html.match(
    /<ul class="songfacts-results">([\s\S]*?)<\/ul>/
  );

  if (!factsListMatch) {
    return null; // No facts found
  }

  const facts: SongFact[] = [];
  const factItemPattern = /<li><div class="inner">([\s\S]*?)<\/div><\/li>/g;

  let factMatch;
  while ((factMatch = factItemPattern.exec(factsListMatch[1])) !== null) {
    const htmlContent = factMatch[1].trim();
    const textContent = htmlToText(htmlContent);

    if (textContent.length > 0) {
      facts.push({
        html: htmlContent,
        text: textContent,
      });
    }
  }

  if (facts.length === 0) {
    return null;
  }

  return {
    artist,
    title,
    album,
    year,
    facts,
    url,
  };
}

/**
 * Convert HTML to plain text
 */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n') // Line breaks
    .replace(/<\/?i>/gi, '') // Remove italic tags
    .replace(/<\/?b>/gi, '') // Remove bold tags
    .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1') // Extract link text
    .replace(/<[^>]+>/g, '') // Remove remaining tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
