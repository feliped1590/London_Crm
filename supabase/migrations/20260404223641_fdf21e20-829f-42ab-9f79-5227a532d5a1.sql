
-- 1. Add new columns
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku_unique TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS structure_hash TEXT;

-- 2. Drop old SKU unique constraint
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;

-- 3. Add unique constraint on sku_unique
ALTER TABLE public.products ADD CONSTRAINT products_sku_unique_key UNIQUE (sku_unique);

-- 4. Index on structure_hash
CREATE INDEX IF NOT EXISTS idx_products_structure_hash ON public.products (structure_hash);

-- 5. Function to compute structure_hash
CREATE OR REPLACE FUNCTION public.compute_structure_hash()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.structure_hash := md5(
    COALESCE(NEW.tenant_id::text, '') || '|' ||
    COALESCE(NEW.tipo_id::text, '') || '|' ||
    COALESCE(NEW.family_id::text, '') || '|' ||
    COALESCE(NEW.grupo_id::text, '') || '|' ||
    COALESCE(NEW.subgrupo_id::text, '') || '|' ||
    COALESCE(NEW.class_id::text, '') || '|' ||
    COALESCE(NEW.width::text, '0') || '|' ||
    COALESCE(NEW.length::text, '0') || '|' ||
    COALESCE(NEW.thickness::text, '0')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compute_structure_hash
BEFORE INSERT OR UPDATE OF tipo_id, family_id, grupo_id, subgrupo_id, class_id, width, length, thickness
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.compute_structure_hash();

-- 6. Function to generate sku_unique
CREATE OR REPLACE FUNCTION public.generate_sku_unique()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  seq INT;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.sku_unique IS NULL THEN
    IF NEW.sku IS NOT NULL AND NEW.sku <> '' THEN
      SELECT COALESCE(MAX(
        CASE 
          WHEN p.sku_unique ~ ('^' || regexp_replace(NEW.sku, '([.*+?^${}()|[\]\\])', '\\\1', 'g') || '-\d+$')
          THEN CAST(substring(p.sku_unique FROM '-(\d+)$') AS INT)
          ELSE 0
        END
      ), 0) + 1 INTO seq
      FROM public.products p
      WHERE p.sku = NEW.sku;
      NEW.sku_unique := NEW.sku || '-' || lpad(seq::text, 3, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_sku_unique
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.generate_sku_unique();

-- 7. Function to protect structural fields
CREATE OR REPLACE FUNCTION public.protect_product_structure()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.origem_alteracao IN ('ERP', 'SYNC') THEN
    RETURN NEW;
  END IF;
  IF OLD.tipo_id     IS DISTINCT FROM NEW.tipo_id
  OR OLD.family_id   IS DISTINCT FROM NEW.family_id
  OR OLD.grupo_id    IS DISTINCT FROM NEW.grupo_id
  OR OLD.subgrupo_id IS DISTINCT FROM NEW.subgrupo_id
  OR OLD.class_id    IS DISTINCT FROM NEW.class_id
  OR OLD.width       IS DISTINCT FROM NEW.width
  OR OLD.length      IS DISTINCT FROM NEW.length
  OR OLD.thickness   IS DISTINCT FROM NEW.thickness THEN
    RAISE EXCEPTION 'Campos estruturais não podem ser alterados após criação. Utilize a opção de duplicar produto.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_product_structure
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.protect_product_structure();

-- 8. Backfill structure_hash directly (no triggers fired — only updating structure_hash column)
-- Disable triggers temporarily for backfill
ALTER TABLE public.products DISABLE TRIGGER trg_validate_nome_impresso;
ALTER TABLE public.products DISABLE TRIGGER trg_protect_product_structure;
ALTER TABLE public.products DISABLE TRIGGER a_auto_erp_versao;
ALTER TABLE public.products DISABLE TRIGGER trg_product_sync_before;
ALTER TABLE public.products DISABLE TRIGGER trg_product_sync_after;

UPDATE public.products SET
  structure_hash = md5(
    COALESCE(tenant_id::text, '') || '|' ||
    COALESCE(tipo_id::text, '') || '|' ||
    COALESCE(family_id::text, '') || '|' ||
    COALESCE(grupo_id::text, '') || '|' ||
    COALESCE(subgrupo_id::text, '') || '|' ||
    COALESCE(class_id::text, '') || '|' ||
    COALESCE(width::text, '0') || '|' ||
    COALESCE(length::text, '0') || '|' ||
    COALESCE(thickness::text, '0')
  )
WHERE structure_hash IS NULL;

-- Backfill sku_unique
DO $$
DECLARE
  r RECORD;
  seq INT;
BEGIN
  FOR r IN SELECT id, sku FROM public.products WHERE sku_unique IS NULL AND sku IS NOT NULL ORDER BY created_at ASC
  LOOP
    SELECT COALESCE(MAX(
      CASE 
        WHEN p.sku_unique ~ ('^' || regexp_replace(r.sku, '([.*+?^${}()|[\]\\])', '\\\1', 'g') || '-\d+$')
        THEN CAST(substring(p.sku_unique FROM '-(\d+)$') AS INT)
        ELSE 0
      END
    ), 0) + 1 INTO seq
    FROM public.products p
    WHERE p.sku = r.sku AND p.sku_unique IS NOT NULL;

    UPDATE public.products SET sku_unique = r.sku || '-' || lpad(seq::text, 3, '0') WHERE id = r.id;
  END LOOP;
END;
$$;

-- Re-enable triggers
ALTER TABLE public.products ENABLE TRIGGER trg_validate_nome_impresso;
ALTER TABLE public.products ENABLE TRIGGER trg_protect_product_structure;
ALTER TABLE public.products ENABLE TRIGGER a_auto_erp_versao;
ALTER TABLE public.products ENABLE TRIGGER trg_product_sync_before;
ALTER TABLE public.products ENABLE TRIGGER trg_product_sync_after;
