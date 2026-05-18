
CREATE OR REPLACE FUNCTION public.sync_product_tipo_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_id IS NOT NULL THEN
    SELECT value INTO NEW.tipo_item
    FROM public.product_types
    WHERE id = NEW.tipo_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_tipo_item ON public.products;
CREATE TRIGGER trg_sync_product_tipo_item
BEFORE INSERT OR UPDATE OF tipo_id ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_tipo_item();

-- Backfill seguro: bypassa triggers de validação (que exigem nome_impresso etc.)
ALTER TABLE public.products DISABLE TRIGGER USER;
UPDATE public.products p
SET tipo_item = pt.value
FROM public.product_types pt
WHERE p.tipo_id = pt.id
  AND (p.tipo_item IS DISTINCT FROM pt.value);
ALTER TABLE public.products ENABLE TRIGGER USER;
