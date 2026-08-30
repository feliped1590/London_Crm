-- Workspace 360: context triggers, access helpers, RLS.
-- Security definer helpers live in public because existing CRM helpers already do;
-- they always check auth.uid() and tenant membership first.

BEGIN;

CREATE OR REPLACE FUNCTION public.workspace_company_context(_company_id uuid)
RETURNS TABLE (tenant_id uuid, legal_entity_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.tenant_id, c.legal_entity_id
  FROM public.companies c
  WHERE c.id = _company_id
    AND auth.uid() IS NOT NULL
    AND c.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.user_can_operate_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = p_company_id
      AND auth.uid() IS NOT NULL
      AND c.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
        OR c.owner_id = auth.uid()
        OR c.created_by = auth.uid()
        OR public.can_manage_portfolio(auth.uid(), c.sales_rep_id, 'company')
        OR EXISTS (
          SELECT 1
          FROM public.deals d
          JOIN public.deal_participants dp ON dp.deal_id = d.id
          WHERE d.company_id = c.id
            AND dp.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.service_engagement_members sem
          JOIN public.service_engagements se ON se.id = sem.engagement_id
          WHERE se.company_id = c.id
            AND sem.user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = p_company_id
      AND auth.uid() IS NOT NULL
      AND c.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
        OR c.owner_id = auth.uid()
        OR c.created_by = auth.uid()
        OR public.can_manage_portfolio(auth.uid(), c.sales_rep_id, 'company')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_deal_participant(p_deal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_deal_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.deal_participants dp
    WHERE dp.deal_id = p_deal_id AND dp.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_customer_document(
  p_company_id uuid,
  p_deal_id uuid,
  p_service_engagement_id uuid,
  p_responsible_user_id uuid,
  p_created_by uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_can_manage_company(p_company_id)
    OR p_responsible_user_id = auth.uid()
    OR p_created_by = auth.uid()
    OR public.user_is_deal_participant(p_deal_id)
    OR (
      p_service_engagement_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.service_engagement_members sem
        WHERE sem.engagement_id = p_service_engagement_id AND sem.user_id = auth.uid()
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_client_contract(
  p_company_id uuid,
  p_responsible_user_id uuid,
  p_created_by uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_can_manage_company(p_company_id)
    OR p_responsible_user_id = auth.uid()
    OR p_created_by = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_service_engagement(
  p_company_id uuid,
  p_deal_id uuid,
  p_engagement_id uuid,
  p_responsible_user_id uuid,
  p_created_by uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_can_manage_company(p_company_id)
    OR p_responsible_user_id = auth.uid()
    OR p_created_by = auth.uid()
    OR public.user_is_deal_participant(p_deal_id)
    OR EXISTS (
      SELECT 1 FROM public.service_engagement_members sem
      WHERE sem.engagement_id = p_engagement_id AND sem.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.workspace_fill_customer_document_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_legal uuid;
  v_type_tenant uuid;
  v_deal_company uuid;
  v_eng_company uuid;
  v_eng_tenant uuid;
  v_contact_company uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  SELECT tenant_id, legal_entity_id INTO v_tenant, v_legal FROM public.companies WHERE id = NEW.company_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
  NEW.tenant_id := v_tenant;
  IF NEW.legal_entity_id IS NULL THEN
    NEW.legal_entity_id := v_legal;
  ELSIF NEW.legal_entity_id IS DISTINCT FROM v_legal THEN
    IF NOT EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = NEW.legal_entity_id AND le.tenant_id = v_tenant) THEN
      RAISE EXCEPTION 'legal_entity_id não pertence ao tenant do cliente';
    END IF;
  END IF;

  SELECT tenant_id INTO v_type_tenant FROM public.document_types WHERE id = NEW.document_type_id;
  IF v_type_tenant IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'Tipo de documento de outro tenant';
  END IF;
  IF NEW.deal_id IS NOT NULL THEN
    SELECT company_id INTO v_deal_company FROM public.deals WHERE id = NEW.deal_id;
    IF v_deal_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Processo não pertence a este cliente';
    END IF;
  END IF;
  IF NEW.service_engagement_id IS NOT NULL THEN
    SELECT company_id, tenant_id INTO v_eng_company, v_eng_tenant FROM public.service_engagements WHERE id = NEW.service_engagement_id;
    IF v_eng_company IS DISTINCT FROM NEW.company_id OR v_eng_tenant IS DISTINCT FROM v_tenant THEN
      RAISE EXCEPTION 'Serviço não pertence a este cliente';
    END IF;
  END IF;
  IF NEW.customer_contact_id IS NOT NULL THEN
    SELECT company_id INTO v_contact_company FROM public.contacts WHERE id = NEW.customer_contact_id;
    IF v_contact_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Contato não pertence a este cliente';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN NEW.created_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN NEW.created_by := OLD.created_by;
  END IF;
  IF NEW.created_by IS NULL THEN RAISE EXCEPTION 'created_by é obrigatório'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_fill_client_contract_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_legal uuid;
  v_contact_company uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  SELECT tenant_id, legal_entity_id INTO v_tenant, v_legal FROM public.companies WHERE id = NEW.company_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
  NEW.tenant_id := v_tenant;
  IF NEW.legal_entity_id IS NULL THEN
    NEW.legal_entity_id := v_legal;
  ELSIF NEW.legal_entity_id IS DISTINCT FROM v_legal THEN
    IF NOT EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = NEW.legal_entity_id AND le.tenant_id = v_tenant) THEN
      RAISE EXCEPTION 'legal_entity_id não pertence ao tenant do cliente';
    END IF;
  END IF;
  IF NEW.customer_contact_id IS NOT NULL THEN
    SELECT company_id INTO v_contact_company FROM public.contacts WHERE id = NEW.customer_contact_id;
    IF v_contact_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Contato não pertence a este cliente';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN NEW.created_by := OLD.created_by;
  END IF;
  IF NEW.created_by IS NULL THEN RAISE EXCEPTION 'created_by é obrigatório'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_fill_service_engagement_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_legal uuid;
  v_deal_company uuid;
  v_contact_company uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  SELECT tenant_id, legal_entity_id INTO v_tenant, v_legal FROM public.companies WHERE id = NEW.company_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
  NEW.tenant_id := v_tenant;
  IF NEW.legal_entity_id IS NULL THEN
    NEW.legal_entity_id := v_legal;
  ELSIF NEW.legal_entity_id IS DISTINCT FROM v_legal THEN
    IF NOT EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = NEW.legal_entity_id AND le.tenant_id = v_tenant) THEN
      RAISE EXCEPTION 'legal_entity_id não pertence ao tenant do cliente';
    END IF;
  END IF;
  IF NEW.deal_id IS NOT NULL THEN
    SELECT company_id INTO v_deal_company FROM public.deals WHERE id = NEW.deal_id;
    IF v_deal_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Processo não pertence a este cliente';
    END IF;
  END IF;
  IF NEW.contract_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.client_contracts cc
      WHERE cc.id = NEW.contract_id AND cc.company_id = NEW.company_id AND cc.tenant_id = v_tenant
    ) THEN
      RAISE EXCEPTION 'Contrato não pertence a este cliente';
    END IF;
  END IF;
  IF NEW.customer_contact_id IS NOT NULL THEN
    SELECT company_id INTO v_contact_company FROM public.contacts WHERE id = NEW.customer_contact_id;
    IF v_contact_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Contato não pertence a este cliente';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN NEW.created_by := OLD.created_by;
  END IF;
  IF NEW.created_by IS NULL THEN RAISE EXCEPTION 'created_by é obrigatório'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_documents_context ON public.customer_documents;
CREATE TRIGGER trg_customer_documents_context
BEFORE INSERT OR UPDATE ON public.customer_documents
FOR EACH ROW EXECUTE FUNCTION public.workspace_fill_customer_document_context();

DROP TRIGGER IF EXISTS trg_client_contracts_context ON public.client_contracts;
CREATE TRIGGER trg_client_contracts_context
BEFORE INSERT OR UPDATE ON public.client_contracts
FOR EACH ROW EXECUTE FUNCTION public.workspace_fill_client_contract_context();

DROP TRIGGER IF EXISTS trg_service_engagements_context ON public.service_engagements;
CREATE TRIGGER trg_service_engagements_context
BEFORE INSERT OR UPDATE ON public.service_engagements
FOR EACH ROW EXECUTE FUNCTION public.workspace_fill_service_engagement_context();

DROP FUNCTION IF EXISTS public.workspace_apply_company_identity();
DROP FUNCTION IF EXISTS public.workspace_fill_company_context();

CREATE OR REPLACE FUNCTION public.workspace_fill_engagement_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.service_engagements WHERE id = NEW.engagement_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Serviço inválido';
  END IF;
  NEW.tenant_id := v_tenant;
  IF NEW.created_by IS NULL OR TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_engagement_members_context ON public.service_engagement_members;
CREATE TRIGGER trg_service_engagement_members_context
BEFORE INSERT OR UPDATE ON public.service_engagement_members
FOR EACH ROW EXECUTE FUNCTION public.workspace_fill_engagement_member();

CREATE OR REPLACE FUNCTION public.can_read_attachment(
  _tenant_id uuid,
  _entity_type text,
  _entity_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_company uuid;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF NOT public.is_user_tenant(_tenant_id) THEN RETURN false; END IF;
  IF public.has_role(uid, 'admin'::public.app_role)
     OR public.has_role(uid, 'desenvolvedor'::public.app_role) THEN
    RETURN true;
  END IF;
  IF _entity_id IS NULL THEN RETURN false; END IF;

  CASE _entity_type
    WHEN 'company' THEN
      RETURN public.user_can_operate_company(_entity_id);
    WHEN 'customer_document' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.customer_documents cd
        WHERE cd.id = _entity_id
          AND public.user_can_access_customer_document(
            cd.company_id, cd.deal_id, cd.service_engagement_id, cd.responsible_user_id, cd.created_by
          )
      );
    WHEN 'contract' THEN
      SELECT company_id INTO v_company FROM public.client_contracts WHERE id = _entity_id;
      IF v_company IS NOT NULL THEN
        RETURN EXISTS (
          SELECT 1 FROM public.client_contracts cc
          WHERE cc.id = _entity_id
            AND public.user_can_access_client_contract(cc.company_id, cc.responsible_user_id, cc.created_by)
        );
      END IF;
      RETURN public.user_can_manage_company(_entity_id);
    WHEN 'service_engagement' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.service_engagements se
        WHERE se.id = _entity_id
          AND public.user_can_access_service_engagement(
            se.company_id, se.deal_id, se.id, se.responsible_user_id, se.created_by
          )
      );
    WHEN 'deal' THEN
      SELECT company_id INTO v_company FROM public.deals WHERE id = _entity_id;
      RETURN v_company IS NOT NULL AND public.user_can_operate_company(v_company);
    WHEN 'order' THEN
      SELECT company_id INTO v_company FROM public.orders WHERE id = _entity_id;
      RETURN v_company IS NOT NULL AND public.user_can_operate_company(v_company);
    WHEN 'proposal' THEN
      SELECT company_id INTO v_company FROM public.proposals WHERE id = _entity_id;
      RETURN v_company IS NOT NULL AND public.user_can_operate_company(v_company);
    WHEN 'product' THEN
      RETURN public.is_user_tenant(_tenant_id);
    WHEN 'user' THEN
      RETURN _entity_id = uid;
    WHEN 'misc' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.file_attachments fa
        WHERE fa.entity_type = 'misc' AND fa.entity_id = _entity_id AND fa.uploaded_by = uid
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_mutate_attachment(
  _tenant_id uuid,
  _entity_type text,
  _entity_id uuid,
  _uploaded_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF public.has_role(uid, 'admin'::public.app_role)
     OR public.has_role(uid, 'desenvolvedor'::public.app_role) THEN
    RETURN true;
  END IF;
  IF NOT public.can_read_attachment(_tenant_id, _entity_type, _entity_id) THEN
    RETURN false;
  END IF;
  RETURN _uploaded_by = uid OR public.user_can_manage_company(
    CASE _entity_type
      WHEN 'company' THEN _entity_id
      WHEN 'customer_document' THEN (SELECT company_id FROM public.customer_documents WHERE id = _entity_id)
      WHEN 'contract' THEN COALESCE(
        (SELECT company_id FROM public.client_contracts WHERE id = _entity_id),
        _entity_id
      )
      WHEN 'service_engagement' THEN (SELECT company_id FROM public.service_engagements WHERE id = _entity_id)
      WHEN 'deal' THEN (SELECT company_id FROM public.deals WHERE id = _entity_id)
      ELSE NULL
    END
  );
END;
$$;

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_engagement_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_types_select ON public.document_types;
CREATE POLICY document_types_select ON public.document_types
  FOR SELECT TO authenticated
  USING (public.is_user_tenant(tenant_id));

DROP POLICY IF EXISTS document_types_write ON public.document_types;
CREATE POLICY document_types_write ON public.document_types
  FOR ALL TO authenticated
  USING (
    public.is_user_tenant(tenant_id)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    )
  )
  WITH CHECK (
    public.is_user_tenant(tenant_id)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    )
  );

DROP POLICY IF EXISTS customer_documents_select ON public.customer_documents;
CREATE POLICY customer_documents_select ON public.customer_documents
  FOR SELECT TO authenticated
  USING (
    public.user_can_access_customer_document(
      company_id, deal_id, service_engagement_id, responsible_user_id, created_by
    )
  );

DROP POLICY IF EXISTS customer_documents_insert ON public.customer_documents;
CREATE POLICY customer_documents_insert ON public.customer_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.user_can_manage_company(company_id)
      OR public.user_is_deal_participant(deal_id)
    )
  );

