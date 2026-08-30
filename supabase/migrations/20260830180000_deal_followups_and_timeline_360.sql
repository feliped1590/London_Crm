-- Follow-ups de cliente/negócio + Timeline 360° (paridade Qualyvac)

BEGIN;

CREATE TABLE IF NOT EXISTS public.followup_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_followup_groups_tenant_name_ci
  ON public.followup_groups (tenant_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_followup_groups_tenant_active_order
  ON public.followup_groups (tenant_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.followup_subgroups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.followup_groups(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  requires_description boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_followup_subgroups_group_name_ci
  ON public.followup_subgroups (group_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_followup_subgroups_tenant_group_active_order
  ON public.followup_subgroups (tenant_id, group_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.deal_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE RESTRICT,
  pipeline_id uuid,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  followup_group_id uuid NOT NULL REFERENCES public.followup_groups(id) ON DELETE RESTRICT,
  followup_subgroup_id uuid NOT NULL REFERENCES public.followup_subgroups(id) ON DELETE RESTRICT,
  channel text NOT NULL,
  description text,
  interaction_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_by uuid,
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text,
  CONSTRAINT deal_followups_channel_chk CHECK (
    channel = ANY (ARRAY['whatsapp','email','phone','in_person','video_conference','system','other']::text[])
  ),
  CONSTRAINT deal_followups_description_len_chk CHECK (
    description IS NULL OR char_length(description) <= 5000
  ),
  CONSTRAINT deal_followups_deletion_reason_chk CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL AND deletion_reason IS NULL)
    OR (
      deleted_at IS NOT NULL
      AND deleted_by IS NOT NULL
      AND deletion_reason IS NOT NULL
      AND char_length(btrim(deletion_reason)) > 0
    )
  )
);

CREATE INDEX IF NOT EXISTS deal_followups_deal_idx
  ON public.deal_followups (tenant_id, deal_id, interaction_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS deal_followups_company_idx
  ON public.deal_followups (tenant_id, company_id, interaction_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS deal_followups_group_idx
  ON public.deal_followups (tenant_id, followup_group_id, interaction_at DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.followup_groups_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.name := btrim(NEW.name);
  IF NEW.name IS NULL OR NEW.name = '' THEN
    RAISE EXCEPTION 'Nome do grupo de follow-up é obrigatório';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.followup_subgroups_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_group_tenant uuid;
BEGIN
  NEW.name := btrim(NEW.name);
  IF NEW.name IS NULL OR NEW.name = '' THEN
    RAISE EXCEPTION 'Nome do subgrupo de follow-up é obrigatório';
  END IF;

  SELECT tenant_id INTO v_group_tenant
  FROM public.followup_groups
  WHERE id = NEW.group_id;

  IF v_group_tenant IS NULL THEN
    RAISE EXCEPTION 'Grupo de follow-up inválido';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM v_group_tenant THEN
    RAISE EXCEPTION 'Subgrupo deve pertencer ao mesmo tenant do grupo';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.deal_followups_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  c record;
  v_sub_group uuid;
BEGIN
  IF NEW.deal_id IS NOT NULL THEN
    SELECT tenant_id, legal_entity_id, company_id, pipeline_id, pipeline_stage_id
      INTO d
    FROM public.deals
    WHERE id = NEW.deal_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Negócio não encontrado para follow-up';
    END IF;
    IF d.pipeline_stage_id IS NULL THEN
      RAISE EXCEPTION 'Negócio sem etapa de pipeline; não é possível registrar follow-up';
    END IF;

    NEW.tenant_id := COALESCE(NEW.tenant_id, d.tenant_id);
    NEW.legal_entity_id := COALESCE(NEW.legal_entity_id, d.legal_entity_id);
    NEW.company_id := COALESCE(NEW.company_id, d.company_id);
    NEW.pipeline_id := COALESCE(NEW.pipeline_id, d.pipeline_id);
    NEW.stage_id := COALESCE(NEW.stage_id, d.pipeline_stage_id);
  ELSE
    IF NEW.company_id IS NULL THEN
      RAISE EXCEPTION 'Cliente obrigatório no follow-up sem negócio';
    END IF;

    SELECT tenant_id, legal_entity_id
      INTO c
    FROM public.companies
    WHERE id = NEW.company_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente não encontrado para follow-up';
    END IF;

    NEW.tenant_id := COALESCE(NEW.tenant_id, c.tenant_id);
    NEW.legal_entity_id := COALESCE(NEW.legal_entity_id, c.legal_entity_id);
    NEW.pipeline_id := NULL;
    NEW.stage_id := NULL;
  END IF;

  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  NEW.interaction_at := COALESCE(NEW.interaction_at, now());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := now();

  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'created_by obrigatório no follow-up';
  END IF;

  SELECT group_id INTO v_sub_group
  FROM public.followup_subgroups
  WHERE id = NEW.followup_subgroup_id AND is_active = true;

  IF v_sub_group IS NULL THEN
    RAISE EXCEPTION 'Subgrupo de follow-up inválido ou inativo';
  END IF;
  IF NEW.followup_group_id IS DISTINCT FROM v_sub_group THEN
    RAISE EXCEPTION 'Subgrupo não pertence ao grupo informado';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.deal_followups_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deal_id IS DISTINCT FROM OLD.deal_id THEN
    RAISE EXCEPTION 'Não é permitido alterar o negócio do follow-up';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id THEN
    RAISE EXCEPTION 'Campos estruturais do follow-up são imutáveis';
  END IF;

  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.deleted_by := COALESCE(NEW.deleted_by, auth.uid());
    NEW.deletion_reason := btrim(COALESCE(NEW.deletion_reason, ''));
  END IF;

  IF (
    NEW.description IS DISTINCT FROM OLD.description
    OR NEW.channel IS DISTINCT FROM OLD.channel
    OR NEW.followup_group_id IS DISTINCT FROM OLD.followup_group_id
    OR NEW.followup_subgroup_id IS DISTINCT FROM OLD.followup_subgroup_id
    OR NEW.interaction_at IS DISTINCT FROM OLD.interaction_at
    OR NEW.stage_id IS DISTINCT FROM OLD.stage_id
  ) AND NEW.deleted_at IS NULL THEN
    NEW.edited_by := COALESCE(auth.uid(), NEW.edited_by);
    NEW.edited_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_followup_groups_updated_at ON public.followup_groups;
CREATE TRIGGER trg_followup_groups_updated_at
  BEFORE UPDATE ON public.followup_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_followup_groups_validate ON public.followup_groups;
CREATE TRIGGER trg_followup_groups_validate
  BEFORE UPDATE ON public.followup_groups
  FOR EACH ROW EXECUTE FUNCTION public.followup_groups_validate();

DROP TRIGGER IF EXISTS trg_followup_subgroups_updated_at ON public.followup_subgroups;
CREATE TRIGGER trg_followup_subgroups_updated_at
  BEFORE UPDATE ON public.followup_subgroups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_followup_subgroups_validate ON public.followup_subgroups;
CREATE TRIGGER trg_followup_subgroups_validate
  BEFORE INSERT OR UPDATE ON public.followup_subgroups
  FOR EACH ROW EXECUTE FUNCTION public.followup_subgroups_validate();

DROP TRIGGER IF EXISTS trg_deal_followups_before_insert ON public.deal_followups;
CREATE TRIGGER trg_deal_followups_before_insert
  BEFORE INSERT ON public.deal_followups
  FOR EACH ROW EXECUTE FUNCTION public.deal_followups_before_insert();

DROP TRIGGER IF EXISTS trg_deal_followups_before_update ON public.deal_followups;
CREATE TRIGGER trg_deal_followups_before_update
  BEFORE UPDATE ON public.deal_followups
  FOR EACH ROW EXECUTE FUNCTION public.deal_followups_before_update();

ALTER TABLE public.followup_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_subgroups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS followup_groups_select ON public.followup_groups;
CREATE POLICY followup_groups_select ON public.followup_groups
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

DROP POLICY IF EXISTS followup_groups_insert ON public.followup_groups;
CREATE POLICY followup_groups_insert ON public.followup_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND created_by = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  );

DROP POLICY IF EXISTS followup_groups_update ON public.followup_groups;
CREATE POLICY followup_groups_update ON public.followup_groups
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  );

DROP POLICY IF EXISTS followup_groups_delete ON public.followup_groups;
CREATE POLICY followup_groups_delete ON public.followup_groups
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_role(auth.uid(), 'desenvolvedor')
  );

DROP POLICY IF EXISTS followup_subgroups_select ON public.followup_subgroups;
CREATE POLICY followup_subgroups_select ON public.followup_subgroups
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

DROP POLICY IF EXISTS followup_subgroups_insert ON public.followup_subgroups;
CREATE POLICY followup_subgroups_insert ON public.followup_subgroups
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND created_by = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  );

DROP POLICY IF EXISTS followup_subgroups_update ON public.followup_subgroups;
CREATE POLICY followup_subgroups_update ON public.followup_subgroups
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  );

