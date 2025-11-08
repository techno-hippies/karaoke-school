-- Migration 020: Add Wikidata JSONB columns to grc20_artists
-- Properly stores labels, aliases (with language structure), and identifiers from Wikidata

-- Add labels column (artist name in different languages)
ALTER TABLE grc20_artists
ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN grc20_artists.labels IS 'Artist name in different languages from Wikidata. Format: {en: "Billie Eilish", ja: "ビリー・アイリッシュ", zh: "比莉·艾利什", ...}';

-- Add wikidata_identifiers column (all platform identifiers from Wikidata)
ALTER TABLE grc20_artists
ADD COLUMN IF NOT EXISTS wikidata_identifiers JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN grc20_artists.wikidata_identifiers IS 'Platform identifiers from Wikidata (musicbrainz, discogs, twitter, instagram, youtube, tiktok, imdb, allmusic, lastfm, musixmatch, songkick, setlistfm, etc.). Format: {twitter: "handle", musicbrainz: "uuid", discogs: ["id1", "id2"], ...}';

-- Update aliases column comment to reflect language-based structure
COMMENT ON COLUMN grc20_artists.aliases IS 'Alternate names by language from Wikidata (Gemini-validated). Format: {en: ["Legal Name", "Stage Name"], ja: ["日本語名"], ar: ["اسم عربي"], ...}. Garbage data (tour names, albums) filtered out.';
