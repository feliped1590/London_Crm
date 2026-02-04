-- 1. Add pricing factor columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS fator_kg numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS fator_milheiro numeric DEFAULT 0;

-- Add comment to explain the formula
COMMENT ON COLUMN public.products.fator_kg IS 'Valor do fator por KG';
COMMENT ON COLUMN public.products.fator_milheiro IS 'Calculado: fator_kg × largura(mm) × comprimento(mm) × espessura(micras)';

-- 2. Add allowed_roles column to pipelines table for access control
ALTER TABLE public.pipelines
ADD COLUMN IF NOT EXISTS allowed_roles text[] DEFAULT NULL;

COMMENT ON COLUMN public.pipelines.allowed_roles IS 'Lista de roles que podem acessar este funil. NULL = todos os roles podem acessar';

-- 3. Create order_approval_rules table for configurable approval workflow
CREATE TABLE IF NOT EXISTS public.order_approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  from_status public.order_status NOT NULL,
  to_status public.order_status NOT NULL,
  required_role text NOT NULL DEFAULT 'admin',
  requires_justification boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(from_status, to_status)
);

-- Enable RLS
ALTER TABLE public.order_approval_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_approval_rules (admin only)
CREATE POLICY "Admin can manage approval rules"
ON public.order_approval_rules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "All authenticated users can view approval rules"
ON public.order_approval_rules
FOR SELECT
TO authenticated
USING (true);

-- Seed initial approval rules based on current workflow logic
INSERT INTO public.order_approval_rules (name, from_status, to_status, required_role, requires_justification, sort_order) VALUES
  ('Liberar para Produção', 'pendente', 'em_producao', 'vendedor', false, 1),
  ('Marcar como Produzido', 'em_producao', 'produzido', 'admin', false, 2),
  ('Faturar Pedido', 'produzido', 'faturado', 'admin', false, 3),
  ('Confirmar Entrega', 'faturado', 'entregue', 'admin', false, 4),
  ('Cancelar Pedido', 'pendente', 'cancelado', 'admin', true, 10),
  ('Cancelar da Produção', 'em_producao', 'cancelado', 'admin', true, 11),
  ('Cancelar Produzido', 'produzido', 'cancelado', 'admin', true, 12),
  ('Cancelar Faturado', 'faturado', 'cancelado', 'admin', true, 13)
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER update_order_approval_rules_updated_at
  BEFORE UPDATE ON public.order_approval_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();