DROP POLICY IF EXISTS followup_subgroups_delete ON public.followup_subgroups;
CREATE POLICY followup_subgroups_delete ON public.followup_subgroups
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_role(auth.uid(), 'desenvolvedor')
  );

DROP POLICY IF EXISTS deal_followups_select ON public.deal_followups;
CREATE POLICY deal_followups_select ON public.deal_followups
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor') OR deleted_at IS NULL)
    AND (
      (
        deal_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.deals d
          WHERE d.id = deal_followups.deal_id
            AND (
              public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'desenvolvedor')
              OR d.created_by = auth.uid()
              OR d.id IN (SELECT deal_id FROM public.deal_participants WHERE user_id = auth.uid())
              OR public.can_manage_portfolio(auth.uid(), public.get_company_owner(d.company_id), 'deal')
            )
        )
      )
      OR (
        deal_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.companies c
          WHERE c.id = deal_followups.company_id
            AND c.tenant_id = deal_followups.tenant_id
            AND (
              public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'desenvolvedor')
              OR c.created_by = auth.uid()
              OR public.can_manage_portfolio(auth.uid(), c.sales_rep_id, 'company')
            )
        )
      )
    )
  );

DROP POLICY IF EXISTS deal_followups_insert ON public.deal_followups;
CREATE POLICY deal_followups_insert ON public.deal_followups
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (legal_entity_id IS NULL OR public.can_access_legal_entity(auth.uid(), legal_entity_id))
    AND (
      (
        deal_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.deals d
          WHERE d.id = deal_followups.deal_id
            AND d.tenant_id = deal_followups.tenant_id
            AND (
              public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'desenvolvedor')
              OR d.created_by = auth.uid()
              OR d.id IN (SELECT deal_id FROM public.deal_participants WHERE user_id = auth.uid())
              OR public.can_manage_portfolio(auth.uid(), public.get_company_owner(d.company_id), 'deal')
            )
        )
      )
      OR (
        deal_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.companies c
          WHERE c.id = deal_followups.company_id
            AND c.tenant_id = deal_followups.tenant_id
            AND (
              public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'desenvolvedor')
              OR c.created_by = auth.uid()
              OR public.can_manage_portfolio(auth.uid(), c.sales_rep_id, 'company')
            )
        )
      )
    )
  );

