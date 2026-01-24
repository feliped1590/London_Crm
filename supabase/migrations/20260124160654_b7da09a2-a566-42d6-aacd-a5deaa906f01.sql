-- Tabela de histórico de transferências de carteira
CREATE TABLE public.portfolio_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'contact', 'deal')),
  entity_id UUID NOT NULL,
  entity_name TEXT NOT NULL,
  from_user_id UUID,
  to_user_id UUID NOT NULL,
  transferred_by UUID NOT NULL,
  transferred_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_portfolio_transfers_from_user ON public.portfolio_transfers(from_user_id);
CREATE INDEX idx_portfolio_transfers_to_user ON public.portfolio_transfers(to_user_id);
CREATE INDEX idx_portfolio_transfers_transferred_at ON public.portfolio_transfers(transferred_at DESC);

-- Enable RLS
ALTER TABLE public.portfolio_transfers ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem gerenciar transferências
CREATE POLICY "Admins can manage portfolio transfers"
ON public.portfolio_transfers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Comentário na tabela
COMMENT ON TABLE public.portfolio_transfers IS 'Histórico de transferências de carteira entre vendedores';