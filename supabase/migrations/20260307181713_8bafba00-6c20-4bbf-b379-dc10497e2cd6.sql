
-- Fase 2: Depreciação definitiva - remover companies.industry
-- Atualizar audit_company_changes para remover referência a custom_fields->>'segmento'
-- e adicionar auditoria dos novos campos de classificação

-- 1. Atualizar função audit_company_changes
CREATE OR REPLACE FUNCTION public.audit_company_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
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

-- 2. Atualizar get_customer_filter_options removendo industries
CREATE OR REPLACE FUNCTION public.get_customer_filter_options()
 RETURNS TABLE(states text[], cities text[], industries text[], setores json[], segmentos json[], atividades json[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT ARRAY_AGG(DISTINCT state ORDER BY state) FROM companies WHERE state IS NOT NULL AND state != '') as states,
    (SELECT ARRAY_AGG(DISTINCT city ORDER BY city) FROM companies WHERE city IS NOT NULL AND city != '') as cities,
    ARRAY[]::text[] as industries,
    (SELECT ARRAY_AGG(json_build_object('id', s.id, 'nome', s.nome) ORDER BY s.sort_order) FROM setores s WHERE s.is_active = true) as setores,
    (SELECT ARRAY_AGG(json_build_object('id', sg.id, 'nome', sg.nome, 'setor_id', sg.setor_id) ORDER BY sg.sort_order) FROM segmentos sg WHERE sg.is_active = true) as segmentos,
    (SELECT ARRAY_AGG(json_build_object('id', a.id, 'nome', a.nome, 'segmento_id', a.segmento_id) ORDER BY a.sort_order) FROM atividades a WHERE a.is_active = true) as atividades;
$function$;

-- 3. Atualizar search_customers_paginated removendo p_industry e industry do retorno
DROP FUNCTION IF EXISTS public.search_customers_paginated(text,text,text,text,uuid,text,uuid,uuid,uuid,text,text,integer,integer);

CREATE OR REPLACE FUNCTION public.search_customers_paginated(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_setor_id uuid DEFAULT NULL,
  p_segmento_id uuid DEFAULT NULL,
  p_atividade_id uuid DEFAULT NULL,
  p_sort_field text DEFAULT 'name',
  p_sort_dir text DEFAULT 'asc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, name text, fantasia text, cnpj text, phone text, email text,
  city text, state text, address text, active boolean,
  custom_fields jsonb, owner_id uuid, owner_name text, created_at timestamptz,
  contact_name text, primary_contact_name text, primary_contact_job_title text,
  primary_contact_mobile text, primary_contact_email text,
  contacts_count bigint, deals_count bigint, deals_open_count bigint,
  deals_won_count bigint, deals_lost_count bigint, deals_total_value numeric,
  last_interaction_at timestamptz, last_order_at timestamptz,
  total_count bigint, region text,
  setor_id uuid, segmento_id uuid, atividade_id uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total bigint;
  v_search_lower text;
  v_search_digits text;
BEGIN
  v_search_lower := lower(trim(coalesce(p_search, '')));
  v_search_digits := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');

  SELECT COUNT(*)::bigint INTO v_total
  FROM companies c
  WHERE
    (p_status = 'all' OR (p_status = 'active' AND c.active = true) OR (p_status = 'inactive' AND c.active = false))
    AND (p_state IS NULL OR c.state = p_state)
    AND (p_city IS NULL OR c.city = p_city)
    AND (p_owner_id IS NULL OR c.owner_id = p_owner_id)
    AND (p_setor_id IS NULL OR c.setor_id = p_setor_id)
    AND (p_segmento_id IS NULL OR c.segmento_id = p_segmento_id)
    AND (p_atividade_id IS NULL OR c.atividade_id = p_atividade_id)
    AND (
      v_search_lower = '' 
      OR lower(c.name) LIKE '%' || v_search_lower || '%'
      OR lower(coalesce(c.fantasia, '')) LIKE '%' || v_search_lower || '%'
      OR (v_search_digits != '' AND regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') LIKE '%' || v_search_digits || '%')
      OR lower(coalesce(c.city, '')) LIKE '%' || v_search_lower || '%'
      OR lower(coalesce(c.email, '')) LIKE '%' || v_search_lower || '%'
      OR (v_search_digits != '' AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') LIKE '%' || v_search_digits || '%')
      OR lower(coalesce(c.contact_name, '')) LIKE '%' || v_search_lower || '%'
    );

  RETURN QUERY
  SELECT
    c.id, c.name, c.fantasia, c.cnpj, c.phone, c.email, c.city, c.state, c.address, c.active,
    c.custom_fields::jsonb, c.owner_id, p.full_name as owner_name, c.created_at, c.contact_name,
    (SELECT ct.first_name || coalesce(' ' || ct.last_name, '') FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT ct.job_title FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT ct.mobile FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT ct.email FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id),
    (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id),
    (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id AND dl.stage NOT IN ('fechado_ganho','fechado_perdido')),
    (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id AND dl.stage = 'fechado_ganho'),
    (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id AND dl.stage = 'fechado_perdido'),
    (SELECT COALESCE(SUM(dl.value), 0) FROM deals dl WHERE dl.company_id = c.id),
    (SELECT MAX(a.created_at) FROM activities a WHERE a.company_id = c.id),
    (SELECT MAX(o.created_at) FROM orders o WHERE o.company_id = c.id),
    v_total,
    public.get_region_by_state(c.state),
    c.setor_id, c.segmento_id, c.atividade_id
  FROM companies c
  LEFT JOIN profiles p ON p.user_id = c.owner_id
  WHERE
    (p_status = 'all' OR (p_status = 'active' AND c.active = true) OR (p_status = 'inactive' AND c.active = false))
    AND (p_state IS NULL OR c.state = p_state)
    AND (p_city IS NULL OR c.city = p_city)
    AND (p_owner_id IS NULL OR c.owner_id = p_owner_id)
    AND (p_setor_id IS NULL OR c.setor_id = p_setor_id)
    AND (p_segmento_id IS NULL OR c.segmento_id = p_segmento_id)
    AND (p_atividade_id IS NULL OR c.atividade_id = p_atividade_id)
    AND (
      v_search_lower = '' 
      OR lower(c.name) LIKE '%' || v_search_lower || '%'
      OR lower(coalesce(c.fantasia, '')) LIKE '%' || v_search_lower || '%'
      OR (v_search_digits != '' AND regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') LIKE '%' || v_search_digits || '%')
      OR lower(coalesce(c.city, '')) LIKE '%' || v_search_lower || '%'
      OR lower(coalesce(c.email, '')) LIKE '%' || v_search_lower || '%'
      OR (v_search_digits != '' AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') LIKE '%' || v_search_digits || '%')
      OR lower(coalesce(c.contact_name, '')) LIKE '%' || v_search_lower || '%'
    )
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_field
        WHEN 'name' THEN lower(c.name)
        WHEN 'city' THEN lower(coalesce(c.city, ''))
        WHEN 'state' THEN lower(coalesce(c.state, ''))
        WHEN 'created_at' THEN c.created_at::text
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_dir = 'desc' THEN
      CASE p_sort_field
        WHEN 'name' THEN lower(c.name)
        WHEN 'city' THEN lower(coalesce(c.city, ''))
        WHEN 'state' THEN lower(coalesce(c.state, ''))
        WHEN 'created_at' THEN c.created_at::text
      END
    END DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- 4. Remover coluna industry da tabela companies
ALTER TABLE public.companies DROP COLUMN IF EXISTS industry;
