
CREATE OR REPLACE FUNCTION public.check_owner_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    IF NOT public.has_role(auth.uid(), 'admin') 
       AND NOT public.has_role(auth.uid(), 'desenvolvedor') THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o responsável';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
