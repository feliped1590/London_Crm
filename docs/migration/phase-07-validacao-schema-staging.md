# Fase 07 — Validação do Schema no Supabase Staging

## 1. Objetivo da fase

Validar, em modo somente leitura, se o schema do Supabase Staging está estruturalmente consistente após a aplicação controlada das migrations da Fase 06, sem alterar dados, objetos ou configuração de produção.

## 2. Premissas

- A Fase 06 foi concluída com sucesso e o `db push` finalizou no staging.
- O staging está separado do Supabase atual usado pela operação na Lovable.
- Esta fase é apenas de validação e documentação (sem escrita em dados).
- Não haverá importação de dados reais nesta fase.
- Edge Functions ainda não serão configuradas nesta etapa.

## 3. Checklist de validação do schema

- [ ] Confirmar conectividade ao projeto Supabase **staging** correto.
- [ ] Validar quantidade e listagem de tabelas no schema `public`.
- [ ] Validar quantidade e listagem de funções SQL no schema `public`.
- [ ] Validar presença de RPCs críticas (ex.: `report_*`, `search_customers_paginated`, `get_activity_status_counts`).
- [ ] Validar quantidade e listagem de triggers no schema `public`.
- [ ] Validar quantidade e listagem de policies RLS por tabela.
- [ ] Validar extensões necessárias (ex.: `pg_trgm`, `pg_stat_statements`, `pgcrypto`).
- [ ] Validar últimas migrations registradas no banco.
- [ ] Validar existência das tabelas críticas de negócio.
- [ ] Registrar resultado final da validação e pendências para a próxima fase.

## 4. Queries SQL somente leitura para validação

> Executar no SQL Editor do Supabase Staging.  
> Todas as queries abaixo são `SELECT`/leitura.

### 4.1 Quantidade de tabelas públicas

```sql
SELECT COUNT(*) AS public_tables_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
```

### 4.2 Lista de tabelas públicas (ordenada)

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### 4.3 Quantidade de funções/RPCs no schema public

```sql
SELECT COUNT(*) AS public_functions_count
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';
```

### 4.4 Lista de funções/RPCs (assinatura básica)

```sql
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

### 4.5 Quantidade de triggers

```sql
SELECT COUNT(*) AS triggers_count
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

### 4.6 Lista de triggers por tabela

```sql
SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

### 4.7 Quantidade de policies RLS

```sql
SELECT COUNT(*) AS rls_policies_count
FROM pg_policies
WHERE schemaname = 'public';
```

### 4.8 Lista de policies RLS por tabela

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 4.9 Extensões instaladas

```sql
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;
```

### 4.10 Últimas migrations aplicadas

```sql
SELECT version, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 30;
```

### 4.11 Existência de tabelas críticas solicitadas

```sql
WITH required_tables AS (
  SELECT unnest(ARRAY[
    'companies',
    'products',
    'orders',
    'deals',
    'proposals',
    'legal_entities',
    'user_profiles'
  ]) AS table_name
)
SELECT
  r.table_name,
  EXISTS (
    SELECT 1
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = r.table_name
  ) AS exists_in_public
FROM required_tables r
ORDER BY r.table_name;
```

### 4.12 Checagem complementar de perfil de usuário (compatibilidade de naming)

```sql
SELECT
  table_name,
  EXISTS (
    SELECT 1
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = table_name
  ) AS exists_in_public
FROM (VALUES ('profiles'), ('user_profiles')) v(table_name);
```

## 5. Critérios de aceite

- Todas as queries executam sem erro de permissão/objeto ausente crítico.
- Tabelas públicas e objetos esperados existem no staging.
- Policies RLS estão presentes em tabelas sensíveis.
- Extensões essenciais para o projeto estão ativas.
- Histórico de migrations mostra aplicação até o bloco final da Fase 06.
- Tabelas críticas de negócio foram validadas e registradas.
- Resultado consolidado documentado para transição à próxima fase.

## 6. Riscos encontrados

- Divergência de nomenclatura de tabelas de perfil (`profiles` vs `user_profiles`) pode gerar falso negativo em checklist.
- Possível drift futuro entre migrations locais e estado do staging se novas compatibilidades não forem versionadas.
- Dependência de extensões/schema (`extensions.gin_trgm_ops`) pode variar entre ambientes.
- Validação estrutural não garante, sozinha, comportamento funcional completo (RLS e regras só com testes de fluxo).
- Triggers/policies podem existir, mas com semântica incorreta sem testes de cenário real.

## 7. Próximos passos recomendados

- Executar e salvar evidências (print/resultado) das queries desta fase.
- Consolidar um resumo de conformidade: `ok`, `atenção`, `pendente`.
- Iniciar Fase 08 com validação funcional controlada:
  - testes de Auth e perfis;
  - testes de RLS por papel/tenant;
  - testes de RPCs críticas;
  - testes de fluxo mínimo de entidades comerciais.
- Só avançar para configuração de Edge Functions após fechamento formal da validação de schema.

