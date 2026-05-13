CREATE TABLE public.product_group_subgroups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.product_groups(id) ON DELETE CASCADE,
  subgroup_id uuid NOT NULL REFERENCES public.product_subgroups(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, subgroup_id)
);

CREATE INDEX idx_pgs_group ON public.product_group_subgroups(group_id);
CREATE INDEX idx_pgs_subgroup ON public.product_group_subgroups(subgroup_id);
CREATE INDEX idx_pgs_tenant ON public.product_group_subgroups(tenant_id);

ALTER TABLE public.product_group_subgroups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read group/subgroup links"
ON public.product_group_subgroups
FOR SELECT
TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admins can insert group/subgroup links"
ON public.product_group_subgroups
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
);

CREATE POLICY "Admins can delete group/subgroup links"
ON public.product_group_subgroups
FOR DELETE
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
);