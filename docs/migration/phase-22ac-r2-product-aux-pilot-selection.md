# Fase 22AC-R2 — Selecao de piloto auxiliar de produto apos NO-GO de `sales_reps` (sem escrita)

## 1. Objetivo

Selecionar tecnicamente uma nova segunda entidade piloto, priorizando auxiliares de produto, apos bloqueio de `sales_reps`, sem executar escrita.

## 2. Escopo

- pre-check Git;
- leitura das evidencias/docus obrigatorias 22Y-22AB;
- avaliacao das candidatas `product_types`, `product_groups`, `product_subgroups`, `product_families`, `product_classes`;
- validacao read-only de presenca em input/write plan, schema, constraints, dependencias e risco de colisao;
- recomendacao da entidade piloto auxiliar.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem SQL de escrita, RPC de escrita, migration, seed, cleanup ou rollback;
- sem alteracao de schema/staging/prod;
- sem ERP/API/webhook/n8n e sem filas;
- sem alteracao do executor;
- sem commit e sem push.

## 4. Estado atual

Pre-check Git:

- branch: `main`;
- commit: `61f3677f feat(migration): add controlled baseline write pilot`;
- divergencia: `0 0`;
- pendencias encontradas: somente trilha esperada 22Y-22AB (docs e artifacts locais nao versionados).

## 5. Motivo para pausar `sales_reps`

Mantido o bloqueio de `sales_reps` por:

- ausencia de origem forte de payload linha-a-linha;
- incompatibilidade entre codigos textuais encontrados e `erp_vendor_code` (`integer`);
- ausencia de `UNIQUE (tenant_id, erp_vendor_code)`;
- idempotencia nao auditavel por registro.

## 6. Candidatas auxiliares avaliadas

- `product_types`
- `product_groups`
- `product_subgroups`
- `product_families`
- `product_classes`

## 7. Presenca no input/write plan

Todas as candidatas:

- estao presentes em `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`;
- estao presentes em `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-224906.json`;
- possuem contagem planejada `1`.

## 8. Schema/constraints de cada candidata

Resumo comum:

- todas possuem PK por `id`;
- todas possuem `UNIQUE (value)`;
- todas possuem `tenant_id` (nullable);
- todas possuem FK de `tenant_id -> tenants(id)`.

Diferencas relevantes:

- `product_types`: conjunto simples (`value`, `label`) e baixo acoplamento;
- `product_groups`: possui `dimension_profile` e `ficha_profile` obrigatorios, aumentando complexidade do payload;
- `product_subgroups`: estrutura simples (`value`, `label`);
- `product_families`: estrutura simples com defaults claros;
- `product_classes`: estrutura simples com defaults claros.

## 9. Dependencias

Ordem planejada no write plan:

- `product_types` -> `product_groups` -> `product_subgroups` -> `product_families` -> `product_classes`.

Para piloto isolado:

- `product_types` apresenta menor dependencia previa;
- `product_groups` tem maior complexidade por campos adicionais;
- demais auxiliares sao viaveis, mas vem depois na ordem de negocio.

## 10. Riscos por entidade

- `product_types`: risco baixo; chave unica por `value`, payload simples, sem dependencia de usuario/permissao.
- `product_groups`: risco medio; payload atual de simulacao nao cobre todos os campos obrigatorios reais.
- `product_subgroups`: risco baixo; candidato viavel, mas posterior a `product_groups`.
- `product_families`: risco baixo; candidato viavel, mas posterior na trilha.
- `product_classes`: risco baixo; candidato viavel, mas posterior na trilha.

## 11. Entidade recomendada

**`product_types`**

## 12. Justificativa da escolha

- menor superficie de dependencia entre auxiliares;
- contagem minima (`1`);
- payload linha-a-linha disponivel na fonte de simulacao da baseline;
- chave deterministica com `UNIQUE (value)`;
- ausencia de colisao atual para valor/label candidato no restore-test.

## 13. Evidencia JSON gerada

- `artifacts/migration/phase-22ac-r2-product-aux-pilot-selection/product-aux-pilot-selection-20260627-173529.json`

## 14. Riscos restantes

- payload atual vem de fonte de simulacao e deve ser congelado em artifact proprio de execucao;
- `tenant_id` aparece como nullable e nao esta explicito no registro de simulacao, exigindo politica clara de escopo no pre-execucao.

## 15. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- foi selecionada auxiliar mais segura para segunda piloto;
- existe payload linha-a-linha suficiente para selecao tecnica;
- schema e constraints oferecem caminho de idempotencia mais deterministico que `sales_reps`;
- nenhuma escrita ocorreu e o executor nao foi alterado.

## 16. Recomendacao da proxima fase

Executar fase de preparacao de execucao para `product_types` (ainda sem escrita), congelando payload final e contrato before/after com hard stop explicito antes de qualquer mutacao.

## 17. Confirmacoes obrigatorias

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
