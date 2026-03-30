-- =============================================
-- ECONOMIC GROUPS: Entidade explícita de grupo econômico
-- =============================================

-- 1. Tabela principal
CREATE TABLE IF NOT EXISTS public.economic_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj_root varchar(8),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  owner_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_economic_groups_tenant ON public.economic_groups(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_economic_groups_tenant_root ON public.economic_groups(tenant_id, cnpj_root) WHERE cnpj_root IS NOT NULL;

CREATE TRIGGER update_economic_groups_updated_at
  BEFORE UPDATE ON public.economic_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. RLS
ALTER TABLE public.economic_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "economic_groups_select_tenant"
  ON public.economic_groups FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
  );

CREATE POLICY "economic_groups_insert_admin"
  ON public.economic_groups FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "economic_groups_update_admin"
  ON public.economic_groups FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "economic_groups_delete_admin"
  ON public.economic_groups FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

-- 3. FK em companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS economic_group_id uuid REFERENCES public.economic_groups(id);

CREATE INDEX IF NOT EXISTS idx_companies_economic_group ON public.companies(economic_group_id);

-- 4. Migração de dados (tabela acabou de ser criada, não precisa ON CONFLICT)
INSERT INTO public.economic_groups (name, cnpj_root, tenant_id)
SELECT
  COALESCE(
    (SELECT c2.name FROM public.companies c2
     WHERE c2.tenant_id = sub.tenant_id AND c2.cnpj_root = sub.cnpj_root
       AND c2.is_matriz = true LIMIT 1),
    sub.first_name
  ),
  sub.cnpj_root,
  sub.tenant_id
FROM (
  SELECT tenant_id, cnpj_root, MIN(name) AS first_name
  FROM public.companies
  WHERE cnpj_root IS NOT NULL AND tenant_id IS NOT NULL
  GROUP BY tenant_id, cnpj_root
) sub;

-- 5. Vincular companies aos grupos
UPDATE public.companies c
SET economic_group_id = eg.id
FROM public.economic_groups eg
WHERE c.cnpj_root = eg.cnpj_root
  AND c.tenant_id = eg.tenant_id
  AND c.cnpj_root IS NOT NULL
  AND c.economic_group_id IS NULL;

-- 6. Trigger automático
CREATE OR REPLACE FUNCTION public.auto_assign_economic_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cnpj_root IS NOT NULL
     AND NEW.tenant_id IS NOT NULL
     AND NEW.economic_group_id IS NULL THEN
    SELECT id INTO NEW.economic_group_id
    FROM public.economic_groups
    WHERE cnpj_root = NEW.cnpj_root
      AND tenant_id = NEW.tenant_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zzz_auto_assign_economic_group
  BEFORE INSERT OR UPDATE OF cnpj_root, economic_group_id ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_economic_group();

-- 7. RPC v2
CREATE OR REPLACE FUNCTION public.get_group_deal_metrics_v2(p_company_id uuid)
RETURNS TABLE(
  total_deals bigint,
  total_value numeric,
  counts_by_stage jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_economic_group_id uuid;
  v_cnpj_root text;
BEGIN
  SELECT c.tenant_id, c.economic_group_id, c.cnpj_root
  INTO v_tenant_id, v_economic_group_id, v_cnpj_root
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_tenant_id IS NULL THEN
    RETURN QUERY SELECT 0::bigint, 0::numeric, '{}'::jsonb;
    RETURN;
  END IF;

  IF v_economic_group_id IS NULL AND v_cnpj_root IS NULL THEN
    RETURN QUERY SELECT 0::bigint, 0::numeric, '{}'::jsonb;
    RETURN;
  END IF;

  RETURN QUERY
  WITH group_deals AS (
    SELECT d.stage::text AS stage, d.value
    FROM public.deals d
    INNER JOIN public.companies c ON c.id = d.company_id
    WHERE c.tenant_id = v_tenant_id
      AND (
        (v_economic_group_id IS NOT NULL AND c.economic_group_id = v_economic_group_id)
        OR
        (v_economic_group_id IS NULL AND c.cnpj_root = v_cnpj_root)
      )
  ),
  stage_counts AS (
    SELECT gd.stage, COUNT(*)::bigint AS stage_total
    FROM group_deals gd
    GROUP BY gd.stage
  )
  SELECT
    COUNT(*)::bigint AS total_deals,
    COALESCE(SUM(gd.value), 0)::numeric AS total_value,
    COALESCE(
      (SELECT jsonb_object_agg(sc.stage, sc.stage_total) FROM stage_counts sc),
      '{}'::jsonb
    ) AS counts_by_stage
  FROM group_deals gd;
END;
$$;