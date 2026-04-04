
-- Function: auto-generate erp_versao from dimensions + group profile
CREATE OR REPLACE FUNCTION public.auto_generate_erp_versao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile TEXT;
  v_w NUMERIC;
  v_l NUMERIC;
  v_t NUMERIC;
  v_versao TEXT;
BEGIN
  -- Skip ERP/SYNC origins to avoid overwriting external values
  IF NEW.origem_alteracao IN ('ERP', 'SYNC') THEN
    RETURN NEW;
  END IF;

  -- Lookup dimension profile from product_groups
  IF NEW.grupo_id IS NOT NULL THEN
    SELECT dimension_profile::TEXT INTO v_profile
    FROM public.product_groups
    WHERE id = NEW.grupo_id;
  END IF;

  -- No profile or 'none' → skip
  IF v_profile IS NULL OR v_profile = 'none' THEN
    RETURN NEW;
  END IF;

  v_w := COALESCE(NEW.width, 0);
  v_l := COALESCE(NEW.length, 0);
  v_t := COALESCE(NEW.thickness, 0);

  IF v_profile = 'full' THEN
    IF v_w > 0 AND v_l > 0 AND v_t > 0 THEN
      v_versao := TRIM(TRAILING '.' FROM TO_CHAR(v_w, 'FM99999999'))
        || 'x'
        || TRIM(TRAILING '.' FROM TO_CHAR(v_l, 'FM99999999'))
        || 'x'
        || REPLACE(TO_CHAR(v_t, 'FM0.000'), '.', ',');
      NEW.erp_versao := v_versao;
    END IF;

  ELSIF v_profile = 'partial' THEN
    IF v_w > 0 AND v_t > 0 THEN
      v_versao := TRIM(TRAILING '.' FROM TO_CHAR(v_w, 'FM99999999'))
        || 'x'
        || REPLACE(TO_CHAR(v_t, 'FM0.000'), '.', ',');
      NEW.erp_versao := v_versao;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: named with 'a_' prefix to execute before sync triggers (alphabetical order)
CREATE TRIGGER a_auto_erp_versao
  BEFORE INSERT OR UPDATE OF width, length, thickness, grupo_id
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_erp_versao();
