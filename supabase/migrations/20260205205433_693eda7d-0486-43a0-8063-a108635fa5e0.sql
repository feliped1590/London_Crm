-- =====================================================
-- REMANEJAMENTO DE CARTEIRA - ESTRUTURA DE BANCO
-- =====================================================

-- 1. VIEW: company_activity_summary
-- Consolida ultimo atendimento de cada cliente
-- last_interaction_at vive EXCLUSIVAMENTE nesta view (sem coluna fisica)
-- JOIN com crm_clients por CNPJ e enriquecimento opcional (nao dependencia critica)

CREATE OR REPLACE VIEW public.company_activity_summary AS
SELECT 
  c.id AS company_id,
  c.name AS company_name,
  c.cnpj,
  c.state,
  c.city,
  c.owner_id,
  c.active,
  c.created_at AS company_created_at,
  -- Regiao comercial (enriquecimento do ERP, pode ser NULL)
  cc.regiao,
  cc.subregiao,
  -- Ultimo atendimento: MAX entre activities, tasks concluidas, emails enviados, whatsapp outbound
  COALESCE(
    GREATEST(
      (SELECT MAX(a.created_at) FROM public.activities a WHERE a.company_id = c.id),
      (SELECT MAX(t.completed_at) FROM public.tasks t WHERE t.company_id = c.id AND t.status = 'concluida'),
      (SELECT MAX(el.sent_at) FROM public.email_logs el 
       JOIN public.contacts ct ON el.contact_id = ct.id 
       WHERE ct.company_id = c.id AND el.sent_at IS NOT NULL),
      (SELECT MAX(wm.created_at) FROM public.whatsapp_messages wm 
       WHERE wm.company_id = c.id AND wm.direction = 'outbound')
    ),
    c.created_at
  ) AS last_interaction_at,
  -- Ultima venda (orders CRM)
  (SELECT MAX(o.created_at) FROM public.orders o WHERE o.company_id = c.id) AS last_order_at,
  -- Totais de pedidos
  (SELECT COUNT(*) FROM public.orders o WHERE o.company_id = c.id) AS total_orders,
  (SELECT COALESCE(SUM(o.total_value), 0) FROM public.orders o WHERE o.company_id = c.id) AS total_order_value
FROM public.companies c
-- LEFT JOIN com crm_clients para enriquecimento de regiao (tratando normalizacao de CNPJ)
LEFT JOIN public.crm_clients cc ON REPLACE(REPLACE(c.cnpj, '.', ''), '/', '') = REPLACE(REPLACE(cc.cnpj_cpf, '.', ''), '/', '')
  AND c.cnpj IS NOT NULL 
  AND cc.cnpj_cpf IS NOT NULL;

-- 2. Adicionar colunas em portfolio_transfers para auditoria completa
ALTER TABLE public.portfolio_transfers 
ADD COLUMN IF NOT EXISTS reason text,
ADD COLUMN IF NOT EXISTS filter_context jsonb;

-- Comentarios para documentacao
COMMENT ON COLUMN public.portfolio_transfers.reason IS 'Motivo do remanejamento informado pelo gestor';
COMMENT ON COLUMN public.portfolio_transfers.filter_context IS 'Contexto dos filtros aplicados no momento da transferencia (JSON)';

-- 3. RPC: get_companies_for_reallocation
-- Funcao server-side para busca filtrada com performance otimizada

CREATE OR REPLACE FUNCTION public.get_companies_for_reallocation(
  p_states text[] DEFAULT NULL,
  p_regions text[] DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_min_days_no_interaction int DEFAULT NULL,
  p_min_days_no_order int DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  company_id uuid,
  company_name text,
  cnpj text,
  state text,
  city text,
  owner_id uuid,
  owner_name text,
  regiao text,
  subregiao text,
  last_interaction_at timestamptz,
  days_since_interaction int,
  last_order_at timestamptz,
  days_since_order int,
  total_orders bigint,
  total_order_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cas.company_id,
    cas.company_name,
    cas.cnpj,
    cas.state,
    cas.city,
    cas.owner_id,
    COALESCE(p.full_name, 'Sem responsável') AS owner_name,
    cas.regiao,
    cas.subregiao,
    cas.last_interaction_at,
    COALESCE(EXTRACT(DAY FROM NOW() - cas.last_interaction_at)::int, 9999) AS days_since_interaction,
    cas.last_order_at,
    COALESCE(EXTRACT(DAY FROM NOW() - cas.last_order_at)::int, 9999) AS days_since_order,
    cas.total_orders,
    cas.total_order_value
  FROM public.company_activity_summary cas
  LEFT JOIN public.profiles p ON cas.owner_id = p.user_id
  WHERE 
    cas.active = true
    AND (p_states IS NULL OR cas.state = ANY(p_states))
    AND (p_regions IS NULL OR cas.regiao = ANY(p_regions))
    AND (p_owner_id IS NULL OR cas.owner_id = p_owner_id)
    AND (p_min_days_no_interaction IS NULL 
         OR COALESCE(EXTRACT(DAY FROM NOW() - cas.last_interaction_at)::int, 9999) >= p_min_days_no_interaction)
    AND (p_min_days_no_order IS NULL 
         OR COALESCE(EXTRACT(DAY FROM NOW() - cas.last_order_at)::int, 9999) >= p_min_days_no_order)
    AND (p_search IS NULL OR p_search = '' 
         OR cas.company_name ILIKE '%' || p_search || '%'
         OR cas.cnpj ILIKE '%' || p_search || '%')
  ORDER BY 
    COALESCE(EXTRACT(DAY FROM NOW() - cas.last_interaction_at)::int, 9999) DESC,
    cas.company_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 4. RPC: get_distinct_states_for_reallocation
-- Retorna lista de UFs distintas para o filtro

CREATE OR REPLACE FUNCTION public.get_distinct_states_for_reallocation()
RETURNS TABLE (state text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT c.state
  FROM public.companies c
  WHERE c.state IS NOT NULL AND c.state != '' AND c.active = true
  ORDER BY c.state;
$$;

-- 5. RPC: get_distinct_regions_for_reallocation
-- Retorna lista de regioes distintas do ERP

CREATE OR REPLACE FUNCTION public.get_distinct_regions_for_reallocation()
RETURNS TABLE (regiao text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT cc.regiao
  FROM public.crm_clients cc
  WHERE cc.regiao IS NOT NULL AND cc.regiao != ''
  ORDER BY cc.regiao;
$$;

-- 6. Grants para funcoes
GRANT EXECUTE ON FUNCTION public.get_companies_for_reallocation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_states_for_reallocation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_regions_for_reallocation TO authenticated;