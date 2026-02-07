-- Corrigir política legada que expõe erp_sync_logs

-- Remover a política problemática que permite acesso público
DROP POLICY IF EXISTS "Service role can manage sync logs" ON public.erp_sync_logs;

-- A política "Admins can view sync logs" já existe e está correta para SELECT
-- As políticas de INSERT e UPDATE também já estão configuradas corretamente