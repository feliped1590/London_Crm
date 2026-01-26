-- Criar tabela de auditoria para pedidos
CREATE TABLE public.order_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para consultas por pedido
CREATE INDEX idx_order_audit_log_order_id ON public.order_audit_log(order_id);
CREATE INDEX idx_order_audit_log_changed_at ON public.order_audit_log(changed_at DESC);

-- Habilitar RLS
ALTER TABLE public.order_audit_log ENABLE ROW LEVEL SECURITY;

-- Política de leitura (todos autenticados podem ver)
CREATE POLICY "Users can view order audit logs"
  ON public.order_audit_log FOR SELECT
  TO authenticated
  USING (true);

-- Política de inserção (todos autenticados podem inserir)
CREATE POLICY "Users can insert order audit logs"
  ON public.order_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Função de auditoria automática para alterações em pedidos
CREATE OR REPLACE FUNCTION public.audit_order_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Número do pedido
  IF OLD.number IS DISTINCT FROM NEW.number THEN
    INSERT INTO public.order_audit_log (order_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'number', 'Número', OLD.number, NEW.number, auth.uid());
  END IF;
  
  -- Empresa
  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    INSERT INTO public.order_audit_log (order_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'company_id', 'Empresa', OLD.company_id::text, NEW.company_id::text, auth.uid());
  END IF;
  
  -- Contato
  IF OLD.contact_id IS DISTINCT FROM NEW.contact_id THEN
    INSERT INTO public.order_audit_log (order_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'contact_id', 'Contato', OLD.contact_id::text, NEW.contact_id::text, auth.uid());
  END IF;
  
  -- Status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_audit_log (order_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'status', 'Status', OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  
  -- Data de entrega
  IF OLD.delivery_date IS DISTINCT FROM NEW.delivery_date THEN
    INSERT INTO public.order_audit_log (order_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'delivery_date', 'Data de Entrega', OLD.delivery_date::text, NEW.delivery_date::text, auth.uid());
  END IF;
  
  -- Valor total
  IF OLD.total_value IS DISTINCT FROM NEW.total_value THEN
    INSERT INTO public.order_audit_log (order_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'total_value', 'Valor Total', OLD.total_value::text, NEW.total_value::text, auth.uid());
  END IF;
  
  -- Observações
  IF OLD.observations IS DISTINCT FROM NEW.observations THEN
    INSERT INTO public.order_audit_log (order_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'observations', 'Observações', OLD.observations, NEW.observations, auth.uid());
  END IF;
  
  -- Proposta vinculada
  IF OLD.proposal_id IS DISTINCT FROM NEW.proposal_id THEN
    INSERT INTO public.order_audit_log (order_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'proposal_id', 'Proposta', OLD.proposal_id::text, NEW.proposal_id::text, auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger de auditoria
CREATE TRIGGER trigger_audit_order_changes
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.audit_order_changes();