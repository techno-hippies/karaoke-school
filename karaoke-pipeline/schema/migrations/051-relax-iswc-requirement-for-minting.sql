/**
 * Migration 051: Relax ISWC requirement for GRC-20 work minting
 *
 * Problem: 3 works lack ISWCs, blocking minting despite having other identifiers:
 *   - Life Is Good (Kenny Chesney) - genius_song_id: 195483
 *   - Sarà perché ti amo (Ricchi E Poveri) - genius_song_id: 887880
 *   - THATS WHAT I WANT (Lil Nas X) - genius_song_id: 7105950
 *
 * Solution: Use genius_song_id as fallback join key when ISWC unavailable
 *
 * Changes:
 * 1. Make iswc nullable in grc20_work_mints
 * 2. Add genius_song_id as alternative join key
 * 3. Add composite unique constraint (only one can be null)
 * 4. Keep ISWC as preferred identifier when available
 */

-- Step 1: Add genius_song_id column to grc20_work_mints
ALTER TABLE grc20_work_mints
ADD COLUMN genius_song_id INTEGER;

-- Step 2: Make iswc nullable (was NOT NULL)
ALTER TABLE grc20_work_mints
ALTER COLUMN iswc DROP NOT NULL;

-- Step 3: Add check constraint: at least one identifier must be present
ALTER TABLE grc20_work_mints
ADD CONSTRAINT grc20_work_mints_identifier_required
CHECK (iswc IS NOT NULL OR genius_song_id IS NOT NULL);

-- Step 4: Drop old unique constraint on iswc only
ALTER TABLE grc20_work_mints
DROP CONSTRAINT IF EXISTS grc20_work_mints_iswc_key;

-- Step 5: Add unique constraints for both identifiers
-- Each identifier must be unique when present
CREATE UNIQUE INDEX grc20_work_mints_iswc_unique
ON grc20_work_mints (iswc)
WHERE iswc IS NOT NULL;

CREATE UNIQUE INDEX grc20_work_mints_genius_unique
ON grc20_work_mints (genius_song_id)
WHERE genius_song_id IS NOT NULL;

-- Step 6: Add index for genius_song_id lookups
CREATE INDEX idx_grc20_work_mints_genius
ON grc20_work_mints (genius_song_id)
WHERE genius_song_id IS NOT NULL;

-- Step 7: Add comments
COMMENT ON COLUMN grc20_work_mints.iswc IS
'ISWC identifier (preferred when available, nullable for works without ISWC)';

COMMENT ON COLUMN grc20_work_mints.genius_song_id IS
'Genius song ID (fallback identifier when ISWC unavailable)';

COMMENT ON CONSTRAINT grc20_work_mints_identifier_required ON grc20_work_mints IS
'Ensures at least one identifier (ISWC or Genius ID) is present for every minted work';
