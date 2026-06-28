# Fase 22BS-R2 — Correção do guard idempotente de `products`

## 1. Objetivo

Corrigir somente o guard idempotente do piloto `products` no executor da baseline para permitir reexecução segura com `idempotent_noop`, sem criar novo produto.

## 2. Contexto

Na 22BQ-R2, o produto piloto foi criado com sucesso (`sku_unique=TMP-SKU-0001-001`).  
Na 22BR-R2, a reexecução idempotente falhou por guard rígido de contagem.

## 3. Motivo do NO-GO anterior

Guard aplicado no bloco de `products`:

- `products count before pilot must be zero`

Esse guard bloqueia o estado esperado de reexecução idempotente (`products=1`).

## 4. Correção feita no guard

Arquivo alterado: `scripts/migration/phase-22k-r2-baseline-write.mjs`.

Ajustes mínimos aplicados:

- remoção da obrigatoriedade fixa de `products_total=0`;
- inclusão de fluxo A (primeira escrita): permite `inserted` somente com `products_total=0` e sem colisões;
- inclusão de fluxo B (reexecução): exige 1 registro por `sku_unique` e 1 por `sku`, com aderência completa ao payload congelado;
- inclusão de fluxo C (divergência): bloqueia NO-GO quando chave natural existe com campos divergentes;
- inclusão de fluxo D (risco de sequência): bloqueia NO-GO quando há `sku` sem `sku_unique` esperado.

## 5. Auditoria antes

Validação read-only antes da correção:

- `products=1`;
- `sku_unique=TMP-SKU-0001-001` cardinalidade `1`;
- `sku=TMP-SKU-0001` cardinalidade `1`;
- `sku_unique=TMP-SKU-0001-002` cardinalidade `0`.

## 6. Reexecução

Comando reexecutado (mesmo da 22BQ):

- `node scripts/migration/phase-22k-r2-baseline-write.mjs --expected-target nsnmlleplpzsefzkuxlb --batch baseline_22f_r2_restore_test_qualyvac --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" --pilot-authorization "AUTORIZO A DÉCIMA PRIMEIRA ESCRITA PILOTO DA BASELINE 22BP-R2 SOMENTE EM products NO RESTORE-TEST nsnmlleplpzsefzkuxlb" --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-225537.json --pilot-payload artifacts/migration/phase-22bp-r2-products-payload-sanitization/products-sanitized-payload-20260627-232650.json --pilot-entity products --execute-pilot-write --write`

Observação operacional:

- houve uma tentativa inicial com erro transitório `504` de infraestrutura e `pilot_write_before_decision=NO-GO`;
- a segunda execução concluiu normalmente e foi usada como resultado oficial da fase.

## 7. Resultado esperado/obtido

Resultado obrigatório obtido na execução válida:

- `beforeDecision=GO`;
- `operation=idempotent_noop`;
- `afterDecision=GO`;
- hard stop emitido: `ESCRITA PILOTO CONCLUÍDA SOMENTE EM products. EXECUÇÃO AMPLIADA BLOQUEADA.`

## 8. Delta

- `delta products = 0`.

## 9. Produto criado anteriormente

Produto previamente existente e preservado:

- `id=01c62ae4-4204-413d-80b5-1054e0dba08d`;
- `tenant_id=00000000-0000-0000-0000-000000000001`;
- `sku=TMP-SKU-0001`;
- `sku_unique=TMP-SKU-0001-001`;
- `name=TMP PRODUCT 01`;
- `versao_numero=1`.

## 10. Confirmação de nenhum novo produto

Após reexecução:

- `products` permanece `1`;
- operação foi `idempotent_noop`;
- nenhum `INSERT` adicional foi realizado.

## 11. Ausência de `TMP-SKU-0001-002`

Validação read-only pós-reexecução:

- cardinalidade de `sku_unique=TMP-SKU-0001-002` permanece `0`.

## 12. Escopo negativo

Sem alteração fora de `products`; contagens preservadas:

- `legal_entities=1`;
- `product_types=13`;
- `product_groups=22`;
- `product_subgroups=54`;
- `product_families=7`;
- `product_classes=11`;
- `companies=5`;
- `contacts=5`;
- `products=1`;
- `sales_reps=0`;
- `deals=0`;
- `orders=0`;
- `order_items=0`;
- `proposals=0`;
- `audit_logs=0`;
- `notifications=0`.

## 13. Riscos restantes

- instabilidade transitória da infraestrutura (`504`) pode exigir reexecução controlada sem alterar critérios;
- fluxo de expansão de `products` continua bloqueado até gate específico.

## 14. Decisão final

- **GO** para fechamento da 22BS-R2.

## 15. Recomendação da próxima fase

Prosseguir para fase de auditoria/fechamento remoto do bloco com foco em:

- validação final de idempotência já corrigida;
- eventual push controlado somente após autorização explícita.

## 16. Confirmações obrigatórias

- novo produto criado nesta fase: **não**;
- reexecução idempotente: **sim**;
- operação obtida: **`idempotent_noop`**;
- delta em `products`: **0**;
- SQL manual executado: **não**;
- migration: **não**;
- seed/cleanup: **não**;
- rollback: **não**;
- ERP/API externa executada: **não**;
- filas processadas: **não**;
- deploy: **não**;
- push: **não**;
- staging/prod alterados: **não**;
- arquivos sensíveis commitados: **não**;
- executor executou escrita ampliada: **não**.
