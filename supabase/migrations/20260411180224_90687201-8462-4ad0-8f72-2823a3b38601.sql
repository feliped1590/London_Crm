-- 1. Add column
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS integration_status text DEFAULT 'not_synced';

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_companies_integration_status
ON companies(integration_status);

-- 3. Compute function
CREATE OR REPLACE FUNCTION public.compute_integration_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cnpj IS NULL OR NEW.city IS NULL OR NEW.state IS NULL OR NEW.address IS NULL THEN
    NEW.integration_status := 'missing_data';
  ELSIF NEW.erp_code IS NOT NULL THEN
    NEW.integration_status := 'ready';
  ELSE
    NEW.integration_status := 'not_synced';
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Trigger
DROP TRIGGER IF EXISTS trg_compute_integration_status ON companies;
CREATE TRIGGER trg_compute_integration_status
BEFORE INSERT OR UPDATE OF cnpj, city, state, address, erp_code
ON companies
FOR EACH ROW
EXECUTE FUNCTION compute_integration_status();

-- 5. Batch update existing records
UPDATE companies
SET integration_status =
  CASE
    WHEN cnpj IS NULL OR city IS NULL OR state IS NULL OR address IS NULL
      THEN 'missing_data'
    WHEN erp_code IS NOT NULL
      THEN 'ready'
    ELSE 'not_synced'
  END;