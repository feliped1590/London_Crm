DO $$
BEGIN
  -- Evita que mudanças de status dos pedidos reenfileirem automaticamente enquanto a integração ERP está instável.
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_enqueue_order_erp_sync'
  ) THEN
    ALTER TABLE public.orders DISABLE TRIGGER trg_enqueue_order_erp_sync;
  END IF;
END $$;

DELETE FROM public.order_sync_log l
USING public.order_sync_queue q, public.orders o
WHERE l.queue_item_id = q.id
  AND q.order_id = o.id
  AND o.number = 'PED-2026-0268';

DELETE FROM public.order_sync_queue q
USING public.orders o
WHERE q.order_id = o.id
  AND o.number = 'PED-2026-0268'
  AND q.status IN ('pending','processing','waiting_propagation','failed','error','blocked_validation');