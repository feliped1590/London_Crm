# Fase 10N.5 - Deploy da `proposal-public-view` com `Deno.serve`

## 1) Objetivo

Executar deploy controlado da Edge Function `proposal-public-view` em staging apos o ajuste de bootstrap para `Deno.serve`, sem teste HTTP funcional nesta fase.

## 2) Ambiente

- Repositorio: `qualyvac-migration`
- Branch da fase: `phase-10n5-deploy-proposal-public-view-deno-serve`
- Projeto alvo: Supabase Staging

## 3) Project ref

Confirmado:

- `cansbrrwrprcycjvgvqm`
- `crm-qualyvac-staging`

## 4) Pre-checks

Pre-checks executados e aprovados:

1. `main` limpa e atualizada;
2. branch da fase criada;
3. `public.proposal_public_links` existe (`to_regclass` nao nulo);
4. `count(*)` em `proposal_public_links` segue `0`;
5. `proposal-public-view` usa `Deno.serve`;
6. import `https://deno.land/std@0.168.0/http/server.ts` ausente na funcao;
7. sem alteracoes locais inesperadas.

## 5) Confirmacao de `Deno.serve`

Validado com `rg` no arquivo `supabase/functions/proposal-public-view/index.ts`:

- encontrado `Deno.serve(async (req) => { ... })`;
- nenhum match para import antigo de `std@0.168.0/http/server.ts`.

## 6) Confirmacao de remocao do import `deno.land/std@0.168.0/http/server.ts`

Validado por inspecao regex no arquivo da funcao: import antigo nao presente.

## 7) Funcao deployada

- `proposal-public-view` (e somente ela).

## 8) Comando de deploy executado

```bash
npx supabase functions deploy proposal-public-view --project-ref cansbrrwrprcycjvgvqm
```

## 9) `--debug` foi necessario?

Nao. O deploy concluiu com sucesso na primeira tentativa.

## 10) Resultado do deploy

Sucesso:

- `Deployed Functions on project cansbrrwrprcycjvgvqm: proposal-public-view`

## 11) Resultado do `functions list`

Antes do deploy:

- `proposal-public-view`: `ACTIVE`, `VERSION=1`, `UPDATED_AT=2026-06-20 20:26:46`

Depois do deploy:

- `proposal-public-view`: `ACTIVE`, `VERSION=2`, `UPDATED_AT=2026-06-20 21:55:53`
- `generate-signed-url-secure`: inalterada (`VERSION=1`)

## 12) `VERSION`/`UPDATED_AT` mudou?

Sim. `proposal-public-view` passou para `VERSION=2` com novo `UPDATED_AT`, confirmando publish efetivo.

## 13) Confirmacao de que nenhum teste HTTP foi executado

Nenhum teste HTTP foi executado nesta fase.

## 14) Confirmacao de que nenhum dado foi inserido

Validacao SQL read-only:

```sql
select count(*) as total_links
from public.proposal_public_links;
```

Resultado: `0`.

## 15) Confirmacao de que nenhuma outra funcao foi alterada

Confirmado via `functions list`: nenhuma outra funcao teve versao/updated_at alterados.

## 16) Riscos remanescentes

1. Ainda falta validacao funcional controlada (negativa/positiva sintetica) da nova versao publicada;
2. Fluxo de aprovacao correlato (`proposal-approve`) segue fora desta fase.

## 17) Rollback recomendado (documental)

- Em necessidade futura, fazer redeploy da versao anterior da funcao (por commit/branch conhecido).
- Nao executar rollback nesta fase sem autorizacao explicita.

## 18) Proximos passos

1. Iniciar fase de validacao sem dados reais e sem integracoes externas para confirmar comportamento da `proposal-public-view` v2;
2. Verificar erros/vazamento de payload em chamadas negativas controladas antes de qualquer teste positivo sintetico.