DROP POLICY IF EXISTS deal_followups_update ON public.deal_followups;
CREATE POLICY deal_followups_update ON public.deal_followups
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'desenvolvedor')
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_subgroups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_followups TO authenticated;
GRANT ALL ON public.followup_groups TO service_role;
GRANT ALL ON public.followup_subgroups TO service_role;
GRANT ALL ON public.deal_followups TO service_role;

INSERT INTO public.followup_groups (tenant_id, name, icon, color, sort_order, created_by)
SELECT
  t.id,
  g.name,
  g.icon,
  g.color,
  g.sort_order,
  COALESCE(
    (SELECT ut.user_id FROM public.user_tenants ut WHERE ut.tenant_id = t.id LIMIT 1),
    (SELECT p.user_id FROM public.profiles p LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  )
FROM public.tenants t
CROSS JOIN (VALUES
  ('Financeiro', 'DollarSign', '#0EA5E9', 10),
  ('Orçamento', 'FileText', '#8B5CF6', 20),
  ('Comercial', 'Handshake', '#22C55E', 30),
  ('Cadastro', 'UserCheck', '#F59E0B', 40),
  ('Pedido', 'Package', '#EF4444', 50)
) AS g(name, icon, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.followup_groups existing
  WHERE existing.tenant_id = t.id AND lower(existing.name) = lower(g.name)
);

INSERT INTO public.followup_subgroups (tenant_id, group_id, name, sort_order, created_by)
SELECT
  g.tenant_id,
  g.id,
  s.name,
  s.sort_order,
  g.created_by
FROM public.followup_groups g
JOIN (VALUES
  ('Financeiro', 'Registro de Carta de IPI', 10),
  ('Financeiro', 'Análise de crédito solicitada', 20),
  ('Financeiro', 'Crédito aprovado', 30),
  ('Financeiro', 'Crédito recusado', 40),
  ('Financeiro', 'Pendência financeira identificada', 50),
  ('Financeiro', 'Documentação financeira solicitada', 60),
  ('Financeiro', 'Documentação financeira recebida', 70),
  ('Orçamento', 'Orçamento em elaboração', 10),
  ('Orçamento', 'Orçamento enviado', 20),
  ('Orçamento', 'Alteração de orçamento solicitada', 30),
  ('Orçamento', 'Orçamento revisado', 40),
  ('Orçamento', 'Aguardando retorno do cliente', 50),
  ('Orçamento', 'Orçamento aprovado', 60),
  ('Orçamento', 'Orçamento recusado', 70),
  ('Comercial', 'Primeiro contato realizado', 10),
  ('Comercial', 'Reunião realizada', 20),
  ('Comercial', 'Visita realizada', 30),
  ('Comercial', 'Necessidade identificada', 40),
  ('Comercial', 'Negociação iniciada', 50),
  ('Comercial', 'Condições comerciais discutidas', 60),
  ('Comercial', 'Cliente sem interesse', 70),
  ('Comercial', 'Retorno solicitado', 80),
  ('Cadastro', 'Dados cadastrais solicitados', 10),
  ('Cadastro', 'Documentos recebidos', 20),
  ('Cadastro', 'Cadastro em análise', 30),
  ('Cadastro', 'Cadastro concluído', 40),
  ('Cadastro', 'Pendência cadastral identificada', 50),
  ('Pedido', 'Pedido solicitado pelo cliente', 10),
  ('Pedido', 'Dados do pedido confirmados', 20),
  ('Pedido', 'Pedido aguardando liberação', 30),
  ('Pedido', 'Pedido liberado', 40),
  ('Pedido', 'Alteração do pedido solicitada', 50)
) AS s(group_name, name, sort_order) ON g.name = s.group_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.followup_subgroups existing
  WHERE existing.group_id = g.id AND lower(existing.name) = lower(s.name)
);

