-- Criar constraint única para external_id + versao (necessário para ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS crm_products_external_id_versao_unique 
ON public.crm_products (external_id, COALESCE(versao, ''));