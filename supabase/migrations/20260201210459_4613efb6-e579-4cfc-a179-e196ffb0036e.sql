-- =============================================
-- Sincronização de Pedidos ERP Iniflex
-- =============================================

-- Tabela de Cabeçalho dos Pedidos
CREATE TABLE public.crm_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação ERP (external_id = numero_pedido)
  external_id TEXT NOT NULL UNIQUE,
  empresa INTEGER,
  
  -- Relacionamentos
  client_external_id TEXT,
  client_id UUID REFERENCES public.crm_clients(id),
  
  -- Dados do pedido (numero_pedido para exibição, igual ao external_id)
  numero_pedido TEXT,
  tipo_pedido TEXT,
  status TEXT,
  situacao TEXT,
  
  -- Datas como TEXT (ERP usa DD/MM/YYYY, conversão em camada de relatório)
  data_emissao TEXT,
  data_entrega TEXT,
  data_alteracao_erp TEXT,
  
  -- Valores
  valor_total NUMERIC,
  valor_desconto NUMERIC,
  valor_frete NUMERIC,
  
  -- Auditoria
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_crm_orders_external_id ON public.crm_orders(external_id);
CREATE INDEX idx_crm_orders_client ON public.crm_orders(client_external_id);
CREATE INDEX idx_crm_orders_data_alteracao ON public.crm_orders(data_alteracao_erp);
CREATE INDEX idx_crm_orders_numero_pedido ON public.crm_orders(numero_pedido);

-- Tabela de Itens dos Pedidos
CREATE TABLE public.crm_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  order_id UUID NOT NULL REFERENCES public.crm_orders(id) ON DELETE CASCADE,
  
  -- Produto
  product_external_id TEXT,
  product_id UUID REFERENCES public.crm_products(id),
  
  -- Dados do item
  descricao TEXT,
  quantidade NUMERIC,
  unidade TEXT,
  valor_unitario NUMERIC,
  valor_total NUMERIC,
  
  -- Auditoria
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_crm_order_items_order ON public.crm_order_items(order_id);
CREATE INDEX idx_crm_order_items_product ON public.crm_order_items(product_external_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_crm_orders_updated_at
  BEFORE UPDATE ON public.crm_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE public.crm_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_order_items ENABLE ROW LEVEL SECURITY;

-- Políticas para crm_orders
CREATE POLICY "crm_orders_select_authenticated" 
  ON public.crm_orders 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "crm_orders_insert_authenticated" 
  ON public.crm_orders 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "crm_orders_update_authenticated" 
  ON public.crm_orders 
  FOR UPDATE 
  TO authenticated 
  USING (true);

-- Políticas para crm_order_items
CREATE POLICY "crm_order_items_select_authenticated" 
  ON public.crm_order_items 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "crm_order_items_insert_authenticated" 
  ON public.crm_order_items 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "crm_order_items_update_authenticated" 
  ON public.crm_order_items 
  FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "crm_order_items_delete_authenticated" 
  ON public.crm_order_items 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Comentários de documentação
COMMENT ON TABLE public.crm_orders IS 'Pedidos sincronizados do ERP Iniflex. Datas mantidas como TEXT (DD/MM/YYYY) - conversão para TIMESTAMP apenas em camada de relatório.';
COMMENT ON COLUMN public.crm_orders.external_id IS 'Identificador único do ERP (= numero_pedido). Usado para UPSERT.';
COMMENT ON COLUMN public.crm_orders.numero_pedido IS 'Número do pedido para exibição (sempre igual ao external_id).';
COMMENT ON COLUMN public.crm_orders.status IS 'Status do pedido conforme ERP - não normalizado.';
COMMENT ON COLUMN public.crm_orders.situacao IS 'Situação do pedido conforme ERP - não normalizado. Mantido separado do status.';