CREATE TABLE IF NOT EXISTS public.customer_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (length(btrim(event_type)) > 0),
  event_source text NOT NULL CHECK (length(btrim(event_source)) > 0),
  source_id uuid NOT NULL,
  source_event_key text NOT NULL,
  title text NOT NULL,
  description text,
  user_id uuid,
  legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_source, source_event_key)
);

CREATE INDEX IF NOT EXISTS idx_customer_timeline_customer_time
  ON public.customer_timeline_events(customer_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_customer_timeline_tenant_customer
  ON public.customer_timeline_events(tenant_id, customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_timeline_event_type
  ON public.customer_timeline_events(event_type);

DROP TRIGGER IF EXISTS update_customer_timeline_events_updated_at ON public.customer_timeline_events;
CREATE TRIGGER update_customer_timeline_events_updated_at
  BEFORE UPDATE ON public.customer_timeline_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.customer_timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_timeline_select ON public.customer_timeline_events;
CREATE POLICY customer_timeline_select ON public.customer_timeline_events
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (legal_entity_id IS NULL OR public.can_access_legal_entity(auth.uid(), legal_entity_id))
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = customer_id
        AND c.tenant_id = customer_timeline_events.tenant_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'desenvolvedor')
          OR c.created_by = auth.uid()
          OR public.can_manage_portfolio(auth.uid(), c.sales_rep_id, 'company')
          OR public.can_manage_portfolio(auth.uid(), c.sales_rep_id, 'deal')
          OR public.can_manage_portfolio(auth.uid(), c.sales_rep_id, 'order')
        )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.customer_timeline_events FROM authenticated;
