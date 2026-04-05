DROP POLICY IF EXISTS "Users can view own tenant settings" ON public.tenant_settings;
DROP POLICY IF EXISTS "Users can upsert own tenant settings" ON public.tenant_settings;
DROP POLICY IF EXISTS "Users can update own tenant settings" ON public.tenant_settings;

CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT active_tenant_id FROM profiles WHERE id = p_user_id AND active_tenant_id IS NOT NULL
  UNION
  SELECT tenant_id FROM user_tenants WHERE user_id = p_user_id
$$;

CREATE POLICY "Users can view own tenant settings"
  ON public.tenant_settings FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert own tenant settings"
  ON public.tenant_settings FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update own tenant settings"
  ON public.tenant_settings FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));