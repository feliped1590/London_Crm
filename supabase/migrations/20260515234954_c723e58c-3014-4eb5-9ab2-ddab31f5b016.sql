
CREATE OR REPLACE FUNCTION public.assign_product_versao_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_product_id IS NULL THEN
    IF NEW.versao_numero IS NULL OR NEW.versao_numero < 1 THEN
      NEW.versao_numero := 1;
    END IF;
    RETURN NEW;
  END IF;
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
