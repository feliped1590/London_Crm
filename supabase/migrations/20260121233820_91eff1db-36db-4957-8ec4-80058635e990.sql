-- Remover política antiga de SELECT
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.whatsapp_messages;

-- Criar nova política: usuários veem apenas mensagens das suas instâncias, admins veem tudo
CREATE POLICY "Users can view messages from their instances or admins see all"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR instance_id IN (
      SELECT id FROM public.whatsapp_instances WHERE user_id = auth.uid()
    )
  );

-- Remover política antiga de UPDATE
DROP POLICY IF EXISTS "Authenticated users can update messages" ON public.whatsapp_messages;

-- Criar nova política de UPDATE
CREATE POLICY "Users can update messages from their instances or admins"
  ON public.whatsapp_messages FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR instance_id IN (
      SELECT id FROM public.whatsapp_instances WHERE user_id = auth.uid()
    )
  );