
CREATE TABLE IF NOT EXISTS public.lifecycle_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  active_days integer NOT NULL DEFAULT 180 CHECK (active_days > 0),
  inactive_days integer NOT NULL DEFAULT 365 CHECK (inactive_days > 0),
  lead_to_prospect_trigger text NOT NULL DEFAULT 'deal_open'
    CHECK (lead_to_prospect_trigger IN ('deal_open','proposal_sent','first_activity','manual')),
  prospect_to_customer_trigger text NOT NULL DEFAULT 'order_created'
    CHECK (prospect_to_customer_trigger IN ('order_created','order_approved','order_invoiced')),
  lost_releases_portfolio boolean NOT NULL DEFAULT true,
  lost_release_requires_confirmation boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (inactive_days > active_days)
);

GRANT SELECT, UPDATE ON public.lifecycle_config TO authenticated;
GRANT ALL ON public.lifecycle_config TO service_role;

ALTER TABLE public.lifecycle_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lifecycle_config_select_tenant" ON public.lifecycle_config
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "lifecycle_config_update_admin" ON public.lifecycle_config
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'desenvolvedor'::app_role))
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'desenvolvedor'::app_role))
  );

CREATE OR REPLACE FUNCTION public.update_lifecycle_config_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_lifecycle_config_updated_at
  BEFORE UPDATE ON public.lifecycle_config
  FOR EACH ROW EXECUTE FUNCTION public.update_lifecycle_config_updated_at();

INSERT INTO public.lifecycle_config (tenant_id)
SELECT DISTINCT tenant_id FROM public.companies
ON CONFLICT (tenant_id) DO NOTHING;

-- =====================================================
CREATE TABLE IF NOT EXISTS public.portfolio_release_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  previous_sales_rep_id uuid REFERENCES public.sales_reps(id),
  status text NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN ('pending_confirmation','released','kept')),
  flagged_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_prq_pending_unique
  ON public.portfolio_release_queue(company_id)
  WHERE status = 'pending_confirmation';
CREATE INDEX idx_portfolio_release_queue_status ON public.portfolio_release_queue(tenant_id, status);
CREATE INDEX idx_portfolio_release_queue_company ON public.portfolio_release_queue(company_id);

GRANT SELECT, INSERT, UPDATE ON public.portfolio_release_queue TO authenticated;
GRANT ALL ON public.portfolio_release_queue TO service_role;

ALTER TABLE public.portfolio_release_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prq_select_tenant" ON public.portfolio_release_queue
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "prq_update_admin" ON public.portfolio_release_queue
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'desenvolvedor'::app_role))
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'desenvolvedor'::app_role))
  );

CREATE POLICY "prq_insert_admin" ON public.portfolio_release_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'desenvolvedor'::app_role))
  );

CREATE TRIGGER trg_prq_updated_at
  BEFORE UPDATE ON public.portfolio_release_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_lifecycle_config_updated_at();

