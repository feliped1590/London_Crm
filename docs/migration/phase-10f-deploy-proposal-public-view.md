# Fase 10F — Deploy controlado da `proposal-public-view` (Staging)

## 1) Objetivo

Realizar deploy controlado da Edge Function `proposal-public-view` no projeto Supabase Staging (`cansbrrwrprcycjvgvqm`), sem ampliar escopo e sem executar teste funcional com token real.

## 2) Pre-checks executados

1. Branch inicial confirmada como `main`.
2. `main` limpa e atualizada em relacao a `origin/main`.
3. Projeto Supabase esperado confirmado em `projects list`:
   - `cansbrrwrprcycjvgvqm` (`crm-qualyvac-staging`) marcado como linked.
4. Hardening da Fase 10D confirmado em `supabase/functions/proposal-public-view/index.ts`:
   - validacao de token (presenca, formato e tamanho),
   - erro generico anti-enumeracao,
   - validacao de expiracao (`approval_token_expires_at`),
   - payload reduzido,
   - logs higienizados,
   - rate limit basico,
   - restricao de metodos.
5. `supabase/config.toml` mantido sem alteracao, com:
   - `[functions.proposal-public-view]`
   - `verify_jwt = false`
6. Confirmado escopo desta fase:
   - deploy de **apenas** `proposal-public-view`.

## 3) Comandos executados

1. `git status --short --branch`
2. `git branch --show-current`
3. `npx supabase projects list`
4. `npx supabase functions list`
5. `git checkout -b phase-10f-deploy-proposal-public-view`
6. `npx supabase functions deploy proposal-public-view --project-ref cansbrrwrprcycjvgvqm`
7. `npx supabase functions list --project-ref cansbrrwrprcycjvgvqm`
8. `Start-Sleep -Seconds 5; npx supabase functions list --project-ref cansbrrwrprcycjvgvqm`

## 4) Resultado do deploy

- Deploy executado com sucesso.
- Saida-chave:
  - `Deployed Functions on project cansbrrwrprcycjvgvqm: proposal-public-view`
- Dashboard informado pela CLI:
  - `https://supabase.com/dashboard/project/cansbrrwrprcycjvgvqm/functions`

## 5) Resultado de `functions list` pos-deploy

- Na primeira consulta imediata apos deploy, a listagem ainda mostrava apenas `generate-signed-url-secure`.
- Apos breve espera e nova consulta, `proposal-public-view` apareceu como `ACTIVE`.
- Estado final observado:
  - `generate-signed-url-secure` — `ACTIVE`
  - `proposal-public-view` — `ACTIVE` (version 1)

## 6) Funcao deployada e funcoes nao alteradas

- **Deployada nesta fase:**
  - `proposal-public-view`

- **Nao deployadas/nao alteradas nesta fase:**
  - todas as demais Edge Functions do repositorio
  - nenhuma integracao externa foi acionada (WhatsApp, e-mail, Google, IA, ERP)

## 7) Teste funcional

- **Nao houve teste funcional HTTP** nesta fase.
- Motivo: evitar uso de token real e dados reais; validacao funcional fica para fase posterior controlada.

## 8) Riscos remanescentes

1. Endpoint permanece publico (`verify_jwt=false`).
2. Funcao ainda usa `SUPABASE_SERVICE_ROLE_KEY`.
3. Rate limit ainda basico (mitigacao inicial, nao definitiva).
4. Necessidade de observacao operacional apos disponibilizacao.

## 9) Rollback planejado (nao executado)

- Se houver necessidade de rollback operacional, executar somente com autorizacao explicita:
  1. redeploy da versao anterior conhecida da funcao;
  2. congelar testes funcionais ate estabilizacao;
  3. registrar incidente e evidencias de log em `proposal_access_logs`.

> Observacao: nenhum rollback foi executado nesta fase.

## 10) Observabilidade recomendada

- Monitorar volume de respostas `404` (token invalido/expirado) e `429` (rate limit).
- Monitorar erros `500` e eventos de `rate_limited`.
- Acompanhar `proposal_access_logs` para padroes anormais de abuso por IP.

## 11) Proximos passos

1. Abrir Fase 10G para validacao funcional controlada sem dados reais.
2. Definir criterio objetivo de sucesso/fracasso para a funcao em staging.
3. Planejar hardening adicional (anti-abuso avancado e estrategia de menor privilegio no medio prazo).

