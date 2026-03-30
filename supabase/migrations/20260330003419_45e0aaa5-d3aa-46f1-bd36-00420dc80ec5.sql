
-- =============================================
-- STORAGE SECURITY: credit-documents bucket
-- Drop insecure policies and create ownership-based access
-- =============================================

-- 1. DROP all existing insecure policies
DROP POLICY IF EXISTS "Authenticated users can view credit docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload credit docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete credit docs" ON storage.objects;

-- 2. SELECT — Admin OR linked seller, with UUID + path validation
CREATE POLICY "credit_docs_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'credit-documents'
  AND array_length(storage.foldername(name), 1) >= 1
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      JOIN public.user_sales_reps usr ON usr.sales_rep_id = c.sales_rep_id
      WHERE usr.user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  )
);

-- 3. INSERT — Admin OR linked seller, with UUID + path validation
CREATE POLICY "credit_docs_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'credit-documents'
  AND array_length(storage.foldername(name), 1) >= 1
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      JOIN public.user_sales_reps usr ON usr.sales_rep_id = c.sales_rep_id
      WHERE usr.user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  )
);

-- 4. DELETE — Admin only
CREATE POLICY "credit_docs_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'credit-documents'
  AND array_length(storage.foldername(name), 1) >= 1
  AND public.has_role(auth.uid(), 'admin')
);
