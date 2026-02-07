-- Remover política duplicada que expõe whatsapp_contacts publicamente
DROP POLICY IF EXISTS "Authenticated users can view whatsapp contacts" ON public.whatsapp_contacts;

-- Corrigir as outras políticas para usar roles:{authenticated} em vez de roles:{public}
DROP POLICY IF EXISTS "Authenticated users can delete whatsapp contacts" ON public.whatsapp_contacts;
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp contacts" ON public.whatsapp_contacts;
DROP POLICY IF EXISTS "Authenticated users can update whatsapp contacts" ON public.whatsapp_contacts;

-- Recriar políticas com roles corretas
CREATE POLICY "Authenticated users can delete whatsapp contacts"
ON public.whatsapp_contacts FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert whatsapp contacts"
ON public.whatsapp_contacts FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update whatsapp contacts"
ON public.whatsapp_contacts FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);