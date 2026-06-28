# Fase 22BP-R2 - Saneamento de payload `products` para piloto unitario (sem escrita)

## 1. Objetivo

Sanear e congelar payload tecnico para 1 produto piloto (`TMP-22F-R2-PRODUCT-01`) com idempotencia e dependencias resolvidas em modo read-only, sem executar escrita.

## 2. Escopo

- pre-check Git e validacao de pendencias da 22BO;
- releitura das evidencias/scripts obrigatorios;
- extracao do piloto de `BASELINE_SIMULATION.products`;
- validacao detalhada de schema/constraints/triggers/FKs de `products`;
- validacao de `sku_unique` e previsibilidade;
- resolucao de dependencias auxiliares por cardinalidade `1`;
- politica de `tenant_id` e `legal_entity_id`;
- definicao de payload saneado congelado;
- validacao de colisoes;
- definicao do gate humano da proxima fase.

## 3. Restricoes absolutas

- sem escrita em banco;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback;
- sem ERP/API/webhook/n8n/filas;
- sem deploy;
- sem commit/push;
- sem alteracao do executor.

## 4. Estado atual

Pre-check validado:

- branch: `main`;
- ultimo commit: `a52bab83 feat(migration): add companies contacts wave write`;
- `HEAD == origin/main`;
- divergencia: `0 0`;
- pendencias no inicio: somente 22BO:
  - `artifacts/migration/phase-22bo-r2-products-gate/products-gate-20260627-232001.json`
  - `docs/migration/phase-22bo-r2-products-gate.md`

## 5. Achados da 22BO

- decisao anterior: `PARCIAL`;
- `products_total=0`;
- payload detalhado de `products` localizado em `scripts/migration/phase-22g-r2-baseline-dry-run.mjs` (`BASELINE_SIMULATION.products`);
- bloqueios anteriores: idempotencia nao fechada e dependencias nao amarradas no payload.

## 6. Produto piloto extraido

