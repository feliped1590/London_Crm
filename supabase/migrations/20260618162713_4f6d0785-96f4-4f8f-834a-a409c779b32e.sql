WITH q AS (
  SELECT id FROM public.order_sync_queue
  WHERE order_id = (SELECT id FROM public.orders WHERE number = 'PED-2026-0268' LIMIT 1)
)
, del_log AS (
  DELETE FROM public.order_sync_log WHERE queue_item_id IN (SELECT id FROM q)
)
DELETE FROM public.order_sync_queue WHERE id IN (SELECT id FROM q);