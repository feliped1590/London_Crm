-- Hardening: search_path explícito (public, pg_temp) evita schema injection
CREATE OR REPLACE FUNCTION public.user_has_legal_entity_access(_legal_entity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_legal_entities ule
    JOIN public.profiles p ON p.id = ule.user_id
    WHERE p.user_id = auth.uid()
      AND ule.legal_entity_id = _legal_entity_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_no_legal_entity_links()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_legal_entities ule
    JOIN public.profiles p ON p.id = ule.user_id
    WHERE p.user_id = auth.uid()
  );
$$;