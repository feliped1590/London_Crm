# Fase 22AJ-R2 — Gate da proxima auxiliar de produto (sem escrita)

## 1. Objetivo

Selecionar tecnicamente a proxima entidade auxiliar de produto para piloto controlado futuro, sem executar escrita.

## 2. Escopo

- pre-check Git;
- leitura obrigatoria de docs/scripts/artifacts da trilha 22AC/22AF/22AG + baseline/write-plan;
- avaliacao read-only das candidatas `product_groups`, `product_subgroups`, `product_families`, `product_classes`;
- validacao de payload, schema, constraints, dependencias, colisao e idempotencia;
- recomendacao tecnica com decisao GO/PARCIAL/NO-GO.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback;
- sem alteracao de schema/staging/prod;
- sem ERP/API/webhook/n8n e sem filas;
- sem alteracao do executor;
- sem commit/push;
- sem alterar `latest.json` e sem alterar `BASELINE_SIMULATION`.

## 4. Estado atual

- branch: `main`;
- `git status --short`: limpo;
- divergencia: `0 0`;
- ultimo commit: `f5639fca feat(migration): add product types pilot baseline write`.

## 5. Escritas piloto ja auditadas

- `legal_entities`: escrita 22T-R2 + auditoria 22U-R2 = **GO**;
- `product_types`: escrita 22AF-R2 + auditoria 22AG-R2 = **GO**;
- registro de `product_types` confirmado:
  - `id=522d0e75-641f-4161-bd41-94ebd50e8158`
  - `value=TMP-PT-001`
  - `label=TMP Product Type`
  - `tenant_id=null`.

## 6. Candidatas avaliadas

- `product_groups`
- `product_subgroups`
- `product_families`
- `product_classes`

## 7. Presenca no input/write plan

Todas as candidatas:

- estao presentes no input `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`;
- estao presentes no write plan `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-181728.json`;
- possuem contagem planejada `1`.

## 8. Payload por candidata

Origem: `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`, secao `BASELINE_SIMULATION`.

- `product_groups`: `TMP-22F-R2-PRODGROUP-01`, `code=TMP-PG-001`, `name=TMP Product Group`
- `product_subgroups`: `TMP-22F-R2-PRODSUBGROUP-01`, `code=TMP-PSG-001`, `name=TMP Product Subgroup`
- `product_families`: `TMP-22F-R2-PRODFAMILY-01`, `code=TMP-PF-001`, `name=TMP Product Family`
- `product_classes`: `TMP-22F-R2-PRODCLASS-01`, `code=TMP-PC-001`, `name=TMP Product Class`

Mapeamento tecnico viavel para todas: `value <- code`, `label <- name`.

## 9. Schema/constraints por candidata

Resumo read-only:

- todas possuem PK por `id` e `UNIQUE(value)`;
- todas possuem `tenant_id` nullable com FK para `tenants(id)`;
- `product_subgroups` e `product_groups` possuem tambem FK `created_by -> auth.users(id)`.

Diferenca relevante:

- `product_groups` inclui `dimension_profile` e `ficha_profile` como NOT NULL, mas ambos possuem default (`'none'::dimension_profile` e `'none'::text`), entao o payload minimo continua completo para insert controlado.

## 10. Dependencias e ordem segura

Ordem de negocio observada no write plan:

1. `product_groups`
2. `product_subgroups`
3. `product_families`
4. `product_classes`

Validacao de dependencia por FK (read-only):

- `product_groups` depende de `product_types` por FK: **nao**;
- `product_subgroups` depende de `product_groups` por FK: **nao**;
- `product_families` depende de tabela anterior por FK: **nao**;
- `product_classes` depende de tabela anterior por FK: **nao**.

Conclusao: as auxiliares podem ser escritas isoladamente do ponto de vista de FK obrigatoria; a ordem acima permanece recomendacao de negocio/consistencia.

## 11. Colisoes verificadas

Candidatos nao existem hoje:

- `product_groups`: `value=TMP-PG-001` e `label=TMP Product Group` -> `0/0`
- `product_subgroups`: `value=TMP-PSG-001` e `label=TMP Product Subgroup` -> `0/0`
- `product_families`: `value=TMP-PF-001` e `label=TMP Product Family` -> `0/0`
- `product_classes`: `value=TMP-PC-001` e `label=TMP Product Class` -> `0/0`

Duplicidades existentes por chave natural:

- max duplicidade por `value`: `0` em todas;
- max duplicidade por `tenant_id + value`: `0` em todas.

## 12. Entidade recomendada

**`product_groups`**

## 13. Justificativa

- atende a preferencia inicial da fase;
- payload linha-a-linha forte e contagem planejada pequena (`1`);
- sem colisao atual para `value`/`label`;
- idempotencia clara por `UNIQUE(value)` com contrato `insert`/`idempotent_noop`/`NO-GO` por divergencia;
- sem dependencia FK obrigatoria de outra auxiliar para inserir;
- campos extras obrigatorios de `product_groups` estao cobertos por defaults.

## 14. Evidencia JSON gerada

- `artifacts/migration/phase-22aj-r2-next-product-aux-gate/next-product-aux-gate-20260627-183053.json`

## 15. Riscos restantes

- manter disciplina de ordem de negocio (grupos antes das demais auxiliares) para evitar drift semantico;
- explicitar no contrato da proxima fase o uso de defaults em `dimension_profile` e `ficha_profile`.

## 16. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- candidata segura escolhida com payload completo e idempotencia plausivel;
- dependencias FK obrigatorias nao bloqueiam piloto isolado;
- sem escrita e sem alteracao do executor.

## 17. Recomendacao da proxima fase

Executar fase de preparacao do piloto `product_groups` (ainda sem escrita), congelando payload oficial, politica de `tenant_id`, contrato before/after e gate humano especifico antes de qualquer execucao real.

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
