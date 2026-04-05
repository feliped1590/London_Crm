CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, category)
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant settings"
  ON public.tenant_settings FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT active_tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can upsert own tenant settings"
  ON public.tenant_settings FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT active_tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own tenant settings"
  ON public.tenant_settings FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT active_tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );