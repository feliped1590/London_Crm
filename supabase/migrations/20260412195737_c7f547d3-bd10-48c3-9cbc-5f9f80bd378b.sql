
UPDATE companies
SET 
  erp_code = LTRIM(SUBSTRING(name FROM '^\d+'), '0'),
  name = TRIM(SUBSTRING(name FROM '^\d+\s*-\s*(.+)$'))
WHERE name ~ '^\d+\s*-\s*'
  AND (erp_code IS NULL OR erp_code = '')
  AND TRIM(SUBSTRING(name FROM '^\d+\s*-\s*(.+)$')) IS NOT NULL
  AND TRIM(SUBSTRING(name FROM '^\d+\s*-\s*(.+)$')) != '';
