
-- Now sync existing data
-- 1. Companies
UPDATE public.companies c
SET owner_id = usr.user_id, updated_at = now()
FROM public.user_sales_reps usr
WHERE c.sales_rep_id = usr.sales_rep_id
  AND (c.owner_id IS DISTINCT FROM usr.user_id);

-- 2. Contacts
UPDATE public.contacts ct
SET owner_id = usr.user_id, updated_at = now()
FROM public.companies c
JOIN public.user_sales_reps usr ON usr.sales_rep_id = c.sales_rep_id
WHERE ct.company_id = c.id
  AND (ct.owner_id IS DISTINCT FROM usr.user_id);

-- 3. Deals  
UPDATE public.deals d
SET owner_id = usr.user_id, updated_at = now()
FROM public.companies c
JOIN public.user_sales_reps usr ON usr.sales_rep_id = c.sales_rep_id
WHERE d.company_id = c.id
  AND (d.owner_id IS DISTINCT FROM usr.user_id);
