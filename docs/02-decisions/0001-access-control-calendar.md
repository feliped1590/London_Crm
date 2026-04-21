# ADR 0001 — Controle de acesso por calendário (janela de acesso por tenant)

**Status:** Aceito
**Data:** 2026-04-21
**Owner:** @felipe

## Contexto

Precisamos restringir o acesso ao CRM com base em dias e horários por tenant
(empresa). O sistema é um SPA + Supabase, sem servidor próprio nem middleware
HTTP tradicional. Hoje já existe:

- `app_sessions` + `validate_app_session` chamada a cada 60s no cliente.
- RLS em todas as tabelas críticas via `has_role` e funções `SECURITY DEFINER`.
- `access_violation_log` para violações de carteira/ownership.

## Decisão

Implementar a regra em **4 camadas combinadas** (defesa em profundidade):

1. **Banco — função central** `is_within_access_window(user_id)` resolve
   tenant ativo, fuso horário, exceções e regra semanal.
2. **Sessão** — `create_app_session` bloqueia login fora do horário;
   `validate_app_session` invalida sessão em uso (efeito até ~60s).
3. **RLS RESTRICTIVE** em `deals` e `orders` (núcleo comercial). Combina
   com as policies existentes via AND. Outras tabelas serão adicionadas em
   ondas conforme rollout (ver `known-issues`).
4. **Edge Functions** — helper `_shared/accessControl.ts` para integrações
   sensíveis (ERP, IA com escrita, e-mail).

### Imunidade
- `admin` e `desenvolvedor` ignoram a janela (intervenção 24/7).

### Fail-safe
- Tenant sem regras cadastradas = liberado 24/7 (rollout não quebra nada).
- Falha de RPC em Edge Function = fail-open com `console.warn`
  (não derrubar integração ERP por erro transitório).

### Logging
- Reuso de `access_violation_log` com `action='outside_allowed_hours'` e
  `details.context` ∈ {`login`, `session_validation`}.

## Consequências

**Positivas**
- Reusa heartbeat existente (sem novo canal Realtime).
- Defesa real no banco (RLS) impossível de burlar pelo cliente.
- Sem nova dependência de UI no rollout — admin pode ativar tenant a tenant.

**Negativas / trade-offs**
- Sessão fora do horário só cai no próximo `validate_app_session` (~60s).
  Aceitável.
- RLS RESTRICTIVE adiciona ~1 chamada a `is_within_access_window` por query
  em `deals`/`orders`. Função é STABLE e a query é indexada — impacto
  esperado < 1ms.
- `access_violation_log` agora mistura dois conceitos (carteira + horário).
  Mitigação: filtrar por `action`. Se virar atrito, criar tabela dedicada
  em ADR futuro.

## Alternativas descartadas

- **Aplicar RLS em todas as tabelas operacionais já na v1**: risco alto de
  regredir telas que precisam ler histórico (relatórios, customer detail).
  Decidido começar por `deals` e `orders` e expandir por demanda.
- **Tabela própria `access_window_violations`**: adiciona complexidade sem
  ganho imediato; pode ser feito quando houver UI dedicada de auditoria.
- **Bloquear via JWT customizado / custom claims**: exigiria refresh
  forçado de token quando regras mudam — mais complexo, mesmo efeito.

## Como reverter (rollback)

```sql
DROP POLICY IF EXISTS "access window restrictive on deals" ON public.deals;
DROP POLICY IF EXISTS "access window restrictive on orders" ON public.orders;
-- restaurar versões anteriores de validate_app_session e create_app_session
-- (ver migration anterior à de 2026-04-21)
```
Tabelas `tenant_access_schedules` e `tenant_access_exceptions` podem ficar:
sem registros, o sistema é fail-safe e não bloqueia ninguém.
