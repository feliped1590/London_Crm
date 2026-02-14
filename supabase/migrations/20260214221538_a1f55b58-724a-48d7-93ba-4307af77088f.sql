
-- =============================================
-- FASE 5A-2: Ativar Delegação nas RLS Operacionais
-- =============================================

-- 1. DEALS — SELECT
DROP POLICY IF EXISTS "Users can view deals they have access to" ON deals;
CREATE POLICY "Users can view deals they have access to"
ON deals FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR id IN (SELECT deal_id FROM deal_participants WHERE user_id = auth.uid())
  OR can_manage_portfolio(auth.uid(), owner_id, 'deal')
);

-- 2. DEALS — UPDATE
DROP POLICY IF EXISTS "Users can update deals they own or are admin" ON deals;
CREATE POLICY "Users can update deals they own or are admin"
ON deals FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR can_manage_portfolio(auth.uid(), owner_id, 'deal')
);

-- 3. COMPANIES — UPDATE
DROP POLICY IF EXISTS "Users can update companies they own or are admin" ON companies;
CREATE POLICY "Users can update companies they own or are admin"
ON companies FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR can_manage_portfolio(auth.uid(), owner_id, 'company')
);

-- 4. COMPANIES — DELETE
DROP POLICY IF EXISTS "Users can delete companies they own or are admin" ON companies;
CREATE POLICY "Users can delete companies they own or are admin"
ON companies FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR can_manage_portfolio(auth.uid(), owner_id, 'company')
);

-- 5. CONTACTS — UPDATE
DROP POLICY IF EXISTS "Users can update contacts they own or are admin" ON contacts;
CREATE POLICY "Users can update contacts they own or are admin"
ON contacts FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR can_manage_portfolio(auth.uid(), owner_id, 'contact')
);

-- 6. ORDERS — UPDATE (via get_company_owner)
DROP POLICY IF EXISTS "Users can update orders they created or are admin" ON orders;
CREATE POLICY "Users can update orders they created or are admin"
ON orders FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR can_manage_portfolio(auth.uid(), get_company_owner(company_id), 'order')
);
