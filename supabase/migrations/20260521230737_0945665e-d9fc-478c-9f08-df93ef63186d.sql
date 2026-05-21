CREATE OR REPLACE FUNCTION public.trg_promote_company_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'entity_notes' THEN
    IF NEW.entity_type = 'company' THEN v_company_id := NEW.entity_id;
    ELSE RETURN NEW; END IF;
  ELSE v_company_id := NEW.company_id;
  END IF;
  IF v_company_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.companies
     SET activity_status = 'ativo',
         activity_status_updated_at = CASE WHEN activity_status IS DISTINCT FROM 'ativo' THEN now() ELSE activity_status_updated_at END,
         last_interaction_at = now()
   WHERE id = v_company_id
     AND (activity_status IS DISTINCT FROM 'ativo' OR last_interaction_at IS NULL OR last_interaction_at < now() - interval '1 hour');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_activity_orders ON public.orders;
CREATE TRIGGER trg_promote_activity_orders AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.trg_promote_company_activity();

DROP TRIGGER IF EXISTS trg_promote_activity_activities ON public.activities;
CREATE TRIGGER trg_promote_activity_activities AFTER INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION public.trg_promote_company_activity();

DROP TRIGGER IF EXISTS trg_promote_activity_notes ON public.entity_notes;
CREATE TRIGGER trg_promote_activity_notes AFTER INSERT ON public.entity_notes FOR EACH ROW EXECUTE FUNCTION public.trg_promote_company_activity();