
-- Trigger function: when a user_sales_reps row is inserted or updated,
-- update all companies with that sales_rep_id to have owner_id = the linked user_id
CREATE OR REPLACE FUNCTION public.sync_owner_on_sales_rep_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update all companies that belong to this sales_rep
  UPDATE public.companies
  SET owner_id = NEW.user_id,
      updated_at = now()
  WHERE sales_rep_id = NEW.sales_rep_id
    AND (owner_id IS DISTINCT FROM NEW.user_id);

  -- Update all contacts whose company belongs to this sales_rep
  UPDATE public.contacts
  SET owner_id = NEW.user_id,
      updated_at = now()
  WHERE company_id IN (
    SELECT id FROM public.companies WHERE sales_rep_id = NEW.sales_rep_id
  )
  AND (owner_id IS DISTINCT FROM NEW.user_id);

  -- Update all deals whose company belongs to this sales_rep
  UPDATE public.deals
  SET owner_id = NEW.user_id,
      updated_at = now()
  WHERE company_id IN (
    SELECT id FROM public.companies WHERE sales_rep_id = NEW.sales_rep_id
  )
  AND (owner_id IS DISTINCT FROM NEW.user_id);

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_owner_on_sales_rep_link ON public.user_sales_reps;
CREATE TRIGGER trg_sync_owner_on_sales_rep_link
  AFTER INSERT OR UPDATE ON public.user_sales_reps
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_owner_on_sales_rep_link();
