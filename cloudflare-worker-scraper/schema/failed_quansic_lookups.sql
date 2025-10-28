-- Failed Quansic Lookups Table
-- Tracks ISRCs that consistently fail to avoid repeated retries

CREATE TABLE IF NOT EXISTS failed_quansic_lookups (
  isrc VARCHAR(12) PRIMARY KEY,
  error_type VARCHAR(50) NOT NULL, -- 'not_found', 'rate_limit', 'server_error'
  error_details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  retry_count INTEGER DEFAULT 1
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_failed_quansic_lookups_error_type ON failed_quansic_lookups(error_type);
CREATE INDEX IF NOT EXISTS idx_failed_quansic_lookups_created_at ON failed_quansic_lookups(created_at);

-- Clean up old unnecessary entries after 30 days
CREATE OR REPLACE FUNCTION cleanup_old_failed_lookups()
RETURNS void AS $$
BEGIN
  DELETE FROM failed_quansic_lookups 
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND retry_count > 5;
END;
$$ LANGUAGE plpgsql;

-- Optional: Schedule this cleanup as a background job if needed
-- SELECT cron.schedule('cleanup-failed-quansic-lookups', '0 2 * * *', 'SELECT cleanup_old_failed_lookups();');
