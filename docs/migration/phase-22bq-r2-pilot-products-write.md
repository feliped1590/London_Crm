# Fase 22BQ-R2 - Escrita piloto unitaria `products` (sem expansao)

## 1. Objetivo

Executar escrita real controlada de 1 unico produto piloto em `products`, com payload saneado da 22BP-R2, idempotencia por `sku_unique`, before/after obrigatorios e hard stop de expansao.

## 2. Escopo executado

- pre-check Git;
- leitura de evidencias 22BO/22BP e payload saneado;
- revalidacao read-only de schema, triggers, unique, nullability e cardinalidades auxiliares;
- alteracao minima do executor `scripts/migration/phase-22k-r2-baseline-write.mjs` para incluir piloto `products`;
- geracao de evidence `before` e `after`;
- execucao de 1 insert controlado em `products`;
- pos-validacao read-only com contagens de guarda.

## 3. Payload utilizado

`TMP-22F-R2-PRODUCT-01`:

- `tenant_id=00000000-0000-0000-0000-000000000001`
- `sku=TMP-SKU-0001`
- `expected_sku_unique=TMP-SKU-0001-001`
- `name=TMP Product 01`
- `expected_persisted_name=TMP PRODUCT 01`
- `tipo_id=522d0e75-641f-4161-bd41-94ebd50e8158`
- `grupo_id=c5057853-15be-440d-886f-b0093de363fa`
- `subgrupo_id=8f798403-516e-48cf-b675-e025240385f3`
- `family_id=d1720ddd-f0a1-42eb-9428-51ca8df02c92`
- `class_id=79b5d092-1669-4b39-b590-565b471c1360`

Campos omitidos por contrato:

- `legal_entity_id`
- `erp_product_code`
- `erp_versao`
- campos de pedido/sync/transacionais.

## 4. Alteracao no executor

Arquivo alterado: `scripts/migration/phase-22k-r2-baseline-write.mjs`

Incluido para 22BQ-R2:

- `products` em `ALLOWED_PILOT_ENTITIES`;
- autorizacao dedicada `EXPECTED_PRODUCTS_PILOT_AUTHORIZATION`;
- contrato congelado `EXPECTED_PRODUCTS_PILOT_PAYLOAD`;
- funcao `executeProductsPilotWrite()` com:
  - validacao de target/batch/autorizacao;
  - validacao de payload saneado e politicas;
  - lookup previo por `expected_sku_unique` e por `sku`;
  - `idempotent_noop` para registro aderente existente;
  - abort em divergencia;
  - insert controlado de 1 linha quando inexistente.
- ramo completo de before/after da fase 22BQ com hard stop final.

## 5. Before

Arquivo:

- `artifacts/migration/phase-22bq-r2-pilot-products-write/before-20260627-234146.json`

Resultado:

- `beforeDecision=GO`
- `productsCountBefore=0`
- lookup `sku=TMP-SKU-0001`: `0`
- lookup `sku_unique=TMP-SKU-0001-001`: `0`
- lookup `name=TMP PRODUCT 01`: `0`
- triggers validados:
  - `trg_generate_sku_unique=true`
  - `trg_uppercase_products=true`
- unique validada:
  - `products_sku_unique_key=true`
- `versao_numero` default `1`;
- `erp_product_code`, `erp_versao`, `legal_entity_id` nullable;
- cardinalidade auxiliares (tipo/grupo/subgrupo/family/class): todas `1`.

## 6. Operacao executada

Comando real executado:

`node scripts/migration/phase-22k-r2-baseline-write.mjs --expected-target nsnmlleplpzsefzkuxlb --batch baseline_22f_r2_restore_test_qualyvac --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" --pilot-authorization "AUTORIZO A DÉCIMA PRIMEIRA ESCRITA PILOTO DA BASELINE 22BP-R2 SOMENTE EM products NO RESTORE-TEST nsnmlleplpzsefzkuxlb" --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-225537.json --pilot-payload artifacts/migration/phase-22bp-r2-products-payload-sanitization/products-sanitized-payload-20260627-232650.json --pilot-entity products --execute-pilot-write --write`

Resultado da operacao:

- `operation=inserted`
- `id=01c62ae4-4204-413d-80b5-1054e0dba08d`
- sem escrita fora de `products`.

## 7. After

Arquivo:

- `artifacts/migration/phase-22bq-r2-pilot-products-write/after-20260627-234146.json`

Resultado:

- `afterDecision=GO`
- `delta=+1` em `products`
- registro final:
  - `sku=TMP-SKU-0001`
  - `sku_unique=TMP-SKU-0001-001`
  - `name=TMP PRODUCT 01`
  - `versao_numero=1`
  - auxiliares (`tipo_id`,`grupo_id`,`subgrupo_id`,`family_id`,`class_id`) aderentes
  - `erp_product_code=null`
  - `erp_versao=null`
  - `legal_entity_id=null`
- `noOtherTableWritten=true`.

## 8. Escopo negativo

Contagens de guarda before/after permaneceram iguais para:

- `legal_entities`, `product_types`, `product_groups`, `product_subgroups`, `product_families`, `product_classes`
- `companies`, `contacts`
- `sales_reps`, `user_tenants`, `user_legal_entities`, `user_sales_reps`
- `deals`, `orders`, `order_items`, `proposals`, `audit_logs`, `notifications`

Unica variacao:

- `products: 0 -> 1`.

## 9. Hard stop

Mensagem emitida exatamente:

`ESCRITA PILOTO CONCLUÍDA SOMENTE EM products. EXECUÇÃO AMPLIADA BLOQUEADA.`

## 10. Riscos restantes

- sequencia de `sku_unique` depende do estado de linhas com o mesmo `sku`; lookup pre-write continua obrigatorio para futuras ondas;
- futuros pilotos `products` devem manter contrato congelado de payload e validacao de trigger/defaults.

## 11. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivo:

- `beforeDecision=GO`;
- escrita ocorreu somente em `products`;
- 1 unico registro criado com chave idempotente aderente (`sku_unique`);
- `afterDecision=GO`;
- escopo negativo preservado;
- hard stop emitido.

## 12. Recomendacao proxima fase

Executar fase de auditoria pos-piloto `products` (read-only), incluindo reexecucao idempotente do mesmo comando para validar comportamento `idempotent_noop` sem delta adicional.
