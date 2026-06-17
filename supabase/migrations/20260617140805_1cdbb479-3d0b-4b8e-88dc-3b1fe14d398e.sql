
ALTER TABLE public.quick_quote_items
  ADD COLUMN IF NOT EXISTS width numeric,
  ADD COLUMN IF NOT EXISTS length numeric,
  ADD COLUMN IF NOT EXISTS thickness numeric,
  ADD COLUMN IF NOT EXISTS fator numeric,
  ADD COLUMN IF NOT EXISTS weight numeric NOT NULL DEFAULT 0;

ALTER TABLE public.quick_quotes
  ADD COLUMN IF NOT EXISTS total_weight numeric NOT NULL DEFAULT 0;
