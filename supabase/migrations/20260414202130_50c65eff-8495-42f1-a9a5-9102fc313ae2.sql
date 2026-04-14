-- Index for batch queries on status
CREATE INDEX IF NOT EXISTS idx_company_sync_queue_status ON company_sync_queue(status);

-- RPC to bulk-enqueue all not_synced companies
CREATE OR REPLACE FUNCTION enqueue_bulk_company_sync()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enqueued_count integer;
BEGIN
  WITH inserted AS (
    INSERT INTO company_sync_queue (company_id, tenant_id, status, attempts, error_message, next_retry_at)
    SELECT id, tenant_id, 'pending', 0, null, null
    FROM companies
    WHERE active = true
      AND integration_status = 'not_synced'
    ON CONFLICT (company_id) DO UPDATE
    SET
      status = 'pending',
      attempts = 0,
      error_message = null,
      next_retry_at = null,
      updated_at = now()
    WHERE company_sync_queue.status IN ('error', 'done', 'failed', 'completed')
    RETURNING 1
  )
  SELECT count(*) INTO enqueued_count FROM inserted;

  RETURN json_build_object('enqueued', enqueued_count);
END;
$$;