-- Criar tabela para controle de lembretes enviados
CREATE TABLE public.task_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'email_1h',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id, reminder_type)
);

-- Habilitar RLS
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

-- Política de leitura para usuários autenticados
CREATE POLICY "Users can view their own reminders"
  ON public.task_reminders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Política de inserção para service role (via edge function)
CREATE POLICY "Service role can insert reminders"
  ON public.task_reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_task_reminders_task_id ON public.task_reminders(task_id);
CREATE INDEX idx_task_reminders_user_id ON public.task_reminders(user_id);
CREATE INDEX idx_task_reminders_type ON public.task_reminders(reminder_type);