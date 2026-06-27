# Fase 22AM-R2 — Escrita real piloto `product_groups`, escopo unico e parada obrigatoria

## 1. Objetivo

Executar a quarta escrita piloto controlada da baseline 22* no restore-test, limitada a 1 registro em `public.product_groups`, com before/after obrigatorios, idempotencia por `UNIQUE(value)` e hard stop final.

## 2. Escopo permitido

- validacoes read-only de target, batch, autorizacoes, schema/defaults e colisao;
- escrita real somente em `public.product_groups`;
- payload unico:
  - `value='TMP-PG-001'`
  - `label='TMP Product Group'`
  - `tenant_id=null`
- omitir `created_by`, `dimension_profile`, `ficha_profile` no insert;
- gerar evidencias locais de before/after e evidencias auxiliares do executor.

## 3. Escopo proibido

- sem escrita em outras tabelas;
- sem ERP/API/webhook/n8n/filas;
- sem migration/seed/cleanup/rollback/deploy;
- sem `--force`, `--skip-guards`, `--tables`, `--all`;
- sem commit/push;
- sem overwrite de divergencia.

## 4. Alteracoes feitas no executor

Arquivo alterado:

- `scripts/migration/phase-22k-r2-baseline-write.mjs`

Alteracoes minimas aplicadas:

- implementada `executeProductGroupsPilotWrite(params)` com validacoes obrigatorias:
  - `pilotEntity`, `pilotAuthorization`, payload congelado;
  - `targetRef`, `targetName`, `batchId`;
  - `value`, `label`, `tenant_id`, `created_by`;
  - `UNIQUE(value)` em `product_groups`;
  - defaults obrigatorios (`dimension_profile='none'`, `ficha_profile='none'`);
- lookup read-only por `value`;
- politica de operacao:
  - `inserted` se nao existir;
  - `idempotent_noop` se existir e coincidir com payload/defaults;
  - `aborted`/`NO-GO` se houver divergencia;
- insert estritamente com colunas:
  - `value`, `label`, `tenant_id`;
- adicionada geracao de evidencias obrigatorias da 22AM-R2:
  - `artifacts/migration/phase-22am-r2-pilot-product-groups-write/before-*.json`
  - `artifacts/migration/phase-22am-r2-pilot-product-groups-write/after-*.json`
- hard stop final da fase:
  - `ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_groups. EXECUÇÃO AMPLIADA BLOQUEADA.`

## 5. Payload usado

Fonte:

- `artifacts/migration/phase-22ak-r2-product-groups-pilot-prep/product-groups-payload-20260627-183504.json`

Payload validado:

- `temp_key=TMP-22F-R2-PRODGROUP-01`
- `value=TMP-PG-001`
- `label=TMP Product Group`
- `tenant_id=null`
- `created_by=null` (politica null/omit)

## 6. Before gerado

- `artifacts/migration/phase-22am-r2-pilot-product-groups-write/before-20260627-184441.json`
- `beforeDecision=GO`

Resumo do before:

- target/batch/autorizacoes: validos;
- `productGroupsCountBefore=21`;
- lookup `value='TMP-PG-001'`: vazio;
- lookup `label='TMP Product Group'`: `0`;
- `UNIQUE(value)=true`;
- `tenant_id nullable=true`;
- `created_by nullable=true`;
- defaults:
  - `dimension_profile='none'::dimension_profile`
  - `ficha_profile='none'::text`.

## 7. Operacao executada

Comando executado:

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --pilot-authorization "AUTORIZO A QUARTA ESCRITA PILOTO DA BASELINE 22AK-R2 SOMENTE EM product_groups NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-183924.json \
  --pilot-payload artifacts/migration/phase-22ak-r2-product-groups-pilot-prep/product-groups-payload-20260627-183504.json \
  --pilot-entity product_groups \
  --execute-pilot-write \
  --write
```

Resultado da operacao:

- `pilot_write_operation=inserted`
- `pilot_write_delta=1`
- `pilot_write_record_id=c5057853-15be-440d-886f-b0093de363fa`

## 8. After gerado

- `artifacts/migration/phase-22am-r2-pilot-product-groups-write/after-20260627-184441.json`
- `afterDecision=GO`

## 9. Delta

- antes: `21`
- depois: `22`
- delta: `+1`

## 10. Registro criado/encontrado

- `id=c5057853-15be-440d-886f-b0093de363fa`
- `value=TMP-PG-001`
- `label=TMP Product Group`
- `tenant_id=null`
- `created_by=null`

## 11. Defaults aplicados

Confirmado no after e em consulta read-only:

- `dimension_profile='none'`
- `ficha_profile='none'`

## 12. Hard stop final

Mensagem final emitida:

- `ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_groups. EXECUÇÃO AMPLIADA BLOQUEADA.`

Nenhuma execucao ampliada foi realizada.

## 13. Validacoes pos-escrita

Read-only consolidado:

- `product_groups`:
  - total atual: `22`
  - `value='TMP-PG-001'`: 1 registro
  - duplicidade por `value`: `1` (sem duplicata)
  - `label='TMP Product Group'`, `tenant_id=null`, `created_by=null`, defaults corretos
- contagens de guarda:
  - `legal_entities=1`
  - `product_types=13`
  - `sales_reps=0`
  - `user_tenants=0`
  - `user_legal_entities=0`
  - `user_sales_reps=0`
  - `companies=0`
  - `contacts=0`
  - `products=0`
  - `deals=0`
  - `orders=0`
  - `proposals=0`

## 14. Riscos restantes

- preflight geral continua `PARCIAL` por `company_contacts` em modo reference-only (esperado pela politica 22N-R2);
- ainda existe risco operacional caso tentem ampliar escopo sem novo gate humano e validacao dedicada por entidade.

## 15. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- target/batch/autorizacoes corretos;
- before e after obrigatorios gerados com decisao `GO`;
- escrita real restrita a `product_groups`;
- apenas 1 registro criado;
- defaults obrigatorios aplicados corretamente;
- hard stop final cumprido;
- nenhuma evidencia de execucao ampliada.

## 16. Recomendacao da proxima fase

Executar auditoria pos-piloto dedicada da 22AM-R2 (idempotencia, escopo negativo e guard rails), sem novas escritas, antes de decidir a proxima entidade piloto auxiliar.

## 17. Confirmacoes obrigatorias

- nova escrita em banco: sim
- tabela escrita: `product_groups`
- quantidade de registros criados: 1
- SQL manual executado: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- commit: nao
- push: nao
- staging/prod alterados: nao
- insert/update/upsert/delete fora de `product_groups`: nao
- RPC de escrita executada: nao
- executor executou escrita ampliada: nao
