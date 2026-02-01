
-- ===========================================
-- 1. Tabela de controle de sincronização
-- ===========================================
CREATE TABLE public.erp_sync_control (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity TEXT NOT NULL UNIQUE,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT '2000-01-01 00:00:00+00',
  last_sync_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca por entidade
CREATE INDEX idx_erp_sync_control_entity ON public.erp_sync_control(entity);

-- Trigger para updated_at
CREATE TRIGGER update_erp_sync_control_updated_at
  BEFORE UPDATE ON public.erp_sync_control
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.erp_sync_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sync control"
  ON public.erp_sync_control FOR SELECT
  USING (public.is_authenticated());

CREATE POLICY "Service role can manage sync control"
  ON public.erp_sync_control FOR ALL
  USING (true);

-- ===========================================
-- 2. Tabela de clientes ERP (crm_clients)
-- ===========================================
CREATE TABLE public.crm_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  tipo_pessoa TEXT,
  cnpj_cpf TEXT,
  rg TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  telefone TEXT,
  celular TEXT,
  emails TEXT[],
  tipo_cliente TEXT,
  tipo_fornecedor TEXT,
  tipo_transportador TEXT,
  tipo_representante TEXT,
  segmento TEXT,
  subsegmento TEXT,
  regiao TEXT,
  subregiao TEXT,
  contribui_icms BOOLEAN DEFAULT false,
  possui_titulos BOOLEAN DEFAULT false,
  insc_estadual TEXT,
  destino_mercadoria TEXT,
  data_alteracao_erp TEXT,
  usuario_alteracao_erp TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_crm_clients_external_id ON public.crm_clients(external_id);
CREATE INDEX idx_crm_clients_cnpj_cpf ON public.crm_clients(cnpj_cpf);
CREATE INDEX idx_crm_clients_razao_social ON public.crm_clients(razao_social);
CREATE INDEX idx_crm_clients_synced_at ON public.crm_clients(synced_at);

-- Trigger para updated_at
CREATE TRIGGER update_crm_clients_updated_at
  BEFORE UPDATE ON public.crm_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clients"
  ON public.crm_clients FOR SELECT
  USING (public.is_authenticated());

CREATE POLICY "Service role can manage clients"
  ON public.crm_clients FOR ALL
  USING (true);

-- ===========================================
-- 3. Tabela de endereços (crm_client_addresses)
-- ===========================================
CREATE TABLE public.crm_client_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('LOCAL', 'ENTREGA', 'COBRANCA')),
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cep TEXT,
  codigo_cidade TEXT,
  cidade TEXT,
  uf TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, tipo)
);

-- Índices
CREATE INDEX idx_crm_client_addresses_client_id ON public.crm_client_addresses(client_id);
CREATE INDEX idx_crm_client_addresses_tipo ON public.crm_client_addresses(tipo);

-- Trigger para updated_at
CREATE TRIGGER update_crm_client_addresses_updated_at
  BEFORE UPDATE ON public.crm_client_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.crm_client_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view addresses"
  ON public.crm_client_addresses FOR SELECT
  USING (public.is_authenticated());

CREATE POLICY "Service role can manage addresses"
  ON public.crm_client_addresses FOR ALL
  USING (true);
