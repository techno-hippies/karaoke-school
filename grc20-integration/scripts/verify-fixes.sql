-- ============================================================================
-- VERIFY GRC-20 CONSENSUS SYSTEM FIXES
-- ============================================================================

-- Check if wikidata regex fix worked
SELECT 
  'Wikidata ID Fix Verification' as check_type,
  COUNT(*) as total_artists,
  COUNT(*) FILTER (WHERE wikidata_id LIKE 'Q%') as fixed_q_ids,
  COUNT(*) FILTER (WHERE wikidata_id = 'wiki') as still_broken,
  ROUND(COUNT(*) FILTER (WHERE wikidata_id LIKE 'Q%') * 100.0 / NULLIF(COUNT(*), 0), 2) as fix_percentage
FROM grc20_artists;

-- Check sample of fixed wikidata IDs
SELECT 
  'Sample Fixed Wikidata IDs' as check_type,
  name,
  wikidata_id,
  '✅ FIXED' as status
FROM grc20_artists 
WHERE wikidata_id LIKE 'Q%' 
LIMIT 10;

-- Check if corroboration logging worked
SELECT 
  'Corroboration Log Verification' as check_type,
  COUNT(*) as total_log_entries,
  COUNT(DISTINCT entity_id) as unique_entities_logged,
  COUNT(DISTINCT field_name) as unique_fields_logged,
  COUNT(*) FILTER (WHERE conflict_detected = TRUE) as conflicts_detected,
  MAX(created_at) as latest_log_entry
FROM grc20_corroboration_log;

-- Check sample corroboration log entries
SELECT 
  'Sample Corroboration Log Entries' as check_type,
  entity_type,
  entity_id,
  field_name,
  source,
  new_value,
  resolution_reason,
  consensus_count,
  conflict_detected,
  created_at
FROM grc20_corroboration_log 
ORDER BY created_at DESC 
LIMIT 10;

-- Check data quality metrics
SELECT 
  'Data Quality Dashboard' as check_type,
  COUNT(*) as total_artists,
  COUNT(*) FILTER (WHERE ready_to_mint = TRUE) as ready_to_mint,
  ROUND(AVG(completeness_score), 2) as avg_completeness,
  ROUND(AVG(consensus_score), 2) as avg_consensus,
  COUNT(*) FILTER (WHERE isni IS NOT NULL) as has_isni,
  COUNT(*) FILTER (WHERE mbid IS NOT NULL) as has_mbid,
  COUNT(*) FILTER (WHERE image_url IS NOT NULL) as has_image,
  COUNT(*) FILTER (WHERE social_link_count >= 2) as has_2plus_social
FROM grc20_artists;

-- Check tier distribution (based on current data)
SELECT 
  'Tier Distribution Analysis' as check_type,
  CASE 
    WHEN isni IS NOT NULL AND external_id_count >= 5 AND social_link_count >= 3 AND completeness_score >= 0.90 THEN 'Premium'
    WHEN external_id_count >= 3 AND social_link_count >= 2 AND completeness_score >= 0.70 THEN 'Standard'
    WHEN genius_artist_id IS NOT NULL AND image_url IS NOT NULL AND social_link_count >= 1 THEN 'Minimal'
    ELSE 'Invalid'
  END as detected_tier,
  COUNT(*) as artist_count,
  ROUND(COUNT(*) * 100.0 / NULLIF(COUNT(*), 0), 2) as percentage
FROM grc20_artists
GROUP BY 
  CASE 
    WHEN isni IS NOT NULL AND external_id_count >= 5 AND social_link_count >= 3 AND completeness_score >= 0.90 THEN 'Premium'
    WHEN external_id_count >= 3 AND social_link_count >= 2 AND completeness_score >= 0.70 THEN 'Standard'
    WHEN genius_artist_id IS NOT NULL AND image_url IS NOT NULL AND social_link_count >= 1 THEN 'Minimal'
    ELSE 'Invalid'
  END
ORDER BY 
  CASE 
    WHEN isni IS NOT NULL AND external_id_count >= 5 AND social_link_count >= 3 AND completeness_score >= 0.90 THEN 1
    WHEN external_id_count >= 3 AND social_link_count >= 2 AND completeness_score >= 0.70 THEN 2
    WHEN genius_artist_id IS NOT NULL AND image_url IS NOT NULL AND social_link_count >= 1 THEN 3
    ELSE 4
  END;