GRANT SELECT ON public.customer_timeline_events TO authenticated;
GRANT ALL ON public.customer_timeline_events TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_customer_timeline_event(
  p_tenant_id uuid, p_customer_id uuid, p_event_type text, p_event_source text,
  p_source_id uuid, p_source_event_key text, p_title text, p_description text,
  p_user_id uuid, p_legal_entity_id uuid, p_metadata jsonb, p_occurred_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_tenant_id IS NULL OR p_customer_id IS NULL OR p_source_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.customer_timeline_events (
    tenant_id, customer_id, event_type, event_source, source_id, source_event_key,
    title, description, user_id, legal_entity_id, metadata, occurred_at
  ) VALUES (
    p_tenant_id, p_customer_id, p_event_type, p_event_source, p_source_id, p_source_event_key,
    p_title, p_description, p_user_id, p_legal_entity_id, COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(p_occurred_at, now())
  )
  ON CONFLICT (event_source, source_event_key) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    user_id = COALESCE(EXCLUDED.user_id, customer_timeline_events.user_id),
    legal_entity_id = COALESCE(EXCLUDED.legal_entity_id, customer_timeline_events.legal_entity_id),
    metadata = EXCLUDED.metadata,
    occurred_at = EXCLUDED.occurred_at,
    updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_customer_timeline_event(uuid,uuid,text,text,uuid,text,text,text,uuid,uuid,jsonb,timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.timeline_capture_deal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := COALESCE(auth.uid(), NEW.created_by, NEW.owner_id);
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id, NEW.company_id, 'pipeline.deal_created', 'deal', NEW.id,
      'deal:' || NEW.id || ':created', 'Negócio criado', NEW.name, v_actor, NEW.legal_entity_id,
      jsonb_build_object('deal_id',NEW.id,'deal_name',NEW.name,'stage',NEW.stage,'value',NEW.value), NEW.created_at);
    RETURN NEW;
  END IF;
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id, NEW.company_id, 'pipeline.owner_changed', 'deal', NEW.id,
      'deal:' || NEW.id || ':owner:' || extract(epoch FROM clock_timestamp()),
      'Responsável do negócio alterado', NEW.name, v_actor, NEW.legal_entity_id,
      jsonb_build_object('deal_id',NEW.id,'deal_name',NEW.name,'from_owner_id',OLD.owner_id,'to_owner_id',NEW.owner_id), NEW.updated_at);
  END IF;
  IF OLD.stage IS DISTINCT FROM NEW.stage AND NEW.stage = 'fechado_ganho' THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id, NEW.company_id, 'pipeline.won', 'deal', NEW.id,
      'deal:' || NEW.id || ':won', 'Negócio ganho', NEW.name, v_actor, NEW.legal_entity_id,
      jsonb_build_object('deal_id',NEW.id,'deal_name',NEW.name,'from_stage',OLD.stage,'to_stage',NEW.stage,'value',NEW.value), COALESCE(NEW.closed_at,NEW.updated_at));
  ELSIF OLD.stage IS DISTINCT FROM NEW.stage AND NEW.stage = 'fechado_perdido' THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id, NEW.company_id, 'pipeline.lost', 'deal', NEW.id,
      'deal:' || NEW.id || ':lost', 'Negócio perdido', COALESCE(NEW.lost_reason,NEW.name), v_actor, NEW.legal_entity_id,
      jsonb_build_object('deal_id',NEW.id,'deal_name',NEW.name,'from_stage',OLD.stage,'to_stage',NEW.stage,'lost_reason',NEW.lost_reason), COALESCE(NEW.closed_at,NEW.updated_at));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS timeline_capture_deal ON public.deals;
CREATE TRIGGER timeline_capture_deal AFTER INSERT OR UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.timeline_capture_deal();

CREATE OR REPLACE FUNCTION public.timeline_capture_deal_stage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record;
BEGIN
  SELECT company_id,tenant_id,name,legal_entity_id INTO d FROM public.deals WHERE id=NEW.deal_id;
  IF d.company_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.upsert_customer_timeline_event(
    d.tenant_id,d.company_id,'pipeline.stage_changed','deal_stage_history',NEW.id,
    'deal-stage:' || NEW.id,'Etapa do negócio alterada',
    COALESCE(d.name,'Negócio') || ': ' || COALESCE(NEW.from_stage,'início') || ' -> ' || NEW.to_stage,
    COALESCE(NEW.changed_by,auth.uid()),d.legal_entity_id,
    jsonb_build_object('deal_id',NEW.deal_id,'deal_name',d.name,'from_stage',NEW.from_stage,'to_stage',NEW.to_stage,'duration_seconds',NEW.duration_seconds),NEW.changed_at);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS timeline_capture_deal_stage ON public.deal_stage_history;
