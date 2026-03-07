
-- Partial unique index to enforce at most one default sales rep per user
CREATE UNIQUE INDEX IF NOT EXISTS user_default_sales_rep_unique
ON public.user_sales_reps (user_id)
WHERE is_default = true;
