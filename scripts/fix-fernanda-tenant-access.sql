-- Execute no SQL Editor do Supabase para liberar AGORA usuários bloqueados
-- (ex.: Fernanda) que já têm CNPJ em user_legal_entities mas sem user_tenants.

INSERT INTO public.user_tenants (user_id, tenant_id, role)
SELECT DISTINCT p.user_id, ule.tenant_id, 'member'
FROM public.user_legal_entities ule
JOIN public.profiles p ON p.id = ule.user_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_tenants ut
  WHERE ut.user_id = p.user_id
    AND ut.tenant_id = ule.tenant_id
);

UPDATE public.profiles p
SET
  active_tenant_id = COALESCE(p.active_tenant_id, sub.tenant_id),
  active_legal_entity_id = COALESCE(p.active_legal_entity_id, sub.legal_entity_id)
FROM (
  SELECT DISTINCT ON (ule.user_id)
    ule.user_id AS profile_id,
    ule.tenant_id,
    ule.legal_entity_id
  FROM public.user_legal_entities ule
  ORDER BY ule.user_id, ule.created_at ASC
) sub
WHERE p.id = sub.profile_id
  AND (p.active_tenant_id IS NULL OR p.active_legal_entity_id IS NULL);

-- Conferência (opcional): quem se chama Fernanda e como ficou o vínculo
SELECT
  p.full_name,
  p.user_id,
  p.active_tenant_id,
  p.active_legal_entity_id,
  ut.tenant_id AS user_tenant_id,
  ule.legal_entity_id
FROM public.profiles p
LEFT JOIN public.user_tenants ut ON ut.user_id = p.user_id
LEFT JOIN public.user_legal_entities ule ON ule.user_id = p.id
WHERE p.full_name ILIKE '%fernanda%';
