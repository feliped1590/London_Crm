-- Workspace 360: task operational columns.
-- Civil due date convention: timestamptz stored at noon UTC (YYYY-MM-DDT12:00:00Z)
-- so the UTC date part equals the civil date in America/Sao_Paulo business use.

BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_kind public.task_kind NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS waiting_on public.task_waiting_on NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS service_engagement_id uuid REFERENCES public.service_engagements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_document_id uuid REFERENCES public.customer_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_source_type_chk;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_source_type_chk CHECK (
    source_type IS NULL
    OR source_type = ANY (ARRAY[
      'manual','checklist','document','contract','service','followup','stage','system'
    ]::text[])
  );

CREATE INDEX IF NOT EXISTS idx_tasks_company_status_due
  ON public.tasks (tenant_id, company_id, status, due_date)
  WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_waiting_on
  ON public.tasks (tenant_id, company_id, waiting_on, status)
  WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_service_engagement
  ON public.tasks (service_engagement_id)
  WHERE service_engagement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_customer_document
  ON public.tasks (customer_document_id)
  WHERE customer_document_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tasks_workspace_fk_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
BEGIN
  IF NEW.service_engagement_id IS NOT NULL THEN
    SELECT company_id INTO v_company FROM public.service_engagements WHERE id = NEW.service_engagement_id;
    IF NEW.company_id IS NULL THEN
      NEW.company_id := v_company;
    ELSIF v_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Serviço da tarefa não pertence ao cliente';
    END IF;
  END IF;
  IF NEW.customer_document_id IS NOT NULL THEN
    SELECT company_id INTO v_company FROM public.customer_documents WHERE id = NEW.customer_document_id;
    IF NEW.company_id IS NULL THEN
      NEW.company_id := v_company;
    ELSIF v_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Documento da tarefa não pertence ao cliente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_workspace_fk ON public.tasks;
CREATE TRIGGER trg_tasks_workspace_fk
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_workspace_fk_validate();

COMMIT;
