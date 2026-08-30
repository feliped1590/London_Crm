-- Workspace 360: unique constraints and indexes.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_types_tenant_name_ci
  ON public.document_types (tenant_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_document_types_tenant_active
  ON public.document_types (tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_customer_documents_company_status
  ON public.customer_documents (tenant_id, company_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_customer_documents_expires
  ON public.customer_documents (tenant_id, company_id, expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_documents_type
  ON public.customer_documents (tenant_id, document_type_id);

CREATE INDEX IF NOT EXISTS idx_client_contracts_company_status
  ON public.client_contracts (tenant_id, company_id, status, ends_on);
CREATE INDEX IF NOT EXISTS idx_client_contracts_renewal
  ON public.client_contracts (tenant_id, company_id, next_renewal_on)
  WHERE next_renewal_on IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_engagements_company_status
  ON public.service_engagements (tenant_id, company_id, status, due_on);
CREATE INDEX IF NOT EXISTS idx_service_engagements_deal
  ON public.service_engagements (tenant_id, deal_id)
  WHERE deal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_engagement_members
  ON public.service_engagement_members (engagement_id, user_id);
CREATE INDEX IF NOT EXISTS idx_service_engagement_members_user
  ON public.service_engagement_members (tenant_id, user_id);

COMMIT;
