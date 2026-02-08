-- ============================================================================
-- REFORMA TRIBUTÁRIA EC 132/2023 - MODELO CONCEITUAL REVISADO
-- ============================================================================

-- 1. ENUMS PARA REGIME DE INCIDÊNCIA (substitui CST conceitual)
-- ============================================================================

CREATE TYPE public.regime_incidencia_cbs_ibs AS ENUM (
  'normal',           -- Tributação normal com alíquota padrão
  'aliquota_zero',    -- Alíquota zero (mantém direito a crédito)
  'monofasico',       -- Incidência concentrada em fase anterior
  'isento',           -- Isento (não gera crédito)
  'imune',            -- Imunidade constitucional
  'suspensao',        -- Suspensão temporária
  'diferimento',      -- Diferimento para fase posterior
  'cashback',         -- Operação com devolução ao consumidor
  'nao_incidencia'    -- Fora do campo de incidência
);

CREATE TYPE public.tipo_geracao_credito AS ENUM (
  'integral',         -- Crédito integral sobre a operação
  'parcial',          -- Crédito proporcional (ex: uso misto)
  'vedado',           -- Não gera crédito (ex: uso pessoal)
  'presumido'         -- Crédito presumido calculado
);

CREATE TYPE public.modelo_tributario AS ENUM (
  'legado',           -- Apenas ICMS/PIS/COFINS/IPI (até 2025)
  'dual_teste',       -- 2026: Legado + CBS 0.9% + IBS 0.1%
  'dual_transicao',   -- 2027-2032: Coexistência com redução gradual
  'novo'              -- 2033+: Apenas CBS/IBS/IS
);

-- Classificação tributária NF-e (campo técnico cClassTrib)
CREATE TYPE public.classificacao_tributaria_nfe AS ENUM (
  '00',  -- Tributação normal CBS/IBS
  '10',  -- Tributação monofásica
  '20',  -- Operação com ST
  '30',  -- Isento
  '40',  -- Não tributado
  '50',  -- Suspensão
  '60',  -- Diferimento
  '70',  -- Regime especial
  '90'   -- Outros
);

-- Status do Split Payment
CREATE TYPE public.split_payment_status AS ENUM (
  'estimado',         -- Valor calculado, ainda não retido
  'retido',           -- Valor retido pelo intermediador
  'liquidado',        -- Valor repassado ao fisco
  'ajustado',         -- Valor sofreu ajuste posterior
  'estornado'         -- Retenção cancelada/devolvida
);

-- Categoria do Imposto Seletivo (não depende apenas de NCM)
CREATE TYPE public.categoria_imposto_seletivo AS ENUM (
  'bebidas_alcoolicas',
  'bebidas_acucaradas',
  'tabaco',
  'veiculos',
  'embarcacoes_aeronaves',
  'extracao_mineral',
  'concursos_prognosticos',
  'nao_aplicavel'
);

-- 2. TABELA DE PARAMETRIZAÇÃO DA TRANSIÇÃO (versionada)
-- ============================================================================

CREATE TABLE public.transicao_tributaria_parametros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_referencia INT NOT NULL,
  modelo_tributario public.modelo_tributario NOT NULL,
  
  -- Percentuais de transição legado → novo
  percentual_icms_iss NUMERIC(5,2) NOT NULL DEFAULT 100,  -- Reduz gradualmente
  percentual_ibs NUMERIC(5,2) NOT NULL DEFAULT 0,         -- Aumenta gradualmente
  percentual_pis_cofins NUMERIC(5,2) NOT NULL DEFAULT 100,
  percentual_cbs NUMERIC(5,2) NOT NULL DEFAULT 0,
  
  -- Alíquotas de referência do ano
  aliquota_cbs_referencia NUMERIC(6,4),    -- ~8.8% quando definido
  aliquota_ibs_referencia NUMERIC(6,4),    -- ~17.7% quando definido
  aliquota_ibs_estadual NUMERIC(6,4),      -- Parte estadual para repartição
  aliquota_ibs_municipal NUMERIC(6,4),     -- Parte municipal para repartição
  
  -- Metadados
  descricao TEXT,
  base_legal TEXT,
  is_active BOOLEAN DEFAULT true,
  valid_from DATE NOT NULL,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT uk_transicao_ano UNIQUE (ano_referencia),
  CONSTRAINT ck_transicao_percentuais CHECK (
    percentual_icms_iss >= 0 AND percentual_icms_iss <= 100 AND
    percentual_ibs >= 0 AND percentual_ibs <= 100 AND
    percentual_pis_cofins >= 0 AND percentual_pis_cofins <= 100 AND
    percentual_cbs >= 0 AND percentual_cbs <= 100
  )
);

