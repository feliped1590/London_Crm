# Fase 10L.7 - Aplicacao da migration `proposal_public_links` no staging

## 1) Objetivo

Aplicar em staging a migration corrigida `20260620220000_create_sales_proposal_public_links.sql` e validar a criacao de `public.proposal_public_links`, sem alteracoes de codigo, Edge Functions, secrets, `.env`, `config.toml` ou integracoes externas.

## 2) Ambiente

- Repositorio: `qualyvac-migration`
- Branch da fase: `phase-10l7-aplica-migration-proposal-public-links`
- Ambiente alvo: Supabase Staging

## 3) Project ref

Validado via `npx supabase projects list`:

- `REFERENCE ID`: `cansbrrwrprcycjvgvqm`
- `NAME`: `crm-qualyvac-staging`
- Projeto permaneceu como `LINKED` durante toda a execucao.

## 4) Pre-checks executados

1. `main` confirmada limpa e atualizada.
2. Branch criada: `phase-10l7-aplica-migration-proposal-public-links`.
3. Migration local confirmada:
   - `supabase/migrations/20260620220000_create_sales_proposal_public_links.sql`
4. `public.proposals` confirmado existente no staging.
5. `20260620220000` confirmado ainda nao aplicado antes da execucao.
6. `npx supabase migration list --linked` executado com sucesso (apos tentativa intermitente inicial de autenticacao).
7. Dry-run executado imediatamente antes do push real:
   - `npx supabase db push --dry-run --linked`
   - resultado exclusivo da migration `20260620220000_create_sales_proposal_public_links.sql`.

## 5) Resultado do dry-run

Resultado aprovado:

- `Would push these migrations:`
  - `20260620220000_create_sales_proposal_public_links.sql`

Sem migrations adicionais.

## 6) Comando de aplicacao executado

Comando aplicado:

- `npx supabase db push --yes --linked`

## 7) Resultado do `db push`

Aplicacao concluida com sucesso:

- Migration aplicada: `20260620220000_create_sales_proposal_public_links.sql`
- CLI finalizou sem erro.

## 8) Resultado das validacoes SQL

Todas as queries read-only obrigatorias foram executadas em seguida.

### 8.1 Migration registrada

```sql
select version
from supabase_migrations.schema_migrations
where version = '20260620220000';
```

Resultado: `20260620220000` presente.

### 8.2 Tabelas base e nova tabela

```sql
select
  to_regclass('public.proposals') as proposals,
  to_regclass('public.proposal_public_links') as proposal_public_links;
```

Resultado:

- `proposals = proposals`
- `proposal_public_links = proposal_public_links`

### 8.3 Colunas da nova tabela

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'proposal_public_links'
order by ordinal_position;
```

Resultado validado:

- Colunas esperadas presentes (`id`, `proposal_id`, `token_hash`, `token_hash_alg`, `scope`, `status`, `expires_at`, `revoked_at`, `revoked_by`, `created_at`, `created_by`, `last_accessed_at`, `access_count`, `max_access_count`, `tenant_id`, `legal_entity_id`, `metadata`).

### 8.4 Indices

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'proposal_public_links'
order by indexname;
```

Resultado validado:

- `proposal_public_links_pkey`
- `uq_proposal_public_links_token_hash`
- `idx_proposal_public_links_token_hash`
- `idx_proposal_public_links_proposal_id`
- `idx_proposal_public_links_expires_at`
- `idx_proposal_public_links_status`
- `idx_proposal_public_links_active_lookup`

### 8.5 RLS

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'proposal_public_links';
```

Resultado: `rowsecurity = true`.

### 8.6 Policies

```sql
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'proposal_public_links'
order by policyname;
```

Resultado: nenhum registro (nenhuma policy criada nesta fase).

### 8.7 Dados inseridos

```sql
select count(*) as total_links
from public.proposal_public_links;
```

Resultado: `total_links = 0`.

## 9) Confirmacao de que nenhum dado foi inserido

Confirmado via `count(*)`: `0` linhas em `public.proposal_public_links`.

## 10) Confirmacao de que nenhuma Edge Function foi alterada

Nenhuma alteracao em `supabase/functions/*` e nenhum deploy de function nesta fase.

## 11) Confirmacao de que nenhuma API externa foi chamada

Somente Git + Supabase CLI + SQL read-only no projeto linked.
Nao houve testes HTTP de funcoes nem chamadas a APIs externas/integracoes bloqueadas.

## 12) RLS / policies

- RLS habilitado em `public.proposal_public_links`.
- Nenhuma policy publica/anonima criada.

## 13) Riscos remanescentes

1. Necessidade de adaptar consumo da nova tabela pelos fluxos de link publico nas Edge Functions.
2. Necessidade de validar comportamento funcional com dados sinteticos (fase dedicada).
3. Revisar duplicidade de indice unique em `token_hash` (`constraint unique` + `unique index`) em futura manutencao, sem impacto de seguranca imediato.

## 14) Rollback recomendado (documental)

- Em caso de reversao futura, criar migration propria de rollback.
- Nao executar rollback manual nesta fase.
- Nao dropar tabela sem autorizacao explicita.

## 15) Proximos passos

1. Fase seguinte: planejar/adaptar `proposal-public-view` (e fluxo correlato) para consumir `public.proposal_public_links` via hash.
2. Executar validacoes negativas/positivas sinteticas apos ajuste do fluxo.
3. Manter bloqueio de integracoes externas e dados reais ate gates de seguranca/funcoes serem concluídos.
