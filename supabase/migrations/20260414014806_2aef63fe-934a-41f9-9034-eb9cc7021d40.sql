ALTER TABLE public.order_items
  ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false;