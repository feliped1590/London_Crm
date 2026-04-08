

# Plano: Campo de Código de Versão ERP para Itens de Pedido

## Problema

O campo `erp_versao` na tabela `products` armazena a string de dimensão (ex: `100x150x0,120`), que é o **detalhe** da versão. Porém, o payload de pedidos (`IMP_PEDIDO_V3`) espera o **código** da versão (ex: `"1"`), que é o identificador numérico da versão no ERP.

Hoje o mapper envia `versao: "100x150x0,120"` quando deveria enviar `versao: "1"`.

## Solução

Adicionar campo `erp_versao_codigo` na tabela `products` com default `'1'`, e usar esse campo no payload de pedidos.

## Etapa 1 — Migration

```sql
ALTER TABLE products 
  ADD COLUMN erp_versao_codigo TEXT DEFAULT '1';

-- Preencher registros existentes
UPDATE products SET erp_versao_codigo = '1' WHERE erp_versao_codigo IS NULL;

COMMENT ON COLUMN products.erp_versao_codigo IS 
  'Código da versão no ERP (ex: 1, 2). Usado no payload de pedidos (IMP_PEDIDO_V3).';
```

## Etapa 2 — Atualizar Edge Function `process-order-sync`

Na query de itens, incluir `erp_versao_codigo` no SELECT:

```sql
products!inner(id, erp_product_code, erp_versao, erp_versao_codigo, name)
```

No mapeamento dos itens, usar `erp_versao_codigo` ao invés de `erp_versao`:

```typescript
erp_versao: item.products.erp_versao_codigo || '1',
```

## Etapa 3 — Atualizar Mapper e Validator

- `order-mapper.ts`: O campo `erp_versao` da interface `CRMOrderItemForSync` passa a receber o código (`"1"`), sem mudança na interface
- `order-validator.ts`: Validação existente de `product_erp_versao` continua funcionando

## Etapa 4 — Atualizar Simulador de Payload

Em `OrderPayloadSimulator.tsx`, ajustar a query e o mapeamento para usar `erp_versao_codigo` no campo `versao` do payload simulado.

## Etapa 5 — Import de Produtos ERP

Na função `erp-import-products`, mapear o campo `versao` do ERP (código) para `erp_versao_codigo`, mantendo `erp_versao` para a string de dimensão/detalhe.

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| Migration SQL (nova) | Adicionar coluna `erp_versao_codigo` |
| `process-order-sync/index.ts` | Usar `erp_versao_codigo` no SELECT e mapeamento |
| `OrderPayloadSimulator.tsx` | Usar `erp_versao_codigo` na simulação |
| `erp-import-products/index.ts` | Mapear código de versão do ERP |

