
CREATE OR REPLACE FUNCTION public.check_pending_tasks(p_user_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'overdue_count', (
      SELECT COUNT(*) FROM public.tasks 
      WHERE assigned_to = p_user_id AND status NOT IN ('concluida'::task_status, 'cancelada'::task_status)
        AND due_date < date_trunc('day', now())
    ),
    'today_count', (
      SELECT COUNT(*) FROM public.tasks 
      WHERE assigned_to = p_user_id AND status NOT IN ('concluida'::task_status, 'cancelada'::task_status)
        AND due_date >= date_trunc('day', now()) 
        AND due_date < date_trunc('day', now()) + interval '1 day'
    ),
    'overdue_tasks', COALESCE((
      SELECT json_agg(json_build_object('id', t.id, 'title', t.title))
      FROM (
        SELECT id, title FROM public.tasks 
        WHERE assigned_to = p_user_id AND status NOT IN ('concluida'::task_status, 'cancelada'::task_status)
          AND due_date < date_trunc('day', now())
        ORDER BY due_date ASC LIMIT 5
      ) t
    ), '[]'::json),
    'today_tasks', COALESCE((
      SELECT json_agg(json_build_object('id', t.id, 'title', t.title))
      FROM (
        SELECT id, title FROM public.tasks 
        WHERE assigned_to = p_user_id AND status NOT IN ('concluida'::task_status, 'cancelada'::task_status)
          AND due_date >= date_trunc('day', now()) 
          AND due_date < date_trunc('day', now()) + interval '1 day'
        ORDER BY due_date ASC LIMIT 5
      ) t
    ), '[]'::json)
  );
$$;
