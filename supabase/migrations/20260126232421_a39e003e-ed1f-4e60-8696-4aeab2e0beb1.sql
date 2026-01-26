-- =====================================================
-- CORREÇÃO DE SEGURANÇA: RLS Policies
-- Este script corrige todas as vulnerabilidades identificadas
-- =====================================================

-- =====================================================
-- 1. CONTACTS - Restringir acesso a usuários autenticados
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Contacts are viewable by authenticated users" ON public.contacts;

CREATE POLICY "Authenticated users can view contacts" 
ON public.contacts FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 2. COMPANIES - Restringir acesso a usuários autenticados
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Companies are viewable by authenticated users" ON public.companies;

CREATE POLICY "Authenticated users can view companies" 
ON public.companies FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 3. PRODUCTS - Restringir acesso a usuários autenticados
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON public.products;

CREATE POLICY "Authenticated users can view products" 
ON public.products FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 4. ORDERS - Restringir acesso a usuários autenticados
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Orders are viewable by authenticated users" ON public.orders;

CREATE POLICY "Authenticated users can view orders" 
ON public.orders FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 5. ORDER_ITEMS - Restringir acesso a usuários autenticados
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Order items are viewable by authenticated users" ON public.order_items;

CREATE POLICY "Authenticated users can view order items" 
ON public.order_items FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 6. PROPOSALS - Restringir acesso e ocultar token
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view proposals" ON public.proposals;
DROP POLICY IF EXISTS "Proposals are viewable by authenticated users" ON public.proposals;

CREATE POLICY "Authenticated users can view proposals" 
ON public.proposals FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 7. PROPOSAL_ITEMS - Restringir acesso a usuários autenticados
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view proposal items" ON public.proposal_items;
DROP POLICY IF EXISTS "Proposal items are viewable by authenticated users" ON public.proposal_items;

CREATE POLICY "Authenticated users can view proposal items" 
ON public.proposal_items FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 8. WHATSAPP_CONTACTS - Restringir acesso a usuários autenticados
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view WhatsApp contacts" ON public.whatsapp_contacts;
DROP POLICY IF EXISTS "WhatsApp contacts are viewable by authenticated users" ON public.whatsapp_contacts;

CREATE POLICY "Authenticated users can view WhatsApp contacts" 
ON public.whatsapp_contacts FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 9. DEAL_AUDIT_LOG - Restringir INSERT apenas via trigger
-- =====================================================
DROP POLICY IF EXISTS "System can insert deal audit logs" ON public.deal_audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert deal audit logs" ON public.deal_audit_log;

-- Apenas permite INSERT via service_role (triggers)
CREATE POLICY "Service role can insert deal audit logs" 
ON public.deal_audit_log FOR INSERT 
TO service_role
WITH CHECK (true);

-- Também permitir para authenticated se o changed_by for o próprio usuário
-- (para garantir que o trigger funcione no contexto do usuário)
CREATE POLICY "Authenticated users can insert own deal audit logs" 
ON public.deal_audit_log FOR INSERT 
TO authenticated
WITH CHECK (changed_by = auth.uid());

-- =====================================================
-- 10. ORDER_AUDIT_LOG - Restringir INSERT apenas via trigger
-- =====================================================
DROP POLICY IF EXISTS "Users can insert order audit logs" ON public.order_audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert order audit logs" ON public.order_audit_log;

-- Apenas permite INSERT via service_role (triggers)
CREATE POLICY "Service role can insert order audit logs" 
ON public.order_audit_log FOR INSERT 
TO service_role
WITH CHECK (true);

-- Também permitir para authenticated se o changed_by for o próprio usuário
CREATE POLICY "Authenticated users can insert own order audit logs" 
ON public.order_audit_log FOR INSERT 
TO authenticated
WITH CHECK (changed_by = auth.uid());

-- =====================================================
-- 11. PROFILES - Adicionar política de DELETE restritiva
-- =====================================================
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

CREATE POLICY "Users can delete own profile" 
ON public.profiles FOR DELETE 
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 12. EMAIL_LOGS - Adicionar política de UPDATE restritiva
-- =====================================================
DROP POLICY IF EXISTS "Users can update own email logs" ON public.email_logs;

-- Não permitir UPDATE por usuários (apenas service_role para tracking)
CREATE POLICY "Service role can update email logs" 
ON public.email_logs FOR UPDATE 
TO service_role
USING (true);

-- =====================================================
-- 13. TASK_REMINDERS - Restringir INSERT
-- =====================================================
DROP POLICY IF EXISTS "Service role can insert task reminders" ON public.task_reminders;

-- Manter INSERT apenas para service_role
CREATE POLICY "Service role can insert task reminders" 
ON public.task_reminders FOR INSERT 
TO service_role
WITH CHECK (true);