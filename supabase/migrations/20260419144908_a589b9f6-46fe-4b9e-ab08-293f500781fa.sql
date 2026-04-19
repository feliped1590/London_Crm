
-- =========================================================
-- FASE 1: Estrutura para Sincronização Pipeline ↔ Pedidos
-- =========================================================

-- 1. Adicionar deal_id em orders (nullable, retrocompatível)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_deal_id ON public.orders(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_deal_id_status ON public.orders(deal_id, status) WHERE deal_id IS NOT NULL;

-- 2. Flag em pipelines (default false = comportamento atual preservado)
ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS controls_order_status boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pipelines.controls_order_status IS
  'Quando true, mudancas de etapa do deal sincronizam status de pedidos vinculados via mapping';

-- 3. Tabela única de transições válidas (fonte única para frontend + backend)
CREATE TABLE IF NOT EXISTS public.order_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_type text NOT NULL CHECK (order_type IN ('producao', 'pronta_entrega')),
  from_status order_status NOT NULL,
  to_status order_status NOT NULL,
  allowed_roles app_role[] NOT NULL DEFAULT ARRAY['admin']::app_role[],
  requires_ownership boolean NOT NULL DEFAULT false,
  label text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_type, from_status, to_status)
);

ALTER TABLE public.order_status_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read transitions"
  ON public.order_status_transitions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins can manage transitions"
  ON public.order_status_transitions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE TRIGGER trg_order_status_transitions_updated_at
  BEFORE UPDATE ON public.order_status_transitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: regras atuais do useOrderApproval
INSERT INTO public.order_status_transitions (order_type, from_status, to_status, allowed_roles, requires_ownership, label, description) VALUES
  ('producao', 'pendente', 'em_producao', ARRAY['admin','vendedor']::app_role[], true, 'Liberar para Producao', 'Autoriza o pedido para iniciar producao'),
  ('producao', 'em_producao', 'produzido', ARRAY['admin']::app_role[], false, 'Marcar como Produzido', 'Confirma que o pedido foi produzido'),
  ('producao', 'produzido', 'faturado', ARRAY['admin']::app_role[], false, 'Faturar Pedido', 'Registra o faturamento do pedido'),
  ('producao', 'faturado', 'entregue', ARRAY['admin']::app_role[], false, 'Confirmar Entrega', 'Confirma a entrega ao cliente'),
  ('pronta_entrega', 'pendente', 'em_faturamento', ARRAY['admin','vendedor']::app_role[], true, 'Liberar para Faturamento', 'Autoriza o pedido para faturamento direto'),
  ('pronta_entrega', 'em_faturamento', 'faturado', ARRAY['admin']::app_role[], false, 'Faturar Pedido', 'Registra o faturamento do pedido')
ON CONFLICT (order_type, from_status, to_status) DO NOTHING;

-- 4. Mapeamento etapa do pipeline -> status de pedido
CREATE TABLE IF NOT EXISTS public.pipeline_stage_order_status_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  target_order_status order_status NOT NULL,
  auto_apply boolean NOT NULL DEFAULT true,
  applies_to_order_type text CHECK (applies_to_order_type IN ('producao', 'pronta_entrega')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (pipeline_stage_id, applies_to_order_type)
);

CREATE INDEX IF NOT EXISTS idx_stage_order_map_stage ON public.pipeline_stage_order_status_map(pipeline_stage_id);

ALTER TABLE public.pipeline_stage_order_status_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read stage to status map"
  ON public.pipeline_stage_order_status_map FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins manage stage to status map"
  ON public.pipeline_stage_order_status_map FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE TRIGGER trg_stage_order_map_updated_at
  BEFORE UPDATE ON public.pipeline_stage_order_status_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Log de sucesso de sincronizacao
CREATE TABLE IF NOT EXISTS public.pipeline_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  pipeline_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  old_status order_status,
  new_status order_status NOT NULL,
  triggered_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_sync_log_order ON public.pipeline_sync_log(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_sync_log_deal ON public.pipeline_sync_log(deal_id, created_at DESC);

ALTER TABLE public.pipeline_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync logs of orders they access"
  ON public.pipeline_sync_log FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = pipeline_sync_log.order_id
        AND o.created_by = auth.uid()
    )
  );

CREATE POLICY "System inserts sync logs"
  ON public.pipeline_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 6. Log de skip
CREATE TABLE IF NOT EXISTS public.pipeline_sync_skip_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  pipeline_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  current_status order_status,
  attempted_status order_status,
  skip_reason text NOT NULL,
  details jsonb,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_skip_log_order ON public.pipeline_sync_skip_log(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_skip_log_reason ON public.pipeline_sync_skip_log(skip_reason);

ALTER TABLE public.pipeline_sync_skip_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view skip logs of orders they access"
  ON public.pipeline_sync_skip_log FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor')
    OR (order_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = pipeline_sync_skip_log.order_id
        AND o.created_by = auth.uid()
    ))
  );

CREATE POLICY "System inserts skip logs"
  ON public.pipeline_sync_skip_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 7. Backfill: vincular orders existentes ao deal via proposta
UPDATE public.orders o
SET deal_id = p.deal_id
FROM public.proposals p
WHERE o.proposal_id = p.id
  AND o.deal_id IS NULL
  AND p.deal_id IS NOT NULL;
