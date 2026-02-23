-- Add unique constraint on codigo for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ncm_codes_codigo_key'
  ) THEN
    ALTER TABLE public.ncm_codes ADD CONSTRAINT ncm_codes_codigo_key UNIQUE (codigo);
  END IF;
END $$;
