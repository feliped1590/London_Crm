
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'venda_tributada',
  ADD COLUMN IF NOT EXISTS redespacho_carrier_id uuid NULL REFERENCES public.carriers(id);

WITH most_common AS (
  SELECT order_id, sale_type, COUNT(*) AS c,
         ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY COUNT(*) DESC) AS rn
  FROM public.order_items
  WHERE sale_type IS NOT NULL
  GROUP BY order_id, sale_type
)
UPDATE public.orders o
SET sale_type = mc.sale_type
FROM most_common mc
WHERE mc.order_id = o.id AND mc.rn = 1;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_sale_type_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_sale_type_check
  CHECK (sale_type IN ('venda_tributada','bonificacao','remessa_amostra'));

CREATE INDEX IF NOT EXISTS idx_orders_redespacho_carrier_id ON public.orders(redespacho_carrier_id);

ALTER TABLE public.carriers
  ADD COLUMN IF NOT EXISTS erp_code integer NULL;

CREATE UNIQUE INDEX IF NOT EXISTS carriers_tenant_erp_code_uniq
  ON public.carriers(tenant_id, erp_code)
  WHERE erp_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_carrier_erp_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.erp_code IS NULL THEN
    RAISE EXCEPTION 'Código ERP é obrigatório para transportadora';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.erp_code IS NOT NULL AND NEW.erp_code IS NULL THEN
    RAISE EXCEPTION 'Código ERP não pode ser removido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_carrier_erp_code ON public.carriers;
CREATE TRIGGER trg_validate_carrier_erp_code
  BEFORE INSERT OR UPDATE ON public.carriers
  FOR EACH ROW EXECUTE FUNCTION public.validate_carrier_erp_code();

CREATE TABLE IF NOT EXISTS public.order_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sequencia integer NOT NULL DEFAULT 1,
  tipo integer NOT NULL DEFAULT 1,
  texto text NOT NULL,
  created_by uuid NULL,
  erp_user_code bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, sequencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_followups TO authenticated;
GRANT ALL ON public.order_followups TO service_role;

ALTER TABLE public.order_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_followups_select" ON public.order_followups;
CREATE POLICY "order_followups_select"
  ON public.order_followups FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "order_followups_insert" ON public.order_followups;
CREATE POLICY "order_followups_insert"
  ON public.order_followups FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "order_followups_update" ON public.order_followups;
CREATE POLICY "order_followups_update"
  ON public.order_followups FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "order_followups_delete" ON public.order_followups;
CREATE POLICY "order_followups_delete"
  ON public.order_followups FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE INDEX IF NOT EXISTS idx_order_followups_order_id ON public.order_followups(order_id);
CREATE INDEX IF NOT EXISTS idx_order_followups_tenant_id ON public.order_followups(tenant_id);

DROP TRIGGER IF EXISTS trg_order_followups_updated_at ON public.order_followups;
CREATE TRIGGER trg_order_followups_updated_at
  BEFORE UPDATE ON public.order_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
