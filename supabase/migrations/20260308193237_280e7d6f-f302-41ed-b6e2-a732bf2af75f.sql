
-- Add price source tracking to proposal_items and order_items
ALTER TABLE public.proposal_items 
  ADD COLUMN IF NOT EXISTS calculated_price_source TEXT DEFAULT 'MANUAL';

ALTER TABLE public.order_items 
  ADD COLUMN IF NOT EXISTS calculated_price_source TEXT DEFAULT 'MANUAL';

COMMENT ON COLUMN public.proposal_items.calculated_price_source IS 'Origem do preço: TABLE, FACTOR_KG, MANUAL';
COMMENT ON COLUMN public.order_items.calculated_price_source IS 'Origem do preço: TABLE, FACTOR_KG, MANUAL';
