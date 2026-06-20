# Fase 10L.2 — Migration de links publicos de propostas (nao aplicada)

## 1) Objetivo

Criar migration SQL controlada para introduzir a tabela dedicada de links publicos de proposta (`sales_proposal_public_links`), validando por inspeção e dry-run, sem aplicar no staging.

## 2) Ambiente

- Repositorio: `Qualyvac_Migration`
- Branch: `phase-10l2-migration-links-publicos-propostas`
- Projeto staging: `crm-qualyvac-staging`
- Project ref: `cansbrrwrprcycjvgvqm`

## 3) Pre-checks

1. Branch inicial confirmada: `main`.
2. `main` limpa e atualizada.
3. Project ref staging confirmado em `supabase projects list`.
4. Chave primaria de `sales_proposals` confirmada: `id uuid`.
5. `sales_proposals.legal_entity_id` existe e e `uuid`.
6. `public.profiles` existe e PK confirmada em `profiles.user_id` (`uuid`).
7. `public.tenants` nao existe no schema atual do staging.

## 4) Migration criada

Arquivo criado:
- `supabase/migrations/20260620220000_create_sales_proposal_public_links.sql`

Nome da tabela:
- `public.sales_proposal_public_links`

## 5) Campos criados (contrato implementado)

- `id uuid` PK
- `sales_proposal_id uuid` (obrigatorio)
- `token_hash text` (obrigatorio, sem token bruto)
- `token_hash_alg text` default `'sha256'`
- `scope text` com check (`view`, `approve`, `view_approve`)
- `status text` com check (`active`, `revoked`, `used`, `expired`)
- `expires_at timestamptz` (obrigatorio)
- `revoked_at timestamptz`
- `revoked_by uuid`
- `created_at timestamptz` default UTC
- `created_by uuid`
- `last_accessed_at timestamptz`
- `access_count integer` default `0`
- `max_access_count integer`
- `tenant_id uuid` (sem FK nesta fase por incompatibilidade de schema atual)
- `legal_entity_id uuid`
- `metadata jsonb` default `'{}'::jsonb`

## 6) FKs criadas

- `sales_proposal_id -> public.sales_proposals(id)` (`ON DELETE CASCADE`)
- `legal_entity_id -> public.legal_entities(id)` (`ON DELETE SET NULL`)
- `created_by -> public.profiles(user_id)` (`ON DELETE SET NULL`)
- `revoked_by -> public.profiles(user_id)` (`ON DELETE SET NULL`)

## 7) Indices criados

- `UNIQUE` em `token_hash` (constraint + unique index)
- indice em `sales_proposal_id`
- indice em `expires_at`
- indice em `status`
- indice composto parcial para lookup ativo:
  - `(status, expires_at, sales_proposal_id)` where `revoked_at IS NULL` and `status='active'`

## 8) RLS / policies

- RLS habilitado na nova tabela (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
- **Nenhuma policy criada** nesta fase (especialmente nenhuma policy publica/anonima).

## 9) Estrategia de token/hash

- Token bruto **nao** e persistido.
- Persistencia apenas de `token_hash`.
- Comentarios SQL adicionados para reforcar requisito de seguranca.

## 10) Estrategia de expiracao/revogacao

- `expires_at` obrigatorio.
- Revogacao explicita por `revoked_at`/`revoked_by` e `status`.
- Suporte a uso unico/controlado via `status` + `access_count`/`max_access_count`.

## 11) Dry-run

### Tentativa 1 (falha de CLI, sem impacto)

Comando:
- `npx supabase db push --dry-run --project-ref cansbrrwrprcycjvgvqm`

Resultado:
- erro de parametro (`--project-ref` nao suportado em `db push` nesta versao da CLI).

### Tentativa 2 (valida, sem aplicar)

Comando:
- `npx supabase db push --dry-run --linked`

Resultado:
- sucesso no dry-run.
- migration detectada para push:
  - `20260620220000_create_sales_proposal_public_links.sql`
- nenhuma migration foi aplicada.

## 12) Confirmacao de nao aplicacao

- Nao houve `db push` real.
- Nao houve alteracao de banco nesta fase.
- Somente criacao de arquivo SQL local + documentacao.

## 13) Riscos remanescentes

1. Politicas RLS especificas ainda nao definidas (intencional nesta fase).
2. Sem adaptacao de Edge Functions ainda, logo o fluxo publico continua bloqueado funcionalmente.
3. Campo `tenant_id` foi mantido sem FK por ausencia de `public.tenants` no staging.

## 14) Criterios para aplicar no staging (Fase 10L.3)

1. Revisao SQL e seguranca aprovadas.
2. Validacao final de estrategia de RLS/policies (sem acesso anonimo direto).
3. Confirmacao de plano de rollback.
4. Aprovacao para execucao de `db push` real em staging.

## 15) Proximos passos

1. Fase 10L.3: aplicar migration no staging (com controle e checklist).
2. Fase 10M: adaptar `proposal-public-view` para `sales_*` + `sales_proposal_public_links`.
3. Fase 10N: deploy controlado.
4. Fase 10O/10P: validacoes negativa e positiva sintetica.

