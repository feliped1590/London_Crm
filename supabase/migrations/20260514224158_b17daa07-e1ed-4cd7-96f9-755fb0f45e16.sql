
CREATE OR REPLACE FUNCTION public.apply_ficha_schema_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text;
  v_version int;
BEGIN
  IF NEW.grupo_id IS NULL THEN
    NEW.ficha_schema_key := NULL;
    NEW.ficha_schema_version := NULL;
    RETURN NEW;
  END IF;

  SELECT pg.ficha_profile INTO v_profile
  FROM public.product_groups pg
  WHERE pg.id = NEW.grupo_id;

  IF v_profile IS NULL OR v_profile = 'none' THEN
    NEW.ficha_schema_key := NULL;
    NEW.ficha_schema_version := NULL;
    RETURN NEW;
  END IF;

  SELECT fs.version INTO v_version
  FROM public.ficha_schemas fs
  WHERE fs.tenant_id = NEW.tenant_id
    AND fs.key = v_profile
    AND fs.is_active = true
  LIMIT 1;

  NEW.ficha_schema_key := v_profile;
  NEW.ficha_schema_version := v_version;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_ficha_schema_snapshot ON public.products;
CREATE TRIGGER trg_apply_ficha_schema_snapshot
BEFORE INSERT OR UPDATE OF grupo_id, ficha_tecnica ON public.products
FOR EACH ROW EXECUTE FUNCTION public.apply_ficha_schema_snapshot();
