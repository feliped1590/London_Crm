ALTER TABLE public.order_approval_requests
  ADD CONSTRAINT order_approval_requests_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_approval_requests
  ADD CONSTRAINT order_approval_requests_order_item_id_fkey
    FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_approval_requests_order ON public.order_approval_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_order_approval_requests_status ON public.order_approval_requests(status);

-- Marca entradas da fila como permanent_failure quando há aprovação pendente,
-- impedindo retentativa automática até a aprovação acontecer.
UPDATE public.order_sync_queue q
SET status = 'permanent_failure',
    error_message = COALESCE(error_message, '') || ' [aguardando aprovação de governança]',
    next_retry_at = NULL,
    updated_at = now()
WHERE q.status IN ('pending','blocked_validation','processing','error','failed')
  AND EXISTS (
    SELECT 1 FROM public.order_approval_requests r
    WHERE r.order_id = q.order_id AND r.status = 'pending'
  );
