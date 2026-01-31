-- Tabela de logs de sincronização ERP
CREATE TABLE public.erp_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- O que foi sincronizado
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  direction TEXT NOT NULL DEFAULT 'crm_to_erp',
  
  -- Resultado
  status TEXT NOT NULL DEFAULT 'pending',
  external_id TEXT,
  error_message TEXT,
  
  -- Payloads para debug
  request_payload JSONB,
  response_payload JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Validação de status e direction
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  CONSTRAINT valid_direction CHECK (direction IN ('crm_to_erp', 'erp_to_crm'))
);

-- Índices para consultas frequentes
CREATE INDEX idx_erp_logs_entity ON erp_sync_logs(entity_type, entity_id);
CREATE INDEX idx_erp_logs_status ON erp_sync_logs(status);
CREATE INDEX idx_erp_logs_direction ON erp_sync_logs(direction);
CREATE INDEX idx_erp_logs_created ON erp_sync_logs(created_at DESC);

-- Trigger para updated_at (reutilizando função existente)
CREATE TRIGGER update_erp_sync_logs_updated_at
  BEFORE UPDATE ON erp_sync_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.erp_sync_logs ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ver logs
CREATE POLICY "Authenticated users can view sync logs"
  ON public.erp_sync_logs
  FOR SELECT
  USING (public.is_authenticated());

-- Política: apenas service role pode inserir/atualizar (Edge Functions)
CREATE POLICY "Service role can manage sync logs"
  ON public.erp_sync_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);