-- Deduplicate: keep only the latest entry per company_id
DELETE FROM public.company_sync_queue
WHERE id NOT IN (
  SELECT DISTINCT ON (company_id) id
  FROM public.company_sync_queue
  ORDER BY company_id, updated_at DESC
);

-- Add unique constraint
ALTER TABLE public.company_sync_queue
  ADD CONSTRAINT company_sync_queue_company_id_unique UNIQUE (company_id);