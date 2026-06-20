# Fase 10N - Deploy controlado de `proposal-public-view` com links publicos

## 1) Objetivo

Executar deploy controlado da Edge Function `proposal-public-view` adaptada para uso de `proposal_public_links`, sem testes HTTP e sem alterar banco/codigo fora do escopo.

## 2) Ambiente

- Repositorio: `qualyvac-migration`
- Branch da fase: `phase-10n-deploy-proposal-public-view-links`
- Projeto alvo: Supabase Staging

## 3) Project ref

Confirmado via `npx supabase projects list`:

- `REFERENCE ID`: `cansbrrwrprcycjvgvqm`
- `NAME`: `crm-qualyvac-staging`

## 4) Pre-checks

Pre-checks executados e aprovados:

1. `main` limpa e atualizada;
2. branch criada: `phase-10n-deploy-proposal-public-view-links`;
3. `public.proposal_public_links` existe (`to_regclass` nao nulo);
4. `proposal_public_links` vazia (`count(*) = 0`);
5. verificacao de logica 10M no arquivo local `supabase/functions/proposal-public-view/index.ts`:
   - uso de `proposal_public_links`;
   - calculo `sha256Hex`;
   - filtros por `token_hash`/`status`/`expires_at`/`revoked_at`.
6. sem alteracoes locais pendentes inesperadas.

## 5) Funcao deployada

- Funcao alvo (unica permitida): `proposal-public-view`

## 6) Comando de deploy executado

Comando executado:

- `npx supabase functions deploy proposal-public-view --project-ref cansbrrwrprcycjvgvqm`

## 7) Resultado do deploy

**Nao concluido com sucesso nesta fase.**

Foram realizadas duas tentativas controladas do mesmo comando, ambas falhando no bundling remoto:

1. timeout ao buscar `https://deno.land/std@0.168.0/http/server.ts` (10s);
2. erro `500 Internal Server Error` ao importar o mesmo endpoint.

Ambas as falhas ocorreram no ambiente remoto de bundle da Supabase, sem alterar regras de escopo.

## 8) Resultado do `functions list`

Consulta antes e apos as tentativas:

- `proposal-public-view` permaneceu `ACTIVE`, `VERSION = 1`, `UPDATED_AT` inalterado.
- `generate-signed-url-secure` inalterada.

Interpretacao: nenhum novo deploy efetivo foi aplicado.

## 9) Confirmacao de que nenhum teste HTTP foi executado

Nenhum teste HTTP foi executado nesta fase.

## 10) Confirmacao de que nenhum dado foi inserido

Validacao SQL read-only:

```sql
select count(*) as total_links
from public.proposal_public_links;
```

Resultado: `total_links = 0`.

## 11) Confirmacao de que nenhuma outra funcao foi alterada

Nao houve deploy de outra funcao alem de tentativas restritas a `proposal-public-view`.
`functions list` permaneceu com o mesmo conjunto e versoes.

## 12) Riscos remanescentes

1. Bloqueio operacional de deploy por indisponibilidade/intermitencia do endpoint remoto de import do Deno.
2. Funcao adaptada da fase 10M ainda nao publicada em staging.
3. Fases de validacao funcional (10O/10P) seguem bloqueadas ate deploy efetivo.

## 13) Rollback recomendado (documental)

- Sem rollback tecnico necessario nesta fase, pois nao houve nova versao publicada.
- Se necessario no futuro, rollback deve ser por redeploy de versao/commit anterior, com autorizacao explicita.

## 14) Proximos passos

1. Repetir Fase 10N com janela de rede estavel para novo deploy da mesma funcao.
2. Opcional de diagnostico operacional: repetir deploy com `--debug` para anexar detalhes tecnicos caso erro persista.
3. Somente apos deploy bem-sucedido, avancar para validacoes sem HTTP real sensivel (fase seguinte planejada).
