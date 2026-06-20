# Fase 10L.4 - Diagnostico de dependencia `sales_proposals` no staging

## 1) Objetivo

Diagnosticar, em modo estritamente read-only, por que a migration `20260620220000_create_sales_proposal_public_links.sql` falha com `relation "public.sales_proposals" does not exist`, apesar de o modelo `sales_*` ter sido previamente tratado como canonico em fases anteriores.

## 2) Ambiente

- Repositorio: `qualyvac-migration`
- Branch inicial validada: `main` limpa e atualizada
- Branch da fase: `phase-10l4-diagnostico-sales-proposals-staging`
- Supabase alvo (linked no CLI): `crm-qualyvac-staging`
- Project ref esperado/validado: `cansbrrwrprcycjvgvqm`
- Escopo: somente leitura (sem `db push --yes`, sem `db reset`, sem alteracoes de schema/codigo/config/secrets)

## 3) Project ref

Confirmado com `npx supabase projects list`:

- `REFERENCE ID`: `cansbrrwrprcycjvgvqm`
- `NAME`: `crm-qualyvac-staging`
- Projeto marcado como `LINKED` durante toda a execucao.

## 4) Resultado das consultas SQL (read-only)

Todas as queries foram executadas com `npx supabase db query --linked --output json`.

### 4.1 Contexto da conexao

```sql
select current_database(), current_schema(), current_user, now();
```

Resultado:

- `current_database = postgres`
- `current_schema = public`
- `current_user = postgres`

### 4.2 Existencia dos objetos `sales_proposal*` em `public`

```sql
select
  to_regclass('public.sales_proposals') as public_sales_proposals,
  to_regclass('public.sales_proposal_items') as public_sales_proposal_items,
  to_regclass('public.sales_proposal_history') as public_sales_proposal_history,
  to_regclass('public.sales_proposal_attachments') as public_sales_proposal_attachments,
  to_regclass('public.sales_proposal_public_links') as public_sales_proposal_public_links;
```

Resultado: todos `null`.

### 4.3 Busca global por objetos com nome contendo `sales_proposal`

```sql
select
  n.nspname as schema_name,
  c.relname as object_name,
  c.relkind as object_kind,
  c.oid::regclass as regclass_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relname ilike '%sales_proposal%'
order by n.nspname, c.relname;
```

Resultado: nenhum registro.

### 4.4 Tabelas/views com nome contendo `sales_proposal`

```sql
select table_schema, table_name, table_type
from information_schema.tables
where table_name ilike '%sales_proposal%'
order by table_schema, table_name;
```

Resultado: nenhum registro.

### 4.5 Migrations aplicadas (ultimas 80)

```sql
select version
from supabase_migrations.schema_migrations
order by version desc
limit 80;
```

Resultado relevante:

- Ultima aplicada: `20260619141118`
- Nao aparece `20260620220000`

### 4.6 Verificacao direta da migration 10L.2

```sql
select version
from supabase_migrations.schema_migrations
where version in ('20260620220000')
order by version;
```

Resultado: vazio (`[]`), logo a migration 10L.2 nao foi aplicada.

### 4.7 Contraprova do modelo atualmente materializado

Query adicional de diagnostico:

```sql
select to_regclass('public.proposals') as public_proposals,
       to_regclass('public.proposal_items') as public_proposal_items;
```

Resultado:

- `public_proposals = proposals`
- `public_proposal_items = proposal_items`

Interpretacao: o modelo presente no staging linked atual e `proposals/proposal_items` (nao `sales_*`).

## 5) Resultado das inspecoes locais

### 5.1 `rg` em migrations (obrigatorio)

Comando:

`rg -n -i "create table.*sales_proposals|create table if not exists.*sales_proposals|public\.sales_proposals|sales_proposal_items|sales_proposal_history|sales_proposal_attachments" supabase/migrations`

Resultado:

- Unica ocorrencia em migrations locais:
  - `supabase/migrations/20260620220000_create_sales_proposal_public_links.sql`
  - Linha com FK: `REFERENCES public.sales_proposals(id)`

Conclusao: nao existe migration base local que crie `public.sales_proposals` (nem `sales_proposal_items/history/attachments`).

### 5.2 `rg` em functions/src (obrigatorio)

