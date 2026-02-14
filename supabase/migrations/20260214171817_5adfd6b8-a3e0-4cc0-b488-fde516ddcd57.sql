
-- =============================================
-- FASE 1 CONCLUSÃO — RLS nas tabelas de negócio
-- =============================================

-- Companies RLS
CREATE POLICY tenant_isolation_companies ON companies
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- Contacts RLS
CREATE POLICY tenant_isolation_contacts ON contacts
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- Deals RLS
CREATE POLICY tenant_isolation_deals ON deals
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- Activities RLS
CREATE POLICY tenant_isolation_activities ON activities
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- Tasks RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tasks ON tasks
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- Email logs RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_email_logs ON email_logs
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- Proposals RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_proposals ON proposals
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- Orders RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_orders ON orders
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- Products RLS  
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_products ON products
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- =============================================
-- FASE 2 — PREPARAÇÃO ESTRUTURAL (ERP READY)
-- =============================================

-- 1️⃣ Colunas ERP na companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS erp_code TEXT,
  ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS fax TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
  ADD COLUMN IF NOT EXISTS erp_registration_date DATE,
  ADD COLUMN IF NOT EXISTS erp_last_update_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erp_last_movement_date DATE,
  ADD COLUMN IF NOT EXISTS erp_synced_at TIMESTAMPTZ;

-- 2️⃣ Endereço detalhado
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- 3️⃣ Criar company_erp_fiscal
CREATE TABLE IF NOT EXISTS company_erp_fiscal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  regime_tributario TEXT,
  contribuinte_icms BOOLEAN DEFAULT false,
  contribuinte_ipi BOOLEAN DEFAULT false,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  suframa TEXT,
  tipo_contribuinte TEXT,
  optante_simples BOOLEAN DEFAULT false,
  cfop_padrao TEXT,
  cst_icms TEXT,
  cst_pis TEXT,
  cst_cofins TEXT,
  cst_ipi TEXT,
  aliquota_icms NUMERIC(5,2),
  aliquota_pis NUMERIC(5,4),
  aliquota_cofins NUMERIC(5,4),
  aliquota_ipi NUMERIC(5,2),
  reducao_base_icms NUMERIC(5,2),
  destino_mercadoria TEXT,
  finalidade_operacao TEXT,
  erp_fiscal_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, company_id)
);

ALTER TABLE company_erp_fiscal ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_company_erp_fiscal ON company_erp_fiscal
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- 4️⃣ Criar company_erp_financial
CREATE TABLE IF NOT EXISTS company_erp_financial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  limite_credito NUMERIC(15,2),
  saldo_devedor NUMERIC(15,2),
  prazo_medio_pagamento INTEGER,
  condicao_pagamento TEXT,
  forma_pagamento TEXT,
  banco_preferencial TEXT,
  agencia TEXT,
  conta TEXT,
  possui_titulos_abertos BOOLEAN DEFAULT false,
  possui_titulos_vencidos BOOLEAN DEFAULT false,
  valor_titulos_abertos NUMERIC(15,2),
  valor_titulos_vencidos NUMERIC(15,2),
  data_ultimo_pagamento DATE,
  credit_score INTEGER,
  credit_risk_level TEXT,
  credit_validity_date DATE,
  credit_approved_by TEXT,
  credit_approved_at TIMESTAMPTZ,
  erp_financial_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, company_id)
);

ALTER TABLE company_erp_financial ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_company_erp_financial ON company_erp_financial
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- 5️⃣ Criar import_conflict_log
CREATE TABLE IF NOT EXISTS import_conflict_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  erp_code TEXT,
  field_name TEXT NOT NULL,
  crm_value TEXT,
  erp_value TEXT,
  resolution TEXT DEFAULT 'pending',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  auto_resolved BOOLEAN DEFAULT false,
  resolution_rule TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE import_conflict_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_import_conflict_log ON import_conflict_log
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- 6️⃣ Índices estratégicos
CREATE INDEX IF NOT EXISTS idx_company_erp_fiscal_tenant_company ON company_erp_fiscal(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_company_erp_financial_tenant_company ON company_erp_financial(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_company_erp_financial_tenant_credit ON company_erp_financial(tenant_id, credit_validity_date);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_erp_code ON companies(tenant_id, erp_code) WHERE erp_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_conflict_tenant_entity ON import_conflict_log(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_import_conflict_tenant_resolution ON import_conflict_log(tenant_id, resolution);

-- Trigger updated_at para novas tabelas
CREATE TRIGGER update_company_erp_fiscal_updated_at
  BEFORE UPDATE ON company_erp_fiscal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_erp_financial_updated_at
  BEFORE UPDATE ON company_erp_financial
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
