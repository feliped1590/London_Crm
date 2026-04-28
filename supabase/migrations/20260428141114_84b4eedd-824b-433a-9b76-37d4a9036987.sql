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
    'waiting_propagation'::text,
    'permanent_failure'::text
  ]));

CREATE INDEX IF NOT EXISTS idx_order_sync_queue_permanent_failure
  ON public.order_sync_queue (tenant_id, updated_at DESC)
  WHERE status = 'permanent_failure';