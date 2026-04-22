-- Corrigir default de timezone do tenant para America/Sao_Paulo
-- Antes: get_tenant_timezone retornava 'UTC' quando o tenant não tinha settings.timezone,
-- causando bloqueio incorreto de acesso (UTC está 3h à frente do horário de Brasília).

CREATE OR REPLACE FUNCTION public.get_tenant_timezone(p_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(NULLIF(t.settings->>'timezone', ''), 'America/Sao_Paulo')
  FROM public.tenants t
  WHERE t.id = p_tenant_id
$function$;

-- Garantir que tenants existentes sem timezone passem a usar America/Sao_Paulo explicitamente
UPDATE public.tenants
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('timezone', 'America/Sao_Paulo')
WHERE settings->>'timezone' IS NULL OR settings->>'timezone' = '';