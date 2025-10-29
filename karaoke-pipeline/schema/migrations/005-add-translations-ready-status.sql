-- Add 'translations_ready' status to song_pipeline
-- This status comes after 'alignment_complete' and before 'stems_separated'

-- Drop the existing constraint
ALTER TABLE song_pipeline
  DROP CONSTRAINT IF EXISTS song_pipeline_status_check;

-- Add new constraint with translations_ready status
ALTER TABLE song_pipeline
  ADD CONSTRAINT song_pipeline_status_check CHECK (status IN (
    'scraped',            -- From TikTok, has spotify_track_id
    'spotify_resolved',   -- Spotify track + artist in cache
    'iswc_found',         -- Quansic ISWC lookup SUCCESS ⚠️ GATE
    'metadata_enriched',  -- MusicBrainz data added
    'lyrics_ready',       -- Lyrics normalized & validated
    'audio_downloaded',   -- Freyr + AcoustID verified + Grove stored
    'alignment_complete', -- ElevenLabs word timing done
    'translations_ready', -- Multi-language translations complete (NEW)
    'stems_separated',    -- Demucs vocals/instrumental
    'media_enhanced',     -- Fal.ai audio2audio + images
    'ready_to_mint',      -- All GRC20 fields populated
    'minted',             -- Complete! GRC20 entity created
    'failed'              -- Dead end (no ISWC, bad audio, etc.)
  ));
