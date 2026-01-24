-- Adiciona coluna discount_percent à tabela order_items para rastrear descontos aplicados
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0;