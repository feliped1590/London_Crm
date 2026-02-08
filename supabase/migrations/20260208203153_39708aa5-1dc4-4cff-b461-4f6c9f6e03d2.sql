-- =============================================================================
-- MÓDULO FISCAL / TRIBUTÁRIO CENTRALIZADO
-- Migração 1: ENUMs, Tabelas Base e Políticas RLS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. NOVOS ENUMs FISCAIS
-- -----------------------------------------------------------------------------

-- Tipo de operação fiscal (para regras e NF-e)
CREATE TYPE public.tipo_operacao_fiscal AS ENUM (
  'venda',
  'venda_interestadual',
  'devolucao_venda',
  'devolucao_compra',
  'remessa_demonstracao',
  'retorno_demonstracao',
  'remessa_conserto',
  'retorno_conserto',
  'transferencia',
  'bonificacao',
  'amostra_gratis',
  'importacao',
  'exportacao',
  'venda_consumidor_final'
);

-- Tipo de benefício fiscal
CREATE TYPE public.tipo_beneficio_fiscal AS ENUM (
  'isencao',
  'reducao_base',
  'suspensao',
  'diferimento',
  'nao_tributado',
  'aliquota_zero',
  'credito_presumido'
);

-- Tributo afetado pelo benefício
CREATE TYPE public.tributo_afetado AS ENUM (
  'icms',
  'icms_st',
  'ipi',
  'pis',
  'cofins',
  'iss',
  'todos'
);

-- Origem da mercadoria (conforme tabela NF-e)
CREATE TYPE public.origem_mercadoria AS ENUM (
  '0',  -- Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8
  '1',  -- Estrangeira - Importação direta, exceto a indicada no código 6
  '2',  -- Estrangeira - Adquirida no mercado interno, exceto a indicada no código 7
  '3',  -- Nacional, mercadoria ou bem com Conteúdo de Importação superior a 40% e inferior ou igual a 70%
  '4',  -- Nacional, cuja produção tenha sido feita em conformidade com os processos produtivos básicos
  '5',  -- Nacional, mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%
  '6',  -- Estrangeira - Importação direta, sem similar nacional, constante em lista de Resolução CAMEX
  '7',  -- Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista de Resolução CAMEX
  '8'   -- Nacional, mercadoria ou bem com Conteúdo de Importação superior a 70%
);

-- -----------------------------------------------------------------------------
-- 2. TABELA DE REGRAS DE TRIBUTAÇÃO (CORE)
-- -----------------------------------------------------------------------------
-- AJUSTE #2: cfop como filtro E cfop_resultante como resultado
-- AJUSTE #3: origem_mercadoria incluída
-- AJUSTE #5: Comentários sobre cache documentados

