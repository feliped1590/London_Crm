-- Further harden realtime, storage and internal audit-like tables

ALTER PUBLICATION supabase_realtime DROP TABLE public.app_sessions;

DROP POLICY IF EXISTS "Users can access scoped realtime topics" ON realtime.messages;
CREATE POLICY "Users can access scoped realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  topic = ('session-guard-' || auth.uid()::text)
  OR topic = ('user-' || auth.uid()::text)
  OR topic = ('user:' || auth.uid()::text)
);

DROP POLICY IF EXISTS "credit_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "credit_docs_select" ON storage.objects;

CREATE POLICY "credit_docs_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'credit-documents'
  AND array_length(storage.foldername(name), 1) >= 1
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      JOIN public.user_sales_reps usr ON usr.sales_rep_id = c.sales_rep_id
      WHERE usr.user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "credit_docs_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'credit-documents'
  AND array_length(storage.foldername(name), 1) >= 1
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      JOIN public.user_sales_reps usr ON usr.sales_rep_id = c.sales_rep_id
      WHERE usr.user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can read sequence logs" ON public.erp_sequence_logs;
DROP POLICY IF EXISTS "Authenticated users can read sequences" ON public.erp_sequences;
DROP POLICY IF EXISTS "Authenticated users can view dedup backups" ON public.products_dedup_backup;
DROP POLICY IF EXISTS "Admins and developers can read sequence logs" ON public.erp_sequence_logs;
DROP POLICY IF EXISTS "Admins and developers can read sequences" ON public.erp_sequences;
DROP POLICY IF EXISTS "Admins and developers can view dedup backups" ON public.products_dedup_backup;

CREATE POLICY "Admins and developers can read sequence logs"
ON public.erp_sequence_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
);

CREATE POLICY "Admins and developers can read sequences"
ON public.erp_sequences
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
);

CREATE POLICY "Admins and developers can view dedup backups"
ON public.products_dedup_backup
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
);