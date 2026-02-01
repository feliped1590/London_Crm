-- Tabela para armazenar produtos sincronizados do ERP Iniflex
CREATE TABLE public.crm_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,              -- Código do produto no ERP
  descricao TEXT,                          -- Nome/descrição
  versao TEXT,                             -- Versão do produto
  sku TEXT,                                -- Código composto (opcional)
  unidade TEXT,                            -- UN, KG, CX, etc.
  ativo BOOLEAN DEFAULT true,              -- Status ativo/inativo
  data_alteracao_erp TEXT,                 -- Data incremental do ERP (como veio)
  raw_data JSONB,                          -- JSON completo do ERP
  synced_at TIMESTAMPTZ DEFAULT now(),     -- Última sincronização
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chave única: external_id + versao (versao pode ser null)
CREATE UNIQUE INDEX idx_crm_products_unique 
ON public.crm_products (external_id, COALESCE(versao, ''));

-- Índices para busca
CREATE INDEX idx_crm_products_descricao ON public.crm_products (descricao);
CREATE INDEX idx_crm_products_sku ON public.crm_products (sku);
CREATE INDEX idx_crm_products_ativo ON public.crm_products (ativo);

-- Trigger para updated_at
CREATE TRIGGER update_crm_products_updated_at
  BEFORE UPDATE ON public.crm_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.crm_products ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ler
CREATE POLICY "Usuários autenticados podem ler produtos"
  ON public.crm_products FOR SELECT
  TO authenticated
  USING (true);

-- Política: service role pode gerenciar (INSERT/UPDATE/DELETE via Edge Functions)
CREATE POLICY "Service role can manage products"
  ON public.crm_products FOR ALL
  USING (true);