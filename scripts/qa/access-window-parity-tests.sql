-- =============================================================================
-- QA: Paridade de comportamento entre create_app_session e force_replace_session
-- =============================================================================
-- Objetivo: garantir que ambos os fluxos de criação de sessão se comportem de
-- forma idêntica quando o acesso ocorre fora da janela permitida:
--   ✔ bloqueiam (success=false, error='OUTSIDE_ALLOWED_HOURS')
--   ✔ logam em access_violation_log com action='outside_allowed_hours'
--   ✔ registram o flow correto ('create' vs 'replace') nos detalhes
--
-- Como executar:
--   1) Substituir :test_user_id por um usuário REAL de teste (não admin/dev)
--   2) Garantir que existe access_calendar_rule para o tenant cobrindo
--      uma janela que NÃO inclui o horário atual (ou desabilitar manualmente)
--   3) Rodar bloco a bloco e inspecionar os RAISE NOTICE
-- =============================================================================

\set test_user_id '00000000-0000-0000-0000-000000000000'

-- -----------------------------------------------------------------------------
-- SETUP: snapshot do log antes dos testes
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_count_before INT;
BEGIN
  SELECT COUNT(*) INTO v_count_before
  FROM public.access_violation_log
  WHERE user_id = :'test_user_id'::uuid
    AND action = 'outside_allowed_hours'
    AND created_at > now() - interval '1 minute';

  RAISE NOTICE '[SETUP] Violações nos últimos 60s antes do teste: %', v_count_before;
END $$;

-- -----------------------------------------------------------------------------
-- TESTE 1: create_app_session fora da janela
-- Esperado: success=false, error='OUTSIDE_ALLOWED_HOURS', log com flow='create'
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_result json;
  v_log_flow text;
BEGIN
  SELECT public.create_app_session(
    :'test_user_id'::uuid,
    'qa-test-create',
    '127.0.0.1',
    'qa-runner/1.0'
  ) INTO v_result;

  RAISE NOTICE '[T1] Resultado create_app_session: %', v_result;

  IF (v_result->>'success')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION '[T1] FALHOU: esperado success=false, recebido %', v_result->>'success';
  END IF;

  IF v_result->>'error' <> 'OUTSIDE_ALLOWED_HOURS' THEN
    RAISE EXCEPTION '[T1] FALHOU: esperado error=OUTSIDE_ALLOWED_HOURS, recebido %', v_result->>'error';
  END IF;

  SELECT details->>'flow' INTO v_log_flow
  FROM public.access_violation_log
  WHERE user_id = :'test_user_id'::uuid
    AND action = 'outside_allowed_hours'
    AND created_at > now() - interval '5 seconds'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_log_flow <> 'create' THEN
    RAISE EXCEPTION '[T1] FALHOU: log esperado com flow=create, recebido %', v_log_flow;
  END IF;

  RAISE NOTICE '[T1] ✔ create_app_session bloqueou + logou com flow=create';
END $$;

-- -----------------------------------------------------------------------------
-- TESTE 2: force_replace_session fora da janela
-- Esperado: success=false, error='OUTSIDE_ALLOWED_HOURS', log com flow='replace'
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_result json;
  v_log_flow text;
BEGIN
  SELECT public.force_replace_session(
    :'test_user_id'::uuid,
    'qa-test-replace',
    '127.0.0.1',
    'qa-runner/1.0'
  ) INTO v_result;

  RAISE NOTICE '[T2] Resultado force_replace_session: %', v_result;

  IF (v_result->>'success')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION '[T2] FALHOU: esperado success=false, recebido %', v_result->>'success';
  END IF;

  IF v_result->>'error' <> 'OUTSIDE_ALLOWED_HOURS' THEN
    RAISE EXCEPTION '[T2] FALHOU: esperado error=OUTSIDE_ALLOWED_HOURS, recebido %', v_result->>'error';
  END IF;

  SELECT details->>'flow' INTO v_log_flow
  FROM public.access_violation_log
  WHERE user_id = :'test_user_id'::uuid
    AND action = 'outside_allowed_hours'
    AND created_at > now() - interval '5 seconds'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_log_flow <> 'replace' THEN
    RAISE EXCEPTION '[T2] FALHOU: log esperado com flow=replace, recebido %', v_log_flow;
  END IF;

  RAISE NOTICE '[T2] ✔ force_replace_session bloqueou + logou com flow=replace';
END $$;

-- -----------------------------------------------------------------------------
-- TESTE 3: Paridade — ambos devem retornar EXATAMENTE o mesmo shape
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_create json;
  v_replace json;
BEGIN
  SELECT public.create_app_session(
    :'test_user_id'::uuid, 'parity', NULL, NULL
  ) INTO v_create;

  SELECT public.force_replace_session(
    :'test_user_id'::uuid, 'parity', NULL, NULL
  ) INTO v_replace;

  IF v_create->>'error' <> v_replace->>'error' THEN
    RAISE EXCEPTION '[T3] FALHOU paridade: create=% vs replace=%',
      v_create->>'error', v_replace->>'error';
  END IF;

  IF v_create->>'success' <> v_replace->>'success' THEN
    RAISE EXCEPTION '[T3] FALHOU paridade: success diverge';
  END IF;

  RAISE NOTICE '[T3] ✔ Paridade total entre create_app_session e force_replace_session';
END $$;

-- -----------------------------------------------------------------------------
-- RESUMO: contar violações geradas pelos testes
-- -----------------------------------------------------------------------------
SELECT
  details->>'flow' AS flow,
  details->>'context' AS context,
  COUNT(*) AS total
FROM public.access_violation_log
WHERE user_id = :'test_user_id'::uuid
  AND action = 'outside_allowed_hours'
  AND created_at > now() - interval '1 minute'
GROUP BY 1, 2
ORDER BY 1, 2;