DROP POLICY IF EXISTS customer_documents_update ON public.customer_documents;
CREATE POLICY customer_documents_update ON public.customer_documents
  FOR UPDATE TO authenticated
  USING (
    public.user_can_access_customer_document(
      company_id, deal_id, service_engagement_id, responsible_user_id, created_by
    )
  )
  WITH CHECK (
    public.user_can_access_customer_document(
      company_id, deal_id, service_engagement_id, responsible_user_id, created_by
    )
  );

DROP POLICY IF EXISTS customer_documents_delete ON public.customer_documents;
CREATE POLICY customer_documents_delete ON public.customer_documents
  FOR DELETE TO authenticated
  USING (
    public.user_can_manage_company(company_id)
    AND (
      created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    )
  );

DROP POLICY IF EXISTS client_contracts_select ON public.client_contracts;
CREATE POLICY client_contracts_select ON public.client_contracts
  FOR SELECT TO authenticated
  USING (public.user_can_access_client_contract(company_id, responsible_user_id, created_by));

DROP POLICY IF EXISTS client_contracts_insert ON public.client_contracts;
CREATE POLICY client_contracts_insert ON public.client_contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_manage_company(company_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS client_contracts_update ON public.client_contracts;
CREATE POLICY client_contracts_update ON public.client_contracts
  FOR UPDATE TO authenticated
  USING (public.user_can_access_client_contract(company_id, responsible_user_id, created_by))
  WITH CHECK (public.user_can_access_client_contract(company_id, responsible_user_id, created_by));

DROP POLICY IF EXISTS client_contracts_delete ON public.client_contracts;
CREATE POLICY client_contracts_delete ON public.client_contracts
  FOR DELETE TO authenticated
  USING (
    public.user_can_manage_company(company_id)
    AND (
      created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    )
  );

DROP POLICY IF EXISTS service_engagements_select ON public.service_engagements;
CREATE POLICY service_engagements_select ON public.service_engagements
  FOR SELECT TO authenticated
  USING (
    public.user_can_access_service_engagement(
      company_id, deal_id, id, responsible_user_id, created_by
    )
  );

DROP POLICY IF EXISTS service_engagements_insert ON public.service_engagements;
CREATE POLICY service_engagements_insert ON public.service_engagements
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.user_can_manage_company(company_id)
      OR public.user_is_deal_participant(deal_id)
    )
  );

