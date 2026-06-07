
CREATE TABLE IF NOT EXISTS public.lost_reason_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  code text NOT NULL,
  label text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('deal','proposal','both')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
GRANT SELECT ON public.lost_reason_categories TO authenticated;
GRANT ALL ON public.lost_reason_categories TO service_role;
ALTER TABLE public.lost_reason_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lost_reason_read" ON public.lost_reason_categories FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "lost_reason_write" ON public.lost_reason_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_lost_reason_updated ON public.lost_reason_categories;
CREATE TRIGGER trg_lost_reason_updated BEFORE UPDATE ON public.lost_reason_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.lost_reason_categories (code, label, scope, sort_order) VALUES
  ('sem_contato','Sem contato','deal',10),
  ('sem_retorno','Sem retorno','both',20),
  ('cliente_desistiu','Cliente desistiu','both',30),
  ('dados_invalidos','Dados inválidos','deal',40),
  ('concorrencia','Comprou da concorrência','both',50),
  ('preco','Preço','proposal',60),
  ('prazo','Prazo','proposal',70),
  ('produto_indisponivel','Produto indisponível','proposal',80),
  ('outros','Outros','both',999)
ON CONFLICT DO NOTHING;

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_reason_id uuid REFERENCES public.lost_reason_categories(id);
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS lost_reason_id uuid REFERENCES public.lost_reason_categories(id);
CREATE INDEX IF NOT EXISTS idx_deals_lost_reason_id ON public.deals(lost_reason_id) WHERE lost_reason_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_lost_reason_id ON public.proposals(lost_reason_id) WHERE lost_reason_id IS NOT NULL;

-- HISTÓRICO DE ETAPAS
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev timestamptz;
  v_dur integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.deal_stage_history (deal_id, from_stage, to_stage, changed_by, changed_at, duration_seconds)
    VALUES (NEW.id, NULL, NEW.stage, NEW.created_by, COALESCE(NEW.created_at, now()), NULL);
    RETURN NEW;
  END IF;
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    SELECT MAX(changed_at) INTO v_prev FROM public.deal_stage_history WHERE deal_id = NEW.id;
    v_dur := CASE WHEN v_prev IS NOT NULL THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - v_prev))::int) ELSE NULL END;
    INSERT INTO public.deal_stage_history (deal_id, from_stage, to_stage, changed_by, changed_at, duration_seconds)
    VALUES (NEW.id, OLD.stage, NEW.stage, COALESCE(auth.uid(), NEW.owner_id), now(), v_dur);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_deal_stage_change ON public.deals;
CREATE TRIGGER trg_log_deal_stage_change
  AFTER INSERT OR UPDATE OF stage ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change();

INSERT INTO public.deal_stage_history (deal_id, from_stage, to_stage, changed_by, changed_at, duration_seconds)
SELECT d.id, NULL, d.stage, d.owner_id, COALESCE(d.updated_at, d.created_at, now()), NULL
FROM public.deals d
LEFT JOIN public.deal_stage_history h ON h.deal_id = d.id
WHERE h.id IS NULL;

CREATE INDEX IF NOT EXISTS idx_dsh_deal_changed ON public.deal_stage_history(deal_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_dsh_changed_at ON public.deal_stage_history(changed_at);

-- METAS ESTENDIDAS
ALTER TABLE public.sales_goals
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'user' CHECK (scope IN ('user','team','legal_entity','company')),
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid,
  ADD COLUMN IF NOT EXISTS team_id uuid,
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

ALTER TABLE public.sales_goals DROP CONSTRAINT IF EXISTS sales_goals_single_target_chk;
ALTER TABLE public.sales_goals ADD CONSTRAINT sales_goals_single_target_chk CHECK (
  (CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END
 + CASE WHEN team_id IS NOT NULL THEN 1 ELSE 0 END
 + CASE WHEN legal_entity_id IS NOT NULL THEN 1 ELSE 0 END) >= 1
);
CREATE INDEX IF NOT EXISTS idx_sales_goals_scope_period ON public.sales_goals(tenant_id, scope, period_start, period_end);

-- LEAD SOURCES
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  code text NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
GRANT SELECT ON public.lead_sources TO authenticated;
GRANT ALL ON public.lead_sources TO service_role;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_sources_read" ON public.lead_sources FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "lead_sources_write" ON public.lead_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role));

DROP TRIGGER IF EXISTS trg_lead_sources_updated ON public.lead_sources;
CREATE TRIGGER trg_lead_sources_updated BEFORE UPDATE ON public.lead_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.lead_sources (code, label, sort_order) VALUES
  ('indicacao','Indicação',10),('site','Site',20),('whatsapp','WhatsApp',30),
  ('telefone','Telefone',40),('email','E-mail',50),('evento','Evento / Feira',60),
  ('redes_sociais','Redes Sociais',70),('prospeccao_ativa','Prospecção Ativa',80),
  ('outros','Outros',999)
ON CONFLICT DO NOTHING;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS lead_source_id uuid REFERENCES public.lead_sources(id),
  ADD COLUMN IF NOT EXISTS lead_source text;

CREATE INDEX IF NOT EXISTS idx_deals_lead_source_id ON public.deals(lead_source_id) WHERE lead_source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_tenant_created ON public.deals(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_stage_created ON public.deals(tenant_id, stage, created_at);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_owner_stage ON public.deals(tenant_id, owner_id, stage);
