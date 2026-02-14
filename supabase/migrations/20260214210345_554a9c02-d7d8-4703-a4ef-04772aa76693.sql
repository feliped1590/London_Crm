
-- =============================================
-- FASE 4F: Permissões por CNPJ (Modo Permissivo)
-- =============================================

-- 1. Tabela user_legal_entities
CREATE TABLE IF NOT EXISTS public.user_legal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  legal_entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, legal_entity_id)
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_user_legal_entities_user ON public.user_legal_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_legal_entities_legal_entity ON public.user_legal_entities(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_orders_legal_entity ON public.orders(legal_entity_id) WHERE legal_entity_id IS NOT NULL;

-- 3. RLS na tabela user_legal_entities
ALTER TABLE public.user_legal_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_user_legal_entities"
ON public.user_legal_entities
FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
  )
);

-- 4. Função can_access_legal_entity (SECURITY DEFINER + search_path)
CREATE OR REPLACE FUNCTION public.can_access_legal_entity(
  p_user_id UUID,
  p_legal_entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_restrictions BOOLEAN;
BEGIN
  -- 1. Pedidos legados (NULL = acesso livre)
  IF p_legal_entity_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- 2. Admin do tenant = acesso total
  IF EXISTS (
    SELECT 1 FROM user_tenants
    WHERE user_id = p_user_id
    AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 3. Sem restrições = modo permissivo
  SELECT EXISTS (
    SELECT 1 FROM user_legal_entities
    WHERE user_id = p_user_id
  ) INTO has_restrictions;

  IF NOT has_restrictions THEN
    RETURN TRUE;
  END IF;

  -- 4. Permissão explícita
  RETURN EXISTS (
    SELECT 1 FROM user_legal_entities
    WHERE user_id = p_user_id
    AND legal_entity_id = p_legal_entity_id
  );
END;
$$;

-- 5. Policies RESTRICTIVE em orders para legal_entity
-- SELECT
CREATE POLICY "legal_entity_select_orders"
ON public.orders
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.can_access_legal_entity(auth.uid(), legal_entity_id)
);

-- INSERT
CREATE POLICY "legal_entity_insert_orders"
ON public.orders
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_legal_entity(auth.uid(), legal_entity_id)
);

-- UPDATE
CREATE POLICY "legal_entity_update_orders"
ON public.orders
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  public.can_access_legal_entity(auth.uid(), legal_entity_id)
)
WITH CHECK (
  public.can_access_legal_entity(auth.uid(), legal_entity_id)
);
