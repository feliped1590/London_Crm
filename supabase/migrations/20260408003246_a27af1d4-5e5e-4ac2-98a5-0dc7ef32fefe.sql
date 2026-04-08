
-- 1. Função para gerar pedido_terceiro
CREATE OR REPLACE FUNCTION public.generate_pedido_terceiro(order_number TEXT)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(order_number, '[^0-9]', '', 'g'), '')::BIGINT;
$$;

-- 2. Novos campos na tabela orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pedido_terceiro BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS erp_order_id BIGINT,
  ADD COLUMN IF NOT EXISTS erp_sync_status TEXT NOT NULL DEFAULT 'none'
    CHECK (erp_sync_status IN ('none','pending','processing','success','error')),
  ADD COLUMN IF NOT EXISTS erp_last_sync_at TIMESTAMPTZ;

-- Índice para consulta rápida
CREATE INDEX IF NOT EXISTS idx_orders_erp_sync_status ON public.orders(erp_sync_status) WHERE erp_sync_status IN ('pending','processing','error');

-- 3. Tabela order_sync_queue
CREATE TABLE IF NOT EXISTS public.order_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  pedido_terceiro BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','error','failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  error_message TEXT,
  next_retry_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_sync_queue_status ON public.order_sync_queue(status) WHERE status IN ('pending','processing');

ALTER TABLE public.order_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view own tenant queue"
  ON public.order_sync_queue FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT t.id FROM tenants t INNER JOIN user_tenants ut ON ut.tenant_id = t.id WHERE ut.user_id = auth.uid()));

-- 4. Tabela order_sync_log
CREATE TABLE IF NOT EXISTS public.order_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  queue_item_id UUID REFERENCES public.order_sync_queue(id),
  pedido_terceiro BIGINT,
  direction TEXT NOT NULL DEFAULT 'crm_to_erp',
  status TEXT NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_sync_log_order ON public.order_sync_log(order_id);

ALTER TABLE public.order_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view own tenant logs"
  ON public.order_sync_log FOR SELECT TO authenticated
  USING (order_id IN (SELECT o.id FROM orders o INNER JOIN user_tenants ut ON ut.tenant_id = o.tenant_id WHERE ut.user_id = auth.uid()));

-- 5. Trigger: enfileirar pedido quando status muda para em_producao
CREATE OR REPLACE FUNCTION public.enqueue_order_for_erp_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_terceiro BIGINT;
BEGIN
  -- Só processa se status mudou para em_producao
  IF NEW.status = 'em_producao' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Gerar pedido_terceiro se não existir
    IF NEW.pedido_terceiro IS NULL THEN
      v_pedido_terceiro := generate_pedido_terceiro(NEW.number);
      NEW.pedido_terceiro := v_pedido_terceiro;
    ELSE
      v_pedido_terceiro := NEW.pedido_terceiro;
    END IF;

    -- Marcar como pending
    NEW.erp_sync_status := 'pending';

    -- Inserir/atualizar na fila (permite reprocessamento)
    INSERT INTO public.order_sync_queue (order_id, tenant_id, pedido_terceiro, status, attempt_count, error_message, updated_at)
    VALUES (NEW.id, NEW.tenant_id, v_pedido_terceiro, 'pending', 0, NULL, now())
    ON CONFLICT (order_id) DO UPDATE SET
      status = 'pending',
      pedido_terceiro = EXCLUDED.pedido_terceiro,
      attempt_count = 0,
      error_message = NULL,
      next_retry_at = NULL,
      processed_at = NULL,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enqueue_order_erp_sync
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_order_for_erp_sync();