-- Inserir cronograma oficial de transição
INSERT INTO public.transicao_tributaria_parametros 
  (ano_referencia, modelo_tributario, percentual_icms_iss, percentual_ibs, 
   percentual_pis_cofins, percentual_cbs, aliquota_cbs_referencia, aliquota_ibs_referencia,
   descricao, valid_from) VALUES
  (2025, 'legado', 100, 0, 100, 0, NULL, NULL, 'Sistema tributário atual', '2025-01-01'),
  (2026, 'dual_teste', 100, 0, 100, 0, 0.9, 0.1, 'Fase teste CBS/IBS - alíquotas simbólicas', '2026-01-01'),
  (2027, 'dual_transicao', 100, 0, 0, 100, 8.8, 17.7, 'CBS substitui PIS/COFINS', '2027-01-01'),
  (2028, 'dual_transicao', 100, 0, 0, 100, 8.8, 17.7, 'Continuidade transição', '2028-01-01'),
  (2029, 'dual_transicao', 90, 10, 0, 100, 8.8, 17.7, 'Início redução ICMS/ISS', '2029-01-01'),
  (2030, 'dual_transicao', 80, 20, 0, 100, 8.8, 17.7, 'Redução gradual ICMS/ISS', '2030-01-01'),
  (2031, 'dual_transicao', 70, 30, 0, 100, 8.8, 17.7, 'Redução gradual ICMS/ISS', '2031-01-01'),
  (2032, 'dual_transicao', 60, 40, 0, 100, 8.8, 17.7, 'Redução gradual ICMS/ISS', '2032-01-01'),
  (2033, 'novo', 0, 100, 0, 100, 8.8, 17.7, 'Extinção ICMS/ISS - IBS integral', '2033-01-01');

-- RLS para transicao_tributaria_parametros
ALTER TABLE public.transicao_tributaria_parametros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read transition params"
  ON public.transicao_tributaria_parametros FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins can manage transition params"
  ON public.transicao_tributaria_parametros FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. EXTENSÃO DA TABELA REGRAS_TRIBUTACAO
-- ============================================================================

-- Adicionar modelo tributário
ALTER TABLE public.regras_tributacao 
  ADD COLUMN IF NOT EXISTS modelo_tributario public.modelo_tributario DEFAULT 'legado';

-- CBS (Federal) - Campos conceituais corretos
ALTER TABLE public.regras_tributacao 
  ADD COLUMN IF NOT EXISTS cbs_regime_incidencia public.regime_incidencia_cbs_ibs DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS cbs_tipo_credito public.tipo_geracao_credito DEFAULT 'integral',
  ADD COLUMN IF NOT EXISTS cbs_aliquota NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS cbs_reducao_base NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS cbs_aliquota_efetiva NUMERIC(6,4);  -- Após reduções

-- IBS (Imposto único - repartição interna apenas)
ALTER TABLE public.regras_tributacao 
  ADD COLUMN IF NOT EXISTS ibs_regime_incidencia public.regime_incidencia_cbs_ibs DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS ibs_tipo_credito public.tipo_geracao_credito DEFAULT 'integral',
  ADD COLUMN IF NOT EXISTS ibs_aliquota NUMERIC(6,4),          -- Alíquota única do IBS
  ADD COLUMN IF NOT EXISTS ibs_reducao_base NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS ibs_aliquota_efetiva NUMERIC(6,4),  -- Após reduções
  ADD COLUMN IF NOT EXISTS ibs_reparticao_estadual NUMERIC(5,2) DEFAULT 65,  -- % para estado
  ADD COLUMN IF NOT EXISTS ibs_reparticao_municipal NUMERIC(5,2) DEFAULT 35; -- % para município

-- Imposto Seletivo (não depende apenas de NCM)
ALTER TABLE public.regras_tributacao 
  ADD COLUMN IF NOT EXISTS is_aplicavel BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_categoria public.categoria_imposto_seletivo DEFAULT 'nao_aplicavel',
  ADD COLUMN IF NOT EXISTS is_aliquota NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS is_excecao_legal TEXT,  -- Referência à exceção se houver
  ADD COLUMN IF NOT EXISTS is_produto_final BOOLEAN DEFAULT true;  -- IS incide sobre produto final

