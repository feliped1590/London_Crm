ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS fator_kg numeric DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_fator_kg_non_negative'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_fator_kg_non_negative
    CHECK (fator_kg IS NULL OR fator_kg >= 0);
  END IF;
END $$;