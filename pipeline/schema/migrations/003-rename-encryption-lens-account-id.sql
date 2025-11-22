-- Rename encryption_lens_account_id to lens_account_row_id for clarity
-- This column stores the database row ID (integer PK) from lens_accounts.id,
-- not the on-chain Lens Protocol account ID (text) from lens_accounts.lens_account_id

ALTER TABLE karaoke_segments
  RENAME COLUMN encryption_lens_account_id TO lens_account_row_id;

-- Update comment for clarity
COMMENT ON COLUMN karaoke_segments.lens_account_row_id IS
  'Foreign key to lens_accounts.id (database row PK). Join to get actual Lens account details (lens_account_id, lens_handle, etc.)';