CREATE TRIGGER timeline_capture_deal_stage AFTER INSERT OR UPDATE ON public.deal_stage_history
  FOR EACH ROW EXECUTE FUNCTION public.timeline_capture_deal_stage();

CREATE OR REPLACE FUNCTION public.timeline_capture_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := COALESCE(auth.uid(),NEW.created_by);
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id,NEW.company_id,'order.created','order',NEW.id,'order:'||NEW.id||':created',
      'Pedido criado','Pedido '||NEW.number,v_actor,NEW.legal_entity_id,
      jsonb_build_object('order_id',NEW.id,'number',NEW.number,'status',NEW.status,'total_value',NEW.total_value,'deal_id',NEW.deal_id),NEW.created_at);
    RETURN NEW;
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id,NEW.company_id,'order.status_changed','order',NEW.id,
      'order:'||NEW.id||':status:'||extract(epoch FROM clock_timestamp()),'Status do pedido alterado',
      'Pedido '||NEW.number||': '||OLD.status||' -> '||NEW.status,v_actor,NEW.legal_entity_id,
      jsonb_build_object('order_id',NEW.id,'number',NEW.number,'from_status',OLD.status,'to_status',NEW.status,'total_value',NEW.total_value),NEW.updated_at);
  END IF;
  IF (OLD.erp_synced_at IS DISTINCT FROM NEW.erp_synced_at AND NEW.erp_synced_at IS NOT NULL)
     OR (OLD.erp_last_sync_at IS DISTINCT FROM NEW.erp_last_sync_at AND NEW.erp_last_sync_at IS NOT NULL) THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id,NEW.company_id,'order.erp_synced','order',NEW.id,
      'order:'||NEW.id||':erp:'||COALESCE(NEW.erp_synced_at,NEW.erp_last_sync_at)::text,
      'Pedido sincronizado com ERP','Pedido '||NEW.number,v_actor,NEW.legal_entity_id,
      jsonb_build_object('order_id',NEW.id,'number',NEW.number,'erp_order_id',NEW.erp_order_id,'erp_status',NEW.erp_status,'erp_sync_status',NEW.erp_sync_status),
      COALESCE(NEW.erp_synced_at,NEW.erp_last_sync_at,NEW.updated_at));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS timeline_capture_order ON public.orders;
CREATE TRIGGER timeline_capture_order AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.timeline_capture_order();

CREATE OR REPLACE FUNCTION public.timeline_capture_task() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := COALESCE(auth.uid(),NEW.assigned_to,NEW.created_by);
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id,NEW.company_id,'followup.created','task',NEW.id,'task:'||NEW.id||':created',
      'Follow-up criado',NEW.title,v_actor,NULL,
      jsonb_build_object('task_id',NEW.id,'deal_id',NEW.deal_id,'status',NEW.status,'priority',NEW.priority,'due_date',NEW.due_date),NEW.created_at);
    RETURN NEW;
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status::text='concluida' THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id,NEW.company_id,'followup.completed','task',NEW.id,'task:'||NEW.id||':completed',
      'Follow-up concluído',NEW.title,v_actor,NULL,
      jsonb_build_object('task_id',NEW.id,'deal_id',NEW.deal_id,'from_status',OLD.status,'to_status',NEW.status),COALESCE(NEW.completed_at,NEW.updated_at));
  END IF;
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id,NEW.company_id,'followup.rescheduled','task',NEW.id,
      'task:'||NEW.id||':rescheduled:'||extract(epoch FROM clock_timestamp()),'Follow-up reagendado',NEW.title,v_actor,NULL,
      jsonb_build_object('task_id',NEW.id,'deal_id',NEW.deal_id,'from_due_date',OLD.due_date,'to_due_date',NEW.due_date),NEW.updated_at);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS timeline_capture_task ON public.tasks;
CREATE TRIGGER timeline_capture_task AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.timeline_capture_task();

