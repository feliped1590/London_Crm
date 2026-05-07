ALTER TABLE public.product_groups ADD COLUMN IF NOT EXISTS default_ncm_code text;

-- Seed defaults atuais (sacos/bobinas) onde ainda não houver
UPDATE public.product_groups
SET default_ncm_code = '39232990'
WHERE default_ncm_code IS NULL AND lower(label) LIKE '%saco%';

UPDATE public.product_groups
SET default_ncm_code = '39173290'
WHERE default_ncm_code IS NULL AND lower(label) LIKE '%bobina%';