-- Campo técnico NF-e (não conceitual)
ALTER TABLE public.regras_tributacao 
  ADD COLUMN IF NOT EXISTS c_class_trib public.classificacao_tributaria_nfe,
  ADD COLUMN IF NOT EXISTS cst_nfe TEXT;  -- CST apenas para campo técnico NF-e

-- Metadados de vigência
ALTER TABLE public.regras_tributacao 
  ADD COLUMN IF NOT EXISTS ano_vigencia_inicio INT,
  ADD COLUMN IF NOT EXISTS ano_vigencia_fim INT;

-- Índice para busca por modelo e ano
CREATE INDEX IF NOT EXISTS idx_regras_modelo_tributario 
  ON public.regras_tributacao(modelo_tributario, ano_vigencia_inicio) 
  WHERE is_active = true;

-- 4. TABELA DE CRÉDITO PRESUMIDO (CONDICIONAL)
-- ============================================================================

CREATE TABLE public.credito_presumido_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  
  -- Tributo afetado
  tributo TEXT NOT NULL CHECK (tributo IN ('cbs', 'ibs', 'ambos')),
  
  -- Condições de aplicação (não é atributo fixo do produto)
  aplica_por_adquirente BOOLEAN DEFAULT false,
  tipos_adquirente TEXT[],  -- Ex: ['simples_nacional', 'produtor_rural']
  aplica_por_operacao BOOLEAN DEFAULT false,
  tipos_operacao TEXT[],    -- Ex: ['exportacao', 'zona_franca']
  aplica_por_ncm BOOLEAN DEFAULT false,
  ncms_aplicaveis TEXT[],
  aplica_por_regiao BOOLEAN DEFAULT false,
  ufs_aplicaveis TEXT[],
  
  -- Percentual do crédito
  percentual_credito NUMERIC(5,2) NOT NULL,
  base_legal TEXT,
  
  -- Vigência
  valid_from DATE NOT NULL,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE public.credito_presumido_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read credito presumido"
  ON public.credito_presumido_regras FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins can manage credito presumido"
  ON public.credito_presumido_regras FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. TABELA SPLIT PAYMENT (ESTADO OPERACIONAL COMPLETO)
-- ============================================================================

CREATE TABLE public.split_payment_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referência ao documento
  documento_id UUID NOT NULL,
  documento_tipo TEXT NOT NULL,  -- 'pedido', 'proposta', 'nfe'
  item_id UUID,
  
  -- Valores brutos
  valor_operacao NUMERIC(15,2) NOT NULL,
  
  -- CBS
  cbs_base_calculo NUMERIC(15,2),
  cbs_aliquota NUMERIC(6,4),
  cbs_valor NUMERIC(15,2),
  cbs_status public.split_payment_status DEFAULT 'estimado',
  
  -- IBS
  ibs_base_calculo NUMERIC(15,2),
  ibs_aliquota NUMERIC(6,4),
  ibs_valor NUMERIC(15,2),
  ibs_valor_estadual NUMERIC(15,2),
  ibs_valor_municipal NUMERIC(15,2),
  ibs_status public.split_payment_status DEFAULT 'estimado',
  
  -- Imposto Seletivo
  is_base_calculo NUMERIC(15,2),
  is_aliquota NUMERIC(5,2),
  is_valor NUMERIC(15,2),
  is_status public.split_payment_status DEFAULT 'estimado',
  
  -- Totais
  valor_total_retido NUMERIC(15,2) NOT NULL,
  valor_liquido_fornecedor NUMERIC(15,2) NOT NULL,
  
  -- Intermediador financeiro
  intermediador_id TEXT,
  intermediador_nome TEXT,
  intermediador_cnpj TEXT,
  
  -- Datas operacionais
  data_operacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_retencao TIMESTAMPTZ,
  data_liquidacao TIMESTAMPTZ,
  data_ajuste TIMESTAMPTZ,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.split_payment_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read split payment"
  ON public.split_payment_registros FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins can manage split payment"
  ON public.split_payment_registros FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Índices
CREATE INDEX idx_split_payment_documento ON public.split_payment_registros(documento_id, documento_tipo);
CREATE INDEX idx_split_payment_status ON public.split_payment_registros(cbs_status, ibs_status);

-- 6. CADASTRO DO IMPOSTO SELETIVO (CATEGORIA + EXCEÇÕES)
-- ============================================================================

