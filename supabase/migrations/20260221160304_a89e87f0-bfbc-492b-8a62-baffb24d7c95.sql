
-- 1. Tornar legal_entity_id NOT NULL em deals e orders
ALTER TABLE public.deals
  ALTER COLUMN legal_entity_id SET NOT NULL;

ALTER TABLE public.orders
  ALTER COLUMN legal_entity_id SET NOT NULL;

-- 2. Trigger de validação: deals.legal_entity_id deve pertencer ao mesmo tenant
CREATE OR REPLACE FUNCTION public.validate_deal_legal_entity_tenant()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $func$
DECLARE
  v_le_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_le_tenant
  FROM public.legal_entities
  WHERE id = NEW.legal_entity_id;

  IF v_le_tenant IS NULL THEN
    RAISE EXCEPTION 'Entidade jurídica % não encontrada.', NEW.legal_entity_id;
  END IF;

  IF v_le_tenant != NEW.tenant_id THEN
    RAISE EXCEPTION 'Entidade jurídica % não pertence ao tenant do negócio.', NEW.legal_entity_id;
  END IF;

  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_validate_deal_legal_entity
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_deal_legal_entity_tenant();
