-- Refinamentos de consistência e rastreabilidade para company_products

-- 1) Garantir default seguro para metadata
ALTER TABLE public.company_products
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE public.company_products
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

-- 2) Reforçar validação do formato de metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_products_metadata_is_object'
      AND conrelid = 'public.company_products'::regclass
  ) THEN
    ALTER TABLE public.company_products
      ADD CONSTRAINT company_products_metadata_is_object
      CHECK (jsonb_typeof(metadata) = 'object');
  END IF;
END $$;

-- 3) Função/trigger: manter tenant consistente, updated_at e last_interaction_at
CREATE OR REPLACE FUNCTION public.set_company_products_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_company_tenant
  FROM public.companies
  WHERE id = NEW.company_id;

  IF v_company_tenant IS NULL THEN
    RAISE EXCEPTION 'Empresa % não encontrada.', NEW.company_id;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := v_company_tenant;
  END IF;

  IF NEW.tenant_id <> v_company_tenant THEN
    RAISE EXCEPTION 'tenant_id incompatível com a empresa vinculada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = NEW.product_id
      AND p.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Produto % não pertence ao tenant informado.', NEW.product_id;
  END IF;

  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb);

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;

    NEW.updated_by := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());
    NEW.last_interaction_at := COALESCE(NEW.last_interaction_at, now());
  ELSE
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by, OLD.created_by);

    IF NEW.relationship_type IS DISTINCT FROM OLD.relationship_type
      OR NEW.notes IS DISTINCT FROM OLD.notes
      OR NEW.is_preferred IS DISTINCT FROM OLD.is_preferred
      OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
      NEW.last_interaction_at := now();
    ELSE
      NEW.last_interaction_at := COALESCE(NEW.last_interaction_at, OLD.last_interaction_at);
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;