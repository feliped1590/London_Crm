# Fase 10I — Diagnostico de divergencia de schema (`proposals`) no staging

## 1) Objetivo

Executar diagnostico read-only para entender por que `public.proposals` nao existe no Supabase Staging e reconciliar a expectativa do codigo/migrations com o schema real.

## 2) Ambiente confirmado

- Repositorio: `Qualyvac_Migration`
- Branch da fase: `phase-10i-diagnostico-schema-proposals-staging`
- Projeto staging confirmado: `crm-qualyvac-staging`
- Project ref confirmado: `cansbrrwrprcycjvgvqm`
- Sem alteracoes locais pendentes antes do diagnostico.

## 3) Resultados das queries read-only (staging)

### 3.1 Banco/schema atual

Query:
- `select current_database(), current_schema(), now();`

Resultado:
- `current_database = postgres`
- `current_schema = public`

### 3.2 Existencia das tabelas criticas

Query:
- `to_regclass(...)` para `companies`, `products`, `orders`, `deals`, `proposals`, `proposal_items`, `legal_entities`, `user_profiles`

Resultado:
- `companies`: existe
- `products`: existe
- `orders`: existe
- `deals`: existe
- `proposals`: **nao existe** (`null`)
- `proposal_items`: **nao existe** (`null`)
- `legal_entities`: existe
- `user_profiles`: **nao existe** (`null`)

### 3.3 Tabelas relacionadas a proposal/proposta

Query:
- `information_schema.tables` com `ilike '%proposal%'`/`'%proposta%'`

Resultado:
- `proposal_approval_rules`
- `proposal_number_sequences`
- `sales_proposal_attachments`
- `sales_proposal_history`
- `sales_proposal_items`
- `sales_proposals`
- `sales_proposals_sp`

### 3.4 Lista de tabelas publicas

Query:
- base tables em `public`

Resultado:
- 73 tabelas publicas.
- Nao existe `proposals`; existe `sales_proposals` e `sales_proposal_items`.
- Nao existe `user_profiles`; existe `profiles`.

### 3.5 Migrations aplicadas no staging

Query:
- `select version from supabase_migrations.schema_migrations ...`

Resultado:
- Janela atual de migrations aplicadas: de `20260517161000` ate `20260602110000`.
- Total no staging: `42`.
- Versions antigas que criariam/alterariam `public.proposals` nao aparecem (ex.: `20260118163027`, `20260118224452`, `20260214170029`, `20260305000616`).

### 3.6 Contagem de objetos

- `public_tables = 73`
- `public_functions = 57`
- `public_policies = 114`

### 3.7 Funcoes/RPCs relacionadas a proposals

Query:
- `information_schema.routines` com `routine_name ilike '%proposal%'`

Resultado:
- `public.next_proposal_number`

### 3.8 Policies relacionadas a proposals

Query:
- `pg_policies` com `tablename ilike '%proposal%'`

Resultado:
- Policies presentes para:
  - `proposal_approval_rules`
  - `sales_proposal_attachments`
  - `sales_proposal_history`
  - `sales_proposal_items`
  - `sales_proposals`
- Nao ha policies para `public.proposals` (tabela ausente).

## 4) Diagnostico no repositorio (read-only)

### 4.1 Migrations locais mencionam `public.proposals`?

Sim, extensivamente.

Achados principais:
- Migration que deveria criar:
  - `supabase/migrations/20260118163027_fdaa771b-21c5-4b33-8f53-ca503f8c1fc8.sql`
  - contem `CREATE TABLE public.proposals` e `CREATE TABLE public.proposal_items`.
- Migration que adiciona token:
  - `supabase/migrations/20260118224452_9e9f4b5d-04da-44f3-952d-ac4b369ac5dc.sql`
  - adiciona `approval_token` e `approval_token_expires_at` em `public.proposals`.
- Diversas migrations posteriores usam `public.proposals` e `public.proposal_items`.

### 4.2 Uso no codigo

Encontrado uso direto de `from('proposals')` e `from('proposal_items')` em:
- `supabase/functions/proposal-public-view/index.ts`
- `supabase/functions/proposal-approve/index.ts`
- `supabase/functions/generate-proposal-pdf/index.ts`
- componentes frontend em `src/components/proposals/...`

### 4.3 Referencia local de schema

Arquivo encontrado:
- `SUPABASE_SCHEMA_COMPLETO.sql`

Conteudo relevante:
- contem `CREATE TABLE public.proposals` e `CREATE TABLE public.proposal_items`.

## 5) Divergencia confirmada

### 5.1 `public.proposals` existe?

- **Nao existe no staging atual.**

### 5.2 Existe tabela equivalente?

- **Sim, provavelmente equivalente funcional parcial:**
  - `public.sales_proposals`
  - `public.sales_proposal_items`

## 6) Migration local que deveria criar `proposals`

- `20260118163027_fdaa771b-21c5-4b33-8f53-ca503f8c1fc8.sql` (create table `public.proposals` + `public.proposal_items`)

## 7) Essa migration aparece aplicada no staging?

- **Nao.**
- `schema_migrations` do staging nao contem essa version (nem outras antigas 202601/202602 relacionadas ao modelo `public.proposals`).

## 8) Hipotese principal da divergencia

Hipotese mais forte:
- O staging `cansbrrwrprcycjvgvqm` esta em um **modelo de schema diferente** (nomenclatura `sales_*`) e com historico de migrations iniciado em 202605, enquanto o codigo/funcoes ainda esperam o modelo antigo `public.proposals`.

Hipoteses complementares:
1. migration ausente no staging;
2. staging inicializado por baseline diferente/squash parcial;
3. codigo orfao em relacao ao schema ativo;
4. validacoes anteriores (Fase 07) cobriram tabelas criticas gerais, mas nao capturaram divergencia de naming para proposals.

## 9) Impacto

### 9.1 Na `proposal-public-view`

- Alto impacto funcional: a funcao consulta `public.proposals` e `public.proposal_items`; no schema atual isso tende a falhar em runtime para qualquer token.

### 9.2 Nas fases futuras

- Bloqueia Fase 10H (teste positivo sintetico) e qualquer validacao funcional real de proposals nesse endpoint.
- Pode impactar outras funcoes/componentes que usam `proposals`/`proposal_items`.

## 10) Recomendacao (sem aplicar correcao agora)

Nao corrigir nesta fase. Em fase futura dedicada:
1. Definir estrategia unica de reconciliacao:
   - **A)** alinhar schema para `public.proposals`/`public.proposal_items`, ou
   - **B)** adaptar codigo/funcoes para `sales_proposals`/`sales_proposal_items`.
2. Confirmar mapping de colunas e regras de negocio entre os dois modelos.
3. Executar plano de compatibilidade em staging antes de novos testes funcionais.

## 11) Criterios para desbloquear a Fase 10H

1. Tabela alvo do endpoint existir no staging (nome esperado pelo codigo) **ou** endpoint atualizado para o nome real do schema.
2. Query base de `proposal-public-view` executar sem erro de relacao ausente.
3. Confirmacao de integridade minima de dados sinteticos (sem usar dados reais).
4. Revalidacao negativa + positiva controlada apos reconciliacao.

