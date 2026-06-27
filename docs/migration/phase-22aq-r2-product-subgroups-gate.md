# Fase 22AQ-R2 - Gate do piloto `product_subgroups` (sem escrita)

## 1. Objetivo

Avaliar tecnicamente `product_subgroups` como proxima entidade piloto, sem executar escrita, confirmando payload rastreavel, viabilidade de idempotencia, dependencia e risco de colisao.

## 2. Escopo

- pre-check Git;
- leitura obrigatoria de docs/scripts/artifacts da trilha 22AJ-22AN + baseline/write-plan;
- validacoes SQL read-only de schema, constraints, FKs e colisao para `product_subgroups`;
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
- divergencia: `0 0`;
- ultimo commit: `2a8268e3 feat(migration): add product groups pilot baseline write`.

## 5. Escritas piloto ja auditadas

- `legal_entities`: escrita 22T-R2 + auditoria 22U-R2 = **GO**;
- `product_types`: escrita 22AF-R2 + auditoria 22AG-R2 = **GO**;
- `product_groups`: escrita 22AM-R2 + auditoria 22AN-R2 = **GO**.

## 6. Payload encontrado de `product_subgroups`

Origem rastreavel:

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`
- secao `BASELINE_SIMULATION.product_subgroups[0]`

Registro encontrado:

- `temp_key=TMP-22F-R2-PRODSUBGROUP-01`
- `code=TMP-PSG-001`
- `name=TMP Product Subgroup`

Mapeamento:

- `value <- code` => `TMP-PSG-001`
- `label <- name` => `TMP Product Subgroup`

Campos de dependencia no payload:

- nao ha `product_group_id`, `group_value`, `parent_id`, `tenant_id` ou `created_by` explicitos.

## 7. Schema/constraints

Tabela avaliada: `public.product_subgroups`

Colunas relevantes:

- obrigatorias sem default: `value`, `label`;
- com default: `id` (`gen_random_uuid()`);
- opcionais: `tenant_id`, `created_by`, `sort_order`, `is_active`, `created_at`.

Constraints/FKs:

- PK: `PRIMARY KEY (id)`;
- unique: `UNIQUE(value)`;
- FKs:
  - `created_by -> auth.users(id)`
  - `tenant_id -> tenants(id)`

Indices:

- `product_colors_pkey`
- `product_colors_value_key`

Observacao:

- nomes de constraints/indices usam prefixo `product_colors`, mas estao ligados a `public.product_subgroups`.

## 8. Dependencias e FKs

Validacao read-only:

- nao existe coluna `product_group_id` em `product_subgroups`;
- nao existe FK de `product_subgroups` para `product_groups`;
- nao existe dependencia obrigatoria de grupo no schema atual.

Relacao com piloto de grupo:

- `product_groups.value='TMP-PG-001'` tem cardinalidade `1` e resolve para `id=c5057853-15be-440d-886f-b0093de363fa`;
- essa regra de lookup pode ser documentada para futuro caso o modelo evolua com FK explicita.

## 9. Politica preliminar de `tenant_id`

- `tenant_id` existe e e nullable;
- politica preliminar proposta: `tenant_id = null` (escopo global/null), alinhado com `product_types` e `product_groups`.

## 10. Politica preliminar de `created_by`

- `created_by` existe e e nullable;
- politica preliminar proposta: `null/omit`;
- nao usar usuario real e nao consultar `profiles`.

## 11. Colisoes verificadas

Read-only:

- total atual `product_subgroups`: `53`;
- `COUNT(value='TMP-PSG-001') = 0`;
- `COUNT(label='TMP Product Subgroup') = 0`;
- max duplicidade por `value` = `0`;
- max duplicidade por `tenant_id + value` = `0`.

## 12. Idempotencia proposta

Chave natural proposta: `value` (ancorada em `UNIQUE(value)`).

Contrato tecnico:

- se `value` nao existir: `insert`;
- se existir e for igual ao payload esperado: `idempotent_noop`;
- se existir com divergencia: `NO-GO`.

## 13. Riscos restantes

- semantica de vinculacao com `product_groups` nao esta representada explicitamente no schema/payload atual; precisa confirmacao de negocio na proxima fase;
- nomes legados de constraints/indices (`product_colors_*`) podem causar ambiguidade de auditoria e devem ser documentados no preparo do piloto.

## 14. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- payload forte e rastreavel existe;
- schema permite escrita isolada futura (campos obrigatorios claros, sem FK obrigatoria para grupo);
- sem colisao para candidato `TMP-PSG-001`;
- idempotencia por `value` e plausivel;
- nenhuma escrita executada e executor nao foi alterado.

## 15. Recomendacao da proxima fase

Executar fase de preparacao do piloto `product_subgroups` (ainda sem escrita), congelando payload oficial, politicas de `tenant_id`/`created_by`, contrato before/after e gate humano especifico antes de qualquer execucao real.

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
