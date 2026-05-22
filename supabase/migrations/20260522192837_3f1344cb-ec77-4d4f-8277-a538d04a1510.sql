
CREATE POLICY "Tenant users can view product sync queue"
ON public.product_sync_queue
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_sync_queue.product_id
      AND p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Tenant users can enqueue product sync"
ON public.product_sync_queue
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_sync_queue.product_id
      AND p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Tenant users can update product sync queue"
ON public.product_sync_queue
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_sync_queue.product_id
      AND p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_sync_queue.product_id
      AND p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);
