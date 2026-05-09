
CREATE TABLE IF NOT EXISTS public.product_sync_queue_archive (LIKE public.product_sync_queue INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.order_sync_queue_archive   (LIKE public.order_sync_queue   INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.company_sync_queue_archive (LIKE public.company_sync_queue INCLUDING ALL);

ALTER TABLE public.product_sync_queue_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.order_sync_queue_archive   ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.company_sync_queue_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.product_sync_queue_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_sync_queue_archive   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_sync_queue_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read product sync archive"  ON public.product_sync_queue_archive;
DROP POLICY IF EXISTS "Admins read order sync archive"    ON public.order_sync_queue_archive;
DROP POLICY IF EXISTS "Admins read company sync archive"  ON public.company_sync_queue_archive;

CREATE POLICY "Admins read product sync archive"
  ON public.product_sync_queue_archive FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Admins read order sync archive"
  ON public.order_sync_queue_archive FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Admins read company sync archive"
  ON public.company_sync_queue_archive FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE INDEX IF NOT EXISTS idx_psq_status_updated  ON public.product_sync_queue (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_osq_status_updated  ON public.order_sync_queue   (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_csq_status_updated  ON public.company_sync_queue (status, updated_at);

CREATE OR REPLACE FUNCTION public.archive_old_sync_records(days_old INTEGER DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff TIMESTAMPTZ := now() - make_interval(days => days_old);
  p_moved INTEGER := 0;
  o_moved INTEGER := 0;
  c_moved INTEGER := 0;
BEGIN
  WITH moved AS (
    DELETE FROM public.product_sync_queue
    WHERE status IN ('completed','failed','permanent_failure')
      AND updated_at < cutoff
    RETURNING *
  )
  INSERT INTO public.product_sync_queue_archive SELECT *, now() FROM moved;
  GET DIAGNOSTICS p_moved = ROW_COUNT;

  WITH moved AS (
    DELETE FROM public.order_sync_queue
    WHERE status IN ('completed','failed','permanent_failure')
      AND updated_at < cutoff
    RETURNING *
  )
  INSERT INTO public.order_sync_queue_archive SELECT *, now() FROM moved;
  GET DIAGNOSTICS o_moved = ROW_COUNT;

  WITH moved AS (
    DELETE FROM public.company_sync_queue
    WHERE status IN ('completed','failed','permanent_failure')
      AND updated_at < cutoff
    RETURNING *
  )
  INSERT INTO public.company_sync_queue_archive SELECT *, now() FROM moved;
  GET DIAGNOSTICS c_moved = ROW_COUNT;

  RETURN jsonb_build_object(
    'cutoff', cutoff,
    'product_archived', p_moved,
    'order_archived',   o_moved,
    'company_archived', c_moved
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_old_sync_records(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_old_sync_records(INTEGER) TO service_role;
