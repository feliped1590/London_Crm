-- =====================================================================
-- QA: Janela de acesso por tenant — cenários manuais
-- =====================================================================
-- Como usar:
--   1. Conecte ao banco como admin (psql ou Cloud SQL editor).
--   2. Ajuste :tenant_id e :test_user_id no bloco "SETUP" abaixo.
--   3. Rode bloco a bloco. Cada SELECT no fim de um cenário é o "assert".
--   4. Ao final, rode o bloco "CLEANUP" para deixar o sistema limpo.
--
-- Convenção: cada cenário imprime um RAISE NOTICE com PASS/FAIL.
-- =====================================================================

-- ─── SETUP ───────────────────────────────────────────────────────────
-- TROQUE estes UUIDs antes de rodar:
\set tenant_id   '00000000-0000-0000-0000-000000000000'
\set test_user_id '00000000-0000-0000-0000-000000000000'
\set admin_user_id '00000000-0000-0000-0000-000000000000'

BEGIN;

-- Limpa qualquer regra/exceção anterior do tenant (somente teste!)
DELETE FROM tenant_access_exceptions WHERE tenant_id = :'tenant_id';
DELETE FROM tenant_access_schedules  WHERE tenant_id = :'tenant_id';
DELETE FROM access_violation_log
 WHERE user_id IN (:'test_user_id', :'admin_user_id')
   AND attempted_at > now() - interval '1 hour';

-- =====================================================================
-- CENÁRIO 1 — Tenant SEM regras → libera (fail-safe)
-- =====================================================================
DO $$
DECLARE v_ok boolean;
BEGIN
  SELECT public.is_within_access_window(:'test_user_id'::uuid) INTO v_ok;
  RAISE NOTICE 'C1 fail-safe sem regras: %', CASE WHEN v_ok THEN 'PASS ✅' ELSE 'FAIL ❌' END;
END $$;

-- =====================================================================
-- CENÁRIO 2 — Cadastrar janela ESTREITA cobrindo agora → libera
-- =====================================================================
INSERT INTO tenant_access_schedules (tenant_id, weekday, start_time, end_time)
VALUES (
  :'tenant_id',
  EXTRACT(DOW FROM (now() AT TIME ZONE COALESCE(public.get_tenant_timezone(:'tenant_id'::uuid), 'UTC')))::int,
  ((now() AT TIME ZONE COALESCE(public.get_tenant_timezone(:'tenant_id'::uuid), 'UTC')) - interval '5 min')::time,
  ((now() AT TIME ZONE COALESCE(public.get_tenant_timezone(:'tenant_id'::uuid), 'UTC')) + interval '5 min')::time
);

DO $$
DECLARE v_ok boolean;
BEGIN
  SELECT public.is_within_access_window(:'test_user_id'::uuid) INTO v_ok;
  RAISE NOTICE 'C2 dentro da janela: %', CASE WHEN v_ok THEN 'PASS ✅' ELSE 'FAIL ❌' END;
END $$;

-- =====================================================================
-- CENÁRIO 3 — Janela no PASSADO → bloqueia
-- =====================================================================
DELETE FROM tenant_access_schedules WHERE tenant_id = :'tenant_id';
INSERT INTO tenant_access_schedules (tenant_id, weekday, start_time, end_time)
VALUES (:'tenant_id', EXTRACT(DOW FROM now())::int, '01:00', '02:00');

DO $$
DECLARE v_ok boolean;
BEGIN
  SELECT public.is_within_access_window(:'test_user_id'::uuid) INTO v_ok;
  RAISE NOTICE 'C3 fora da janela: %', CASE WHEN NOT v_ok THEN 'PASS ✅' ELSE 'FAIL ❌' END;
END $$;

-- =====================================================================
-- CENÁRIO 4 — Admin fora da janela → libera + LOGA admin_bypass
-- =====================================================================
DO $$
DECLARE v_ok boolean; v_logged int;
BEGIN
  SELECT public.is_within_access_window(:'admin_user_id'::uuid) INTO v_ok;
  SELECT count(*) INTO v_logged FROM public.access_violation_log
   WHERE user_id = :'admin_user_id'::uuid
     AND action = 'admin_bypass'
     AND attempted_at > now() - interval '1 minute';
  RAISE NOTICE 'C4 admin bypass libera+loga: %', CASE WHEN v_ok AND v_logged > 0 THEN 'PASS ✅' ELSE 'FAIL ❌' END;
