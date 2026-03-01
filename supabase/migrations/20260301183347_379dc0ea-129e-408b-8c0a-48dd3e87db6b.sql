
-- 1. Remover da fila de sync
DELETE FROM public.product_sync_queue 
WHERE product_id IN (SELECT id FROM public.products WHERE tipo_id = '087646db-8ec4-4922-b294-80b782532eaf');

-- 2. Remover produtos do tipo COT
DELETE FROM public.products 
WHERE tipo_id = '087646db-8ec4-4922-b294-80b782532eaf';

-- 3. Remover o tipo COT
DELETE FROM public.product_types 
WHERE id = '087646db-8ec4-4922-b294-80b782532eaf';
