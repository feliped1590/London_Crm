-- Tabela para registrar aprovações/transições de status de pedidos
CREATE TABLE public.order_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    from_status public.order_status,
    to_status public.order_status NOT NULL,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    UNIQUE(order_id, to_status)
);

-- Índices para performance
CREATE INDEX idx_order_approvals_order_id ON public.order_approvals(order_id);
CREATE INDEX idx_order_approvals_approved_by ON public.order_approvals(approved_by);

-- Habilitar RLS
ALTER TABLE public.order_approvals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view order approvals"
ON public.order_approvals FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert order approvals"
ON public.order_approvals FOR INSERT
TO authenticated
WITH CHECK (approved_by = auth.uid());

-- Comentários para documentação
COMMENT ON TABLE public.order_approvals IS 'Registro de aprovações e transições de status de pedidos';
COMMENT ON COLUMN public.order_approvals.from_status IS 'Status anterior (null se for criação)';
COMMENT ON COLUMN public.order_approvals.to_status IS 'Novo status após aprovação';
COMMENT ON COLUMN public.order_approvals.notes IS 'Observações opcionais da aprovação';