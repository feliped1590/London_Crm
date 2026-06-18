DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_sync_before') THEN
    ALTER TABLE public.products DISABLE TRIGGER trg_product_sync_before;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_sync_after') THEN
    ALTER TABLE public.products DISABLE TRIGGER trg_product_sync_after;
  END IF;
END $$;