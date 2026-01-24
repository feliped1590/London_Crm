
-- =============================================
-- 1. TRIGGERS PARA CONTROLE DE ALTERAÇÃO DE OWNER_ID (Item 3)
-- =============================================

-- Função que previne alteração de owner_id por não-admins
CREATE OR REPLACE FUNCTION public.check_owner_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o responsável';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aplicar triggers nas tabelas
CREATE TRIGGER check_owner_change_companies
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.check_owner_change();

CREATE TRIGGER check_owner_change_contacts
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.check_owner_change();

CREATE TRIGGER check_owner_change_deals
BEFORE UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.check_owner_change();

-- =============================================
-- 2. TABELA DE AUDITORIA DE NEGÓCIOS (Item 5)
-- =============================================

CREATE TABLE public.deal_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view deal audit logs"
ON public.deal_audit_log FOR SELECT TO authenticated
USING (true);

CREATE POLICY "System can insert deal audit logs"
ON public.deal_audit_log FOR INSERT TO authenticated
WITH CHECK (true);

-- Índice para performance
CREATE INDEX idx_deal_audit_log_deal_id ON public.deal_audit_log(deal_id);
CREATE INDEX idx_deal_audit_log_changed_at ON public.deal_audit_log(changed_at DESC);

-- Função de auditoria automática
CREATE OR REPLACE FUNCTION public.audit_deal_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Nome do negócio
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO public.deal_audit_log (deal_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'name', 'Nome', OLD.name, NEW.name, auth.uid());
  END IF;
  
  -- Valor
  IF OLD.value IS DISTINCT FROM NEW.value THEN
    INSERT INTO public.deal_audit_log (deal_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'value', 'Valor', OLD.value::text, NEW.value::text, auth.uid());
  END IF;
  
  -- Previsão de fechamento
  IF OLD.expected_close_date IS DISTINCT FROM NEW.expected_close_date THEN
    INSERT INTO public.deal_audit_log (deal_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'expected_close_date', 'Previsão de Fechamento', OLD.expected_close_date::text, NEW.expected_close_date::text, auth.uid());
  END IF;
  
  -- Empresa vinculada
  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    INSERT INTO public.deal_audit_log (deal_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'company_id', 'Empresa', OLD.company_id::text, NEW.company_id::text, auth.uid());
  END IF;
  
  -- Contato vinculado
  IF OLD.contact_id IS DISTINCT FROM NEW.contact_id THEN
    INSERT INTO public.deal_audit_log (deal_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'contact_id', 'Contato', OLD.contact_id::text, NEW.contact_id::text, auth.uid());
  END IF;
  
  -- Observações
  IF OLD.notes IS DISTINCT FROM NEW.notes THEN
    INSERT INTO public.deal_audit_log (deal_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'notes', 'Observações', OLD.notes, NEW.notes, auth.uid());
  END IF;
  
  -- Responsável
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    INSERT INTO public.deal_audit_log (deal_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'owner_id', 'Responsável', OLD.owner_id::text, NEW.owner_id::text, auth.uid());
  END IF;
  
  -- Probabilidade
  IF OLD.probability IS DISTINCT FROM NEW.probability THEN
    INSERT INTO public.deal_audit_log (deal_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'probability', 'Probabilidade', OLD.probability::text, NEW.probability::text, auth.uid());
  END IF;
  
  -- Motivo de perda
  IF OLD.lost_reason IS DISTINCT FROM NEW.lost_reason THEN
    INSERT INTO public.deal_audit_log (deal_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'lost_reason', 'Motivo de Perda', OLD.lost_reason, NEW.lost_reason, auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_audit_deal_changes
AFTER UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.audit_deal_changes();

-- =============================================
-- 3. TABELA DE PARTICIPANTES DE NEGÓCIOS (Item 4)
-- =============================================

CREATE TABLE public.deal_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, user_id)
);

ALTER TABLE public.deal_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view deal participants"
ON public.deal_participants FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and deal owners can manage participants"
ON public.deal_participants FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.deals 
    WHERE id = deal_participants.deal_id 
    AND (owner_id = auth.uid() OR created_by = auth.uid())
  )
);

CREATE INDEX idx_deal_participants_deal_id ON public.deal_participants(deal_id);
CREATE INDEX idx_deal_participants_user_id ON public.deal_participants(user_id);

-- Atualizar política SELECT de deals para considerar participantes
DROP POLICY IF EXISTS "Authenticated users can view deals" ON public.deals;

CREATE POLICY "Users can view deals they have access to"
ON public.deals FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.deal_participants
    WHERE deal_id = deals.id AND user_id = auth.uid()
  )
);

-- =============================================
-- 4. MÓDULO DE TABELAS DE PREÇOS (Item 6)
-- =============================================

-- Tabela principal de pricing tables
CREATE TABLE public.pricing_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_until DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pricing tables"
ON public.pricing_tables FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage pricing tables"
ON public.pricing_tables FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_pricing_tables_updated_at
BEFORE UPDATE ON public.pricing_tables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Regras de preço por faixa
CREATE TABLE public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_table_id UUID NOT NULL REFERENCES public.pricing_tables(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  category TEXT,
  min_quantity NUMERIC NOT NULL DEFAULT 0,
  max_quantity NUMERIC,
  discount_percent NUMERIC DEFAULT 0,
  fixed_price NUMERIC,
  price_per_unit NUMERIC,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pricing rules"
ON public.pricing_rules FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage pricing rules"
ON public.pricing_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_pricing_rules_table_id ON public.pricing_rules(pricing_table_id);
CREATE INDEX idx_pricing_rules_product_id ON public.pricing_rules(product_id);

-- Vinculação de tabela de preços a entidades
CREATE TABLE public.pricing_table_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_table_id UUID NOT NULL REFERENCES public.pricing_tables(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'contact')),
  entity_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);

ALTER TABLE public.pricing_table_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pricing assignments"
ON public.pricing_table_assignments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage pricing assignments"
ON public.pricing_table_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_pricing_assignments_table_id ON public.pricing_table_assignments(pricing_table_id);
CREATE INDEX idx_pricing_assignments_entity ON public.pricing_table_assignments(entity_type, entity_id);

-- =============================================
-- 5. ADICIONAR MÓDULO DE TABELA DE PREÇOS AO SISTEMA
-- =============================================

INSERT INTO public.system_modules (key, name, path, icon, sort_order, is_active)
VALUES ('pricing', 'Tabelas de Preços', '/pricing', 'DollarSign', 65, true)
ON CONFLICT (key) DO NOTHING;

-- Dar acesso admin ao módulo
INSERT INTO public.role_module_permissions (module_id, role, can_access, access_type)
SELECT id, 'admin', true, 'total'
FROM public.system_modules WHERE key = 'pricing'
ON CONFLICT DO NOTHING;
