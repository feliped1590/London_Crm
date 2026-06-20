# Fase 06 — Aplicação controlada das migrations no Supabase Staging

## Objetivo

Aplicar as migrations do repositório no Supabase Staging de forma controlada, corrigindo incompatibilidades de replay em ambiente novo sem impactar produção.

## Contexto da execução

- Branch: `phase-06-migrations-staging`
- Ambiente alvo: Supabase **staging** (linkado via CLI)
- Comando principal utilizado: `npx supabase db push --yes`
- Política de segurança adotada:
  - sem `db reset`;
  - sem comandos destrutivos;
  - sem alterações em frontend ou `.env` de produção.

## Estado inicial observado

- `npx supabase migration list --linked` mostrou grande parte das migrations já aplicada no remoto, com bloco pendente a partir de `20260521230800...`.
- A migration de compatibilidade `20260521230800_add_companies_activity_status_compat.sql` já existia, porém com problema de encoding.

## Erros encontrados, causa e correção aplicada

### Erro 01 — Syntax error no início da migration compat

- **Arquivo:** `supabase/migrations/20260521230800_add_companies_activity_status_compat.sql`
- **Erro:** `syntax error at or near "﻿"` (caractere invisível antes do comentário)
- **Causa:** arquivo com BOM UTF-8 (`EF BB BF`) no início.
- **Correção aplicada:**
  - normalização do conteúdo da migration;
  - regravação em UTF-8 sem BOM.
- **Resultado:** migration passou a aplicar normalmente.

### Erro 02 — Falha em `cron.unschedule(...)`

- **Arquivo:** `supabase/migrations/20260529131457_38f05709-a297-4296-bac6-6e554eee3782.sql`
- **Erro:** `could not find valid entry for job 'dispatch-company-sync-2min'`
- **Causa:** ambiente staging novo sem os jobs legados esperados pela migration.
- **Correção aplicada (idempotente e não invasiva):**
  - nova migration de compatibilidade:
    - `supabase/migrations/20260529131456_cron_unschedule_compat.sql`
  - objetivo: garantir criação dos jobs `*-2min` quando ausentes antes do `unschedule`.
- **Resultado:** bloco de migrations de cron avançou com sucesso.

### Erro 03 — `gin_trgm_ops` não encontrado

- **Arquivo:** `supabase/migrations/20260603211717_8bd85a94-938c-4098-858a-2a96ed37f319.sql`
- **Erro:** `operator class "gin_trgm_ops" does not exist for access method "gin"`
- **Causa:** no Supabase, o opclass de `pg_trgm` está disponível no schema `extensions`.
- **Correção aplicada:**
  - ajuste mínimo na migration para usar `extensions.gin_trgm_ops` nos índices GIN trigram.
- **Resultado:** criação dos índices trigram passou.

### Erro 04 — Coluna `last_interaction_at` ausente

- **Arquivo com falha:** `20260603211717_8bd85a94...`
- **Erro:** `column "last_interaction_at" does not exist`
- **Causa:** ordem de replay em staging sem essa coluna criada previamente.
- **Correção aplicada (idempotente):**
  - nova migration:
    - `supabase/migrations/20260603211716_add_companies_last_interaction_at_compat.sql`
  - adiciona `public.companies.last_interaction_at timestamptz` com `IF NOT EXISTS`.
- **Resultado:** bloco avançou.

### Erro 05 — Coluna `lifecycle_baseline_at` ausente

- **Arquivo com falha:** `supabase/migrations/20260614164223_3372ce43-6e5d-4579-871d-2491d517fe09.sql`
- **Erro:** `column "lifecycle_baseline_at" of relation "companies" does not exist`
- **Causa:** migration esperava colunas de lifecycle ainda não presentes no staging.
- **Correção aplicada (idempotente):**
  - nova migration:
    - `supabase/migrations/20260614164222_add_companies_lifecycle_columns_compat.sql`
  - adiciona:
    - `lifecycle_baseline_at timestamptz`
    - `activity_status_updated_at timestamptz`
    - ambas com `IF NOT EXISTS`.
- **Resultado:** fluxo seguiu até o fim.

## Resultado da nova tentativa

- `npx supabase db push --yes` finalizou com sucesso.
- Mensagem final: `Finished supabase db push.`
- As migrations pendentes do bloco de junho foram aplicadas no staging.

## Observações relevantes

- Durante a aplicação houve `NOTICE` de objetos inexistentes ou já existentes; não bloquearam execução.
- Não houve uso de comandos destrutivos.
- Produção não foi alterada.
- O diretório `supabase/.temp/` apareceu como artefato local da CLI (não aplicado ao banco).

## Arquivos alterados nesta fase

- `supabase/migrations/20260521230800_add_companies_activity_status_compat.sql` (normalização de encoding + SQL válido)
- `supabase/migrations/20260529131456_cron_unschedule_compat.sql` (novo)
- `supabase/migrations/20260603211716_add_companies_last_interaction_at_compat.sql` (novo)
- `supabase/migrations/20260603211717_8bd85a94-938c-4098-858a-2a96ed37f319.sql` (ajuste de opclass trigram)
- `supabase/migrations/20260614164222_add_companies_lifecycle_columns_compat.sql` (novo)

## Próxima validação recomendada (Fase 06.1)

- Rodar verificação funcional de schema no staging:
  - Auth/RLS básico;
  - principais RPCs;
  - triggers críticas;
  - execução controlada de Edge Functions essenciais.