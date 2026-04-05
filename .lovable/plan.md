

# Plano: Pipeline de Staging ERP com Histórico, Hash Determinístico e Promoção Segura

## Arquitetura Final

```text
ERP API (EXP_PRODUTOS_V1)
        |
        v
+-------------------------------+
| erp_products_staging          |  <-- Todos os produtos, historico completo
| UUID PK (multiplas versoes)   |
| hash_data (MD5 deterministico)|
| status: pending/processing/   |
|         processed/error/skip  |
+-------------------------------+
        |
        v  RPC: promote_staging_products_v2(p_tenant_id)
        |  advisory lock + ROW_NUMBER + hash comparison
        |
+-------------------------------+
| products (CRM)                |  <-- Apenas Produtos Acabados
| erp_hash, erp_last_update_date|
| is_acabado = true             |
+-------------------------------+
```

## 1. Migration SQL

### 1a. Tabela `erp_products_staging`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | UUID PK | Permite multiplas versoes do mesmo erp_code |
| `tenant_id` | UUID NOT NULL | Multi-tenant |
| `erp_code` | TEXT NOT NULL | cd_material |
| `codigo_tipo_item` | INTEGER | 1=PA, 2=MP, etc |
| `data_alteracao` | TIMESTAMPTZ | Controle incremental |
| `raw_data` | JSONB NOT NULL | Payload completo |
| `hash_data` | TEXT NOT NULL | MD5 deterministico |
| `status` | TEXT DEFAULT 'pending' | pending/processing/processed/error/skipped |
| `error_message` | TEXT | Detalhes do erro |
| `retry_count` | INTEGER DEFAULT 0 | Tentativas |
| `promoted` | BOOLEAN DEFAULT FALSE | Ja processado? |
| `promoted_at` | TIMESTAMPTZ | Quando promovido |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |

Indices:
- `(tenant_id, erp_code, data_alteracao DESC)` -- busca ultima versao
- `(tenant_id, erp_code, hash_data) WHERE status = 'pending'` -- dedup parcial
- `(tenant_id, codigo_tipo_item, status)` -- filtro de promocao
- `(tenant_id, status)` -- monitoramento

RLS: tenant isolation + admin access.

### 1b. Colunas novas em `products`

```sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_acabado BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS erp_hash TEXT;
```

`erp_last_update_date` ja existe.

### 1c. Funcao RPC `promote_staging_products_v2(p_tenant_id UUID)`

Logica:
1. `pg_advisory_xact_lock` baseado no tenant_id (previne concorrencia)
2. Marcar registros candidatos como `status = 'processing'`
3. `ROW_NUMBER() OVER (PARTITION BY tenant_id, erp_code ORDER BY data_alteracao DESC)` -- so o mais recente
4. Filtro: `codigo_tipo_item = 1`, `status = 'processing'`, `data_alteracao IS NOT NULL`
5. Comparar `hash_data` com `products.erp_hash` -- skip se igual
6. Upsert em `products` via `ON CONFLICT (tenant_id, erp_product_code)`:
   - Atualizar **apenas se** `staging.data_alteracao > products.erp_last_update_date` ou `erp_last_update_date IS NULL`
   - Setar `erp_hash = staging.hash_data`, `is_acabado = true`, `origem_alteracao = 'ERP'`
7. Marcar processados como `status = 'processed'`, `promoted = true`
8. Em erro: `status = 'error'`, `error_message`, `retry_count + 1`
9. Registros com `retry_count >= 5` ficam como `error` permanente
10. Atualizar `erp_sync_control` apenas com maior `data_alteracao` dos `processed`
11. Retornar JSON: `{ promoted, skipped_hash, skipped_old, errors }`

SECURITY DEFINER para bypass de RLS.

## 2. Edge Function: `erp-import-products-staging/index.ts`

Nova edge function dedicada a ingestao:

**Input**: `{ tenant_id, records[] }`

**Fluxo**:
1. Para cada record:
   - Extrair `erp_code`, `codigo_tipo_item`, `data_alteracao`
   - Gerar hash deterministico: `MD5(JSON.stringify(sortKeys(record)))` usando funcao auxiliar que ordena chaves recursivamente
   - Verificar se ja existe `(tenant_id, erp_code, hash_data)` com `status = 'pending'` -- skip se duplicado
   - Insert na staging com `status = 'pending'`
2. Retornar `{ staging_inserted, staging_skipped_unchanged }`

**NAO** chama promocao -- responsabilidade separada.

### Helper de hash deterministico

```typescript
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + sorted.map(k =>
    JSON.stringify(k) + ':' + stableStringify((obj as Record<string, unknown>)[k])
  ).join(',') + '}';
}
```

Hash: usar `crypto.subtle.digest('MD5', ...)` ou importar MD5 do Deno std.

## 3. Edge Function: `erp-promote-products/index.ts`

Edge function independente para promocao:

**Input**: `{ tenant_id }`

**Fluxo**:
1. Chamar RPC `promote_staging_products_v2(tenant_id)`
2. Sincronizar sequencia ERP via `sync_erp_sequence_if_higher` com base nos codigos promovidos
3. Retornar summary

Pode ser chamada manualmente (botao) ou via cron.

## 4. Frontend -- StagingMonitor.tsx

Na aba ERP da pagina de Integracoes:
- 4 Cards: Total Staging | Pendentes | Promovidos | Erros
- Tabela com ultimos registros (erp_code, tipo_item, status, data_alteracao, hash)
- Botao "Promover Agora" -- chama `erp-promote-products`
- Botao "Reprocessar Erros" -- reseta `status = 'pending'` onde `status = 'error'` e `retry_count < 5`
- Indicador de ultima sincronizacao (de `erp_sync_control`)

## 5. Edge Function existente (`erp-import-products`)

Manter como esta -- fallback para imports diretos. Nao deprecar.

## Arquivos impactados

| Arquivo | Acao |
|---------|------|
| Nova migration SQL | `erp_products_staging`, colunas `products`, RPC `promote_staging_products_v2` |
| `supabase/functions/erp-import-products-staging/index.ts` | Nova -- ingestao staging |
| `supabase/functions/erp-promote-products/index.ts` | Nova -- promocao independente |
| `src/pages/Integrations.tsx` | Adicionar StagingMonitor na aba ERP |
| `src/components/integrations/StagingMonitor.tsx` | Novo componente de monitoramento |

## Garantias

- **Idempotencia**: hash deterministico evita reprocessamento
- **Consistencia**: advisory lock previne concorrencia
- **Auditabilidade**: historico completo na staging
- **Performance**: indices parciais, processamento em batch
- **Escalabilidade**: separacao ingestao/promocao, retry controlado

