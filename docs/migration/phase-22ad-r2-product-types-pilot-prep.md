# Fase 22AD-R2 — Preparar piloto `product_types` com payload congelado e hard stop (sem escrita)

## 1. Objetivo

Preparar tecnicamente a terceira escrita piloto futura em `product_types`, sem executar mutacao, congelando payload, politica de `tenant_id`, contrato de validacao e gate humano especifico.

## 2. Escopo

- pre-check Git de estado local;
- leitura obrigatoria de docs/evidencias 22U/22AB/22AC + script dry-run/executor + artifacts `latest.json` e `write-plan`;
- extracao e congelamento do payload final de `product_types`;
- validacao read-only de schema, constraints e colisao;
- definicao da regra de idempotencia por `value`;
- documentacao de comando futuro, gate humano e contrato before/after;
- sem escrita, sem alteracao do executor, sem commit/push.

## 3. Restricoes absolutas

- proibido executar insert/update/upsert/delete;
- proibido SQL de escrita, RPC de escrita, seed, cleanup, rollback e migration;
- proibido alterar schema, staging/prod ou integracoes externas;
- proibido alterar `scripts/migration/phase-22k-r2-baseline-write.mjs`;
- proibido inventar payload ou alterar fontes `latest.json`/`BASELINE_SIMULATION`;
- proibido commit/push.

## 4. Estado atual

Pre-check Git confirmado:

- branch: `main`;
- ultimo commit: `61f3677f feat(migration): add controlled baseline write pilot`;
- divergencia com `origin/main`: `0 0`;
- pendencias: somente trilha esperada 22Y-22AC + novos arquivos desta fase.

## 5. Motivo da escolha de `product_types`

Mantida a decisao 22AC-R2: menor superficie de dependencia, contagem minima planejada (`1`), payload linha-a-linha rastreavel em `BASELINE_SIMULATION`, `UNIQUE (value)` para idempotencia deterministica e ausencia de colisao candidata atual.

## 6. Payload final congelado

Registro congelado para piloto futuro:

- `source`: `baseline_simulation_22g_r2`
- `temp_key`: `TMP-22F-R2-PRODTYPE-01`
- `value`: `TMP-PT-001` (mapeado de `code`)
- `label`: `TMP Product Type` (mapeado de `name`)
- `tenant_id`: `null` (politica definida nesta fase)

Campos opcionais nao incluidos no payload congelado: `sort_order`, `is_active`, `created_at`, `created_by`.

## 7. Origem do payload

Origem primaria:

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`
- secao: `BASELINE_SIMULATION.product_types[0]`

Registro de origem:

- `temp_key=TMP-22F-R2-PRODTYPE-01`
- `code=TMP-PT-001`
- `name=TMP Product Type`

Regras de mapeamento (sem transformacao):

- `value <- code`
- `label <- name`

## 8. Politica de `tenant_id`

Decisao: **Opcao A — Escopo global/null** (`tenant_id = null`).

Justificativa:

- `tenant_id` nao existe no payload original de simulacao para `product_types`;
- chave unica tecnica e global por `UNIQUE (value)`;
- valor candidato nao existe no ambiente atual;
- usar tenant explicito nao melhora determinismo com chave unica global vigente.

## 9. Schema/constraints

Validacao read-only em `public.product_types`:

- `value`: `text`, `NOT NULL`, sem default;
- `label`: `text`, `NOT NULL`, sem default;
- `tenant_id`: `uuid`, nullable, sem default;
- PK: `PRIMARY KEY (id)`;
- unique: `UNIQUE (value)` presente;
- FK: `tenant_id -> tenants(id)` presente;
- FK adicional: `created_by -> auth.users(id)`.

Contagem atual:

- total de linhas: `12`.

## 10. Regra de idempotencia

Politica definida para fase futura:

- chave principal: `value` (pela `UNIQUE (value)`);
- se `value` nao existir: podera inserir;
- se `value` existir e `value+label+tenant_id` baterem com payload congelado: considerar idempotente/no-op;
- se `value` existir e divergir: abortar com **NO-GO**;
- proibido delete/cleanup/sobrescrita automatica de divergencia.

## 11. Validacao de colisao

Read-only executado para candidato:

- `value='TMP-PT-001'`: `0` ocorrencias;
- `label='TMP Product Type'`: `0` ocorrencias;
- colisao atual: **nao detectada**.

## 12. Gate humano especifico

Frase obrigatoria para fase futura (somente documentada):

`AUTORIZO A TERCEIRA ESCRITA PILOTO DA BASELINE 22AD-R2 SOMENTE EM product_types NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

## 13. Comando futuro proposto

Comando documentado (nao executar nesta fase):

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --pilot-authorization "AUTORIZO A TERCEIRA ESCRITA PILOTO DA BASELINE 22AD-R2 SOMENTE EM product_types NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-224906.json \
  --pilot-payload artifacts/migration/phase-22ad-r2-product-types-pilot-prep/product-types-payload-20260627-180436.json \
  --pilot-entity product_types \
  --execute-pilot-write \
  --write
```

Observacao: este comando nao deve funcionar para escrita real na 22AD-R2, porque o executor atual ainda esta travado/validado para `legal_entities` como piloto.

## 14. Contrato before/after

Before futuro deve conter no minimo:

- `target`, `project name`, `batch`;
- autorizacoes geral e piloto;
- entidade piloto `product_types`;
- payload congelado;
- contagem antes da tabela;
- `value` candidato e `label` candidato;
- politica de `tenant_id`;
- lookup por `value`;
- confirmacao de exclusao de outras entidades;
- confirmacao de 0 transacionais/filas/ERP.

After futuro deve conter no minimo:

- contagem depois e delta;
- registro criado/afetado;
- `value`, `label`, `tenant_id`;
- erros, se houver;
- confirmacao de escopo unico;
- confirmacao de execucao ampliada bloqueada.

## 15. Evidencia JSON gerada

- `artifacts/migration/phase-22ad-r2-product-types-pilot-prep/product-types-payload-20260627-180436.json`

## 16. Riscos restantes

- executor atual ainda nao aceita `product_types` como entidade piloto;
- `UNIQUE (value)` global exige disciplina de nao sobrescrever divergencias se registro preexistente aparecer entre fases;
- nomenclatura de constraints no banco referencia prefixo historico (`product_categories_*`), apesar de definicoes estarem corretas para `public.product_types`.

## 17. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- payload congelado com origem rastreavel e regras explicitas;
- politica de `tenant_id` definida com criterio tecnico;
- schema/constraints e colisao validados por leitura;
- idempotencia futura definida;
- nenhuma escrita executada e executor nao alterado.

## 18. Recomendacao da proxima fase

Executar fase de hardening especifico do executor para aceitar piloto **somente** em `product_types` com hard stop final, before/after obrigatorios e bloqueio explicito de execucao ampliada.

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
