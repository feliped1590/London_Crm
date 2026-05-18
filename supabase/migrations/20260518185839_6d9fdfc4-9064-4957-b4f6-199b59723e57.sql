-- Allow structural edits on products that have not been synced to ERP yet.
-- Once `erp_product_code` is set, structural fields stay immutable.

CREATE OR REPLACE FUNCTION public.protect_product_structure()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- ERP/SYNC origins always allowed (mirror ERP source of truth)
  IF NEW.origem_alteracao IN ('ERP', 'SYNC') THEN
    RETURN NEW;
  END IF;

  -- Only block when product is already linked to the ERP
  IF OLD.erp_product_code IS NULL OR btrim(OLD.erp_product_code) = '' THEN
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
    RAISE EXCEPTION 'Produto já sincronizado com o ERP não pode ter campos estruturais alterados. Utilize a opção Duplicar Produto.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- Regenerate sku_unique when the SKU changes during an UPDATE
CREATE OR REPLACE FUNCTION public.generate_sku_unique()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  seq INT;
  v_should_regen BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_should_regen := TRUE;
  ELSIF NEW.sku_unique IS NULL THEN
    v_should_regen := TRUE;
  ELSIF TG_OP = 'UPDATE' AND NEW.sku IS DISTINCT FROM OLD.sku THEN
    v_should_regen := TRUE;
  END IF;

  IF v_should_regen AND NEW.sku IS NOT NULL AND NEW.sku <> '' THEN
    SELECT COALESCE(MAX(
      CASE
        WHEN p.sku_unique ~ ('^' || regexp_replace(NEW.sku, '([.*+?^${}()|[\]\\])', '\\\1', 'g') || '-\d+$')
        THEN CAST(substring(p.sku_unique FROM '-(\d+)$') AS INT)
        ELSE 0
      END
    ), 0) + 1 INTO seq
    FROM public.products p
    WHERE p.sku = NEW.sku
      AND (TG_OP = 'INSERT' OR p.id <> NEW.id);
    NEW.sku_unique := NEW.sku || '-' || lpad(seq::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure UPDATE also fires sku_unique regeneration
DROP TRIGGER IF EXISTS trg_generate_sku_unique ON public.products;
CREATE TRIGGER trg_generate_sku_unique
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.generate_sku_unique();
