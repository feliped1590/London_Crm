-- Adicionar novos campos à tabela crm_products para suportar payload real do Iniflex
-- external_id = produto (codigo + versão embutida, ex: "6003/1")

ALTER TABLE public.crm_products 
  ADD COLUMN IF NOT EXISTS produto_codigo TEXT,
  ADD COLUMN IF NOT EXISTS descricao_simples TEXT,
  ADD COLUMN IF NOT EXISTS descricao_completa TEXT,
  ADD COLUMN IF NOT EXISTS grupo TEXT,
  ADD COLUMN IF NOT EXISTS subgrupo TEXT,
  ADD COLUMN IF NOT EXISTS tipo_item TEXT,
  ADD COLUMN IF NOT EXISTS ncm TEXT,
  ADD COLUMN IF NOT EXISTS gera_estoque BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preco_venda NUMERIC,
  ADD COLUMN IF NOT EXISTS custo_medio NUMERIC,
  ADD COLUMN IF NOT EXISTS usuario_alteracao_erp TEXT;

-- Índices para otimizar buscas e filtros
CREATE INDEX IF NOT EXISTS idx_crm_products_grupo 
  ON public.crm_products (grupo);
CREATE INDEX IF NOT EXISTS idx_crm_products_gera_estoque 
  ON public.crm_products (gera_estoque);
CREATE INDEX IF NOT EXISTS idx_crm_products_data_alteracao 
  ON public.crm_products (data_alteracao_erp);
CREATE INDEX IF NOT EXISTS idx_crm_products_ativo 
  ON public.crm_products (ativo);

-- Comentário para documentação
COMMENT ON COLUMN public.crm_products.external_id IS 'Campo produto do ERP Iniflex (codigo + versão embutida, ex: 6003/1)';