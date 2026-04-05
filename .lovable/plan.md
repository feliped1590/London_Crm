

# Plano: SKU para Produtos Promovidos do ERP

## Problema

O `INSERT` na tabela `products` falha porque `sku` é `NOT NULL`, e a RPC `promote_staging_products_v2` não gera SKU.

A regra de SKU do CRM é: `TIPO-FAM-GRP-SUB-CLS-W-L-T` (composto dos **códigos** das tabelas de lookup: `product_types`, `product_groups`, etc.). Porém, os dados do ERP trazem apenas **descrições textuais** (ex: "LISO BOBINA", "4 SOLDAS") que não correspondem diretamente aos códigos das lookups do CRM.

## Dados Relevantes

- ERP traz: `desc_tipo_item = "PRODUTOS ACABADOS"`, `desc_grupo = "LISO SACO"`, `desc_subgrupo = "4 SOLDAS"`
- CRM tem: `product_types.value = "PA"` (label "Produto Acabado"), `product_groups.value = "PEBD"`, etc.
- Não há correspondência automática confiável entre as descrições do ERP e os códigos das lookups

## Solução Proposta

### Estratégia: SKU temporário baseado no código ERP + mapeamento posterior

1. **Na promoção (RPC)**: gerar um SKU provisório usando o `erp_product_code` como base:
   - Formato: `ERP-{erp_product_code}` (ex: `ERP-100135`)
   - Isso satisfaz a constraint `NOT NULL` e identifica claramente produtos vindos do ERP que ainda não foram classificados

2. **Marcar produtos como "não classificados"**: os campos `tipo_id`, `grupo_id`, `subgrupo_id`, `family_id`, `class_id` ficam `NULL`, indicando que o produto precisa de classificação manual

3. **Fluxo pós-promoção**: o usuário pode abrir o produto no catálogo e classificá-lo (tipo, grupo, etc.), momento em que o SKU será regenerado automaticamente conforme as regras do CRM

### Alternativa descartada
Tentar mapear automaticamente "LISO BOBINA" → algum grupo CRM. Os nomes são completamente diferentes (ERP usa nomenclatura de processo, CRM usa nomenclatura de material), tornando o mapeamento automático não confiável.

## Alterações

| Arquivo | Ação |
|---------|------|
| Migration SQL | Atualizar `promote_staging_products_v2` para gerar `sku = 'ERP-' \|\| v_erp_code` no INSERT |

## Detalhes Técnicos

Na RPC, alterar apenas o bloco `INSERT`:

```sql
INSERT INTO products (
  tenant_id, sku, erp_product_code, name, ...
) VALUES (
  p_tenant_id,
  'ERP-' || v_erp_code,  -- SKU provisório
  v_erp_code,
  ...
);
```

A trigger `trg_generate_sku_unique` já vai gerar automaticamente o `sku_unique` (ex: `ERP-100135-001`).

Também resetar os ~9.907 registros em `error` na staging de volta para `pending`.

## Resultado Esperado

- INSERT não falha mais (SKU preenchido)
- Produtos promovidos aparecem no catálogo com SKU `ERP-XXXXX`
- Classificação pode ser feita depois manualmente
- Quando classificados, SKU será atualizado conforme regras CRM

