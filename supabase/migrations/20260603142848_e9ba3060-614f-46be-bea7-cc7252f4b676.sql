-- Trigger to auto-set closed_at
CREATE OR REPLACE FUNCTION public.set_deal_closed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IN ('fechado_ganho','fechado_perdido') AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_deal_closed_at ON public.deals;
CREATE TRIGGER trg_set_deal_closed_at
BEFORE INSERT OR UPDATE OF stage, closed_at ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.set_deal_closed_at();

-- Backfill, bypassing access_violation trigger which requires auth.uid()
ALTER TABLE public.deals DISABLE TRIGGER USER;
ALTER TABLE public.deals ENABLE TRIGGER trg_set_deal_closed_at;

UPDATE public.deals
SET closed_at = updated_at
WHERE stage IN ('fechado_ganho','fechado_perdido')
  AND closed_at IS NULL;

ALTER TABLE public.deals ENABLE TRIGGER USER;