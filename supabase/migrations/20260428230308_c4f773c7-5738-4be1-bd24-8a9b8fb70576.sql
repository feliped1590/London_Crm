ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS observations_pcp text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_observations_max_length'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_observations_max_length
      CHECK (observations IS NULL OR char_length(observations) <= 1000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_observations_pcp_max_length'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_observations_pcp_max_length
      CHECK (observations_pcp IS NULL OR char_length(observations_pcp) <= 1000);
  END IF;
END $$;