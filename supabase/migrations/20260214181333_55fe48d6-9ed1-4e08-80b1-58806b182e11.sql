
-- =============================================
-- FASE 4B: Estrutura de Contatos ERP
-- Ajustes revisados (6 correções aplicadas)
-- =============================================

-- 1. Novas colunas comerciais na tabela contacts
ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS phone_extension TEXT,
  ADD COLUMN IF NOT EXISTS gender CHAR(1),
  ADD COLUMN IF NOT EXISTS erp_contact_code TEXT,
  ADD COLUMN IF NOT EXISTS erp_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erp_last_update_date TIMESTAMPTZ;

-- Ajuste 5: CHECK constraint para gender (M/F/O) em vez de TEXT aberto
ALTER TABLE public.contacts 
  ADD CONSTRAINT contacts_gender_check CHECK (gender IN ('M', 'F', 'O'));

-- Ajuste 4: Partial UNIQUE para evitar duplicação silenciosa por email
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_tenant_company_email_unique
  ON public.contacts (tenant_id, company_id, email)
  WHERE email IS NOT NULL AND email != '';

-- Ajuste 1: Índice para merge por erp_contact_code (sem ambiguidade com companies.erp_code)
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_erp_contact_code
  ON public.contacts (tenant_id, erp_contact_code)
  WHERE erp_contact_code IS NOT NULL;

-- Índice para listagem por empresa
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_company
  ON public.contacts (tenant_id, company_id);

-- 2. Tabela auxiliar ERP para dados operacionais
CREATE TABLE IF NOT EXISTS public.contact_erp_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  erp_sequence INTEGER,
  person_code TEXT,
  superior_seq INTEGER,
  treatment TEXT,
  homepage TEXT,
  photo_path TEXT,
  relationship_code TEXT,
  credential_expiry DATE,
  receives_billing_email BOOLEAN DEFAULT false,
  receives_payment_email BOOLEAN DEFAULT false,
  receives_email BOOLEAN DEFAULT false,
  notify_sale BOOLEAN DEFAULT false,
  participates BOOLEAN DEFAULT false,
  erp_notes TEXT,
  erp_modified_at DATE,
  erp_updated_at DATE,
  extra_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajuste 6: UNIQUE(contact_id) — tenant_id é redundante pois contact_id já é globalmente único
ALTER TABLE public.contact_erp_data 
  ADD CONSTRAINT contact_erp_data_contact_unique UNIQUE (contact_id);

-- Índice para joins rápidos
CREATE INDEX IF NOT EXISTS idx_contact_erp_data_tenant
  ON public.contact_erp_data (tenant_id);

-- RLS
ALTER TABLE public.contact_erp_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolamento por tenant - SELECT"
  ON public.contact_erp_data FOR SELECT
  USING (
    tenant_id IN (
      SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()
    )
  );

CREATE POLICY "Isolamento por tenant - INSERT"
  ON public.contact_erp_data FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()
    )
  );

CREATE POLICY "Isolamento por tenant - UPDATE"
  ON public.contact_erp_data FOR UPDATE
  USING (
    tenant_id IN (
      SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()
    )
  );

CREATE POLICY "Isolamento por tenant - DELETE"
  ON public.contact_erp_data FOR DELETE
  USING (
    tenant_id IN (
      SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()
    )
  );

-- Trigger de updated_at
CREATE TRIGGER update_contact_erp_data_updated_at
  BEFORE UPDATE ON public.contact_erp_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
