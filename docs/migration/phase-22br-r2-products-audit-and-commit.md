# Fase 22BR-R2 - Auditoria products + reexecucao idempotente + commit local

## 1. Objetivo

Auditar o piloto real de `products` da 22BQ-R2, validar idempotencia por `sku_unique`, executar reexecucao controlada do mesmo comando e consolidar o bloco 22BO-22BR em commit local.

## 2. Escopo

- pre-check Git;
- leitura de evidencias 22BO/22BP/22BQ;
- auditoria read-only do produto piloto;
- validacao read-only de idempotencia/dependencias/escopo negativo;
- reexecucao do mesmo comando da 22BQ-R2;
- geracao de evidencia 22BR-R2;
- checagem de sensiveis;
- stage seletivo e commit local.

## 3. Restricoes absolutas

- sem expansao;
- sem escrita fora de `products`;
- sem schema/migration/seed/cleanup/rollback;
- sem ERP/API/webhook/n8n/filas/deploy;
- sem push.

## 4. Estado Git antes do commit

- branch: `main`
- ultimo commit: `a52bab83 feat(migration): add companies contacts wave write`
- `HEAD == origin/main`
- divergencia: `0 0`
- pendencias: trilha esperada 22BO-22BQ + artefatos da reexecucao 22BR.

## 5. Resumo 22BO-22BQ

- 22BO: gate `products` com decisao `PARCIAL`;
- 22BP: saneamento de payload com decisao `GO`;
- 22BQ: escrita piloto real de 1 produto em `products` com decisao `GO`.

## 6. Auditoria do produto piloto

Produto auditado:

- `id=01c62ae4-4204-413d-80b5-1054e0dba08d`
- `tenant_id=00000000-0000-0000-0000-000000000001`
- `sku=TMP-SKU-0001`
- `sku_unique=TMP-SKU-0001-001`
- `name=TMP PRODUCT 01`
- `tipo_id=522d0e75-641f-4161-bd41-94ebd50e8158`
- `grupo_id=c5057853-15be-440d-886f-b0093de363fa`
- `subgrupo_id=8f798403-516e-48cf-b675-e025240385f3`
- `family_id=d1720ddd-f0a1-42eb-9428-51ca8df02c92`
- `class_id=79b5d092-1669-4b39-b590-565b471c1360`
- `versao_numero=1`
- `erp_product_code=null`
- `erp_versao=null`
- `legal_entity_id=null`

Cardinalidades:

- por `id`: 1
- por `sku_unique`: 1
- por `sku`: 1

## 7. Auditoria da chave `sku_unique`

- `products_sku_unique_key` presente;
- `sku_unique='TMP-SKU-0001-001'` com cardinalidade 1;
- sem duplicidade por `sku_unique`;
- sem divergencia por `sku`;
- `TMP-SKU-0001-002` inexistente.

## 8. Validacao de idempotencia read-only

Read-only fechou aderente para idempotencia tecnica (`sku_unique`), com trigger de geracao e uppercase presentes.

## 9. Resultado da reexecucao idempotente

Comando da 22BQ-R2 foi reexecutado exatamente.

Resultado observado:

- `pilot_write_operation=aborted`
- `pilot_write_before_decision=NO-GO`
- `pilot_write_after_decision=NO-GO`
- motivo principal do `before`: `products count before pilot must be zero`

## 10. Delta da reexecucao

- `delta=0`
- `products` permaneceu `1`
- nenhum novo produto criado
- nenhuma mudanca fora de `products`

## 11. Validacao das dependencias auxiliares

Vinculos por join validados com cardinalidade 1:

- `tipo_id -> product_types.id`
- `grupo_id -> product_groups.id`
- `subgrupo_id -> product_subgroups.id`
- `family_id -> product_families.id`
- `class_id -> product_classes.id`

## 12. Escopo negativo

Contagens permaneceram:

- `legal_entities=1`
- `product_types=13`
- `product_groups=22`
- `product_subgroups=54`
- `product_families=7`
- `product_classes=11`
- `companies=5`
- `contacts=5`
- `products=1`
- `sales_reps=0`
- `user_tenants=0`
- `user_legal_entities=0`
- `user_sales_reps=0`
- `deals=0`
- `orders=0`
- `order_items=0`
- `proposals=0`
- `audit_logs=0`
- `notifications=0`

## 13. Evidencia JSON gerada

- `artifacts/migration/phase-22br-r2-products-audit-and-commit/products-audit-20260627-235420.json`
- artefatos de reexecucao:
  - `artifacts/migration/phase-22bq-r2-pilot-products-write/pilot-products-20260627-235011.json`
  - `artifacts/migration/phase-22bq-r2-pilot-products-write/before-20260627-235011.json`
  - `artifacts/migration/phase-22bq-r2-pilot-products-write/after-20260627-235011.json`

## 14. Checagem de sensiveis

Checagem conservadora executada nos arquivos da trilha 22BO-22BR, sem deteccao de tokens/chaves privadas/senhas/URLs com credenciais.

## 15. Arquivos incluidos no commit

Incluidos somente arquivos da trilha 22BO-22BR e evidencias relacionadas.

## 16. Commit criado

Commit local criado na fase 22BR-R2 com mensagem:

- `feat(migration): add products pilot write`

## 17. Push executado ou nao

- push: nao executado.

## 18. Riscos restantes

- a reexecucao do comando nao retornou `idempotent_noop`; foi bloqueada por guard de `products_count_before_zero`, exigindo ajuste controlado em fase posterior.

## 19. Decisao final GO/PARCIAL/NO-GO

**NO-GO**

Motivo:

- criterio de GO da fase exige reexecucao com `idempotent_noop`, mas a reexecucao retornou `aborted`.

## 20. Recomendacao da proxima fase

Abrir fase tecnica dedicada para ajuste de guard de reexecucao idempotente de `products` (sem expansao), reaplicar reexecucao e somente entao avaliar fechamento para GO.

## 21. Confirmacoes obrigatorias

- nova escrita em banco nesta fase: nao, exceto reexecucao idempotente sem criacao
- produto novo criado nesta fase: nao
- SQL de escrita manual executado nesta fase: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- push: nao
- staging/prod alterados: nao
- arquivos sensiveis commitados: nao
- executor alterado nesta fase: nao
- executor executou escrita ampliada: nao
