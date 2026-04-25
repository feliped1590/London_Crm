DROP POLICY IF EXISTS "Authenticated users can view WhatsApp contacts" ON public.whatsapp_contacts;
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp contacts" ON public.whatsapp_contacts;
DROP POLICY IF EXISTS "Authenticated users can update whatsapp contacts" ON public.whatsapp_contacts;
DROP POLICY IF EXISTS "Authenticated users can delete whatsapp contacts" ON public.whatsapp_contacts;
DROP POLICY IF EXISTS "Users can view scoped WhatsApp contacts" ON public.whatsapp_contacts;
DROP POLICY IF EXISTS "Users can insert scoped WhatsApp contacts" ON public.whatsapp_contacts;
DROP POLICY IF EXISTS "Users can update scoped WhatsApp contacts" ON public.whatsapp_contacts;
DROP POLICY IF EXISTS "Users can delete scoped WhatsApp contacts" ON public.whatsapp_contacts;

CREATE POLICY "Users can view scoped WhatsApp contacts"
ON public.whatsapp_contacts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.whatsapp_messages wm
    JOIN public.whatsapp_instances wi ON wi.id = wm.instance_id
    WHERE wm.phone = whatsapp_contacts.phone_number
      AND wi.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = whatsapp_contacts.contact_id
      AND (
        c.owner_id = auth.uid()
        OR c.created_by = auth.uid()
        OR c.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      )
  )
);

CREATE POLICY "Users can insert scoped WhatsApp contacts"
ON public.whatsapp_contacts
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
  OR contact_id IS NULL
  OR EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = whatsapp_contacts.contact_id
      AND (
        c.owner_id = auth.uid()
        OR c.created_by = auth.uid()
        OR c.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      )
  )
);

CREATE POLICY "Users can update scoped WhatsApp contacts"
ON public.whatsapp_contacts
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = whatsapp_contacts.contact_id
      AND (
        c.owner_id = auth.uid()
        OR c.created_by = auth.uid()
        OR c.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
  OR contact_id IS NULL
  OR EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = whatsapp_contacts.contact_id
      AND (
        c.owner_id = auth.uid()
        OR c.created_by = auth.uid()
        OR c.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      )
  )
);

CREATE POLICY "Users can delete scoped WhatsApp contacts"
ON public.whatsapp_contacts
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = whatsapp_contacts.contact_id
      AND (
        c.owner_id = auth.uid()
        OR c.created_by = auth.uid()
        OR c.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      )
  )
);

DROP POLICY IF EXISTS "Admins can view request logs" ON public.request_logs;
CREATE POLICY "Admins can view request logs"
ON public.request_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
);