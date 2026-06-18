
-- Reativa triggers de sync ERP após estabilização
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enqueue_order_erp_sync') THEN
    ALTER TABLE public.orders ENABLE TRIGGER trg_enqueue_order_erp_sync;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_sync_before') THEN
    ALTER TABLE public.products ENABLE TRIGGER trg_product_sync_before;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_sync_after') THEN
    ALTER TABLE public.products ENABLE TRIGGER trg_product_sync_after;
  END IF;
END $$;

-- Vincula PED-2026-0268 ao pedido 22382 criado manualmente no ERP e marca como sincronizado
UPDATE public.orders
SET erp_order_id   = '22382',
    erp_order_code = '22382',
    erp_sync_status = 'success',
    erp_synced_at  = now(),
    erp_last_sync_at = now()
WHERE number = 'PED-2026-0268';
