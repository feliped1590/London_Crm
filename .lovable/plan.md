

# Plano: Mapeamento Completo ERP → CRM na Promoção

## Problema

A RPC `promote_staging_products_v2` promove registros da staging para `products` mapeando **apenas o nome** (e usando um campo que nem existe: `ds_material`). Todos os outros campos do ERP são ignorados.

## Campos do ERP disponíveis vs. destino no CRM

```text
ERP (raw_data)                    →  products (CRM)
─────────────────────────────────────────────────────
desc_completa_item                →  name
desc_simples_versao               →  erp_versao_detalhes
produto (ex: "100135/1")          →  erp_product_code + erp_versao
codigo_ncm                        →  ncm_code
codigo_unidade                    →  unit_measure
desc_familia                      →  (lookup ou texto)
desc_grupo                        →  erp_grupo
desc_subgrupo                     →  erp_subgrupo
empresa                           →  erp_empresa
codigo_tipo_item                  →  tipo_item
codigo_tipo_ficha                 →  tipo_ficha
codigo_roteiro                    →  erp_versao_roteiro
situacao_item                     →  erp_status
situacao_versao                   →  erp_versao_situacao
preco_venda                       →  unit_price
preco_ultima_venda                →  price_cash (ou referência)
peso_liquido                      →  weight
referencia                        →  reference
```

## Solução

### Migration: Reescrever a RPC `promote_staging_products_v2`

Atualizar o UPDATE e INSERT para mapear todos os campos relevantes do `raw_data` JSONB:

**No UPDATE:**
```sql
UPDATE products SET
  name = COALESCE(rec.raw_data->>'desc_completa_item', name),
  ncm_code = COALESCE(rec.raw_data->>'codigo_ncm', ncm_code),
  unit_measure = COALESCE(rec.raw_data->>'codigo_unidade', unit_measure),
  erp_grupo = COALESCE(rec.raw_data->>'desc_grupo', erp_grupo),
  erp_subgrupo = COALESCE(rec.raw_data->>'desc_subgrupo', erp_subgrupo),
  erp_empresa = COALESCE((rec.raw_data->>'empresa')::int, erp_empresa),
  tipo_item = COALESCE(rec.raw_data->>'desc_tipo_item', tipo_item),
  tipo_ficha = COALESCE((rec.raw_data->>'codigo_tipo_ficha')::int, tipo_ficha),
  erp_versao = <parsed from produto field>,
  erp_versao_detalhes = COALESCE(rec.raw_data->>'desc_simples_versao', erp_versao_detalhes),
  erp_versao_roteiro = COALESCE((rec.raw_data->>'codigo_roteiro')::int, erp_versao_roteiro),
  erp_versao_situacao = COALESCE(rec.raw_data->>'situacao_versao', erp_versao_situacao),
  erp_status = COALESCE(rec.raw_data->>'situacao_item', erp_status),
  unit_price = COALESCE((rec.raw_data->>'preco_venda')::numeric, unit_price),
  weight = COALESCE((rec.raw_data->>'peso_liquido')::numeric, weight),
  reference = COALESCE(rec.raw_data->>'referencia', reference),
  erp_last_update_date = rec.data_alteracao,
  erp_synced_at = now(),
  origem_alteracao = 'ERP'
WHERE ...
```

**No INSERT:** mesmos campos, garantindo que o produto entra completo no CRM.

**Parsing do campo `produto`:** o ERP envia `"100135/1"` — a RPC deve separar em `erp_product_code = '100135'` e `erp_versao = '1'` usando `split_part()`.

### Considerações

- Campos numéricos (`empresa`, `tipo_ficha`, `roteiro`, `preco_venda`, `peso_liquido`) precisam de cast seguro com tratamento de NULL/vazio
- `COALESCE` garante que campos já preenchidos no CRM não sejam sobrescritos por NULL do ERP
- A proteção de data (`data_alteracao >= erp_last_update_date`) já existe e será mantida
- Nenhuma alteração no frontend — apenas a RPC fica mais rica

## Arquivos Impactados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Reescrever `promote_staging_products_v2` com mapeamento completo |

## Resultado Esperado

- Produtos promovidos chegam com NCM, unidade, grupo, subgrupo, preço, peso, versão, etc.
- CRM recebe dados completos e utilizáveis, não apenas nome + código

