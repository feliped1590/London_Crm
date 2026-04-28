CREATE TABLE IF NOT EXISTS public.user_recent_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('company', 'product')),
  entity_id uuid NOT NULL,
  interaction_type text NOT NULL DEFAULT 'view' CHECK (interaction_type IN ('create', 'update', 'view', 'open')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_interaction_at timestamptz NOT NULL DEFAULT now(),
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  interaction_count integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_user_recent_interactions_user_entity_recent
  ON public.user_recent_interactions (user_id, entity_type, last_interaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_recent_interactions_tenant
  ON public.user_recent_interactions (tenant_id);

ALTER TABLE public.user_recent_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own recent interactions" ON public.user_recent_interactions;
CREATE POLICY "Users can view own recent interactions"
ON public.user_recent_interactions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own recent interactions" ON public.user_recent_interactions;
CREATE POLICY "Users can insert own recent interactions"
ON public.user_recent_interactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update own recent interactions" ON public.user_recent_interactions;
CREATE POLICY "Users can update own recent interactions"
ON public.user_recent_interactions
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  AND tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
);
