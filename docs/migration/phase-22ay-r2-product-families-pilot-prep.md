# Fase 22AY-R2 - Preparar piloto `product_families` com payload congelado (sem escrita)

## 1. Objetivo

Preparar tecnicamente o futuro piloto de `product_families`, sem executar mutacao, congelando payload oficial, politicas operacionais, gate humano especifico e contrato before/after.

## 2. Escopo

- pre-check Git;
- leitura obrigatoria de docs/scripts/artifacts das fases 22AX/22AU/22AT/22AN + baseline/write-plan;
- extracao e congelamento do payload de `product_families`;
- validacao read-only de schema, defaults, constraints, indices e colisao;
- definicao de politicas de `tenant_id` e `created_by`;
- documentacao da ausencia tecnica de vinculo com `product_groups`/`product_subgroups`;
- definicao de idempotencia e comando futuro proposto.

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
- ultimo commit: `7f213984 feat(migration): add product subgroups pilot baseline write`;
- divergencia: `0 0`;
- `git status --short`: pendencias esperadas da 22AX-R2 apenas:
  - `docs/migration/phase-22ax-r2-product-families-gate.md`
  - `artifacts/migration/phase-22ax-r2-product-families-gate/`.

## 5. Motivo da escolha de `product_families`

- candidata natural apos fechamento GO de `product_subgroups`;
- payload linha-a-linha forte presente na simulacao baseline;
- `UNIQUE(value)` presente e sem colisao para candidato `TMP-PF-001`;
- escrita isolada tecnicamente possivel no schema atual.

## 6. Payload final congelado

Registro congelado:

- `source`: `baseline_simulation_22g_r2`
- `temp_key`: `TMP-22F-R2-PRODFAMILY-01`
- `value`: `TMP-PF-001`
- `label`: `TMP Product Family`
- `tenant_id`: `null`
- `created_by`: `not_applicable`

## 7. Origem do payload

Origem primaria:

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`
- secao: `BASELINE_SIMULATION.product_families[0]`

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
- alinhado com `product_types`, `product_groups` e `product_subgroups`.

## 9. Politica de `created_by`

Definicao: **not_applicable**.

Justificativa:

- coluna `created_by` nao existe em `public.product_families`;
- nao ha preenchimento nem lookup de usuario a ser realizado.

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

- `product_families` nao possui coluna `product_group_id`;
- nao existe FK de `product_families` para `product_groups`;
- payload nao traz `group_value`/`parent_id`.

Conclusao:

- nao e possivel nem desejavel inferir/criar vinculo tecnico nesta fase.

## 12. Ausencia de vinculo tecnico com `product_subgroups`

Validacao read-only:

- `product_families` nao possui coluna `product_subgroup_id`;
- nao existe FK de `product_families` para `product_subgroups`;
- payload nao traz `subgroup_value`.

Conclusao:

- nao e possivel nem desejavel inferir/criar vinculo tecnico nesta fase.

## 13. Risco semantico documentado

- apesar da ausencia de vinculos tecnicos no schema atual, pode haver expectativa de negocio de relacao hierarquica;
- risco foi registrado e nao bloqueia a preparacao;
- nenhuma inferencia de vinculo sera feita sem regra/coluna explicita.

## 14. Schema/constraints

Resumo read-only de `public.product_families`:

- PK: `PRIMARY KEY (id)`;
- unique: `UNIQUE(value)`;
- FKs:
  - `tenant_id -> tenants(id)`;
- colunas obrigatorias sem default: `value`, `label`;
- colunas com default relevante: `id`, `sort_order`, `is_active`, `created_at`;
- coluna opcional relevante: `tenant_id`.

## 15. Regra de idempotencia

Politica futura definida:

- chave principal: `value`;
- se `value` nao existir: futura fase pode inserir;
- se `value` existir e bater com payload/defaults esperados: `idempotent_noop`;
- se divergir em `label`, `tenant_id`, `sort_order` ou `is_active`: abortar com **NO-GO**;
- proibido overwrite automatico, delete e cleanup.

## 16. Validacao de colisao

Read-only no estado atual:

- total atual `product_families`: `6`;
- `value='TMP-PF-001'`: `0`;
- `label='TMP Product Family'`: `0`;
- max duplicidade por `value`: `1` (sem duplicidade real);
- max duplicidade por `tenant_id + value`: `1` (sem duplicidade real).

## 17. Gate humano especifico

Frase obrigatoria para fase futura:

`AUTORIZO A SEXTA ESCRITA PILOTO DA BASELINE 22AY-R2 SOMENTE EM product_families NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

Somente documentada nesta fase; nenhuma escrita executada.

## 18. Comando futuro proposto

Comando proposto (nao executar nesta fase):

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --pilot-authorization "AUTORIZO A SEXTA ESCRITA PILOTO DA BASELINE 22AY-R2 SOMENTE EM product_families NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-192122.json \
  --pilot-payload artifacts/migration/phase-22ay-r2-product-families-pilot-prep/product-families-payload-20260627-202332.json \
  --pilot-entity product_families \
  --execute-pilot-write \
  --write
```

Observacao:

- nao executar nesta fase;
- proxima fase deve preparar o executor com hard stop especifico para `product_families`.

## 19. Contrato before/after

Before futuro deve conter:

- target, project, batch;
- autorizacoes geral e piloto;
- entidade piloto `product_families`;
- payload congelado;
- contagem antes;
- lookup por `value` e `label`;
- politicas `tenant_id`, `created_by=not_applicable` e defaults;
- confirmacao de ausencia de FK para `product_groups`;
- confirmacao de ausencia de FK para `product_subgroups`;
- confirmacao de escopo negativo e de ausencia de transacionais/filas/ERP.

After futuro deve conter:

- contagem depois e delta;
- registro criado/encontrado;
- `value`, `label`, `tenant_id`, `sort_order`, `is_active`, `created_at`;
- operacao (`inserted`/`idempotent_noop`/`aborted`);
- erros (se houver);
- confirmacao de escopo unico e bloqueio de execucao ampliada.

## 20. Evidencia JSON gerada

- `artifacts/migration/phase-22ay-r2-product-families-pilot-prep/product-families-payload-20260627-202332.json`

## 21. Riscos restantes

- risco semantico de relacao hierarquica de negocio nao explicitada no schema atual;
- proxima fase ainda depende de hard stop dedicado no executor para `product_families` antes de qualquer escrita real.

## 22. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- payload final congelado com origem rastreavel;
- politicas de `tenant_id`, `created_by` e defaults ficaram explicitas e conservadoras;
- ausencia de vinculo tecnico com `product_groups` e `product_subgroups` foi validada e documentada;
- idempotencia por `value` definida;
- sem colisao atual;
- sem escrita e sem alteracao do executor.

## 23. Recomendacao da proxima fase

Preparar o executor para modo piloto `product_families` com hard stop final (sem escrita real), validando `--pilot-payload` dedicado e contrato before/after antes do gate de execucao.

## 24. Confirmacoes obrigatorias

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
