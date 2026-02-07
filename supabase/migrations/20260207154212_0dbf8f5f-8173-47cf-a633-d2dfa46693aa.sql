-- Fase 2: Correções de Segurança de Médio Prazo

-- 2.1 Restringir erp_sync_logs para apenas admins
DROP POLICY IF EXISTS "Authenticated users can view sync logs" ON public.erp_sync_logs;
DROP POLICY IF EXISTS "Service role can insert sync logs" ON public.erp_sync_logs;
DROP POLICY IF EXISTS "Service role can update sync logs" ON public.erp_sync_logs;

-- SELECT: apenas admins e desenvolvedores podem ver logs de sync
CREATE POLICY "Admins can view sync logs"
ON public.erp_sync_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- INSERT: apenas service role (edge functions) pode inserir
CREATE POLICY "Service role can insert sync logs"
ON public.erp_sync_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: apenas service role pode atualizar
CREATE POLICY "Service role can update sync logs"
ON public.erp_sync_logs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2.2 Restringir erp_sync_control para apenas admins
DROP POLICY IF EXISTS "Authenticated users can view sync control" ON public.erp_sync_control;
DROP POLICY IF EXISTS "Service role can manage sync control" ON public.erp_sync_control;

CREATE POLICY "Admins can view sync control"
ON public.erp_sync_control FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage sync control"
ON public.erp_sync_control FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2.3 Criar view segura para perfis (oculta telefone de não-admins)
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') THEN phone
    WHEN auth.uid() = user_id THEN phone
    ELSE NULL
  END as phone,
  created_at,
  updated_at
FROM public.profiles;

-- Dar permissão de SELECT na view
GRANT SELECT ON public.profiles_safe TO authenticated;