-- Migration 025: GRC-20 Artist Relationships
-- Add group/member relationship tracking to grc20_artists

-- Add relationship columns
ALTER TABLE grc20_artists
  ADD COLUMN IF NOT EXISTS group_member_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS member_of_groups JSONB DEFAULT '[]'::jsonb;

-- Add helpful comments
COMMENT ON COLUMN grc20_artists.group_member_ids IS 'For groups: array of member objects [{"mbid": "...", "name": "Macklemore", "spotify_artist_id": "..."}]';
COMMENT ON COLUMN grc20_artists.member_of_groups IS 'For individuals: array of group references [{"id": 16, "name": "Macklemore & Ryan Lewis", "spotify_artist_id": "..."}]';

-- Create GIN indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_grc20_artists_group_members ON grc20_artists USING GIN (group_member_ids);
CREATE INDEX IF NOT EXISTS idx_grc20_artists_member_of ON grc20_artists USING GIN (member_of_groups);

-- Example queries enabled by this migration:
-- 1. Find all groups this artist is a member of:
--    SELECT * FROM grc20_artists WHERE member_of_groups @> '[{"name": "Macklemore & Ryan Lewis"}]'::jsonb;
--
-- 2. Find all members of a group:
--    SELECT * FROM grc20_artists WHERE id = 16; -- then parse group_member_ids
--
-- 3. Find artists who are members of any group:
--    SELECT * FROM grc20_artists WHERE jsonb_array_length(member_of_groups) > 0;
