
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'producao';
COMMENT ON COLUMN public.orders.order_type IS 'Tipo do pedido: producao ou pronta_entrega';
