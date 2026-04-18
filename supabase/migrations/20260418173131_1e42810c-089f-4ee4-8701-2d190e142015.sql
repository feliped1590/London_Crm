-- 1. Security definer helper: checa se o auth.uid() atual tem acesso a uma legal_entity
CREATE OR REPLACE FUNCTION public.user_has_legal_entity_access(_legal_entity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_legal_entities ule
    JOIN public.profiles p ON p.id = ule.user_id
    WHERE p.user_id = auth.uid()
      AND ule.legal_entity_id = _legal_entity_id
  );
$$;

-- 2. Helper: usuário não possui nenhum vínculo (compat legado = vê tudo)
CREATE OR REPLACE FUNCTION public.user_has_no_legal_entity_links()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_legal_entities ule
    JOIN public.profiles p ON p.id = ule.user_id
    WHERE p.user_id = auth.uid()
  );
$$;

-- 3. Substitui policy de SELECT em pipelines
DROP POLICY IF EXISTS "Authenticated users can view pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Users see pipelines of their legal entities" ON public.pipelines;

CREATE POLICY "Users see pipelines of their legal entities"
ON public.pipelines
FOR SELECT
TO authenticated
USING (
  legal_entity_id IS NULL
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR public.user_has_no_legal_entity_links()
  OR public.user_has_legal_entity_access(legal_entity_id)
);

-- 4. Index de apoio (idempotente)
CREATE INDEX IF NOT EXISTS idx_user_legal_entities_user_id ON public.user_legal_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_legal_entities_legal_entity_id ON public.user_legal_entities(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_legal_entity_id ON public.pipelines(legal_entity_id);