DROP POLICY IF EXISTS service_engagements_update ON public.service_engagements;
CREATE POLICY service_engagements_update ON public.service_engagements
  FOR UPDATE TO authenticated
  USING (
    public.user_can_access_service_engagement(
      company_id, deal_id, id, responsible_user_id, created_by
    )
  )
  WITH CHECK (
    public.user_can_access_service_engagement(
      company_id, deal_id, id, responsible_user_id, created_by
    )
  );

DROP POLICY IF EXISTS service_engagements_delete ON public.service_engagements;
CREATE POLICY service_engagements_delete ON public.service_engagements
  FOR DELETE TO authenticated
  USING (
    public.user_can_manage_company(company_id)
    AND (
      created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
    )
  );

DROP POLICY IF EXISTS service_engagement_members_select ON public.service_engagement_members;
CREATE POLICY service_engagement_members_select ON public.service_engagement_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_engagements se
      WHERE se.id = engagement_id
        AND public.user_can_access_service_engagement(
          se.company_id, se.deal_id, se.id, se.responsible_user_id, se.created_by
        )
    )
  );

DROP POLICY IF EXISTS service_engagement_members_write ON public.service_engagement_members;
CREATE POLICY service_engagement_members_write ON public.service_engagement_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_engagements se
      WHERE se.id = engagement_id
        AND public.user_can_manage_company(se.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_engagements se
      WHERE se.id = engagement_id
        AND public.user_can_manage_company(se.company_id)
    )
  );

