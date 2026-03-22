CREATE TYPE public.company_product_relationship_type AS ENUM (
  'INTEREST',
  'HOMOLOGATED',
  'RECURRENT',
  'STRATEGIC',
  'BLACKLIST'
);

CREATE TABLE public.company_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL,
  product_id UUID NOT NULL,
  relationship_type public.company_product_relationship_type NOT NULL DEFAULT 'INTEREST',
  notes TEXT,
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_interaction_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by UUID,
  CONSTRAINT company_products_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  CONSTRAINT company_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT company_products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT company_products_metadata_is_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_company_products_tenant_company
  ON public.company_products (tenant_id, company_id);

CREATE INDEX idx_company_products_tenant_product
  ON public.company_products (tenant_id, product_id);

CREATE INDEX idx_company_products_tenant_relationship_type
  ON public.company_products (tenant_id, relationship_type);

CREATE INDEX idx_company_products_tenant_company_preferred
  ON public.company_products (tenant_id, company_id, is_preferred)
  WHERE archived_at IS NULL;

CREATE UNIQUE INDEX idx_company_products_unique_active
  ON public.company_products (tenant_id, company_id, product_id)
  WHERE archived_at IS NULL;

ALTER TABLE public.company_products ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_company_products_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    NEW.updated_by := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());
  ELSE
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_company_products_defaults
BEFORE INSERT OR UPDATE ON public.company_products
FOR EACH ROW
EXECUTE FUNCTION public.set_company_products_defaults();

CREATE POLICY "company_products_select"
ON public.company_products
FOR SELECT
TO authenticated
USING (
  archived_at IS NULL
  AND tenant_id IN (
    SELECT ut.tenant_id
    FROM public.user_tenants ut
    WHERE ut.user_id = auth.uid()
  )
);

CREATE POLICY "company_products_insert"
ON public.company_products
FOR INSERT
TO authenticated
WITH CHECK (
  archived_at IS NULL
  AND created_by = auth.uid()
  AND tenant_id IN (
    SELECT ut.tenant_id
    FROM public.user_tenants ut
    WHERE ut.user_id = auth.uid()
  )
);

CREATE POLICY "company_products_update"
ON public.company_products
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT ut.tenant_id
    FROM public.user_tenants ut
    WHERE ut.user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT ut.tenant_id
    FROM public.user_tenants ut
    WHERE ut.user_id = auth.uid()
  )
);

CREATE POLICY "company_products_delete_admin_only"
ON public.company_products
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.company_products;