
-- 1. Add columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS parent_product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS versao_numero integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_products_parent ON public.products(parent_product_id);

-- 2. Unique number per parent (children only)
CREATE UNIQUE INDEX IF NOT EXISTS products_parent_versao_unique
  ON public.products(parent_product_id, versao_numero)
  WHERE parent_product_id IS NOT NULL;

-- 3. Allow shared erp_product_code across versions: drop old, recreate including versao_numero
DROP INDEX IF EXISTS public.products_tenant_erp_code_unique;
CREATE UNIQUE INDEX products_tenant_erp_code_unique
  ON public.products(tenant_id, erp_product_code, versao_numero)
  WHERE erp_product_code IS NOT NULL AND erp_product_code <> '';

-- 4. Auto-numbering trigger for child versions
CREATE OR REPLACE FUNCTION public.assign_product_versao_numero()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_product_id IS NULL THEN
    IF NEW.versao_numero IS NULL OR NEW.versao_numero < 1 THEN
      NEW.versao_numero := 1;
    END IF;
    RETURN NEW;
  END IF;

  -- Child: pick next available number for this parent
  IF NEW.versao_numero IS NULL OR NEW.versao_numero = 1 THEN
    SELECT COALESCE(MAX(versao_numero), 1) + 1
      INTO NEW.versao_numero
      FROM public.products
     WHERE parent_product_id = NEW.parent_product_id
        OR id = NEW.parent_product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_product_versao_numero ON public.products;
CREATE TRIGGER trg_assign_product_versao_numero
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.assign_product_versao_numero();
