-- 1. BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars','avatars',true),
  ('produtos','produtos',true),
  ('crm','crm',false),
  ('pedidos','pedidos',false),
  ('propostas','propostas',false),
  ('contratos','contratos',false),
  ('documentos','documentos',false)
ON CONFLICT (id) DO NOTHING;

-- 2. TABELA
CREATE TABLE IF NOT EXISTS public.file_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  bucket        text NOT NULL,
  object_path   text NOT NULL,
  original_name text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL,
  module        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  is_public     boolean NOT NULL DEFAULT false,
  uploaded_by   uuid NOT NULL DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT file_attachments_bucket_path_unique UNIQUE (bucket, object_path),
  CONSTRAINT file_attachments_module_chk CHECK (module IN
    ('crm','pedidos','produtos','propostas','contratos','avatars','documentos')),
  CONSTRAINT file_attachments_size_chk CHECK (size_bytes > 0 AND size_bytes <= 52428800),
  CONSTRAINT file_attachments_name_chk CHECK (char_length(original_name) <= 255)
);

CREATE INDEX IF NOT EXISTS idx_file_attachments_entity
  ON public.file_attachments (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded_by
  ON public.file_attachments (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_attachments_module
  ON public.file_attachments (module);

CREATE OR REPLACE FUNCTION public.set_file_attachments_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_file_attachments_updated_at ON public.file_attachments;
CREATE TRIGGER trg_file_attachments_updated_at
BEFORE UPDATE ON public.file_attachments
FOR EACH ROW EXECUTE FUNCTION public.set_file_attachments_updated_at();

-- 3. VALIDAÇÃO MIME
CREATE OR REPLACE FUNCTION public.validate_file_attachment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE allowed text[];
BEGIN
  allowed := CASE NEW.module
    WHEN 'avatars'  THEN ARRAY['image/png','image/jpeg','image/webp']
    WHEN 'produtos' THEN ARRAY['image/png','image/jpeg','image/webp','application/pdf']
    ELSE ARRAY[
      'application/pdf','image/png','image/jpeg','image/webp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','text/csv','application/zip'
    ]
  END;
  IF NOT (NEW.mime_type = ANY(allowed)) THEN
    RAISE EXCEPTION 'Tipo de arquivo "%" não permitido para o módulo "%"',
      NEW.mime_type, NEW.module USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_file_attachment ON public.file_attachments;
CREATE TRIGGER trg_validate_file_attachment
BEFORE INSERT OR UPDATE ON public.file_attachments
FOR EACH ROW EXECUTE FUNCTION public.validate_file_attachment();

-- 4. WRAPPERS ESCALARES
CREATE OR REPLACE FUNCTION public.is_user_tenant(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.get_user_tenant_ids(auth.uid()) t WHERE t = _tenant_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_mutate_attachment(
  _tenant_id uuid, _entity_type text, _entity_id uuid, _uploaded_by uuid
)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  owner_uid uuid;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF public.has_role(uid,'admin'::app_role) OR public.has_role(uid,'desenvolvedor'::app_role) THEN
    RETURN true;
  END IF;
  IF NOT public.is_user_tenant(_tenant_id) THEN RETURN false; END IF;
  IF _uploaded_by = uid THEN RETURN true; END IF;

  BEGIN
    CASE _entity_type
      WHEN 'company' THEN
        SELECT COALESCE(sales_rep_id, owner_id) INTO owner_uid
          FROM public.companies WHERE id = _entity_id;
      WHEN 'order' THEN
        SELECT COALESCE(sales_rep_id, owner_id) INTO owner_uid
          FROM public.orders WHERE id = _entity_id;
      WHEN 'proposal' THEN
        SELECT COALESCE(sales_rep_id, owner_id) INTO owner_uid
          FROM public.proposals WHERE id = _entity_id;
      WHEN 'product' THEN owner_uid := uid;
      WHEN 'user'    THEN owner_uid := _entity_id;
      ELSE owner_uid := NULL;
    END CASE;
  EXCEPTION WHEN undefined_table THEN owner_uid := NULL;
  END;

  RETURN owner_uid = uid;
END;
$$;

-- 5. RLS file_attachments
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_attachments_select" ON public.file_attachments;
CREATE POLICY "file_attachments_select" ON public.file_attachments
  FOR SELECT TO authenticated
  USING (public.is_user_tenant(tenant_id));

DROP POLICY IF EXISTS "file_attachments_insert" ON public.file_attachments;
CREATE POLICY "file_attachments_insert" ON public.file_attachments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_user_tenant(tenant_id) AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "file_attachments_update" ON public.file_attachments;
CREATE POLICY "file_attachments_update" ON public.file_attachments
  FOR UPDATE TO authenticated
  USING (public.can_mutate_attachment(tenant_id, entity_type, entity_id, uploaded_by))
  WITH CHECK (public.can_mutate_attachment(tenant_id, entity_type, entity_id, uploaded_by));

DROP POLICY IF EXISTS "file_attachments_delete" ON public.file_attachments;
CREATE POLICY "file_attachments_delete" ON public.file_attachments
  FOR DELETE TO authenticated
  USING (public.can_mutate_attachment(tenant_id, entity_type, entity_id, uploaded_by));

-- 6. RLS storage.objects (path = {tenant_id}/{entity_type}/{entity_id}/{uuid}-{name})
DROP POLICY IF EXISTS "public_buckets_select" ON storage.objects;
CREATE POLICY "public_buckets_select" ON storage.objects
  FOR SELECT
  USING (bucket_id IN ('avatars','produtos'));

DROP POLICY IF EXISTS "public_buckets_insert" ON storage.objects;
CREATE POLICY "public_buckets_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('avatars','produtos')
    AND public.is_user_tenant(split_part(name,'/',1)::uuid)
  );

DROP POLICY IF EXISTS "public_buckets_update" ON storage.objects;
CREATE POLICY "public_buckets_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('avatars','produtos')
    AND public.is_user_tenant(split_part(name,'/',1)::uuid)
  );

DROP POLICY IF EXISTS "public_buckets_delete" ON storage.objects;
CREATE POLICY "public_buckets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('avatars','produtos')
    AND public.is_user_tenant(split_part(name,'/',1)::uuid)
    AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'desenvolvedor'::app_role)
      OR owner = auth.uid()
    )
  );

DROP POLICY IF EXISTS "private_buckets_select" ON storage.objects;
CREATE POLICY "private_buckets_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('crm','pedidos','propostas','contratos','documentos')
    AND public.is_user_tenant(split_part(name,'/',1)::uuid)
  );

DROP POLICY IF EXISTS "private_buckets_insert" ON storage.objects;
CREATE POLICY "private_buckets_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('crm','pedidos','propostas','contratos','documentos')
    AND public.is_user_tenant(split_part(name,'/',1)::uuid)
  );

DROP POLICY IF EXISTS "private_buckets_update" ON storage.objects;
CREATE POLICY "private_buckets_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('crm','pedidos','propostas','contratos','documentos')
    AND public.is_user_tenant(split_part(name,'/',1)::uuid)
    AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'desenvolvedor'::app_role)
      OR owner = auth.uid()
    )
  );

DROP POLICY IF EXISTS "private_buckets_delete" ON storage.objects;
CREATE POLICY "private_buckets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('crm','pedidos','propostas','contratos','documentos')
    AND public.is_user_tenant(split_part(name,'/',1)::uuid)
    AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'desenvolvedor'::app_role)
      OR owner = auth.uid()
    )
  );