
ALTER TABLE public.products_dedup_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dedup backups"
ON public.products_dedup_backup
FOR SELECT
TO authenticated
USING (true);
