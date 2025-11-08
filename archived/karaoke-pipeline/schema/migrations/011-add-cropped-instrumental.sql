-- Add cropped instrumental columns to karaoke_segments
-- Allows storing the FFmpeg-cropped version separate from full instrumental

ALTER TABLE karaoke_segments
ADD COLUMN IF NOT EXISTS cropped_instrumental_grove_cid TEXT,
ADD COLUMN IF NOT EXISTS cropped_instrumental_grove_url TEXT;

-- Add index for queries filtering by cropped status
CREATE INDEX IF NOT EXISTS idx_karaoke_segments_cropped_status
ON karaoke_segments(cropped_instrumental_grove_cid)
WHERE cropped_instrumental_grove_cid IS NULL;
