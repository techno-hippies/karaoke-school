-- Extract artist IPIs from BMI works data
-- BMI stores writers and publishers with IPI numbers in JSONB arrays

CREATE OR REPLACE VIEW bmi_artist_ipis AS
WITH writer_ipis AS (
    SELECT DISTINCT
        jsonb_array_element->>'name' as artist_name,
        jsonb_array_element->>'ipi' as ipi,
        jsonb_array_element->>'affiliation' as affiliation
    FROM bmi_works,
    jsonb_array_elements(writers) as jsonb_array_element
    WHERE jsonb_array_element->>'ipi' IS NOT NULL
),
publisher_ipis AS (
    SELECT DISTINCT
        jsonb_array_element->>'name' as artist_name,
        jsonb_array_element->>'ipi' as ipi,
        jsonb_array_element->>'affiliation' as affiliation
    FROM bmi_works,
    jsonb_array_elements(publishers) as jsonb_array_element
    WHERE jsonb_array_element->>'ipi' IS NOT NULL
)
SELECT * FROM writer_ipis
UNION
SELECT * FROM publisher_ipis;

-- Check coverage
SELECT 
    'BMI Artist IPIs' as source,
    COUNT(DISTINCT ipi) as unique_ipis,
    COUNT(DISTINCT artist_name) as unique_names
FROM bmi_artist_ipis;
