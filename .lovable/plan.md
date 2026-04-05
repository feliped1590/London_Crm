

# Plano: Correção da Promoção de Produtos ERP

## Problemas Identificados

### 1. Erro na Promoção (5.012 erros)
**Erro:** `there is no unique or exclusion constraint matching the ON CONFLICT specification`

**Causa:** A RPC `promote_staging_products_v2` usa `ON CONFLICT (tenant_id, erp_product_code)`, mas o índice único no banco é **parcial**: `WHERE erp_product_code IS NOT NULL`. O PostgreSQL não aceita `ON CONFLICT` contra índices parciais dessa forma.

**Correção:** Alterar a RPC para usar a abordagem INSERT/UPDATE separada (primeiro tenta UPDATE, se não afetou linhas faz INSERT), ou criar um índice único não-parcial.

### 2. Contagem errada no Monitor (mostra 1.000 ao invés de 24.396)
**Causa:** A query do `StagingMonitor` faz `select('status')` sem limit, mas o Supabase tem limite padrão de **1.000 linhas**. Com 24.396 registros, só conta 1.000.

**Correção:** Usar query com `COUNT` via RPC ou agrupar no banco ao invés de contar no frontend.

## Dados Reais no Banco

| Status | Quantidade |
|--------|-----------|
| pending | 19.384 |
| error | 5.012 |
| **Total** | **24.396** |

- 9.908 são tipo 1 (Produto Acabado) — só esses devem ser promovidos
- Restante (tipos 2, 4, 7, 8, 10, 11, 12, 15, 22) deve ser marcado como `skipped`

## Solução

### Passo 1 — Migration: Corrigir índice e RPC

Converter o índice parcial em índice completo (com `COALESCE` ou simplesmente removendo a condição) ou alterar a RPC para usar lógica UPDATE-then-INSERT:

```sql
-- Opção: Reescrever a RPC para evitar ON CONFLICT
-- Faz UPDATE se existe, INSERT se não existe
UPDATE products SET ... WHERE tenant_id = p_tenant_id AND erp_product_code = rec.erp_code;
IF NOT FOUND THEN
  INSERT INTO products (...) VALUES (...);
END IF;
```

### Passo 2 — Migration: Resetar erros para reprocessamento

```sql
UPDATE erp_products_staging 
SET status = 'pending', error_message = NULL, retry_count = 0 
WHERE status = 'error';
```

### Passo 3 — Corrigir contagem no StagingMonitor

Substituir a query que busca todos os registros por uma contagem agrupada:

```sql
SELECT status, COUNT(*)::int as count 
FROM erp_products_staging 
GROUP BY status
```

Usar RPC ou query direta com `.rpc()` para obter os totais corretos.

### Passo 4 — Limitar tabela de registros recentes

A tabela de "Últimos Registros" já usa `.limit(20)`, está OK.

## Arquivos Impactados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Reescrever RPC `promote_staging_products_v2` (UPDATE/INSERT), resetar erros |
| `src/components/integrations/StagingMonitor.tsx` | Corrigir contagem para usar GROUP BY no banco |

## Fluxo Correto (confirmando seu entendimento)

Sim, está correto:
1. **Importar do ERP** → traz TODOS os produtos para staging (todos os tipos)
2. **Promover Agora** → promove APENAS tipo 1 (Produtos Acabados) para a tabela `products`; os demais são marcados como `skipped`

## Resultado Esperado

- Promoção funciona sem erros de constraint
- Monitor mostra contagens reais (24.396+)
- Produtos Acabados são promovidos corretamente
- Demais tipos são marcados como `skipped` (não como erro)

