
-- =============================================
-- MÓDULO DE CONTROLE DE ESTOQUE MULTI-CNPJ
-- =============================================

-- 1. ENUM
CREATE TYPE public.stock_movement_type AS ENUM ('entrada', 'saida', 'ajuste');

-- 2. TABELA product_stock
CREATE TABLE public.product_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  quantidade_atual NUMERIC(14,4) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(14,4),
  estoque_maximo NUMERIC(14,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_stock_unique UNIQUE (product_id, company_id, tenant_id),
  CONSTRAINT product_stock_quantidade_check CHECK (quantidade_atual >= 0)
);

CREATE INDEX idx_product_stock_tenant_company ON public.product_stock (tenant_id, company_id);
CREATE INDEX idx_product_stock_product ON public.product_stock (product_id);

CREATE TRIGGER update_product_stock_updated_at
  BEFORE UPDATE ON public.product_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pipelines_updated_at();

-- 3. TABELA stock_movements
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  tipo public.stock_movement_type NOT NULL,
  quantidade NUMERIC(14,4) NOT NULL,
  motivo TEXT,
  referencia_id UUID,
  referencia_tipo TEXT,
  usuario_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_quantidade_check CHECK (quantidade > 0)
);

CREATE INDEX idx_stock_movements_tenant_date ON public.stock_movements (tenant_id, created_at DESC);
CREATE INDEX idx_stock_movements_product ON public.stock_movements (product_id);
CREATE INDEX idx_stock_movements_company ON public.stock_movements (company_id);
CREATE INDEX idx_stock_movements_referencia ON public.stock_movements (referencia_id) WHERE referencia_id IS NOT NULL;

-- 4. RLS - product_stock
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock in their tenant"
  ON public.product_stock FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert stock in their tenant"
  ON public.product_stock FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users can update stock in their tenant"
  ON public.product_stock FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

-- 5. RLS - stock_movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view movements in their tenant"
  ON public.stock_movements FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert movements in their tenant"
  ON public.stock_movements FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE TRIGGER prevent_stock_movement_update
  BEFORE UPDATE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

CREATE TRIGGER prevent_stock_movement_delete
  BEFORE DELETE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

-- 6. RPC - process_stock_movement
CREATE OR REPLACE FUNCTION public.process_stock_movement(
  p_product_id UUID,
  p_company_id UUID,
  p_tenant_id UUID,
  p_tipo TEXT,
  p_quantidade NUMERIC,
  p_motivo TEXT DEFAULT NULL,
  p_referencia_id UUID DEFAULT NULL,
  p_referencia_tipo TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_id UUID;
  v_saldo_atual NUMERIC(14,4);
  v_novo_saldo NUMERIC(14,4);
  v_movement_id UUID;
  v_tipo public.stock_movement_type;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant inválido para o usuário autenticado';
  END IF;

  BEGIN
    v_tipo := p_tipo::public.stock_movement_type;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido: %. Valores aceitos: entrada, saida, ajuste', p_tipo;
  END;

  IF p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;

  SELECT id, quantidade_atual INTO v_stock_id, v_saldo_atual
  FROM public.product_stock
  WHERE product_id = p_product_id AND company_id = p_company_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_stock_id IS NULL THEN
    INSERT INTO public.product_stock (product_id, company_id, tenant_id, quantidade_atual)
    VALUES (p_product_id, p_company_id, p_tenant_id, 0)
    RETURNING id, quantidade_atual INTO v_stock_id, v_saldo_atual;
  END IF;

  CASE v_tipo
    WHEN 'entrada' THEN
      v_novo_saldo := v_saldo_atual + p_quantidade;
    WHEN 'saida' THEN
      v_novo_saldo := v_saldo_atual - p_quantidade;
    WHEN 'ajuste' THEN
      v_novo_saldo := p_quantidade;
  END CASE;

  IF v_novo_saldo < 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo atual: %, Quantidade solicitada: %', v_saldo_atual, p_quantidade;
  END IF;

  UPDATE public.product_stock
  SET quantidade_atual = v_novo_saldo, updated_at = now()
  WHERE id = v_stock_id;

  INSERT INTO public.stock_movements (product_id, company_id, tenant_id, tipo, quantidade, motivo, referencia_id, referencia_tipo, usuario_id)
  VALUES (p_product_id, p_company_id, p_tenant_id, v_tipo, p_quantidade, p_motivo, p_referencia_id, p_referencia_tipo, auth.uid())
  RETURNING id INTO v_movement_id;

  RETURN json_build_object(
    'id_movimento', v_movement_id,
    'saldo_atual', v_novo_saldo,
    'timestamp', now()
  );
END;
$$;

-- 7. RPC - transfer_stock
CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_product_id UUID,
  p_from_company_id UUID,
  p_to_company_id UUID,
  p_tenant_id UUID,
  p_quantidade NUMERIC,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referencia_id UUID;
  v_result_saida JSON;
  v_result_entrada JSON;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant inválido para o usuário autenticado';
  END IF;

  IF p_from_company_id = p_to_company_id THEN
    RAISE EXCEPTION 'Empresa de origem e destino devem ser diferentes';
  END IF;

  v_referencia_id := gen_random_uuid();

  v_result_saida := public.process_stock_movement(
    p_product_id, p_from_company_id, p_tenant_id,
    'saida', p_quantidade,
    COALESCE(p_motivo, 'Transferência entre empresas'),
    v_referencia_id, 'transferencia'
  );

  v_result_entrada := public.process_stock_movement(
    p_product_id, p_to_company_id, p_tenant_id,
    'entrada', p_quantidade,
    COALESCE(p_motivo, 'Transferência entre empresas'),
    v_referencia_id, 'transferencia'
  );

  RETURN json_build_object(
    'referencia_id', v_referencia_id,
    'saida', v_result_saida,
    'entrada', v_result_entrada,
    'timestamp', now()
  );
END;
$$;

-- 8. REGISTRO DO MÓDULO
INSERT INTO public.system_modules (key, name, path, icon, is_active, sort_order)
VALUES ('stock', 'Estoque', '/stock', 'Warehouse', true, 6)
ON CONFLICT (key) DO NOTHING;

-- 9. PERMISSÕES POR ROLE
INSERT INTO public.role_module_permissions (module_id, role, can_access, access_type)
SELECT sm.id, r.role::app_role, true, 'total'::access_level
FROM public.system_modules sm
CROSS JOIN (VALUES ('admin'), ('vendedor'), ('atendente')) AS r(role)
WHERE sm.key = 'stock'
ON CONFLICT DO NOTHING;
