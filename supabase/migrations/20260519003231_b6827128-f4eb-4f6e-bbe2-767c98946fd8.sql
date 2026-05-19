
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_due
  ON public.tasks (tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_created_at
  ON public.tasks (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_created
  ON public.orders (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sales_rep
  ON public.orders (sales_rep_id) WHERE sales_rep_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_tenant_pipeline_stage
  ON public.deals (tenant_id, pipeline_id, pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_owner_updated
  ON public.deals (tenant_id, owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_companies_tenant_updated
  ON public.companies (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_sales_rep
  ON public.companies (tenant_id, sales_rep_id);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_owner
  ON public.contacts (tenant_id, owner_id);

CREATE INDEX IF NOT EXISTS idx_activities_tenant_created
  ON public.activities (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_instance_created
  ON public.whatsapp_messages (instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_created
  ON public.whatsapp_messages (phone, created_at DESC);

DROP INDEX IF EXISTS public.idx_companies_owner;
DROP INDEX IF EXISTS public.idx_companies_created_by;
DROP INDEX IF EXISTS public.idx_companies_iniflex_id;
DROP INDEX IF EXISTS public.idx_contacts_tenant_company;
DROP INDEX IF EXISTS public.idx_contacts_cpf;
DROP INDEX IF EXISTS public.idx_contacts_iniflex_id;
DROP INDEX IF EXISTS public.idx_products_parent;
DROP INDEX IF EXISTS public.idx_products_ncm;
DROP INDEX IF EXISTS public.idx_products_ncm_id;
DROP INDEX IF EXISTS public.idx_products_tenant_legal_entity;
DROP INDEX IF EXISTS public.idx_crm_products_descricao;
DROP INDEX IF EXISTS public.idx_company_audit_log_changed_at;
DROP INDEX IF EXISTS public.idx_erp_logs_direction;
DROP INDEX IF EXISTS public.idx_product_sync_log_created;
DROP INDEX IF EXISTS public.idx_company_sync_status;

DROP TABLE IF EXISTS public.companies_classification_backup CASCADE;
DROP TABLE IF EXISTS public.products_dedup_backup CASCADE;
DROP TABLE IF EXISTS public.crm_products CASCADE;

ANALYZE public.tasks;
ANALYZE public.orders;
ANALYZE public.deals;
ANALYZE public.companies;
ANALYZE public.contacts;
ANALYZE public.activities;
ANALYZE public.whatsapp_messages;