DROP POLICY IF EXISTS file_attachments_select ON public.file_attachments;
CREATE POLICY file_attachments_select ON public.file_attachments
  FOR SELECT TO authenticated
  USING (public.can_read_attachment(tenant_id, entity_type, entity_id));

DROP POLICY IF EXISTS file_attachments_insert ON public.file_attachments;
DROP POLICY IF EXISTS "file_attachments_insert" ON public.file_attachments;
CREATE POLICY file_attachments_insert ON public.file_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.can_read_attachment(tenant_id, entity_type, entity_id)
  );

DROP POLICY IF EXISTS private_buckets_select ON storage.objects;
CREATE POLICY private_buckets_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('crm','pedidos','propostas','contratos','documentos')
    AND split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    AND split_part(name, '/', 3) ~ '^[0-9a-fA-F-]{36}$'
    AND public.can_read_attachment(
      split_part(name, '/', 1)::uuid,
      split_part(name, '/', 2),
      split_part(name, '/', 3)::uuid
    )
  );

DROP POLICY IF EXISTS private_buckets_insert ON storage.objects;
DROP POLICY IF EXISTS "private_buckets_insert" ON storage.objects;
CREATE POLICY private_buckets_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('crm','pedidos','propostas','contratos','documentos')
    AND split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    AND split_part(name, '/', 3) ~ '^[0-9a-fA-F-]{36}$'
    AND public.can_read_attachment(
      split_part(name, '/', 1)::uuid,
      split_part(name, '/', 2),
      split_part(name, '/', 3)::uuid
    )
  );

REVOKE ALL ON FUNCTION public.workspace_company_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_operate_company(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_manage_company(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_is_deal_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_access_customer_document(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_access_client_contract(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_access_service_engagement(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_attachment(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_operate_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_attachment(uuid, text, uuid) TO authenticated;

COMMIT;
