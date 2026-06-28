# Fase 22BO-R2 - Fechamento remoto 22BK-22BN + gate products (sem escrita)

## 1. Objetivo

Confirmar o fechamento remoto do marco 22BK-22BN e executar gate tecnico read-only de `products`, sem escrita em banco, sem alteracao de executor e sem commit/push.

## 2. Escopo

- pre-check Git de sincronismo remoto;
- confirmacao de contagens atuais no restore-test;
- leitura de docs/evidencias e scripts da trilha;
- descoberta do payload de `products`;
- levantamento de schema, constraints, FKs, indices, triggers e RLS de `products`;
- validacao de dependencias com auxiliares de produto;
- avaliacao de chave de idempotencia;
- verificacao de colisoes;
- decisao de piloto/micro-onda;
- geracao de payload congelado de gate e documentacao da fase.

## 3. Restricoes absolutas

- sem escrita em banco;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback;
- sem ERP/API/webhook/n8n/filas;
- sem deploy;
- sem alteracao de `scripts/migration/phase-22k-r2-baseline-write.mjs`;
- sem commit;
- sem push.

## 4. Fechamento remoto do marco 22BK-22BN

Pre-checks confirmados:

- branch: `main`;
- `git status --short`: limpo;
- divergencia: `0 0`;
- ultimo commit: `a52bab83 feat(migration): add companies contacts wave write`;
- `HEAD == origin/main`;
- remoto `origin`: `https://github.com/feliped1590/Qualyvac_Migration.git`.

Conclusao: fechamento remoto do marco 22BK-22BN confirmado.

## 5. Estado atual do restore-test

Contagens read-only:

- `legal_entities=1`
- `product_types=13`
- `product_groups=22`
- `product_subgroups=54`
- `product_families=7`
- `product_classes=11`
- `companies=5`
- `contacts=5`
- `products=0`
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

## 6. Motivo de avancar para `products`

Com auxiliares de produto e frente cadastral base ja estabilizados, `products` e a proxima entidade funcional natural para gate de escrita controlada.

## 7. Payload encontrado de `products`

Fontes analisadas:

- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-205752.json`
- write plan mais recente aplicavel:
  - `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-225537.json`
- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`

Resultado:

- `latest.json` e write plans trazem **contagem planejada** (`products=5`), mas nao carregam os registros detalhados;
- payload bruto detalhado localizado em `BASELINE_SIMULATION.products` no script 22G;
- candidatos encontrados (5):
  - `TMP-22F-R2-PRODUCT-01` (`TMP-SKU-0001`, `TMP Product 01`)
  - `TMP-22F-R2-PRODUCT-02` (`TMP-SKU-0002`, `TMP Product 02`)
  - `TMP-22F-R2-PRODUCT-03` (`TMP-SKU-0003`, `TMP Product 03`)
  - `TMP-22F-R2-PRODUCT-04` (`TMP-SKU-0004`, `TMP Product 04`)
  - `TMP-22F-R2-PRODUCT-05` (`TMP-SKU-0005`, `TMP Product 05`)
- campos disponiveis no payload encontrado: `temp_key`, `sku`, `name`;
- campos de dependencia (tipo/grupo/subgrupo/familia/classe) **nao presentes** no payload;
- campos comerciais/tecnicos (`unit`, `status`, `price`, dimensoes, `ncm`) **nao presentes** no payload.

## 8. Schema/constraints de `products`

Levantamento read-only confirmou:

- tabela existe com `products_total=0`;
- RLS habilitado;
- colunas obrigatorias sem default: `sku`, `name`;
- colunas obrigatorias com default relevantes: `id`, `created_at`, `updated_at`, `tenant_id`, `ficha_tecnica`, `versao_numero`;
- chaves/FKs relevantes presentes:
  - `tipo_id -> product_types.id`
  - `grupo_id -> product_groups.id`
  - `subgrupo_id -> product_subgroups.id`
  - `family_id -> product_families.id`
  - `class_id -> product_classes.id`
  - `legal_entity_id -> legal_entities.id`
  - `tenant_id -> tenants.id`