END $$;

-- =====================================================================
-- CENÁRIO 5 — Exceção (feriado bloqueia) sobrescreve janela aberta
-- =====================================================================
DELETE FROM tenant_access_schedules WHERE tenant_id = :'tenant_id';
INSERT INTO tenant_access_schedules (tenant_id, weekday, start_time, end_time)
VALUES (:'tenant_id', EXTRACT(DOW FROM now())::int, '00:00', '23:59');

INSERT INTO tenant_access_exceptions (tenant_id, exception_date, is_allowed, description)
VALUES (
  :'tenant_id',
  ((now() AT TIME ZONE COALESCE(public.get_tenant_timezone(:'tenant_id'::uuid), 'UTC')))::date,
  false,
  'TESTE feriado'
);

DO $$
DECLARE v_ok boolean;
BEGIN
  SELECT public.is_within_access_window(:'test_user_id'::uuid) INTO v_ok;
  RAISE NOTICE 'C5 exceção bloqueia: %', CASE WHEN NOT v_ok THEN 'PASS ✅' ELSE 'FAIL ❌' END;
END $$;

-- =====================================================================
-- CENÁRIO 6 — Exceção liberadora sobrescreve janela fechada
-- =====================================================================
DELETE FROM tenant_access_schedules WHERE tenant_id = :'tenant_id';
INSERT INTO tenant_access_schedules (tenant_id, weekday, start_time, end_time)
VALUES (:'tenant_id', EXTRACT(DOW FROM now())::int, '01:00', '02:00');

UPDATE tenant_access_exceptions
   SET is_allowed = true, description = 'TESTE liberação extra'
 WHERE tenant_id = :'tenant_id';

DO $$
DECLARE v_ok boolean;
BEGIN
  SELECT public.is_within_access_window(:'test_user_id'::uuid) INTO v_ok;
  RAISE NOTICE 'C6 exceção libera: %', CASE WHEN v_ok THEN 'PASS ✅' ELSE 'FAIL ❌' END;
END $$;

-- =====================================================================
-- CENÁRIO 7 — RLS de orders bloqueia INSERT mas permite SELECT
-- =====================================================================
DELETE FROM tenant_access_exceptions WHERE tenant_id = :'tenant_id';
DELETE FROM tenant_access_schedules  WHERE tenant_id = :'tenant_id';
INSERT INTO tenant_access_schedules (tenant_id, weekday, start_time, end_time)
VALUES (:'tenant_id', EXTRACT(DOW FROM now())::int, '01:00', '02:00');

-- Simula contexto do usuário comum (RLS efetiva).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = format('{"sub":"%s"}', :'test_user_id');

DO $$
DECLARE v_select_ok boolean := true; v_insert_blocked boolean := false;
BEGIN
  BEGIN
    PERFORM 1 FROM public.orders LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_select_ok := false;
  END;

  BEGIN
    INSERT INTO public.orders (number, status, total_value, tenant_id)
    VALUES ('QA-TEST-' || floor(random()*1e9)::text, 'pendente', 0, :'tenant_id'::uuid);
  EXCEPTION WHEN OTHERS THEN v_insert_blocked := true;
  END;

  RAISE NOTICE 'C7 SELECT livre: %', CASE WHEN v_select_ok THEN 'PASS ✅' ELSE 'FAIL ❌' END;
  RAISE NOTICE 'C7 INSERT bloqueado: %', CASE WHEN v_insert_blocked THEN 'PASS ✅' ELSE 'FAIL ❌' END;
END $$;

RESET ROLE;

-- =====================================================================
-- CENÁRIO 8 — Tenant timezone diferente (America/Sao_Paulo)
-- =====================================================================
-- Validação manual: troque settings.timezone do tenant temporariamente
-- e refaça C2/C3 — confirmar que o weekday/horário usado é o LOCAL do tenant.

-- =====================================================================
-- CLEANUP
-- =====================================================================
DELETE FROM tenant_access_exceptions WHERE tenant_id = :'tenant_id';
DELETE FROM tenant_access_schedules  WHERE tenant_id = :'tenant_id';
DELETE FROM orders WHERE number LIKE 'QA-TEST-%';

ROLLBACK; -- Por segurança: nada permanece. Troque para COMMIT se quiser persistir os logs.
