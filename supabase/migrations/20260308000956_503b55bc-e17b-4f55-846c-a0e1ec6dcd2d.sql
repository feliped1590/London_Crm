
-- Update check_owner_change to allow changes from SECURITY DEFINER functions (system sync)
-- The key insight: when called from a SECURITY DEFINER trigger, auth.uid() is NULL
CREATE OR REPLACE FUNCTION public.check_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    -- Allow if called from system context (auth.uid() is NULL in SECURITY DEFINER triggers)
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    
    IF NOT public.has_role(auth.uid(), 'admin') 
       AND NOT public.has_role(auth.uid(), 'desenvolvedor') THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o responsável';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
