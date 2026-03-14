
CREATE OR REPLACE FUNCTION public.audit_company_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_old_rep_name TEXT;
  v_new_rep_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  -- Auditar mudanças no setor_id
  IF OLD.setor_id IS DISTINCT FROM NEW.setor_id THEN
    INSERT INTO public.company_audit_log (company_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'setor_id', 'Setor', OLD.setor_id::TEXT, NEW.setor_id::TEXT, v_user_id);
  END IF;
  
  -- Auditar mudanças no segmento_id
  IF OLD.segmento_id IS DISTINCT FROM NEW.segmento_id THEN
    INSERT INTO public.company_audit_log (company_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'segmento_id', 'Segmento', OLD.segmento_id::TEXT, NEW.segmento_id::TEXT, v_user_id);
  END IF;
  
  -- Auditar mudanças no atividade_id
  IF OLD.atividade_id IS DISTINCT FROM NEW.atividade_id THEN
    INSERT INTO public.company_audit_log (company_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'atividade_id', 'Atividade', OLD.atividade_id::TEXT, NEW.atividade_id::TEXT, v_user_id);
  END IF;
  
  -- Auditar mudanças no owner_id
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    INSERT INTO public.company_audit_log (company_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'owner_id', 'Vendedor Responsável', OLD.owner_id::TEXT, NEW.owner_id::TEXT, v_user_id);
  END IF;
  
  -- Auditar mudanças no sales_rep_id (Vendedor Comercial)
  IF OLD.sales_rep_id IS DISTINCT FROM NEW.sales_rep_id THEN
    SELECT name INTO v_old_rep_name FROM public.sales_reps WHERE id = OLD.sales_rep_id;
    SELECT name INTO v_new_rep_name FROM public.sales_reps WHERE id = NEW.sales_rep_id;
    
    INSERT INTO public.company_audit_log (company_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'sales_rep_id', 'Vendedor Comercial', 
            COALESCE(v_old_rep_name, '(nenhum)'), 
            COALESCE(v_new_rep_name, '(nenhum)'), 
            v_user_id);
  END IF;
  
  -- Auditar mudanças no status ativo
  IF OLD.active IS DISTINCT FROM NEW.active THEN
    INSERT INTO public.company_audit_log (company_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'active', 'Status Ativo', 
            CASE WHEN OLD.active THEN 'Ativo' ELSE 'Inativo' END,
            CASE WHEN NEW.active THEN 'Ativo' ELSE 'Inativo' END,
            v_user_id);
  END IF;
  
  -- Auditar mudanças no parent_company_id
  IF OLD.parent_company_id IS DISTINCT FROM NEW.parent_company_id THEN
    INSERT INTO public.company_audit_log (company_id, field_name, field_label, old_value, new_value, changed_by)
    VALUES (NEW.id, 'parent_company_id', 'Empresa Matriz', OLD.parent_company_id::TEXT, NEW.parent_company_id::TEXT, v_user_id);
  END IF;
  
  RETURN NEW;
END;
$function$;