Comando:

`rg -n -i "sales_proposals|sales_proposal_items|proposal-public-view|approval_token|sales_proposal_public_links" supabase/functions src`

Resultado relevante:

- `proposal-public-view` e `proposal-approve` continuam consultando `approval_token`/`approval_token_expires_at` no fluxo legado.
- Frontend tambem referencia `proposals` (ex.: `src/components/proposals/ProposalDialog.tsx`).
- Nao ha uso efetivo de `sales_proposals` nessas referencias levantadas.

### 5.3 Leitura da migration base de propostas

Arquivo: `supabase/migrations/20260118163027_fdaa771b-21c5-4b33-8f53-ca503f8c1fc8.sql`

Evidencia:

- Cria `public.proposals` e `public.proposal_items`.
- Nao cria `sales_*`.

## 6) Hipotese principal

**O modelo `sales_*` foi documentado, mas nao esta materializado no staging linked atual (`cansbrrwrprcycjvgvqm`) nem existe migration local que o crie.**

Portanto, a migration 10L.2 falha corretamente ao tentar criar FK para `public.sales_proposals(id)`.

## 7) Evidencias consolidadas

1. `projects list` confirma projeto linked correto (`crm-qualyvac-staging`, ref `cansbrrwrprcycjvgvqm`).
2. `to_regclass` para `public.sales_proposals` e objetos correlatos retorna `null`.
3. `pg_class` e `information_schema.tables` nao retornam nenhum objeto `sales_proposal*` em qualquer schema.
4. `rg` em migrations mostra que nenhuma migration local cria `sales_proposals`; apenas a 10L.2 referencia essa tabela.
5. `public.proposals` e `public.proposal_items` existem no staging linked e na migration base local.

## 8) Impacto na migration 10L.2

- Estado atual: **bloqueada por dependencia inexistente**.
- A migration 10L.2 depende de tabela base (`public.sales_proposals`) que nao existe no schema alvo.
- Dry-run nao valida existencia de dependencias de FK em profundidade; a falha aparece na aplicacao real.

## 9) Impacto na `proposal-public-view`

- Como o schema ativo encontrado e legado (`public.proposals`), o caminho mais seguro de curto prazo para destravar validacoes continua nesse modelo.
- Qualquer adaptacao para `sales_*` permanece bloqueada ate materializacao real e validada desse modelo no mesmo ambiente linked.

## 10) Respostas objetivas solicitadas

1. **Project ref usado pelo CLI e `cansbrrwrprcycjvgvqm`?**  
   Sim.
2. **`public.sales_proposals` existe como tabela/view?**  
   Nao existe.
3. **Existe em outro schema?**  
   Nao foi encontrado em nenhum schema.
4. **`sales_proposal_items/history/attachments` existem?**  
   Nao.
5. **Qual migration local cria `sales_proposals`?**  
   Nenhuma migration local encontrada.
6. **Essa migration base aparece aplicada no staging?**  
   Nao se aplica; nao ha migration base local de `sales_proposals` para aparecer aplicada.
7. **Fase 10J pode ter lido outro ambiente/schema/repositorio?**  
   Sim, esta e uma possibilidade forte; outra possibilidade e leitura de evidencia nao materializada no ambiente linked atual.
8. **Problema principal classificado como:**  
   `modelo sales_* documentado mas nao materializado` + `migration base ausente`.
9. **A migration 10L.2 deve ser alterada ou base deve existir antes?**  
   A base deve existir antes (pre-requisito estrutural). Sem isso, a FK continuara falhando.
10. **Menor correcao segura:**  
   Abrir fase especifica para reconciliar o modelo canonico no staging linked atual (decisao formal entre manter legado `proposals` ou materializar `sales_*`) e somente depois reenfileirar 10L.2.

## 11) Proxima fase recomendada

Iniciar uma fase 10L.5 (diagnostico de reconciliacao de modelo no staging linked) com foco em:

1. Decisao formal do modelo canonico no ambiente real de staging (`proposals` vs `sales_*`);
2. Definicao de pre-requisitos de schema para links publicos;
3. Planejamento da menor intervencao segura (migration de base ou ajuste controlado da migration 10L.2), sem executar aplicacao ainda.
