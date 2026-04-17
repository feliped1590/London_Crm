-- Reconciliar PED-2026-0059: ERP aceitou (código 21830) mas grava local falhou
-- Destravar temporariamente para gravar os campos de ERP
UPDATE orders
SET is_locked = false
WHERE id = '8d936548-a4b0-4fa3-b78f-fa5cec0c3ca8';

UPDATE orders
SET erp_order_id = 21830,
    erp_order_code = '21830',
    erp_sync_status = 'success',
    erp_synced_at = '2026-04-17T21:54:44.072Z'::timestamptz,
    erp_last_sync_at = '2026-04-17T21:54:44.072Z'::timestamptz,
    is_locked = true
WHERE id = '8d936548-a4b0-4fa3-b78f-fa5cec0c3ca8';

-- Marcar a fila como concluída
UPDATE order_sync_queue
SET status = 'completed',
    processed_at = now(),
    error_message = null,
    updated_at = now()
WHERE order_id = '8d936548-a4b0-4fa3-b78f-fa5cec0c3ca8'
  AND status IN ('pending', 'processing', 'failed');