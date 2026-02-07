-- =====================================================
-- NCM FISCAL INTELLIGENCE - FASE 1: INFRAESTRUTURA
-- =====================================================

-- 1. ENUMS
CREATE TYPE regime_tributario AS ENUM (
  'simples_nacional',
  'lucro_presumido', 
  'lucro_real',
  'mei'
);

CREATE TYPE tipo_produto_fiscal AS ENUM (
  'revenda',
  'consumo',
  'industrializacao',
  'ativo_imobilizado'
);

-- 2. TABELA OFICIAL DE NCM
CREATE TABLE public.ncm_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo CHAR(8) NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  data_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_vigencia DATE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'obsoleto')),
  ex_tipi TEXT[],
  aliquota_ipi_oficial NUMERIC(5,2),
  unidade_tributaria TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN ncm_codes.aliquota_ipi_oficial IS 
  'Alíquota IPI conforme TIPI oficial. Apenas referência - a alíquota aplicável está em ncm_fiscal_rules.';

-- Índices para performance
CREATE INDEX idx_ncm_codes_codigo ON ncm_codes(codigo);
CREATE INDEX idx_ncm_codes_status ON ncm_codes(status);
CREATE INDEX idx_ncm_codes_descricao ON ncm_codes USING gin(to_tsvector('portuguese', descricao));

-- 3. TABELA DE REGRAS FISCAIS POR NCM
CREATE TABLE public.ncm_fiscal_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ncm_id UUID NOT NULL REFERENCES ncm_codes(id) ON DELETE CASCADE,
  uf_origem CHAR(2),
  uf_destino CHAR(2),
  regime_tributario regime_tributario NOT NULL,
  cst_icms TEXT,
  csosn TEXT,
  aliquota_icms NUMERIC(5,2),
  tem_icms_st BOOLEAN DEFAULT false,
  aliquota_ipi NUMERIC(5,2),
  cst_pis_cofins TEXT,
  aliquota_pis NUMERIC(5,4),
  aliquota_cofins NUMERIC(5,4),
  tipo_produto tipo_produto_fiscal,
  is_active BOOLEAN DEFAULT true,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN ncm_fiscal_rules.aliquota_ipi IS 
  'Alíquota IPI aplicável conforme regras de negócio da empresa. Pode diferir da TIPI oficial.';

CREATE INDEX idx_ncm_fiscal_rules_ncm ON ncm_fiscal_rules(ncm_id);
CREATE INDEX idx_ncm_fiscal_rules_uf ON ncm_fiscal_rules(uf_origem, uf_destino);
CREATE INDEX idx_ncm_fiscal_rules_regime ON ncm_fiscal_rules(regime_tributario);