- unique/indices relevantes:
  - `products_sku_unique_key` (unique em `sku_unique`)
  - `products_tenant_erp_code_unique` (unique parcial em `tenant_id, erp_product_code, versao_numero`)
  - `idx_products_technical_uniqueness` (unique tecnico parcial)
  - `products_parent_versao_unique`
- triggers relevantes:
  - uppercase (`trg_uppercase_products`)
  - geracao de `sku_unique`
  - auto versao ERP
  - hash estrutural
  - triggers de sync.

## 9. Dependencias com auxiliares de produto

Lookups read-only por `value` (TMP) confirmados com cardinalidade `1`:

- `product_types.value = TMP-PT-001`
- `product_groups.value = TMP-PG-001`
- `product_subgroups.value = TMP-PSG-001`
- `product_families.value = TMP-PF-001`
- `product_classes.value = TMP-PC-001`

Ponto critico:

- embora os auxiliares existam, o payload atual de `products` nao traz os campos de vinculo necessarios (`tipo_id/grupo_id/subgrupo_id/family_id/class_id` ou equivalentes por `value`), logo a dependencia fica sem resolucao deterministica no payload.

## 10. Chave de idempotencia candidata

Avaliacao por ordem de preferencia:

1. `(tenant_id, erp_code, erp_versao)`:
   - nao fechado; schema usa `erp_product_code + versao_numero`, e o payload nao traz esses campos.
2. `(tenant_id, item, version)`:
   - nao fechado; `item/version` nao estao no payload e nao existem como contrato direto no schema.
3. `(tenant_id, sku)`:
   - payload suporta `sku`, mas nao ha unique real por `(tenant_id, sku)`.
4. `(tenant_id, code)`:
   - nao aplicavel; sem `code` no payload/schema como chave confiavel.

Conclusao: idempotencia **nao fechada** para liberar escrita segura nesta fase.

## 11. Colisoes verificadas

Read-only:

- por `sku` (`TMP-SKU-0001..0005`): `0` colisoes;
- por `name` (`TMP Product 01..05` e uppercase): `0` colisoes;
- registros `TMP` em `products`: `0`.

Sem divergencia detectada no estado atual (tabela vazia), mas ainda sem chave deterministica forte.

## 12. Produto piloto ou onda selecionada

Decisao de selecao:

- estrategia preferida: piloto unitario;
- selecao final desta fase: **bloqueada para escrita**;
- pre-candidato tecnico (nao autorizado para write ainda): `TMP-22F-R2-PRODUCT-01`.

## 13. Payload congelado

Gerado payload de gate em estado `blocked_partial`, com:

- lista de candidatos identificados;
- pre-candidato tecnico para piloto;
- lacunas obrigatorias para destravar escrita:
  - chave de idempotencia deterministica no payload;
  - mapeamento deterministico de dependencias de auxiliares;
  - contrato canonico de chave para execucao idempotente.

## 14. Gate humano especifico

Nao aplicavel nesta fase (sem piloto viavel para escrita).

Autorizacao futura so deve ser publicada quando houver chave de idempotencia fechada + payload saneado de `products`.

## 15. Riscos restantes

- payload atual de `products` e minimalista e insuficiente para idempotencia forte;
- dependencias de auxiliares nao estao explicitadas no payload encontrado;
- triggers de `products` exigem validacao before/after robusta (uppercase, sku_unique, versao/sync).

## 16. Decisao final GO/PARCIAL/NO-GO

**PARCIAL**

Motivo:

- gate remoto e schema foram validados com sucesso;
- payload de `products` existe (simulacao), mas requer saneamento para chave idempotente e dependencias antes de qualquer escrita.

## 17. Recomendacao da proxima fase

Abrir fase de saneamento do payload de `products` (sem escrita), fechando:

- chave de idempotencia canonica;
- mapeamento de dependencias para FKs;
- definicao de 1 piloto unitario congelado com contrato completo.

## 18. Confirmacoes obrigatorias

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
