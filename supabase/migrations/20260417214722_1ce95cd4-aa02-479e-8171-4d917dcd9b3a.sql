-- Adicionar colunas de validação para pré-validação de pedidos (espelha company_sync_queue)
ALTER TABLE public.order_sync_queue
  ADD COLUMN IF NOT EXISTS validation_errors JSONB,
  ADD COLUMN IF NOT EXISTS validation_fields TEXT[];

-- Atualizar CHECK constraint para incluir novos status
ALTER TABLE public.order_sync_queue
  DROP CONSTRAINT IF EXISTS order_sync_queue_status_check;

ALTER TABLE public.order_sync_queue
  ADD CONSTRAINT order_sync_queue_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'processing'::text,
    'completed'::text,
    'error'::text,
    'failed'::text,
    'blocked_validation'::text,
    'waiting_propagation'::text
  ]));

-- Índice GIN para consultas por campo/erro
CREATE INDEX IF NOT EXISTS idx_order_sync_queue_validation_fields
  ON public.order_sync_queue USING GIN (validation_fields)
  WHERE validation_fields IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_sync_queue_validation_errors
  ON public.order_sync_queue USING GIN (validation_errors)
  WHERE validation_errors IS NOT NULL;

-- Índice para listar bloqueados rapidamente
CREATE INDEX IF NOT EXISTS idx_order_sync_queue_blocked
  ON public.order_sync_queue (tenant_id, updated_at DESC)
  WHERE status = 'blocked_validation';