-- Remove useless audit timestamp columns
-- Keep only created_at/updated_at (standard)

ALTER TABLE karaoke_segments 
  DROP COLUMN IF EXISTS optimal_segment_selected_at,
  DROP COLUMN IF EXISTS clip_selected_at,
  DROP COLUMN IF EXISTS fal_enhanced_at;

-- Result: Clean schema with only essential data
-- 10 columns remaining (down from 13)
