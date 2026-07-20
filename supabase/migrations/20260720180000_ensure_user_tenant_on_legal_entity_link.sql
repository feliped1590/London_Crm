-- Corrige e previne "Acesso bloqueado" por falta de user_tenants.
-- Sem user_tenants o RLS impede ler legal_entities.

-- 1) Backfill: vínculo de CNPJ → membership de tenant
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

-- 2) Contexto ativo nulo → preenche a partir do primeiro vínculo
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

-- 3) Usuários com perfil/role mas sem nenhum tenant → entra no tenant mais antigo ativo
INSERT INTO public.user_tenants (user_id, tenant_id, role)
SELECT p.user_id, t.id, 'member'
FROM public.profiles p
CROSS JOIN LATERAL (
  SELECT id
  FROM public.tenants
  WHERE COALESCE(active, true) = true
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
) t
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_tenants ut WHERE ut.user_id = p.user_id
)
ON CONFLICT (user_id, tenant_id) DO NOTHING;

UPDATE public.profiles p
SET active_tenant_id = t.id
FROM (
  SELECT id
  FROM public.tenants
  WHERE COALESCE(active, true) = true
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
) t
WHERE p.active_tenant_id IS NULL
  AND EXISTS (SELECT 1 FROM public.user_tenants ut WHERE ut.user_id = p.user_id);

-- 4) RPC admin (idempotente) — usada pela tela de Settings
CREATE OR REPLACE FUNCTION public.ensure_user_tenant_membership(
  p_auth_user_id uuid,
  p_tenant_id uuid,
  p_legal_entity_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem garantir membership de tenant';
  END IF;

  IF p_auth_user_id IS NULL OR p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'user_id e tenant_id são obrigatórios';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
  ) AND NOT public.has_role(auth.uid(), 'desenvolvedor'::public.app_role) THEN
    RAISE EXCEPTION 'Tenant fora do escopo do administrador';
  END IF;

  INSERT INTO public.user_tenants (user_id, tenant_id, role)
  VALUES (p_auth_user_id, p_tenant_id, 'member')
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  UPDATE public.profiles
  SET
    active_tenant_id = COALESCE(active_tenant_id, p_tenant_id),
    active_legal_entity_id = COALESCE(active_legal_entity_id, p_legal_entity_id)
  WHERE user_id = p_auth_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_tenant_membership(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_tenant_membership(uuid, uuid, uuid) TO authenticated;

-- 5) Trigger: vincular CNPJ também garante user_tenants + contexto ativo
CREATE OR REPLACE FUNCTION public.tg_user_legal_entity_ensure_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid;
BEGIN
  SELECT p.user_id INTO v_auth_user_id
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF v_auth_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_tenants (user_id, tenant_id, role)
  VALUES (v_auth_user_id, NEW.tenant_id, 'member')
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  UPDATE public.profiles
  SET
    active_tenant_id = COALESCE(active_tenant_id, NEW.tenant_id),
    active_legal_entity_id = COALESCE(active_legal_entity_id, NEW.legal_entity_id)
  WHERE user_id = v_auth_user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_legal_entity_ensure_tenant ON public.user_legal_entities;
CREATE TRIGGER trg_user_legal_entity_ensure_tenant
  AFTER INSERT ON public.user_legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_user_legal_entity_ensure_tenant();

-- 6) Novos usuários já nascem com tenant (evita bloqueio antes de vincular CNPJ)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'vendedor');

  SELECT t.id INTO v_tenant_id
  FROM public.tenants t
  WHERE COALESCE(t.active, true) = true
  ORDER BY t.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.user_tenants (user_id, tenant_id, role)
    VALUES (NEW.id, v_tenant_id, 'member')
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    UPDATE public.profiles
    SET active_tenant_id = COALESCE(active_tenant_id, v_tenant_id)
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