CREATE OR REPLACE FUNCTION public.timeline_capture_followup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id,NEW.company_id,'followup.completed','deal_followup',NEW.id,'deal-followup:'||NEW.id||':completed',
      'Interação registrada',NEW.description,COALESCE(NEW.created_by,auth.uid()),NEW.legal_entity_id,
      jsonb_build_object('followup_id',NEW.id,'deal_id',NEW.deal_id,'channel',NEW.channel,'group_id',NEW.followup_group_id,'subgroup_id',NEW.followup_subgroup_id),NEW.interaction_at);
    RETURN NEW;
  END IF;
  IF OLD.interaction_at IS DISTINCT FROM NEW.interaction_at THEN
    PERFORM public.upsert_customer_timeline_event(
      NEW.tenant_id,NEW.company_id,'followup.rescheduled','deal_followup',NEW.id,
      'deal-followup:'||NEW.id||':rescheduled:'||extract(epoch FROM clock_timestamp()),'Follow-up reagendado',NEW.description,
      COALESCE(NEW.edited_by,auth.uid(),NEW.created_by),NEW.legal_entity_id,
      jsonb_build_object('followup_id',NEW.id,'deal_id',NEW.deal_id,'channel',NEW.channel,'from_interaction_at',OLD.interaction_at,'to_interaction_at',NEW.interaction_at),COALESCE(NEW.edited_at,NEW.updated_at));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS timeline_capture_followup ON public.deal_followups;
CREATE TRIGGER timeline_capture_followup AFTER INSERT OR UPDATE ON public.deal_followups
  FOR EACH ROW EXECUTE FUNCTION public.timeline_capture_followup();

CREATE OR REPLACE FUNCTION public.timeline_capture_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.upsert_customer_timeline_event(
    NEW.tenant_id,NEW.company_id,
    CASE WHEN NEW.type IN ('email','call','meeting','whatsapp') THEN 'communication.'||NEW.type ELSE 'system.activity_recorded' END,
    'activity',NEW.id,'activity:'||NEW.id,
    COALESCE(NULLIF(NEW.subject,''),'Atividade registrada'),NEW.content,COALESCE(NEW.created_by,auth.uid()),NULL,
    jsonb_build_object('activity_id',NEW.id,'activity_type',NEW.type,'deal_id',NEW.deal_id,'contact_id',NEW.contact_id),NEW.created_at);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS timeline_capture_activity ON public.activities;
CREATE TRIGGER timeline_capture_activity AFTER INSERT OR UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.timeline_capture_activity();

INSERT INTO public.customer_timeline_events
  (tenant_id,customer_id,event_type,event_source,source_id,source_event_key,title,description,user_id,legal_entity_id,metadata,occurred_at)
SELECT d.tenant_id,d.company_id,'pipeline.deal_created','deal',d.id,'deal:'||d.id||':created','Negócio criado',d.name,
  COALESCE(d.created_by,d.owner_id),d.legal_entity_id,jsonb_build_object('deal_id',d.id,'deal_name',d.name,'stage',d.stage,'value',d.value),d.created_at
FROM public.deals d WHERE d.company_id IS NOT NULL ON CONFLICT DO NOTHING;

INSERT INTO public.customer_timeline_events
  (tenant_id,customer_id,event_type,event_source,source_id,source_event_key,title,description,user_id,legal_entity_id,metadata,occurred_at)
SELECT d.tenant_id,d.company_id,'pipeline.stage_changed','deal_stage_history',h.id,'deal-stage:'||h.id,'Etapa do negócio alterada',
  d.name||': '||COALESCE(h.from_stage,'início')||' -> '||h.to_stage,h.changed_by,d.legal_entity_id,
  jsonb_build_object('deal_id',d.id,'deal_name',d.name,'from_stage',h.from_stage,'to_stage',h.to_stage,'duration_seconds',h.duration_seconds),h.changed_at
FROM public.deal_stage_history h JOIN public.deals d ON d.id=h.deal_id WHERE d.company_id IS NOT NULL ON CONFLICT DO NOTHING;

INSERT INTO public.customer_timeline_events
  (tenant_id,customer_id,event_type,event_source,source_id,source_event_key,title,description,user_id,legal_entity_id,metadata,occurred_at)
SELECT d.tenant_id,d.company_id,CASE d.stage WHEN 'fechado_ganho' THEN 'pipeline.won' ELSE 'pipeline.lost' END,'deal',d.id,
  'deal:'||d.id||CASE d.stage WHEN 'fechado_ganho' THEN ':won' ELSE ':lost' END,
  CASE d.stage WHEN 'fechado_ganho' THEN 'Negócio ganho' ELSE 'Negócio perdido' END,COALESCE(d.lost_reason,d.name),
  COALESCE(d.created_by,d.owner_id),d.legal_entity_id,jsonb_build_object('deal_id',d.id,'deal_name',d.name,'stage',d.stage,'value',d.value),
  COALESCE(d.closed_at,d.updated_at)
