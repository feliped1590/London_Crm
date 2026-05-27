CREATE INDEX IF NOT EXISTS idx_orders_contact_id ON public.orders(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_contact_id ON public.proposals(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON public.tasks(contact_id) WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_created ON public.orders(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_tenant_status_created ON public.proposals(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status_due ON public.tasks(assigned_to, status, due_date);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage ON public.deals(pipeline_id, pipeline_stage_id);

CREATE INDEX IF NOT EXISTS idx_product_sync_queue_pending
  ON public.product_sync_queue(next_retry_at NULLS FIRST, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_order_sync_queue_pending
  ON public.order_sync_queue(next_retry_at NULLS FIRST, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_company_sync_queue_pending
  ON public.company_sync_queue(next_retry_at NULLS FIRST, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_attribute_sync_queue_pending
  ON public.attribute_sync_queue(next_retry_at NULLS FIRST, created_at)
  WHERE status = 'pending';

DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname IN (
      'process-product-sync-dispatcher',
      'process-order-sync-dispatcher',
      'process-company-sync-dispatcher',
      'process-attribute-sync-dispatcher'
    )
  LOOP
    PERFORM cron.alter_job(j.jobid, schedule := '*/2 * * * *');
  END LOOP;
END $$;