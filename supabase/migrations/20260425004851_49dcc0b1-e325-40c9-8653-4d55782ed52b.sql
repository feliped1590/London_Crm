DROP POLICY IF EXISTS "Authenticated users can upload legal entity logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update legal entity logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete legal entity logos" ON storage.objects;

CREATE POLICY "Scoped users can upload legal entity logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'legal-entity-logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.legal_entities le
      JOIN public.user_tenants ut ON ut.tenant_id = le.tenant_id
      WHERE le.id::text = (storage.foldername(name))[1]
        AND ut.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Scoped users can update legal entity logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'legal-entity-logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.legal_entities le
      JOIN public.user_tenants ut ON ut.tenant_id = le.tenant_id
      WHERE le.id::text = (storage.foldername(name))[1]
        AND ut.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'legal-entity-logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.legal_entities le
      JOIN public.user_tenants ut ON ut.tenant_id = le.tenant_id
      WHERE le.id::text = (storage.foldername(name))[1]
        AND ut.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Scoped users can delete legal entity logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'legal-entity-logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.legal_entities le
      JOIN public.user_tenants ut ON ut.tenant_id = le.tenant_id
      WHERE le.id::text = (storage.foldername(name))[1]
        AND ut.user_id = auth.uid()
    )
  )
);