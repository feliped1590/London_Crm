-- Add derived cnpj_root field to companies for documental economic-group clustering
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS cnpj_root VARCHAR(8);

-- Keep cnpj_root derivation centralized in the database
CREATE OR REPLACE FUNCTION public.set_company_cnpj_root()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnpj_digits TEXT;
BEGIN
  v_cnpj_digits := regexp_replace(COALESCE(NEW.cnpj, ''), '\D', '', 'g');

  IF length(v_cnpj_digits) >= 8 THEN
    NEW.cnpj_root := substring(v_cnpj_digits FROM 1 FOR 8);
  ELSE
    NEW.cnpj_root := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_company_cnpj_root_on_write ON public.companies;
CREATE TRIGGER set_company_cnpj_root_on_write
BEFORE INSERT OR UPDATE OF cnpj ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.set_company_cnpj_root();

-- Backfill existing rows so the new field is immediately usable
UPDATE public.companies
SET cnpj_root = CASE
  WHEN length(regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g')) >= 8
    THEN substring(regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g') FROM 1 FOR 8)
  ELSE NULL
END
WHERE cnpj_root IS DISTINCT FROM CASE
  WHEN length(regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g')) >= 8
    THEN substring(regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g') FROM 1 FOR 8)
  ELSE NULL
END;

-- Multi-tenant lookup index for grouping/filtering by CNPJ root
CREATE INDEX IF NOT EXISTS idx_companies_tenant_cnpj_root
ON public.companies (tenant_id, cnpj_root);