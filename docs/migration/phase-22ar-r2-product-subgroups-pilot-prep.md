# Fase 22AR-R2 - Preparar piloto `product_subgroups` com payload congelado (sem escrita)

## 1. Objetivo

Preparar tecnicamente o futuro piloto de `product_subgroups`, sem executar mutacao, congelando payload oficial, politicas operacionais e contrato before/after.

## 2. Escopo

- pre-check Git;
- leitura obrigatoria de docs/scripts/artifacts das fases 22AQ/22AN/22AM e base 22G/22O;
- extracao e congelamento do payload de `product_subgroups`;
- validacao read-only de schema, defaults, constraints, indices e colisao;
- definicao de politicas de `tenant_id`, `created_by` e idempotencia;
- documentacao do risco semantico de ausencia de vinculo com `product_groups`.

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

- branch: `main`;
- ultimo commit: `2a8268e3 feat(migration): add product groups pilot baseline write`;
- divergencia: `0 0`;
- `git status --short`: pendencias esperadas da 22AQ-R2 apenas:
  - `docs/migration/phase-22aq-r2-product-subgroups-gate.md`
  - `artifacts/migration/phase-22aq-r2-product-subgroups-gate/`.

## 5. Motivo da escolha de `product_subgroups`

- candidata natural apos fechamento GO de `product_groups`;
- payload linha-a-linha forte presente na simulacao baseline;
- `UNIQUE(value)` presente e sem colisao para candidato `TMP-PSG-001`;
- escrita isolada tecnicamente possivel no schema atual.

## 6. Payload final congelado

Registro congelado:

- `source`: `baseline_simulation_22g_r2`
- `temp_key`: `TMP-22F-R2-PRODSUBGROUP-01`
- `value`: `TMP-PSG-001`
- `label`: `TMP Product Subgroup`
- `tenant_id`: `null`
- `created_by`: `null`

## 7. Origem do payload

Origem primaria:

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`
- secao: `BASELINE_SIMULATION.product_subgroups[0]`

Mapeamento direto:

- `value <- code` (sem transformacao)
- `label <- name` (sem transformacao)

## 8. Politica de `tenant_id`

Definicao: **escopo global/null**.

Decisao:

- usar `tenant_id = null`.

Justificativa:

- payload origem nao traz tenant;
- `tenant_id` e nullable;
- `UNIQUE(value)` e global;
- sem colisao atual do candidato;
- alinhado com `product_types` e `product_groups`.

## 9. Politica de `created_by`

Definicao: **nao preencher** (`created_by = null/omit`).

Justificativa:

- coluna e nullable;
- nao ha fonte segura de usuario no payload;
- proibido vincular auth/perfil real nesta fase.

## 10. Politica dos defaults

Validado no schema real:

- `sort_order`: default `0`;
- `is_active`: default `true`;
- `created_at`: default `now()`.

Politica:

- omitir os tres campos no futuro payload de escrita;
- aceitar preenchimento automatico do banco;
- nao preencher manualmente nesta fase.

## 11. Ausencia de vinculo tecnico com `product_groups`

Validacao read-only:

- `product_subgroups` nao possui coluna `product_group_id`;
- nao existe FK de `product_subgroups` para `product_groups`;
- payload nao traz `group_value` ou `parent_id`.

Conclusao:

- nao e possivel nem desejavel inferir/criar vinculo tecnico nesta fase.

## 12. Risco semantico documentado

- apesar da ausencia de vinculo tecnico no schema atual, pode haver expectativa de negocio de relacao grupo/subgrupo;
- risco foi registrado e nao bloqueia a preparacao;
- nenhuma inferencia de vinculo sera feita sem regra/coluna explicita.

## 13. Schema/constraints

Resumo read-only de `public.product_subgroups`:

- PK: `PRIMARY KEY (id)`;
- unique: `UNIQUE(value)`;
- FKs:
  - `created_by -> auth.users(id)`
  - `tenant_id -> tenants(id)`;
- colunas obrigatorias sem default: `value`, `label`;
- colunas opcionais relevantes: `tenant_id`, `created_by`, `sort_order`, `is_active`, `created_at`;
- indices:
  - `product_colors_pkey`
  - `product_colors_value_key`.

## 14. Regra de idempotencia

Politica futura definida:

- chave principal: `value`;
- se `value` nao existir: futura fase pode inserir;
- se `value` existir e bater com payload/defaults esperados: `idempotent_noop`;
- se divergir em `label`, `tenant_id`, `created_by`, `sort_order` ou `is_active`: abortar com **NO-GO**;
- proibido overwrite automatico, delete e cleanup.

## 15. Validacao de colisao

Read-only no estado atual:

- total atual `product_subgroups`: `53`;
- `value='TMP-PSG-001'`: `0`;
- `label='TMP Product Subgroup'`: `0`;
- max duplicidade por `value`: `0`;
- max duplicidade por `tenant_id + value`: `0`.

## 16. Gate humano especifico

Frase obrigatoria para fase futura:

`AUTORIZO A QUINTA ESCRITA PILOTO DA BASELINE 22AR-R2 SOMENTE EM product_subgroups NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

Somente documentada nesta fase; nenhuma escrita executada.

## 17. Comando futuro proposto

Comando proposto (nao executar nesta fase):

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --pilot-authorization "AUTORIZO A QUINTA ESCRITA PILOTO DA BASELINE 22AR-R2 SOMENTE EM product_subgroups NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-183924.json \
  --pilot-payload artifacts/migration/phase-22ar-r2-product-subgroups-pilot-prep/product-subgroups-payload-20260627-190705.json \
  --pilot-entity product_subgroups \
  --execute-pilot-write \
  --write
```

Observacao:

- nao executar nesta fase;
- proxima fase deve preparar o executor com hard stop especifico para `product_subgroups`.

## 18. Contrato before/after

Before futuro deve conter:

- target, project, batch;
- autorizacoes geral e piloto;
- entidade piloto `product_subgroups`;
- payload congelado;
- contagem antes;
- lookup por `value` e `label`;
- politicas `tenant_id`, `created_by` e defaults;
- confirmacao de ausencia de FK para `product_groups`;
- confirmacao de escopo negativo e de ausencia de transacionais/filas/ERP.

After futuro deve conter:

- contagem depois e delta;
- registro criado/encontrado;
- `value`, `label`, `tenant_id`, `created_by`, `sort_order`, `is_active`, `created_at`;
- operacao (`inserted`/`idempotent_noop`/`aborted`);
- erros (se houver);
- confirmacao de escopo unico e bloqueio de execucao ampliada.

## 19. Evidencia JSON gerada

- `artifacts/migration/phase-22ar-r2-product-subgroups-pilot-prep/product-subgroups-payload-20260627-190705.json`

## 20. Riscos restantes

- risco semantico de relacao grupo/subgrupo nao explicitada no schema atual;
- nomenclatura legada de constraints/indices (`product_colors_*`) pode causar ambiguidade de auditoria;
- necessidade de hard stop dedicado no executor antes de qualquer escrita real de `product_subgroups`.

## 21. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- payload final congelado com origem rastreavel;
- politicas de `tenant_id`, `created_by` e defaults ficaram explicitas e conservadoras;
- ausencia de vinculo tecnico com `product_groups` foi validada e documentada;
- idempotencia por `value` definida;
- sem colisao atual;
- sem escrita e sem alteracao do executor.

## 22. Recomendacao da proxima fase

Preparar o executor para modo piloto `product_subgroups` com hard stop final (sem escrita real), validando `--pilot-payload` dedicado e contrato before/after antes do gate de execucao.

## 23. Confirmacoes obrigatorias

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
