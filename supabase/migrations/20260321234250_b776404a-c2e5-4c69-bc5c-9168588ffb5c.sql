CREATE INDEX IF NOT EXISTS idx_user_sales_reps_sales_rep_lookup
ON public.user_sales_reps (sales_rep_id, is_default DESC, created_at ASC, user_id ASC);