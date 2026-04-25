-- Harden company audit log visibility and remove global realtime broadcast for WhatsApp messages

CREATE OR REPLACE FUNCTION public.can_view_company_audit_log(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = _company_id
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
        OR c.owner_id = auth.uid()
        OR c.created_by = auth.uid()
        OR c.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
        OR public.can_manage_portfolio(auth.uid(), c.sales_rep_id, 'company')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_company_audit_log(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_company_audit_log(uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view company audit logs" ON public.company_audit_log;
DROP POLICY IF EXISTS "Users can view scoped company audit logs" ON public.company_audit_log;

CREATE POLICY "Users can view scoped company audit logs"
ON public.company_audit_log
FOR SELECT
TO authenticated
USING (public.can_view_company_audit_log(company_id));

-- Prevent sensitive WhatsApp message payloads from being broadcast through the global realtime publication.
ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_messages;