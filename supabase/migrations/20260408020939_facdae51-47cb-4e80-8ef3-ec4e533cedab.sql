
-- freight_type_erp_mapping
DROP POLICY IF EXISTS "Admins can manage freight mappings" ON freight_type_erp_mapping;
CREATE POLICY "Admins and devs can manage freight mappings"
  ON freight_type_erp_mapping FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

-- sale_type_erp_mapping
DROP POLICY IF EXISTS "Admins can manage sale type mappings" ON sale_type_erp_mapping;
CREATE POLICY "Admins and devs can manage sale type mappings"
  ON sale_type_erp_mapping FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

-- payment_method_erp_mapping
DROP POLICY IF EXISTS "Admins can manage payment mappings" ON payment_method_erp_mapping;
CREATE POLICY "Admins and devs can manage payment mappings"
  ON payment_method_erp_mapping FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

-- order_type_erp_mapping
DROP POLICY IF EXISTS "Admins can manage order type mappings" ON order_type_erp_mapping;
CREATE POLICY "Admins and devs can manage order type mappings"
  ON order_type_erp_mapping FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