-- =====================================================
CREATE OR REPLACE FUNCTION public.recompute_company_lifecycle(p_company_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_updated integer := 0;
  v_active_days integer;
  v_inactive_days integer;
BEGIN
  SELECT active_days, inactive_days INTO v_active_days, v_inactive_days
  FROM public.lifecycle_config ORDER BY created_at ASC LIMIT 1;
  v_active_days := COALESCE(v_active_days, 180);
  v_inactive_days := COALESCE(v_inactive_days, 365);

  WITH source AS (
    SELECT c.id,
      CASE
        WHEN c.lifecycle_stage <> 'customer_active' THEN NULL::activity_status
        ELSE (
          CASE
            WHEN COALESCE(s.last_interaction_at, c.created_at) >= now() - make_interval(days => v_active_days)
              THEN 'ativo'::activity_status
            WHEN COALESCE(s.last_interaction_at, c.created_at) >= now() - make_interval(days => v_inactive_days)
              THEN 'inativo'::activity_status
            ELSE 'perdido'::activity_status
          END
        )
      END AS new_status,
      COALESCE(s.last_interaction_at, c.created_at) AS last_int
    FROM companies c
    LEFT JOIN company_activity_summary s ON s.company_id = c.id
    WHERE p_company_id IS NULL OR c.id = p_company_id
  ),
  upd AS (
    UPDATE companies c
    SET activity_status = src.new_status,
        last_interaction_at = src.last_int,
        activity_status_updated_at = now()
    FROM source src
    WHERE c.id = src.id
      AND (c.activity_status IS DISTINCT FROM src.new_status
           OR c.last_interaction_at IS DISTINCT FROM src.last_int)
    RETURNING c.id
  )
  SELECT COUNT(*) INTO v_updated FROM upd;
  RETURN v_updated;
END;
$function$;

-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_promote_lead_to_prospect()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_trigger text;
  v_pipeline_type text;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  SELECT lead_to_prospect_trigger INTO v_trigger
  FROM public.lifecycle_config ORDER BY created_at ASC LIMIT 1;
  IF COALESCE(v_trigger, 'deal_open') <> 'deal_open' THEN RETURN NEW; END IF;

  SELECT p.pipeline_type INTO v_pipeline_type
  FROM public.pipelines p
  JOIN public.pipeline_stages ps ON ps.pipeline_id = p.id
  WHERE ps.id = NEW.stage_id LIMIT 1;

  IF v_pipeline_type IS NOT NULL AND v_pipeline_type NOT IN ('sales','commercial') THEN
    RETURN NEW;
  END IF;

  UPDATE public.companies
  SET lifecycle_stage = 'prospect'::lifecycle_stage,
      activity_status_updated_at = now()
  WHERE id = NEW.company_id
    AND lifecycle_stage = 'lead'::lifecycle_stage;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_promote_lead_to_prospect_on_deal ON public.deals;
CREATE TRIGGER trg_promote_lead_to_prospect_on_deal
  AFTER INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.trg_promote_lead_to_prospect();

-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_promote_to_customer_on_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_trigger text;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  SELECT prospect_to_customer_trigger INTO v_trigger
  FROM public.lifecycle_config ORDER BY created_at ASC LIMIT 1;
  IF COALESCE(v_trigger, 'order_created') <> 'order_created' THEN RETURN NEW; END IF;

  UPDATE public.companies
  SET lifecycle_stage = 'customer_active'::lifecycle_stage,
      activity_status = 'ativo'::activity_status,
      activity_status_updated_at = now(),
      last_interaction_at = now()
  WHERE id = NEW.company_id
    AND lifecycle_stage <> 'customer_active'::lifecycle_stage;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_promote_to_customer_on_order ON public.orders;
CREATE TRIGGER trg_promote_to_customer_on_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_promote_to_customer_on_order();

-- =====================================================
CREATE OR REPLACE FUNCTION public.flag_lost_customers_for_release()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_lost_releases boolean;
  v_requires_conf boolean;
BEGIN
  SELECT lost_releases_portfolio, lost_release_requires_confirmation
    INTO v_lost_releases, v_requires_conf
  FROM public.lifecycle_config ORDER BY created_at ASC LIMIT 1;

  IF NOT COALESCE(v_lost_releases, true) THEN RETURN 0; END IF;

  IF COALESCE(v_requires_conf, true) THEN
    WITH ins AS (
      INSERT INTO public.portfolio_release_queue (tenant_id, company_id, previous_sales_rep_id, status)
      SELECT c.tenant_id, c.id, c.sales_rep_id, 'pending_confirmation'
      FROM public.companies c
      WHERE c.activity_status = 'perdido'::activity_status
        AND c.sales_rep_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.portfolio_release_queue q
          WHERE q.company_id = c.id AND q.status = 'pending_confirmation'
        )
      RETURNING 1
    )
    SELECT count(*) INTO v_count FROM ins;
  ELSE
    WITH upd AS (
      UPDATE public.companies c
      SET sales_rep_id = NULL, owner_id = NULL
      WHERE c.activity_status = 'perdido'::activity_status
        AND c.sales_rep_id IS NOT NULL
      RETURNING c.id
    )
    SELECT count(*) INTO v_count FROM upd;
  END IF;
  RETURN v_count;
END;
$function$;