CREATE TABLE public.regras_tributacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  nome TEXT NOT NULL,
  descricao TEXT,
  codigo_interno TEXT UNIQUE, -- Para referência rápida (ex: "VENDA-SP-SP-SN")
  
  -- =========================================================================
  -- CHAVES DE DECISÃO (filtros para matching)
  -- Campos NULL = regra genérica (menor prioridade)
  -- Campos preenchidos = regra específica (maior prioridade)
  -- =========================================================================
  tipo_operacao public.tipo_operacao_fiscal,
  uf_origem CHAR(2),
  uf_destino CHAR(2),
  regime_empresa public.regime_tributario,      -- Regime da empresa emissora
  regime_cliente public.regime_tributario,      -- Regime do cliente destinatário
  ncm_code TEXT,                                -- Pode ser parcial (ex: "3923" para todo capítulo)
  cfop TEXT,                                    -- CFOP como critério de filtro (opcional)
  
  -- =========================================================================
  -- RESULTADOS DA REGRA (valores a aplicar)
  -- =========================================================================
  
  -- CFOP resultante (AJUSTE #2)
  cfop_resultante TEXT NOT NULL,                -- CFOP a ser usado no documento fiscal
  
  -- Origem da mercadoria (AJUSTE #3)
  origem_mercadoria public.origem_mercadoria DEFAULT '0',
  
  -- ICMS
  icms_cst TEXT,                                -- CST para Lucro Presumido/Real
  icms_csosn TEXT,                              -- CSOSN para Simples Nacional
  icms_aliquota NUMERIC(5,2),
  icms_reducao_base NUMERIC(5,2),               -- % de redução da base de cálculo
  icms_mva NUMERIC(6,2),                        -- MVA para ICMS-ST
  icms_st_aliquota NUMERIC(5,2),
  icms_st_reducao_base NUMERIC(5,2),
  
  -- IPI
  ipi_cst TEXT,
  ipi_aliquota NUMERIC(5,2),
  ipi_enquadramento TEXT,                       -- Código de enquadramento legal
  
  -- PIS
  pis_cst TEXT,
  pis_aliquota NUMERIC(5,4),
  
  -- COFINS
  cofins_cst TEXT,
  cofins_aliquota NUMERIC(5,4),
  
  -- Extensibilidade para futuros tributos
  difal_aliquota_destino NUMERIC(5,2),
  difal_aliquota_origem NUMERIC(5,2),
  fcp_aliquota NUMERIC(5,2),
  iss_aliquota NUMERIC(5,2),
  
  -- =========================================================================
  -- METADADOS E CONTROLE
  -- =========================================================================
  
  -- Prioridade (maior = mais específica, usada no matching)
  prioridade INT DEFAULT 0,
  
  -- Vigência versionada
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Imutabilidade após uso em documento fiscal
  locked_at TIMESTAMPTZ,
  locked_by_document_id UUID,
  
  -- Flag para regra de fallback (AJUSTE #4)
  is_fallback BOOLEAN DEFAULT false,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  
  -- Constraints
  CONSTRAINT regra_vigencia_valida CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CONSTRAINT regra_cfop_resultante_valido CHECK (cfop_resultante ~ '^[1-7][0-9]{3}$')
);

-- Comentário sobre cache (AJUSTE #5)
COMMENT ON TABLE public.regras_tributacao IS 
'Regras de tributação centralizadas. 
PERFORMANCE FUTURA: Implementar cache Redis/Memcached por contexto fiscal.
Invalidação: Ao alterar regras, invalidar cache por (tipo_operacao, uf_origem, uf_destino, regime_empresa, ncm_code).
Uso em alto volume: Para emissão de NF-e em lote, pré-carregar regras em memória.';

-- Índice para busca de regras por contexto
CREATE INDEX idx_regras_tributacao_contexto ON public.regras_tributacao(
  tipo_operacao, uf_origem, uf_destino, regime_empresa, ncm_code
) WHERE is_active = true;

-- Índice para fallback
CREATE INDEX idx_regras_tributacao_fallback ON public.regras_tributacao(is_fallback) 
  WHERE is_fallback = true AND is_active = true;

-- -----------------------------------------------------------------------------
-- 3. TABELA DE BENEFÍCIOS FISCAIS
-- -----------------------------------------------------------------------------
-- AJUSTE #1: Fonte única de isenções (sem flags no cliente)

CREATE TABLE public.beneficios_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  nome TEXT NOT NULL,
  codigo TEXT UNIQUE,                           -- Código interno para referência
  
  -- Tipo e tributo afetado
  tipo public.tipo_beneficio_fiscal NOT NULL,
  tributo public.tributo_afetado NOT NULL,
  
  -- Valor do benefício (quando aplicável)
  percentual_reducao NUMERIC(5,2),              -- Para reducao_base
  aliquota_resultante NUMERIC(5,2),             -- Para aliquota_zero ou credito_presumido
  
  -- Documento legal
  numero_documento TEXT NOT NULL,               -- Ex: "Lei 12.345/2020", "Decreto 1234/2023"
  orgao_emissor TEXT,                           -- Ex: "Receita Federal", "SEFAZ-SP"
  data_documento DATE,
  
  -- Arquivo anexo
  documento_url TEXT,
  documento_nome TEXT,
  
  -- NCMs afetados (opcional - se vazio, aplica a todos)
  ncms_aplicaveis TEXT[],
  
  -- Vigência
  valid_from DATE NOT NULL,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  
  notes TEXT,
  
  CONSTRAINT beneficio_vigencia_valida CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

COMMENT ON TABLE public.beneficios_fiscais IS 
'Cadastro central de benefícios fiscais (isenções, reduções, etc).
GOVERNANÇA: Toda isenção/redução fiscal deve ser cadastrada aqui com documento legal.
AUDITORIA: Alterações são rastreadas. Benefícios vinculados a clientes em cliente_beneficios_fiscais.';

-- -----------------------------------------------------------------------------
-- 4. VINCULAÇÃO DE BENEFÍCIOS A CLIENTES
-- -----------------------------------------------------------------------------
-- AJUSTE #1: Substitui flags isento_icms/isento_ipi no cliente

CREATE TABLE public.cliente_beneficios_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referências
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  beneficio_id UUID NOT NULL REFERENCES public.beneficios_fiscais(id) ON DELETE CASCADE,
  
  -- Documento comprobatório do cliente (ex: Carta de Isenção específica)
  documento_cliente_url TEXT,
  documento_cliente_nome TEXT,
  numero_documento_cliente TEXT,                -- Número do documento do cliente
  
  -- Vigência específica para este cliente (pode ser diferente do benefício base)
  valid_from DATE NOT NULL,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  notes TEXT,
  
  CONSTRAINT unique_cliente_beneficio UNIQUE (company_id, beneficio_id),
  CONSTRAINT cliente_beneficio_vigencia CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE INDEX idx_cliente_beneficios_company ON public.cliente_beneficios_fiscais(company_id);
CREATE INDEX idx_cliente_beneficios_beneficio ON public.cliente_beneficios_fiscais(beneficio_id);

-- -----------------------------------------------------------------------------
-- 5. SNAPSHOT FISCAL DE DOCUMENTOS (IMUTÁVEL)
-- -----------------------------------------------------------------------------

CREATE TABLE public.documento_fiscal_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referência ao documento
  documento_tipo TEXT NOT NULL,                 -- 'order', 'proposal', 'nfe'
  documento_id UUID NOT NULL,
  item_id UUID,                                 -- Referência ao item específico (se aplicável)
  
  -- Regra utilizada
  regra_id UUID REFERENCES public.regras_tributacao(id),
  
  -- Snapshot completo da tributação aplicada (JSONB imutável)
  tributacao_aplicada JSONB NOT NULL,
  
  -- Benefícios aplicados (JSONB imutável)
  beneficios_aplicados JSONB,
  
  -- Contexto no momento do cálculo (para auditoria completa)
  contexto_calculo JSONB NOT NULL,
  
  -- Timestamp imutável
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Hash para verificação de integridade
  hash_verificacao TEXT GENERATED ALWAYS AS (
    md5(tributacao_aplicada::text || COALESCE(beneficios_aplicados::text, '') || contexto_calculo::text)
  ) STORED
);

CREATE INDEX idx_documento_fiscal_documento ON public.documento_fiscal_snapshot(documento_tipo, documento_id);
CREATE INDEX idx_documento_fiscal_regra ON public.documento_fiscal_snapshot(regra_id);

COMMENT ON TABLE public.documento_fiscal_snapshot IS 
'Histórico imutável das regras fiscais aplicadas em documentos.
IMUTABILIDADE: Esta tabela não permite UPDATE ou DELETE.
NF-e: Estrutura preparada para rastreabilidade fiscal completa.';

-- -----------------------------------------------------------------------------
-- 6. EXTENSÃO DA TABELA COMPANIES (CAMPOS FISCAIS)
-- -----------------------------------------------------------------------------
-- AJUSTE #1: NÃO adicionar isento_icms/isento_ipi (usar benefícios fiscais)

-- Apenas SUFRAMA (para Zona Franca) - campo informativo
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS suframa TEXT;

-- Comentário sobre a decisão de design
COMMENT ON COLUMN public.companies.suframa IS 
'Código SUFRAMA para empresas da Zona Franca de Manaus.
NOTA: Isenções fiscais devem ser tratadas via beneficios_fiscais + cliente_beneficios_fiscais.';

-- -----------------------------------------------------------------------------
-- 7. EXTENSÃO DA TABELA PRODUCTS (ORIGEM MERCADORIA)
-- -----------------------------------------------------------------------------
-- AJUSTE #3: Campo origem da mercadoria no produto

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS 
  origem_mercadoria public.origem_mercadoria DEFAULT '0';

COMMENT ON COLUMN public.products.origem_mercadoria IS 
'Origem da mercadoria conforme tabela NF-e (0-8).
Pode ser sobrescrita pela regra fiscal se necessário.';

-- -----------------------------------------------------------------------------
-- 8. TABELAS AUXILIARES DE CADASTROS FISCAIS
-- -----------------------------------------------------------------------------

-- Cadastro de CST/CSOSN (referência)
CREATE TABLE public.cadastro_cst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('CST', 'CSOSN')),
  tributo TEXT NOT NULL CHECK (tributo IN ('ICMS', 'IPI', 'PIS', 'COFINS')),
  descricao TEXT NOT NULL,
  observacoes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cadastro de CFOP (referência)
CREATE TABLE public.cadastro_cfop (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE CHECK (codigo ~ '^[1-7][0-9]{3}$'),
  descricao TEXT NOT NULL,
  tipo_operacao TEXT,                           -- entrada, saída, etc
  aplicacao TEXT,                               -- venda, devolução, transferência, etc
  observacoes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cadastro de Enquadramento IPI
CREATE TABLE public.cadastro_enquadramento_ipi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  tipo TEXT,                                    -- saída, entrada
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 9. TRIGGERS DE AUDITORIA E IMUTABILIDADE
-- -----------------------------------------------------------------------------

-- Trigger para atualizar updated_at em regras_tributacao
CREATE OR REPLACE FUNCTION public.update_regras_tributacao_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Bloquear alteração se regra estiver locked
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Regra fiscal % está bloqueada desde % e não pode ser alterada.', 
      OLD.id, OLD.locked_at;
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_regras_tributacao_updated
  BEFORE UPDATE ON public.regras_tributacao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_regras_tributacao_timestamp();

-- Trigger para impedir DELETE em regras locked
CREATE OR REPLACE FUNCTION public.prevent_delete_locked_regra()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Regra fiscal % está bloqueada e não pode ser excluída.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_regras_tributacao_prevent_delete
  BEFORE DELETE ON public.regras_tributacao
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delete_locked_regra();

-- Trigger para impedir modificações em documento_fiscal_snapshot
CREATE OR REPLACE FUNCTION public.prevent_fiscal_snapshot_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Snapshots fiscais são imutáveis e não podem ser alterados ou excluídos.';
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_documento_fiscal_imutavel
  BEFORE UPDATE OR DELETE ON public.documento_fiscal_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_fiscal_snapshot_modification();

-- Trigger para bloquear regra ao ser usada em documento
CREATE OR REPLACE FUNCTION public.lock_regra_on_use()
RETURNS TRIGGER AS $$
BEGIN
  -- Bloquear a regra usada
  UPDATE public.regras_tributacao
  SET locked_at = now(),
      locked_by_document_id = NEW.documento_id
  WHERE id = NEW.regra_id
    AND locked_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_lock_regra_on_snapshot
  AFTER INSERT ON public.documento_fiscal_snapshot
  FOR EACH ROW
  WHEN (NEW.regra_id IS NOT NULL)
  EXECUTE FUNCTION public.lock_regra_on_use();

-- -----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

-- Regras de Tributação
ALTER TABLE public.regras_tributacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active rules"
  ON public.regras_tributacao FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage rules"
  ON public.regras_tributacao FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Benefícios Fiscais
ALTER TABLE public.beneficios_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view benefits"
  ON public.beneficios_fiscais FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage benefits"
  ON public.beneficios_fiscais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Cliente Benefícios Fiscais
ALTER TABLE public.cliente_beneficios_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client benefits"
  ON public.cliente_beneficios_fiscais FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage client benefits"
  ON public.cliente_beneficios_fiscais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Documento Fiscal Snapshot
ALTER TABLE public.documento_fiscal_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view snapshots"
  ON public.documento_fiscal_snapshot FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System can insert snapshots"
  ON public.documento_fiscal_snapshot FOR INSERT TO authenticated
  WITH CHECK (true);

-- Cadastros auxiliares
ALTER TABLE public.cadastro_cst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadastro_cfop ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadastro_enquadramento_ipi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view CST"
  ON public.cadastro_cst FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage CST"
  ON public.cadastro_cst FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view CFOP"
  ON public.cadastro_cfop FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage CFOP"
  ON public.cadastro_cfop FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view IPI"
  ON public.cadastro_enquadramento_ipi FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage IPI"
  ON public.cadastro_enquadramento_ipi FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- -----------------------------------------------------------------------------
-- 11. INSERIR REGRA DE FALLBACK OBRIGATÓRIA
-- -----------------------------------------------------------------------------
-- AJUSTE #4: Regra genérica para evitar null no motor fiscal

INSERT INTO public.regras_tributacao (
  nome,
  descricao,
  codigo_interno,
  cfop_resultante,
  origem_mercadoria,
  icms_cst,
  icms_aliquota,
  ipi_cst,
  ipi_aliquota,
  pis_cst,
  pis_aliquota,
  cofins_cst,
  cofins_aliquota,
  prioridade,
  is_fallback,
  valid_from
) VALUES (
  'Regra Fiscal Padrão (Fallback)',
  'Regra genérica aplicada quando nenhuma regra específica é encontrada. ATENÇÃO: Revise os tributos para operações específicas.',
  'FALLBACK-GERAL',
  '5102',  -- CFOP padrão para venda de mercadoria adquirida
  '0',     -- Nacional
  '00',    -- ICMS tributado integralmente
  18.00,   -- Alíquota padrão
  '50',    -- IPI - Saída tributada
  0.00,    -- Sem IPI por padrão
  '01',    -- PIS - Operação tributável
  1.65,    -- Alíquota PIS padrão
  '01',    -- COFINS - Operação tributável
  7.60,    -- Alíquota COFINS padrão
  -1000,   -- Prioridade mínima (fallback)
  true,
  '2020-01-01'
);