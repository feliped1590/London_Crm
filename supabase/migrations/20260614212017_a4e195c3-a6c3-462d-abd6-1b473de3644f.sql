
ALTER TABLE public.legal_entities
  ADD COLUMN IF NOT EXISTS order_erp_endpoint text,
  ADD COLUMN IF NOT EXISTS order_erp_token_secret_name text,
  ADD COLUMN IF NOT EXISTS order_erp_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.legal_entities.order_erp_endpoint IS
  'URL do endpoint Iniflex/Projedata usado APENAS para sincronização de pedidos desta entidade jurídica. NULL = usa env PROJEDATA_API_URL (fallback Novafix). Outras integrações (clientes, produtos, atributos) NÃO usam este campo.';
COMMENT ON COLUMN public.legal_entities.order_erp_token_secret_name IS
  'Nome do secret (variável de ambiente da Edge Function) que contém o Bearer Token usado APENAS para pedidos desta entidade. NULL = usa env PROJEDATA_API_TOKEN. Nunca armazena o token cru.';
COMMENT ON COLUMN public.legal_entities.order_erp_enabled IS
  'Kill-switch da integração de pedidos para esta entidade. false bloqueia o envio com mensagem clara. Não afeta outras integrações.';

ALTER TABLE public.order_sync_log
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid,
  ADD COLUMN IF NOT EXISTS endpoint_used text,
  ADD COLUMN IF NOT EXISTS empresa_used integer;
