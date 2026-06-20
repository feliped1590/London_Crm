# Fase 10N.2 - Retentativa de deploy de `proposal-public-view`

## 1) Objetivo

Repetir deploy controlado da funcao `proposal-public-view` no staging, sem alteracao de codigo e sem testes HTTP.

## 2) Ambiente

- Repositorio: `qualyvac-migration`
- Branch da fase: `phase-10n2-retry-deploy-proposal-public-view-links`
- Projeto alvo: Supabase Staging

## 3) Project ref

Validado via `npx supabase projects list`:

- `REFERENCE ID`: `cansbrrwrprcycjvgvqm`
- `NAME`: `crm-qualyvac-staging`

## 4) Pre-checks

Todos os pre-checks solicitados foram executados:

1. `main` limpa e atualizada;
2. branch da fase criada;
3. `public.proposal_public_links` existe (`to_regclass` nao nulo);
4. `count(*)` em `proposal_public_links` = `0`;
5. funcao local contem logica da fase 10M (`sha256Hex`, lookup em `proposal_public_links`, filtros de link ativo/expiracao/revogacao);
6. sem alteracoes locais pendentes inesperadas.

## 5) Comando executado

Tentativa 1 (normal):

- `npx supabase functions deploy proposal-public-view --project-ref cansbrrwrprcycjvgvqm`

Tentativa 2 (debug, unica retentativa permitida):

- `npx supabase functions deploy proposal-public-view --project-ref cansbrrwrprcycjvgvqm --debug`

## 6) Resultado do deploy

Deploy **nao concluido**.

Ambas as tentativas falharam com o mesmo motivo de bundling remoto:

- timeout ao buscar `https://deno.land/std@0.168.0/http/server.ts` durante bundle no ambiente da Supabase.

## 7) `--debug` foi necessario?

Sim. Foi executado uma unica vez apos a primeira falha, conforme regra.

## 8) Resultado do `functions list`

Estado final apos as tentativas:

- `proposal-public-view`: `ACTIVE`, `VERSION = 1`, `UPDATED_AT = 2026-06-20 20:26:46`
- `generate-signed-url-secure`: inalterada

## 9) `VERSION`/`UPDATED_AT` mudou?

Nao. Permaneceu igual ao estado anterior, confirmando ausencia de novo deploy efetivo.

## 10) Confirmacao de que nenhum teste HTTP foi executado

Nenhum teste HTTP foi executado nesta fase.

## 11) Confirmacao de que nenhum dado foi inserido

Validado por SQL read-only:

```sql
select count(*) as total_links
from public.proposal_public_links;
```

Resultado: `0`.

## 12) Confirmacao de que nenhuma outra funcao foi alterada

Nenhuma outra funcao foi deployada/alterada.

## 13) Riscos remanescentes

1. Bloqueio operacional persiste no bundler remoto da Supabase (import externo em `deno.land`);
2. Funcao adaptada da fase 10M ainda nao publicada em staging;
3. Fases de validacao funcional continuam bloqueadas ate deploy efetivo.

## 14) Proximos passos

1. Escalar bloqueio operacional de bundling remoto (timeout em import `deno.land`) e repetir deploy em nova janela;
2. Se o erro persistir, considerar estrategia de resiliencia de dependencias remotas antes da proxima tentativa;
3. Somente apos deploy efetivo, avancar para fase de validacao sem dados reais e sem integracoes externas.
