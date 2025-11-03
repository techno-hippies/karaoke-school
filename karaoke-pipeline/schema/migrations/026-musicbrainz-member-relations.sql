-- Migration 026: MusicBrainz Member Relations
-- Add member_relations column to store authoritative group membership data

-- Add member_relations column
ALTER TABLE musicbrainz_artists
  ADD COLUMN IF NOT EXISTS member_relations JSONB DEFAULT '[]'::jsonb;

-- Add index for querying member relationships
CREATE INDEX IF NOT EXISTS idx_musicbrainz_artists_member_relations
  ON musicbrainz_artists USING GIN (member_relations);

-- Add comment explaining the structure
COMMENT ON COLUMN musicbrainz_artists.member_relations IS
'Array of member relationships from MusicBrainz artist-rels.
Structure: [{"direction": "backward"|"forward", "type": "member of band", "artist_mbid": "...", "artist_name": "..."}]
- direction="backward" (for GROUPS): this group HAS the linked artist as member (group ← member)
- direction="forward" (for MEMBERS): this member belongs TO the linked group (member → group)
Example: "Macklemore & Ryan Lewis" has direction="backward" for "Ryan Lewis" and "Macklemore"';

-- Example queries enabled by this migration:
-- 1. Find all groups this person is a member of:
--    SELECT * FROM musicbrainz_artists
--    WHERE member_relations @> '[{"direction": "backward"}]'::jsonb;
--
-- 2. Find all members of a specific group:
--    SELECT * FROM musicbrainz_artists
--    WHERE member_relations @> jsonb_build_array(
--      jsonb_build_object('artist_mbid', 'GROUP_MBID_HERE', 'direction', 'backward')
--    );
