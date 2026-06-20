# Fase 10L.3 - Aplicacao da migration de links publicos de propostas

## 1) Objetivo

Aplicar a migration `20260620220000_create_sales_proposal_public_links.sql` no Supabase Staging (`cansbrrwrprcycjvgvqm`) e validar a criacao de `public.sales_proposal_public_links`, sem tocar em Lovable, codigo, Edge Functions, `config.toml`, `.env`, secrets, dados reais ou APIs externas.

## 2) Ambiente

- Repositorio local: `qualyvac-migration`
- Branch de origem validada: `main`
- Branch da fase: `phase-10l3-aplica-migration-links-publicos-propostas`
- Projeto Supabase alvo (linked): `crm-qualyvac-staging`
- Project ref esperado/confirmado: `cansbrrwrprcycjvgvqm`

## 3) Project ref

Confirmado via `npx supabase projects list`:

- `REFERENCE ID`: `cansbrrwrprcycjvgvqm`
- `NAME`: `crm-qualyvac-staging`
- Marcado como `LINKED` no momento da execucao.

## 4) Pre-checks executados

Executados com sucesso antes da aplicacao real:

1. `git checkout main`
2. `git status --short --branch` (main limpa)
3. `git checkout -b phase-10l3-aplica-migration-links-publicos-propostas`
4. Confirmacao de branch atual (`git branch --show-current`)
5. Confirmacao do projeto linked (`npx supabase projects list`)
6. Confirmacao da migration local em `supabase/migrations/20260620220000_create_sales_proposal_public_links.sql`
7. `npx supabase migration list --linked`
8. Dry-run imediatamente antes do push real: `npx supabase db push --dry-run --linked`

## 5) Resultado do dry-run

Dry-run OK e com escopo exclusivo:

- Output: `Would push these migrations:`
- Unica migration listada: `20260620220000_create_sales_proposal_public_links.sql`
- Nenhuma migration adicional detectada.

## 6) Comando de aplicacao executado

Comando executado para aplicacao real:

`npx supabase db push --yes --linked`

## 7) Resultado do db push

**Falha na aplicacao** durante execucao da migration:

- Migration iniciada: `20260620220000_create_sales_proposal_public_links.sql`
- Erro retornado pelo Postgres:
  - `ERROR: relation "public.sales_proposals" does not exist (SQLSTATE 42P01)`
- Consequencia: migration **nao foi aplicada** no staging.

## 8) Resultado das validacoes SQL (read-only)

Consultas executadas via `npx supabase db query --linked --output json`.

### 8.1 `schema_migrations`

Consulta:

`select version from supabase_migrations.schema_migrations where version = '20260620220000';`

Resultado: `[]` (versao nao aplicada).

### 8.2 Existencia da tabela alvo

Consulta:

`select to_regclass('public.sales_proposal_public_links') as sales_proposal_public_links;`

Resultado: `null` (tabela nao existe).

### 8.3 Colunas

Consulta:

`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'sales_proposal_public_links' order by ordinal_position;`

Resultado: `[]`.

### 8.4 Indices

Consulta:

`select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'sales_proposal_public_links' order by indexname;`

Resultado: `[]`.

### 8.5 RLS

Consulta:

`select schemaname, tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'sales_proposal_public_links';`

Resultado: `[]` (sem tabela, sem RLS materializado).

### 8.6 Policies

Consulta:

`select schemaname, tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' and tablename = 'sales_proposal_public_links' order by policyname;`

Resultado: `[]`.

### 8.7 Checagem complementar de dependencia

Consulta complementar para explicar a falha:

`select to_regclass('public.sales_proposals') as sales_proposals;`

Resultado: `null` no projeto linked.

## 9) Confirmacao de que nenhum dado foi inserido

Como a migration falhou antes de criar a tabela:

- `public.sales_proposal_public_links` nao existe.
- Nao houve insercao de dados nessa tabela.

## 10) Confirmacao de que nenhuma Edge Function foi alterada

Nenhuma alteracao em `supabase/functions/*`.
Nenhum deploy de function foi executado nesta fase.

## 11) Confirmacao de que nenhuma API externa foi chamada

Foram executados apenas comandos locais Git/Supabase CLI e queries SQL read-only no projeto linked.
Nao houve chamadas HTTP de teste, nem integracoes externas (WhatsApp, Resend, Google Calendar, IA/Lovable AI, ERP).

## 12) RLS / policies

Estado final da fase:

- RLS esperado para `sales_proposal_public_links`: **nao validado materialmente** (tabela nao criada).
- Policies publicas: **nenhuma criada** (tambem por ausencia da tabela).

## 13) Riscos remanescentes

1. Bloqueio estrutural: dependencia `public.sales_proposals` ausente no staging linked atual.
2. A migration 10L.2 nao e aplicavel neste estado de schema.
3. Fluxos 10M/10N/10O/10P continuam bloqueados sem reconciliacao da dependencia.

## 14) Rollback recomendado (documental)

- Nao executar rollback manual nesta fase.
- Em necessidade futura, planejar reversao via migration propria, revisada e aprovada.
- Nao dropar tabela sem autorizacao explicita.

Observacao: como a migration nao foi aplicada, nao houve acao efetiva para reverter nesta fase.

## 15) Proximos passos

1. Abrir fase de diagnostico/correcao de dependencia no staging para definir tabela canonica realmente existente no projeto linked atual.
2. Criar migration de compatibilidade controlada para referenciar a entidade de proposta existente (ou ajustar pre-requisitos de schema) antes de reaplicar a 20260620220000.
3. Repetir dry-run e exigir novamente escopo exclusivo antes de novo `db push --yes`.

## Resultado final da Fase 10L.3

- **Status:** bloqueada com seguranca.
- **Aplicacao da migration 20260620220000:** nao aplicada.
- **Tabela `public.sales_proposal_public_links`:** nao criada.
- **Escopo de seguranca:** preservado (staging only, sem alteracoes de codigo/integracoes externas).
