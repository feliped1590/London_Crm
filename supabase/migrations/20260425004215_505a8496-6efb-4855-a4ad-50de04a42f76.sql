DROP POLICY IF EXISTS "tenant_isolation_contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can view scoped contacts" ON public.contacts;

CREATE POLICY "Users can view scoped contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  OR public.can_manage_portfolio(auth.uid(), public.get_company_owner(company_id), 'contact')
  OR EXISTS (
    SELECT 1
    FROM public.deals d
    WHERE d.contact_id = contacts.id
      AND (d.owner_id = auth.uid() OR d.created_by = auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.contact_id = contacts.id
      AND (o.created_by = auth.uid() OR o.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  )
  OR EXISTS (
    SELECT 1
    FROM public.proposals p
    WHERE p.contact_id = contacts.id
      AND (p.created_by = auth.uid() OR p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  )
  OR EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.contact_id = contacts.id
      AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contacts;
CREATE POLICY "Users can insert scoped contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Users can update contacts they own or are admin" ON public.contacts;
CREATE POLICY "Users can update scoped contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR public.can_manage_portfolio(auth.uid(), public.get_company_owner(company_id), 'contact')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR public.can_manage_portfolio(auth.uid(), public.get_company_owner(company_id), 'contact')
);

DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;
CREATE POLICY "Admins can delete contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
);