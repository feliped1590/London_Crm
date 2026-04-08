
-- 1. Add erp_user_code to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS erp_user_code BIGINT DEFAULT NULL;

-- 2. Create order_type_erp_mapping table
CREATE TABLE IF NOT EXISTS public.order_type_erp_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  crm_order_type TEXT NOT NULL,
  erp_flow_code INTEGER NOT NULL,
  erp_flow_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_tenant_order_type UNIQUE (tenant_id, crm_order_type)
);

-- 3. Enable RLS
ALTER TABLE public.order_type_erp_mapping ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "Authenticated users can read order type mappings"
ON public.order_type_erp_mapping FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage order type mappings"
ON public.order_type_erp_mapping FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
