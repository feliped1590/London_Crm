
-- ============================================
-- FASE 1: MULTI-TENANT - BASE ESTRUTURAL
-- ============================================

-- 1. Criar tabela tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Inserir tenant inicial
INSERT INTO public.tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Tenant Inicial', 'default');

-- 3. Criar tabela user_tenants
CREATE TABLE public.user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- 4. Associar todos os usuários existentes ao tenant inicial
INSERT INTO public.user_tenants (user_id, tenant_id, role)
SELECT id, '00000000-0000-0000-0000-000000000001', 'owner'
FROM auth.users;

-- 5. Adicionar tenant_id nas tabelas principais (NULLABLE primeiro)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 6. Popular tenant_id nos registros existentes
UPDATE public.companies SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.contacts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.deals SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.activities SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.tasks SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.orders SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.products SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.email_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.proposals SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- 7. Aplicar NOT NULL
ALTER TABLE public.companies ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.contacts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.deals ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.activities ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.proposals ALTER COLUMN tenant_id SET NOT NULL;

-- 8. Criar índices compostos
CREATE INDEX idx_companies_tenant ON public.companies(tenant_id);
CREATE INDEX idx_contacts_tenant ON public.contacts(tenant_id);
CREATE INDEX idx_deals_tenant ON public.deals(tenant_id);
CREATE INDEX idx_activities_tenant ON public.activities(tenant_id);
CREATE INDEX idx_tasks_tenant ON public.tasks(tenant_id);
CREATE INDEX idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_email_logs_tenant ON public.email_logs(tenant_id);
CREATE INDEX idx_proposals_tenant ON public.proposals(tenant_id);

-- Índices compostos para queries frequentes
CREATE INDEX idx_companies_tenant_owner ON public.companies(tenant_id, owner_id);
CREATE INDEX idx_companies_tenant_active ON public.companies(tenant_id, active);
CREATE INDEX idx_deals_tenant_stage ON public.deals(tenant_id, stage);
CREATE INDEX idx_deals_tenant_owner ON public.deals(tenant_id, owner_id);
CREATE INDEX idx_tasks_tenant_assigned ON public.tasks(tenant_id, assigned_to);

-- 9. Ajustar constraint de CNPJ (unique por tenant)
CREATE UNIQUE INDEX idx_companies_tenant_cnpj
  ON public.companies (tenant_id, cnpj)
  WHERE cnpj IS NOT NULL AND cnpj != '';

-- RLS para tenants e user_tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenants"
  ON public.tenants FOR SELECT
  USING (id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their tenant memberships"
  ON public.user_tenants FOR SELECT
  USING (user_id = auth.uid());

-- Adicionar active_tenant_id no profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.profiles SET active_tenant_id = '00000000-0000-0000-0000-000000000001' WHERE active_tenant_id IS NULL;

-- DEFAULT para novos registros (tenant inicial como fallback)
ALTER TABLE public.companies ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.contacts ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.deals ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.activities ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.tasks ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.orders ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.products ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.email_logs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.proposals ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
