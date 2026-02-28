
CREATE INDEX IF NOT EXISTS idx_tasks_owner_status_due 
ON public.tasks (assigned_to, status, due_date);