FROM public.deals d WHERE d.company_id IS NOT NULL AND d.stage IN ('fechado_ganho','fechado_perdido') ON CONFLICT DO NOTHING;

INSERT INTO public.customer_timeline_events
  (tenant_id,customer_id,event_type,event_source,source_id,source_event_key,title,description,user_id,legal_entity_id,metadata,occurred_at)
SELECT o.tenant_id,o.company_id,'order.created','order',o.id,'order:'||o.id||':created','Pedido criado','Pedido '||o.number,o.created_by,o.legal_entity_id,
  jsonb_build_object('order_id',o.id,'number',o.number,'status',o.status,'total_value',o.total_value,'deal_id',o.deal_id),o.created_at
FROM public.orders o WHERE o.company_id IS NOT NULL ON CONFLICT DO NOTHING;

INSERT INTO public.customer_timeline_events
  (tenant_id,customer_id,event_type,event_source,source_id,source_event_key,title,description,user_id,legal_entity_id,metadata,occurred_at)
SELECT o.tenant_id,o.company_id,'order.erp_synced','order',o.id,'order:'||o.id||':erp:'||COALESCE(o.erp_synced_at,o.erp_last_sync_at)::text,
  'Pedido sincronizado com ERP','Pedido '||o.number,o.created_by,o.legal_entity_id,
  jsonb_build_object('order_id',o.id,'number',o.number,'erp_order_id',o.erp_order_id,'erp_status',o.erp_status,'erp_sync_status',o.erp_sync_status),
  COALESCE(o.erp_synced_at,o.erp_last_sync_at)
FROM public.orders o WHERE o.company_id IS NOT NULL AND COALESCE(o.erp_synced_at,o.erp_last_sync_at) IS NOT NULL ON CONFLICT DO NOTHING;

INSERT INTO public.customer_timeline_events
  (tenant_id,customer_id,event_type,event_source,source_id,source_event_key,title,description,user_id,legal_entity_id,metadata,occurred_at)
SELECT t.tenant_id,t.company_id,'followup.created','task',t.id,'task:'||t.id||':created','Follow-up criado',t.title,
  COALESCE(t.assigned_to,t.created_by),NULL,jsonb_build_object('task_id',t.id,'deal_id',t.deal_id,'status',t.status,'priority',t.priority,'due_date',t.due_date),t.created_at
FROM public.tasks t WHERE t.company_id IS NOT NULL ON CONFLICT DO NOTHING;

INSERT INTO public.customer_timeline_events
  (tenant_id,customer_id,event_type,event_source,source_id,source_event_key,title,description,user_id,legal_entity_id,metadata,occurred_at)
SELECT t.tenant_id,t.company_id,'followup.completed','task',t.id,'task:'||t.id||':completed','Follow-up concluído',t.title,
  COALESCE(t.assigned_to,t.created_by),NULL,jsonb_build_object('task_id',t.id,'deal_id',t.deal_id,'status',t.status),COALESCE(t.completed_at,t.updated_at)
FROM public.tasks t WHERE t.company_id IS NOT NULL AND t.status::text='concluida' ON CONFLICT DO NOTHING;

INSERT INTO public.customer_timeline_events
  (tenant_id,customer_id,event_type,event_source,source_id,source_event_key,title,description,user_id,legal_entity_id,metadata,occurred_at)
SELECT a.tenant_id,a.company_id,
  CASE WHEN a.type IN ('email','call','meeting','whatsapp') THEN 'communication.'||a.type ELSE 'system.activity_recorded' END,
  'activity',a.id,'activity:'||a.id,COALESCE(NULLIF(a.subject,''),'Atividade registrada'),a.content,a.created_by,NULL,
  jsonb_build_object('activity_id',a.id,'activity_type',a.type,'deal_id',a.deal_id,'contact_id',a.contact_id),a.created_at
FROM public.activities a WHERE a.company_id IS NOT NULL ON CONFLICT DO NOTHING;

COMMIT;
