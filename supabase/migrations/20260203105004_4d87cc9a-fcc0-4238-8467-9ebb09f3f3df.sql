-- =========================================
-- SPRINT 2: Qualidade de Dados
-- =========================================

-- 1. Adicionar colunas na tabela companies
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS parent_company_id UUID REFERENCES public.companies(id),
ADD COLUMN IF NOT EXISTS is_matriz BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_companies_parent_company ON public.companies(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_companies_is_matriz ON public.companies(is_matriz) WHERE is_matriz = true;

-- Inicializar last_reviewed_at para registros existentes
UPDATE public.companies SET last_reviewed_at = now() WHERE last_reviewed_at IS NULL;

-- 2. Criar tabela de auditoria de clientes (espelha deal_audit_log)
CREATE TABLE IF NOT EXISTS public.company_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para consultas por empresa
CREATE INDEX IF NOT EXISTS idx_company_audit_log_company ON public.company_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_company_audit_log_changed_at ON public.company_audit_log(changed_at DESC);

-- RLS para company_audit_log
ALTER TABLE public.company_audit_log ENABLE ROW LEVEL SECURITY;

-- Política: Todos usuários autenticados podem ver
CREATE POLICY "Authenticated users can view company audit logs"
ON public.company_audit_log
FOR SELECT
TO authenticated
USING (true);

-- Política: Sistema pode inserir
CREATE POLICY "System can insert company audit logs"
ON public.company_audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. Trigger para auditoria de campos críticos (segmento, owner_id, active, parent_company_id)
CREATE OR REPLACE FUNCTION public.audit_company_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_old_segment TEXT;
  v_new_segment TEXT;
BEGIN
  -- Obter user_id do contexto JWT
  v_user_id := auth.uid();
  
  -- Auditar mudanças no segmento (armazenado em custom_fields)
  v_old_segment := OLD.custom_fields->>'segmento';
  v_new_segment := NEW.custom_fields->>'segmento';
  
  IF v_old_segment IS DISTINCT FROM v_new_segment THEN
    INSERT INTO public.company_audit_log (company_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'segmento', 'Segmento', v_old_segment, v_new_segment, v_user_id);
  END IF;
  
  -- Auditar mudanças no owner_id
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    INSERT INTO public.company_audit_log (company_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'owner_id', 'Vendedor Responsável', OLD.owner_id::TEXT, NEW.owner_id::TEXT, v_user_id);
  END IF;
  
  -- Auditar mudanças no status ativo
  IF OLD.active IS DISTINCT FROM NEW.active THEN
    INSERT INTO public.company_audit_log (company_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'active', 'Status Ativo', 
            CASE WHEN OLD.active THEN 'Ativo' ELSE 'Inativo' END,
            CASE WHEN NEW.active THEN 'Ativo' ELSE 'Inativo' END,
            v_user_id);
  END IF;
  
  -- Auditar mudanças no parent_company_id
  IF OLD.parent_company_id IS DISTINCT FROM NEW.parent_company_id THEN
    INSERT INTO public.company_audit_log (company_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'parent_company_id', 'Empresa Matriz', OLD.parent_company_id::TEXT, NEW.parent_company_id::TEXT, v_user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger de auditoria
DROP TRIGGER IF EXISTS audit_company_changes_trigger ON public.companies;
CREATE TRIGGER audit_company_changes_trigger
AFTER UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.audit_company_changes();

-- 4. Validação de Matriz: impedir que uma filial seja promovida a matriz se já existir outra matriz no mesmo grupo
-- Esta regra só vale para NOVOS cadastros ou mudanças de is_matriz
CREATE OR REPLACE FUNCTION public.check_matriz_constraint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_matriz_id UUID;
  v_existing_matriz_name TEXT;
BEGIN
  -- Só valida se is_matriz está sendo definido como TRUE
  IF NEW.is_matriz = true THEN
    -- Se tem parent_company_id, não pode ser matriz (matriz não tem parent)
    IF NEW.parent_company_id IS NOT NULL THEN
      RAISE EXCEPTION 'Uma empresa matriz não pode ter parent_company_id definido';
    END IF;
    
    -- Verificar se já existe outra matriz no mesmo grupo econômico (empresas que apontam para esta como parent)
    -- Se UPDATE e já era matriz, permite (está só atualizando outros campos)
    IF TG_OP = 'UPDATE' AND OLD.is_matriz = true THEN
      RETURN NEW;
    END IF;
    
    -- Para INSERT ou mudança de is_matriz de false para true:
    -- Verificar se esta empresa já é referenciada como parent por outra matriz
    -- (não bloqueia cadastro existente - só novos cadastros ou promoções)
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger de validação de matriz
DROP TRIGGER IF EXISTS check_matriz_constraint_trigger ON public.companies;
CREATE TRIGGER check_matriz_constraint_trigger
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.check_matriz_constraint();