---
name: ERP Product Version Sync
description: Sincronização de múltiplas versões (v1, v2, v3…) do mesmo produto no ERP via IMP_ITEM_VERSAO_TESTE
type: feature
---

Cada versão é uma linha própria em `products`:
- v1 = produto principal (`parent_product_id IS NULL`, `versao_numero = 1`)
- v2+ = filhos (`parent_product_id = <id do pai>`, `versao_numero = 2, 3…`) atribuído por `trg_assign_product_versao_numero`.

## Fluxo de sync (process-product-sync)
- Cada versão entra individualmente em `product_sync_queue` (1 item por linha).
- Payload IMP_ITEM_VERSAO_TESTE: `codigo = <erp_product_code do pai>`, `versoes:[{ versao: String(versao_numero), roteiro: 1, situacao: 'A', detalhes: erp_versao }]`.
- Filho herda `erp_product_code` do pai no `loadProductForSync` se ainda não tiver.
- Se o pai não tem `erp_product_code`, o filho falha validação ("Versão não pode ser sincronizada antes do produto principal ter código ERP") e fica em retry.

## Após sync com sucesso
- `erp_versao_codigo` é persistido como `String(versao_numero)` — espelho do que foi enviado.
- `erp_versao_situacao = 'A'`.
- `erp_versao` (descritivo dimensional, ex.: `300x350x0,160`) é gerado por trigger e não é usado como identificador da versão no ERP.

## Importante
- `erp_versao_codigo` é a fonte da verdade para o número da versão usado em outras integrações (ex.: IMP_ATRIBFICHA_V1 em `process-attribute-sync`).
- Nunca confundir `erp_versao` (dimensional, descritivo) com `erp_versao_codigo` (numérico, identificador da versão).
