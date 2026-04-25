CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT active_tenant_id FROM public.profiles WHERE user_id = p_user_id AND active_tenant_id IS NOT NULL
  UNION
  SELECT tenant_id FROM public.user_tenants WHERE user_id = p_user_id
$$;

ALTER TABLE public.companies_classification_backup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_classification_backup_admin_select" ON public.companies_classification_backup;
CREATE POLICY "companies_classification_backup_admin_select"
ON public.companies_classification_backup
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view scoped profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'desenvolvedor')
  OR active_tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;
CREATE POLICY "Users can view scoped roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'desenvolvedor')
);

DROP POLICY IF EXISTS "Authenticated users can view activities" ON public.activities;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view proposals" ON public.proposals;
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can view email logs" ON public.email_logs;

DROP POLICY IF EXISTS "Authenticated users can view credit analyses" ON public.credit_analyses;
DROP POLICY IF EXISTS "Usuários autenticados podem ver análises de crédito" ON public.credit_analyses;
CREATE POLICY "Credit analyses restricted read"
ON public.credit_analyses
FOR SELECT
TO authenticated
USING (public.can_update_credit_score(auth.uid()) OR consulted_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can view credit documents" ON public.credit_documents;
DROP POLICY IF EXISTS "Authenticated users can insert credit documents" ON public.credit_documents;
DROP POLICY IF EXISTS "Authenticated users can delete credit documents" ON public.credit_documents;
CREATE POLICY "Credit documents restricted read"
ON public.credit_documents
FOR SELECT
TO authenticated
USING (public.can_update_credit_score(auth.uid()) OR uploaded_by = auth.uid());
CREATE POLICY "Credit documents restricted insert"
ON public.credit_documents
FOR INSERT
TO authenticated
WITH CHECK (public.can_update_credit_score(auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "Credit documents restricted delete"
ON public.credit_documents
FOR DELETE
TO authenticated
USING (public.can_update_credit_score(auth.uid()));

DROP POLICY IF EXISTS "tenant_isolation_company_erp_financial" ON public.company_erp_financial;
CREATE POLICY "company_erp_financial_restricted_select"
ON public.company_erp_financial
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'faturamento')
  )
);
CREATE POLICY "company_erp_financial_restricted_write"
ON public.company_erp_financial
FOR ALL
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor')
    OR public.has_role(auth.uid(), 'financeiro')
  )
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor')
    OR public.has_role(auth.uid(), 'financeiro')
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert product_classes" ON public.product_classes;
DROP POLICY IF EXISTS "Authenticated users can update product_classes" ON public.product_classes;
DROP POLICY IF EXISTS "Authenticated users can delete product_classes" ON public.product_classes;
CREATE POLICY "Admins can insert product_classes"
ON public.product_classes
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can update product_classes"
ON public.product_classes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can delete product_classes"
ON public.product_classes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

DROP POLICY IF EXISTS "Authenticated users can insert product_families" ON public.product_families;
DROP POLICY IF EXISTS "Authenticated users can update product_families" ON public.product_families;
DROP POLICY IF EXISTS "Authenticated users can delete product_families" ON public.product_families;
CREATE POLICY "Admins can insert product_families"
ON public.product_families
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can update product_families"
ON public.product_families
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can delete product_families"
ON public.product_families
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

DROP POLICY IF EXISTS "Authenticated users can manage pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Admins can manage pipeline stages"
ON public.pipeline_stages
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));