-- 4. CAMPOS FISCAIS NA TABELA DE PRODUTOS
ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm_code CHAR(8);
ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm_id UUID REFERENCES ncm_codes(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cst_icms TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS csosn TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_icms NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tem_icms_st BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_ipi NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cst_pis_cofins TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_pis NUMERIC(5,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_cofins NUMERIC(5,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tipo_produto_fiscal tipo_produto_fiscal;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm_validated_at TIMESTAMPTZ;

COMMENT ON TABLE products IS 
  'Campos fiscais representam o SNAPSHOT aplicado no momento do cadastro. NÃO devem ser recalculados retroativamente.';

CREATE INDEX idx_products_ncm ON products(ncm_code);
CREATE INDEX idx_products_ncm_id ON products(ncm_id);

-- 5. CAMPOS FISCAIS NA TABELA DE EMPRESAS
ALTER TABLE companies ADD COLUMN IF NOT EXISTS regime_tributario regime_tributario;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contribuinte_icms BOOLEAN DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contribuinte_ipi BOOLEAN DEFAULT false;

-- 6. TABELA DE AUDITORIA DE NCM
CREATE TABLE public.product_ncm_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_ncm CHAR(8),
  new_ncm CHAR(8),
  old_fiscal_state JSONB,
  new_fiscal_state JSONB,
  reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT now(),
  has_billing_history BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT
);

COMMENT ON COLUMN product_ncm_audit.old_fiscal_state IS 
  'JSON completo com todos os campos fiscais do produto antes da alteração. Serve como prova fiscal em auditoria.';

CREATE INDEX idx_product_ncm_audit_product ON product_ncm_audit(product_id);
CREATE INDEX idx_product_ncm_audit_changed_at ON product_ncm_audit(changed_at DESC);

-- 7. TRIGGER DE AUDITORIA NCM
CREATE OR REPLACE FUNCTION audit_product_ncm_change()
RETURNS TRIGGER AS $$
DECLARE
  v_has_billing BOOLEAN;
  v_old_fiscal JSONB;
  v_new_fiscal JSONB;
BEGIN
  IF OLD.ncm_code IS DISTINCT FROM NEW.ncm_code 
     OR OLD.ncm_id IS DISTINCT FROM NEW.ncm_id THEN
    
    SELECT EXISTS(
      SELECT 1 FROM order_items WHERE product_id = NEW.id
    ) INTO v_has_billing;
    
    v_old_fiscal := jsonb_build_object(
      'ncm_code', OLD.ncm_code,
      'ncm_id', OLD.ncm_id,
      'cst_icms', OLD.cst_icms,
      'csosn', OLD.csosn,
      'aliquota_icms', OLD.aliquota_icms,
      'tem_icms_st', OLD.tem_icms_st,
      'aliquota_ipi', OLD.aliquota_ipi,
      'cst_pis_cofins', OLD.cst_pis_cofins,
      'aliquota_pis', OLD.aliquota_pis,
      'aliquota_cofins', OLD.aliquota_cofins,
      'tipo_produto_fiscal', OLD.tipo_produto_fiscal,
      'ncm_validated_at', OLD.ncm_validated_at
    );
    
    v_new_fiscal := jsonb_build_object(
      'ncm_code', NEW.ncm_code,
      'ncm_id', NEW.ncm_id,
      'cst_icms', NEW.cst_icms,
      'csosn', NEW.csosn,
      'aliquota_icms', NEW.aliquota_icms,
      'tem_icms_st', NEW.tem_icms_st,
      'aliquota_ipi', NEW.aliquota_ipi,
      'cst_pis_cofins', NEW.cst_pis_cofins,
      'aliquota_pis', NEW.aliquota_pis,
      'aliquota_cofins', NEW.aliquota_cofins,
      'tipo_produto_fiscal', NEW.tipo_produto_fiscal,
      'ncm_validated_at', NEW.ncm_validated_at
    );
    
    INSERT INTO product_ncm_audit (
      product_id, 
      old_ncm, 
      new_ncm,
      old_fiscal_state,
      new_fiscal_state,
      changed_by, 
      has_billing_history
    ) VALUES (
      NEW.id, 
      OLD.ncm_code, 
      NEW.ncm_code,
      v_old_fiscal,
      v_new_fiscal,
      auth.uid(),
      v_has_billing
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

CREATE TRIGGER trg_audit_product_ncm
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION audit_product_ncm_change();

-- 8. FUNÇÃO DE BUSCA NCM
CREATE OR REPLACE FUNCTION search_ncm(
  search_term TEXT,
  limit_rows INT DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  codigo CHAR(8),
  descricao TEXT,
  status TEXT,
  aliquota_ipi_oficial NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT n.id, n.codigo, n.descricao, n.status, n.aliquota_ipi_oficial
  FROM ncm_codes n
  WHERE n.codigo LIKE search_term || '%'
     OR n.descricao ILIKE '%' || search_term || '%'
  ORDER BY 
    CASE WHEN n.codigo = search_term THEN 0 ELSE 1 END,
    n.status = 'ativo' DESC,
    n.codigo
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

COMMENT ON FUNCTION search_ncm IS 
  'Busca NCM por código ou descrição. MELHORIA FUTURA: Para bases muito grandes, considerar GIN trigram.';

-- 9. RLS POLICIES

-- NCM Codes
ALTER TABLE ncm_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ncm_codes"
  ON ncm_codes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage ncm_codes"
  ON ncm_codes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update ncm_codes"
  ON ncm_codes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete ncm_codes"
  ON ncm_codes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- NCM Fiscal Rules
ALTER TABLE ncm_fiscal_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ncm_fiscal_rules"
  ON ncm_fiscal_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin insert ncm_fiscal_rules"
  ON ncm_fiscal_rules FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update ncm_fiscal_rules"
  ON ncm_fiscal_rules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete ncm_fiscal_rules"
  ON ncm_fiscal_rules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Product NCM Audit
ALTER TABLE product_ncm_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ncm_audit"
  ON product_ncm_audit FOR SELECT TO authenticated USING (true);

CREATE POLICY "System insert ncm_audit"
  ON product_ncm_audit FOR INSERT TO authenticated
  WITH CHECK (true);

-- Prevent modification of audit records
CREATE POLICY "Prevent update ncm_audit"
  ON product_ncm_audit FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "Prevent delete ncm_audit"
  ON product_ncm_audit FOR DELETE TO authenticated
  USING (false);