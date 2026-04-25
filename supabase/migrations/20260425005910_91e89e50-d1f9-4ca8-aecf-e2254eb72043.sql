-- Fix ambiguous storage object path reference and align legal-entity admin checks

DROP POLICY IF EXISTS "credit_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "credit_docs_select" ON storage.objects;

CREATE POLICY "credit_docs_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'credit-documents'
  AND array_length(storage.foldername(objects.name), 1) >= 1
  AND (storage.foldername(objects.name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      JOIN public.user_sales_reps usr ON usr.sales_rep_id = c.sales_rep_id
      WHERE usr.user_id = auth.uid()
        AND c.id::text = (storage.foldername(objects.name))[1]
    )
  )
);

CREATE POLICY "credit_docs_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'credit-documents'
  AND array_length(storage.foldername(objects.name), 1) >= 1
  AND (storage.foldername(objects.name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      JOIN public.user_sales_reps usr ON usr.sales_rep_id = c.sales_rep_id
      WHERE usr.user_id = auth.uid()
        AND c.id::text = (storage.foldername(objects.name))[1]
    )
  )
);

CREATE OR REPLACE FUNCTION public.can_access_legal_entity(p_user_id uuid, p_legal_entity_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  has_restrictions BOOLEAN;
BEGIN
  IF p_legal_entity_id IS NULL THEN
    RETURN TRUE;
  END IF;

  IF public.has_role(p_user_id, 'admin'::public.app_role)
     OR public.has_role(p_user_id, 'desenvolvedor'::public.app_role) THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_legal_entities
    WHERE user_id = p_user_id
  ) INTO has_restrictions;

  IF NOT has_restrictions THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_legal_entities
    WHERE user_id = p_user_id
    AND legal_entity_id = p_legal_entity_id
  );
END;
$function$;