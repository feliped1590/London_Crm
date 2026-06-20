# Fase 10L.6 - Correcao da migration de links publicos para `proposals`

## 1) Objetivo

Corrigir a migration pendente `20260620220000_create_sales_proposal_public_links.sql` para o modelo real materializado no staging (`public.proposals`), validar em dry-run e documentar, sem aplicacao real no banco.

## 2) Ambiente

- Repositorio: `qualyvac-migration`
- Branch inicial validada: `main` limpa e atualizada
- Branch da fase: `phase-10l6-corrige-migration-links-publicos-proposals`
- Escopo: somente ajuste em migration pendente + validacoes read-only/dry-run

## 3) Project ref

Confirmado via `npx supabase projects list`:

- `REFERENCE ID`: `cansbrrwrprcycjvgvqm`
- `NAME`: `crm-qualyvac-staging`
- Projeto marcado como `LINKED` durante toda a fase.

## 4) Confirmacao de que `20260620220000` nao estava aplicada

Consulta executada:

```sql
select version
from supabase_migrations.schema_migrations
where version = '20260620220000';
```

Resultado: `[]` (nao aplicada).

## 5) Motivo da correcao

A versao original da migration dependia de `public.sales_proposals`, objeto inexistente no staging linked e sem evidencias concretas no repositorio/migrations aplicadas.  
O dominio real encontrado e:

- `public.proposals`
- `public.proposal_items`

## 6) Nome final da tabela escolhida

Escolha final:

- `public.proposal_public_links`

Decisao: abandonar nome baseado em `sales_*` para alinhar ao modelo real do dominio de propostas no ambiente atual.

## 7) Alteracoes feitas na migration

Arquivo alterado:

- `supabase/migrations/20260620220000_create_sales_proposal_public_links.sql`

Mudancas principais:

1. Tabela renomeada de `public.sales_proposal_public_links` para `public.proposal_public_links`.
2. Coluna FK principal renomeada de `sales_proposal_id` para `proposal_id`.
3. Dependencia alterada de `public.sales_proposals(id)` para `public.proposals(id)`.
4. Renomeio de constraints/indexes/comentarios para prefixo `proposal_public_links`.
5. Mantidos requisitos de seguranca: hash-only token, expiracao obrigatoria, revogacao, auditoria, RLS habilitado e sem policy publica.

## 8) FKs finais

Ficaram assim:

- `proposal_id -> public.proposals(id) ON DELETE CASCADE`
- `revoked_by -> public.profiles(user_id) ON DELETE SET NULL`
- `created_by -> public.profiles(user_id) ON DELETE SET NULL`
- `legal_entity_id -> public.legal_entities(id) ON DELETE SET NULL`

## 9) Indices finais

Indices definidos na migration corrigida:

- `idx_proposal_public_links_token_hash` (UNIQUE em `token_hash`)
- `idx_proposal_public_links_proposal_id` (`proposal_id`)
- `idx_proposal_public_links_expires_at` (`expires_at`)
- `idx_proposal_public_links_status` (`status`)
- `idx_proposal_public_links_active_lookup` (`status`, `expires_at`, `proposal_id`) parcial para `status='active'` e `revoked_at IS NULL`

## 10) RLS / policies

- `ALTER TABLE public.proposal_public_links ENABLE ROW LEVEL SECURITY;`
- Nenhuma policy publica/anonima criada nesta fase.

## 11) Resultado do dry-run

Comando efetivo validado:

- `npx supabase db push --dry-run --linked`

Resultado:

- `Would push these migrations:`
  - `20260620220000_create_sales_proposal_public_links.sql`

Ou seja, dry-run mostrou exclusivamente a migration esperada.

Observacao operacional: `npx supabase db push --dry-run` (sem `--linked`) retornou falha de autenticacao (`SUPABASE_DB_PASSWORD`) nesta versao do CLI; a validacao oficial da fase foi concluida com `--linked`.

## 12) Confirmacao de que nao houve aplicacao real

- Nao foi executado `npx supabase db push --yes`.
- Nao foi executado `supabase db reset`.
- A migration segue pendente no staging.

## 13) Riscos remanescentes

1. Necessidade de validar na proxima fase o comportamento real de criacao da tabela com esse SQL revisado.
2. Necessidade de alinhar funcoes publicas (`proposal-public-view` / `proposal-approve`) com a nova tabela de links.
3. Garantir que nao sejam criadas policies permissivas na fase de aplicacao.

## 14) Criterios para aplicar no staging na proxima fase

Prosseguir para aplicacao somente se:

1. Projeto linked continuar `cansbrrwrprcycjvgvqm` (`crm-qualyvac-staging`);
2. Dry-run seguir exibindo somente `20260620220000_create_sales_proposal_public_links.sql`;
3. Nao houver alteracoes locais inesperadas fora de docs/migration alvo;
4. Validacoes pos-aplicacao confirmarem:
   - tabela criada;
   - colunas e FKs corretas;
   - indices criados;
   - RLS habilitado;
   - ausencia de policies publicas.

## 15) Proximos passos

1. Abrir fase 10L.7 para aplicacao controlada da migration corrigida no staging (`db push --yes`).
2. Executar validacao SQL read-only pos-aplicacao.
3. Em fase posterior, adaptar e validar fluxo de links publicos nas Edge Functions com dados sinteticos.
