# Fase 22AX-R2 - Gate do piloto `product_families` (sem escrita)

## 1. Objetivo

Avaliar tecnicamente `product_families` como proxima entidade piloto, sem executar escrita, confirmando payload rastreavel, schema real, constraints, dependencias, colisao e viabilidade de idempotencia.

## 2. Escopo

- pre-check Git;
- leitura obrigatoria de docs/scripts/artifacts da trilha recente (22AQ-22AU + baseline/write-plan);
- validacoes SQL read-only de schema, constraints, FKs e colisao para `product_families`;
- decisao tecnica GO/PARCIAL/NO-GO;
- geracao de evidencia JSON e documentacao da fase.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback;
- sem alteracao de schema/staging/prod;
- sem ERP/API/webhook/n8n e sem filas;
- sem alterar executor;
- sem commit/push;
- sem inventar payload ou alterar artifacts de origem.

## 4. Estado atual

Pre-check Git:

- branch: `main`;
- `git status --short`: limpo;
- divergencia `origin/main...main`: `0 0`;
- ultimo commit: `7f213984 feat(migration): add product subgroups pilot baseline write`.

## 5. Escritas piloto ja auditadas

- `legal_entities`: escrita 22T-R2 + auditoria 22U-R2 = **GO**;
- `product_types`: escrita 22AF-R2 + auditoria 22AG-R2 = **GO**;
- `product_groups`: escrita 22AM-R2 + auditoria 22AN-R2 = **GO**;
- `product_subgroups`: escrita 22AT-R2 + auditoria 22AU-R2 = **GO**.

## 6. Payload encontrado de `product_families`

Origem rastreavel:

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`
- secao `BASELINE_SIMULATION.product_families[0]`

Registro encontrado:

- `temp_key=TMP-22F-R2-PRODFAMILY-01`
- `code=TMP-PF-001`
- `name=TMP Product Family`

Mapeamento:

- `value <- code` => `TMP-PF-001`
- `label <- name` => `TMP Product Family`

Campos de dependencia no payload:

- nao ha `product_group_id`, `product_subgroup_id`, `group_value`, `subgroup_value`, `parent_id`, `tenant_id` ou `created_by`.

## 7. Schema/constraints

Tabela avaliada: `public.product_families`

Colunas relevantes:

- obrigatorias sem default: `value`, `label`;
- obrigatorias com default: `id`, `sort_order`, `is_active`, `created_at`;
- opcionais: `tenant_id` (nullable).

Constraints:

- PK: `PRIMARY KEY (id)`;
- unique: `UNIQUE(value)`;
- FK: `tenant_id -> tenants(id)`.

Indices:

- `product_families_pkey`;
- `product_families_value_key`.

Total atual:

- `product_families=6`.

## 8. Dependencias e FKs

Validacao read-only:

- coluna `product_group_id`: ausente;
- coluna `product_subgroup_id`: ausente;
- coluna `group_value`: ausente;
- coluna `subgroup_value`: ausente;
- coluna `parent_id`: ausente;
- FK para `product_groups`: `0`;
- FK para `product_subgroups`: `0`.

Conclusao:

- nao ha dependencia tecnica obrigatoria de `product_groups`/`product_subgroups` para escrita de `product_families` no schema atual.

Cardinalidade dos pilotos anteriores (apenas referencia):

- `product_groups.value='TMP-PG-001'` => `1`;
- `product_subgroups.value='TMP-PSG-001'` => `1`.

## 9. Politica preliminar de `tenant_id`

- `tenant_id` existe e e nullable;
- politica preliminar proposta: `tenant_id = null` (escopo global/null), alinhado com pilotos auxiliares anteriores.

## 10. Politica preliminar de `created_by`

- coluna `created_by` nao existe em `public.product_families`;
- politica: `not_applicable` para esta entidade.

## 11. Colisoes verificadas

Read-only:

- `COUNT(value='TMP-PF-001') = 0`;
- `COUNT(label='TMP Product Family') = 0`;
- max duplicidade por `value` = `1` (sem duplicidade real);
- max duplicidade por `tenant_id + value` = `1` (sem duplicidade real).

Conclusao:

- sem colisao atual para candidato do piloto.

## 12. Idempotencia proposta

Chave natural proposta: `value` (ancorada em `UNIQUE(value)`).

Contrato tecnico:

- se `value` nao existir: `insert` em fase futura controlada;
- se existir e aderir ao payload/defaults: `idempotent_noop`;
- se existir com divergencia: `NO-GO`;
- sem overwrite/delete/cleanup automatico.

## 13. Riscos restantes

- semantica de negocio pode futuramente exigir hierarquia explicita com grupo/subgrupo, ausente no schema atual;
- fase futura ainda precisa congelar payload oficial de `product_families` em artifact dedicado e gate humano especifico.

## 14. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- payload forte e rastreavel existe;
- schema permite escrita isolada futura com obrigatorios claros;
- sem FK obrigatoria para `product_groups`/`product_subgroups`;
- `UNIQUE(value)` presente;
- sem colisao para `TMP-PF-001`;
- nenhuma escrita executada e executor nao foi alterado.

## 15. Recomendacao da proxima fase

Executar fase de preparacao do piloto `product_families` (sem escrita), com payload congelado dedicado, politicas explicitas (`tenant_id`, defaults), contrato before/after e frase de autorizacao humana especifica.

## 16. Confirmacoes obrigatorias

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