Origem:

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`

Registro piloto:

- `temp_key=TMP-22F-R2-PRODUCT-01`
- `sku=TMP-SKU-0001`
- `name=TMP Product 01`

Campos adicionais no mesmo registro: nenhum.

## 7. Schema detalhado de `products`

Confirmacoes principais:

- obrigatorios sem default: `sku`, `name`;
- `tenant_id`: `NOT NULL` com default `'00000000-0000-0000-0000-000000000001'::uuid`;
- FKs tecnicas existem e sao opcionais (`nullable`):
  - `tipo_id -> product_types.id`
  - `grupo_id -> product_groups.id`
  - `subgrupo_id -> product_subgroups.id`
  - `family_id -> product_families.id`
  - `class_id -> product_classes.id`
  - `legal_entity_id -> legal_entities.id`
- `sku_unique` existe e e `nullable`;
- unique relevante:
  - `products_sku_unique_key` em `sku_unique`;
- ERP/version:
  - `erp_product_code` nullable;
  - `erp_versao` nullable;
  - `versao_numero` `NOT NULL` com default `1`.

## 8. Trigger e `sku_unique`

Trigger:

- `trg_generate_sku_unique` chama `generate_sku_unique()` antes de `INSERT/UPDATE`.

Comportamento da funcao:

- regenera `sku_unique` em insert, em `sku_unique` nulo, ou mudanca de `sku`;
- calcula sequencia por `MAX` das linhas existentes com mesmo `sku` (`+1`);
- formula: `sku_unique = sku || '-' || lpad(seq, 3, '0')`;
- nao usa `tenant_id`;
- nao usa `name`;
- nao normaliza caixa em `sku`.

Uppercase:

- trigger `trg_uppercase_products` aplica uppercase em `name`, `nome_impresso`, `description`.
- `sku` nao entra no uppercase.

Previsao para piloto:

- `sku=TMP-SKU-0001` com `same_sku_rows=0` -> `expected_sku_unique=TMP-SKU-0001-001`.

## 9. Dependencias auxiliares resolvidas

Lookups read-only por `value` com cardinalidade `1`:

- `TMP-PT-001` -> `tipo_id=522d0e75-641f-4161-bd41-94ebd50e8158`
- `TMP-PG-001` -> `grupo_id=c5057853-15be-440d-886f-b0093de363fa`
- `TMP-PSG-001` -> `subgrupo_id=8f798403-516e-48cf-b675-e025240385f3`
- `TMP-PF-001` -> `family_id=d1720ddd-f0a1-42eb-9428-51ca8df02c92`
- `TMP-PC-001` -> `class_id=79b5d092-1669-4b39-b590-565b471c1360`

Todas as FKs correspondentes existem no schema e as colunas sao opcionais.

## 10. Politica de tenant

- `tenant_id=00000000-0000-0000-0000-000000000001` existe;
- apesar de haver default fixo, foi adotado `tenant_id` explicito no payload saneado para manter determinismo.

## 11. Politica de legal_entity

- `legal_entities=1` (id: `973a686d-e87f-4114-9d1d-455ed80a92de`);
- `products.legal_entity_id` e opcional;
- politica definida: `omit_or_null_unless_required`.

## 12. Payload saneado do produto piloto

Payload congelado:

- `source=baseline_simulation_22g_r2_sanitized`
- `temp_key=TMP-22F-R2-PRODUCT-01`
- `tenant_id=00000000-0000-0000-0000-000000000001`
- `sku=TMP-SKU-0001`
- `expected_sku_unique=TMP-SKU-0001-001`
- `name=TMP Product 01`
- `expected_persisted_name=TMP PRODUCT 01`
- auxiliares amarradas:
  - `tipo_id=522d0e75-641f-4161-bd41-94ebd50e8158`
  - `grupo_id=c5057853-15be-440d-886f-b0093de363fa`
  - `subgrupo_id=8f798403-516e-48cf-b675-e025240385f3`
  - `family_id=d1720ddd-f0a1-42eb-9428-51ca8df02c92`
  - `class_id=79b5d092-1669-4b39-b590-565b471c1360`
- politicas:
  - `legal_entity_id_policy=omit_or_null_unless_required`
  - `erp_product_code_policy=omit_or_null`
  - `erp_versao_policy=omit_or_null`
  - `versao_numero_policy=default_or_omit`
  - `write_policy=single_product_pilot_only`

## 13. Chave de idempotencia

Chave adotada para piloto:

- `sku_unique` (derivada deterministicamente de `sku` no estado atual).

Regra operacional:

- antes de inserir, fazer lookup por `expected_sku_unique`;
- se existir aderente -> `idempotent_noop`;
- se nao existir -> candidato a insert;
- se existir divergente -> `NO-GO`.

## 14. Colisoes verificadas

Read-only:

- `products_total=0`;
- `same_sku_rows` (`TMP-SKU-0001`) = `0`;
- `same_expected_sku_unique_rows` (`TMP-SKU-0001-001`) = `0`;
- `name` (`TMP Product 01` / `TMP PRODUCT 01`) = `0`.

Sem colisao divergente detectada.

## 15. Gate humano especifico

Autorizacao futura documentada:

`AUTORIZO A DÉCIMA PRIMEIRA ESCRITA PILOTO DA BASELINE 22BP-R2 SOMENTE EM products NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

## 16. Riscos restantes

- sequencia de `sku_unique` depende de contagem por `sku`; lookup pre-write obrigatorio continua necessario;
- triggers de `products` podem alterar campos textuais e metadados ERP/sync, exigindo validacao before/after estrita;
- futuras alteracoes de formato de SKU exigem nova validacao de previsibilidade.

## 17. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivo:

- piloto possui `sku` e `name`;
- campos obrigatorios atendidos;
- `sku_unique` previsivel no estado atual;
- chave de idempotencia definida;
- dependencias resolvidas com cardinalidade `1`;
- colisoes zero;
- payload saneado congelado gerado;
- nenhuma escrita executada.

## 18. Recomendacao da proxima fase

Abrir fase de preparacao do piloto real de `products` com before/after obrigatorio, validação idempotente por `expected_sku_unique` e hard stop final.

## 19. Confirmacoes obrigatorias

- nova escrita em banco: nao
- SQL de escrita executado: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- commit: nao
- push: nao
- executor alterado: nao
- staging/prod alterados: nao
- executor executou escrita ampliada: nao
