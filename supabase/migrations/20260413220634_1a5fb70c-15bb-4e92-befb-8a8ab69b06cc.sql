
ALTER TABLE public.orders
  ADD COLUMN commission_type TEXT DEFAULT 'percentage'
    CHECK (commission_type IN ('percentage', 'fixed')),
  ADD COLUMN commission_value NUMERIC(10,2) DEFAULT 0;