CREATE TABLE public.cadastro_imposto_seletivo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  categoria public.categoria_imposto_seletivo NOT NULL,
  
  -- Alíquota
  aliquota_padrao NUMERIC(5,2) NOT NULL,
  aliquota_maxima NUMERIC(5,2),
  
  -- Critérios de aplicação (não apenas NCM)
  ncms_aplicaveis TEXT[],           -- NCMs quando aplicável
  produtos_especificos TEXT[],      -- Descrições de produtos
  excecoes_legais TEXT[],           -- Produtos excluídos
  criterios_adicionais JSONB,       -- Outros critérios (graduação alcoólica, etc.)
  
  -- Incidência
  incide_produto_final BOOLEAN DEFAULT true,
  incide_importacao BOOLEAN DEFAULT true,
  
  -- Vigência e base legal
  base_legal TEXT,
  valid_from DATE NOT NULL DEFAULT '2027-01-01',
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE public.cadastro_imposto_seletivo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read IS cadastro"
  ON public.cadastro_imposto_seletivo FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins can manage IS cadastro"
  ON public.cadastro_imposto_seletivo FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Dados iniciais do Imposto Seletivo (conforme EC 132/2023)
INSERT INTO public.cadastro_imposto_seletivo 
  (codigo, descricao, categoria, aliquota_padrao, aliquota_maxima, base_legal) VALUES
  ('IS-BA', 'Bebidas Alcoólicas', 'bebidas_alcoolicas', 20.00, 35.00, 'EC 132/2023 Art. 153'),
  ('IS-TB', 'Produtos de Tabaco', 'tabaco', 35.00, 50.00, 'EC 132/2023 Art. 153'),
  ('IS-VE', 'Veículos Automotores', 'veiculos', 3.00, 5.00, 'EC 132/2023 Art. 153'),
  ('IS-BS', 'Bebidas Açucaradas', 'bebidas_acucaradas', 10.00, 20.00, 'EC 132/2023 Art. 153'),
  ('IS-EA', 'Embarcações e Aeronaves', 'embarcacoes_aeronaves', 3.00, 5.00, 'EC 132/2023 Art. 153'),
  ('IS-EM', 'Extração Mineral', 'extracao_mineral', 1.00, 2.00, 'EC 132/2023 Art. 153'),
  ('IS-CP', 'Concursos de Prognósticos', 'concursos_prognosticos', 5.00, 10.00, 'EC 132/2023 Art. 153');

-- 7. ATUALIZAR ENUM tributo_afetado PARA BENEFÍCIOS
-- ============================================================================

ALTER TYPE public.tributo_afetado ADD VALUE IF NOT EXISTS 'cbs';
ALTER TYPE public.tributo_afetado ADD VALUE IF NOT EXISTS 'ibs';
ALTER TYPE public.tributo_afetado ADD VALUE IF NOT EXISTS 'is';

-- 8. FUNÇÃO PARA OBTER PARÂMETROS DE TRANSIÇÃO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_parametros_transicao(p_ano INT)
RETURNS public.transicao_tributaria_parametros
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.transicao_tributaria_parametros
  WHERE ano_referencia = p_ano
    AND is_active = true
  LIMIT 1;
$$;

-- 9. FUNÇÃO PARA CALCULAR CRÉDITO PRESUMIDO APLICÁVEL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_credito_presumido_aplicavel(
  p_tributo TEXT,
  p_ncm TEXT DEFAULT NULL,
  p_tipo_adquirente TEXT DEFAULT NULL,
  p_tipo_operacao TEXT DEFAULT NULL,
  p_uf TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  codigo TEXT,
  nome TEXT,
  percentual_credito NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cpr.id,
    cpr.codigo,
    cpr.nome,
    cpr.percentual_credito
  FROM public.credito_presumido_regras cpr
  WHERE cpr.is_active = true
    AND cpr.valid_from <= CURRENT_DATE
    AND (cpr.valid_until IS NULL OR cpr.valid_until >= CURRENT_DATE)
    AND (cpr.tributo = p_tributo OR cpr.tributo = 'ambos')
    AND (
      -- Verifica condições - pelo menos uma deve bater se estiver habilitada
      (NOT cpr.aplica_por_ncm OR p_ncm = ANY(cpr.ncms_aplicaveis))
      AND (NOT cpr.aplica_por_adquirente OR p_tipo_adquirente = ANY(cpr.tipos_adquirente))
      AND (NOT cpr.aplica_por_operacao OR p_tipo_operacao = ANY(cpr.tipos_operacao))
      AND (NOT cpr.aplica_por_regiao OR p_uf = ANY(cpr.ufs_aplicaveis))
    )
  ORDER BY cpr.percentual_credito DESC
  LIMIT 1;
$$;