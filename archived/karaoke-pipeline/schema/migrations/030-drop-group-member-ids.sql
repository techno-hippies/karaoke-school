-- Migration 030: Remove redundant group_member_ids column
--
-- Rationale: We now store relationships in single direction (member_of_groups only)
-- to maintain single source of truth and avoid data duplication.
--
-- Relationships are stored from member → group perspective only:
-- - member_of_groups: Array of groups this artist is a member of
-- - Each entry contains: {grc20_entity_id, mbid, name, spotify_artist_id}
--
-- Groups can discover their members by querying:
-- SELECT * FROM grc20_artists WHERE member_of_groups @> '[{"mbid": "<group-mbid>"}]'
--
-- Created: 2025-11-01

ALTER TABLE grc20_artists
  DROP COLUMN IF EXISTS group_member_ids;
