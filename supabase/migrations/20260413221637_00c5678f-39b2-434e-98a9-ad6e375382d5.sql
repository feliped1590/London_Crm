ALTER TABLE public.orders
  DROP COLUMN IF EXISTS commission_type,
  DROP COLUMN IF EXISTS commission_value;