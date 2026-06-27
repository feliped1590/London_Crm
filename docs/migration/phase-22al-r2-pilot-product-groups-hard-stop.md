# Fase 22AL-R2 — Preparar modo piloto `product_groups` com hard stop final (sem escrita)

## 1. Objetivo

Preparar o executor para reconhecer e validar `product_groups` como piloto, mantendo hard stop final antes de qualquer mutacao real.

## 2. Escopo

- manter guard rails existentes;
- aceitar `--pilot-entity product_groups` somente para validacao/evidencia/operacao em memoria;
- validar `--pilot-payload` congelado da 22AK-R2;
- validar schema/defaults/colisoes por leitura;
- gerar evidencia local da 22AL-R2;
- acionar hard stop final sem escrita.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback;
- sem alteracao de schema/staging/prod;
- sem ERP/API/webhook/n8n e sem filas;
- sem liberar `sales_reps`, `profiles`, `company_contacts`;
- sem bypass (`--force`, `--skip-guards`, `--tables`, `--all`);
- sem commit/push/deploy.

## 4. Alteracoes feitas no executor

Arquivo alterado:

- `scripts/migration/phase-22k-r2-baseline-write.mjs`

Alteracoes da 22AL-R2:

- `ALLOWED_PILOT_ENTITIES` passou a aceitar `product_groups`;
- adicionada autorizacao exata para piloto `product_groups`;
- validacao de payload estendida para `product_groups` com regras 22AK-R2;
- validacoes read-only de `product_groups`:
  - `UNIQUE(value)`;
  - contagem atual;
  - colisao por `value` e `label`;
  - nullable de `tenant_id` e `created_by`;
  - defaults de `dimension_profile` e `ficha_profile`;
- operacao piloto de `product_groups` montada somente em memoria;
- funcao de bloqueio explicita adicionada:
  - `executeProductGroupsPilotWrite()` com erro de hard stop 22AL-R2;
- evidencia dedicada da fase:
  - `artifacts/migration/phase-22al-r2-pilot-product-groups/pilot-product-groups-*.json`;
- mensagens finais ajustadas para hard stop especifico de `product_groups`.

## 5. Autorizacoes exigidas

- autorizacao geral exata:
  - `AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb`
- autorizacao piloto `product_groups` exata:
  - `AUTORIZO A QUARTA ESCRITA PILOTO DA BASELINE 22AK-R2 SOMENTE EM product_groups NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

## 6. Payload congelado validado

Payload validado de:

- `artifacts/migration/phase-22ak-r2-product-groups-pilot-prep/product-groups-payload-20260627-183504.json`

Checagens aplicadas:

- fase `22AK-R2`;
- origem `baseline_simulation_22g_r2` / `BASELINE_SIMULATION.product_groups`;
- 1 registro apenas com:
  - `temp_key=TMP-22F-R2-PRODGROUP-01`
  - `value=TMP-PG-001`
  - `label=TMP Product Group`
  - `tenant_id=null`
  - `created_by=null` (ou omitido por politica);
- politica de tenant null;
- politica de created_by nao preenchido;
- defaults esperados:
  - `dimension_profile=none`
  - `ficha_profile=none`.

## 7. Validacao de schema/colisao/defaults

Validacao read-only em `public.product_groups`:

- `UNIQUE (value)`: presente;
- contagem atual: `21`;
- colisao por `value='TMP-PG-001'`: `0`;
- colisao por `label='TMP Product Group'`: `0`;
- `tenant_id` nullable: `true`;
- `created_by` nullable: `true`;
- `dimension_profile` default: `'none'::dimension_profile`;
- `ficha_profile` default: `'none'::text`.

## 8. Operacao piloto montada em memoria

Estrutura montada:

- `entity`: `product_groups`
- `action`: `insert_pilot_planned`
- `value`: `TMP-PG-001`
- `label`: `TMP Product Group`
- `tenant_id`: `null`
- `created_by`: `null`
- `defaultsExpected.dimension_profile`: `none`
- `defaultsExpected.ficha_profile`: `none`
- `executableIn22AL`: `false`
- `realExecutionBlocked`: `true`
- motivo: hard stop ativo na 22AL-R2.

## 9. Evidencia piloto gerada

- `artifacts/migration/phase-22al-r2-pilot-product-groups/pilot-product-groups-20260627-183924.json`

## 10. Hard stop final

Mensagem emitida:

- `EXECUÇÃO PILOTO product_groups BLOQUEADA NA FASE 22AL-R2. Payload validado, mas nenhuma mutação foi executada.`

## 11. Resultado do teste

Comando executado (modo seguro armado):

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --pilot-authorization "AUTORIZO A QUARTA ESCRITA PILOTO DA BASELINE 22AK-R2 SOMENTE EM product_groups NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-181728.json \
  --pilot-payload artifacts/migration/phase-22ak-r2-product-groups-pilot-prep/product-groups-payload-20260627-183504.json \
  --pilot-entity product_groups \
  --execute-pilot-write \
  --write
```

Resultado observado:

- `preflight_decision=PARCIAL` (aceito por politica 22N-R2: somente `company_contacts` reference-only);
- `write_plan_decision=GO`;
- `pilot_payload_validated=true`;
- `pilot_validation_decision=GO`;
- evidencia piloto 22AL gerada;
- hard stop acionado;
- nenhuma mutacao executada.

## 12. Riscos restantes

- preflight global segue `PARCIAL` por `company_contacts` reference-only (esperado);
- proxima fase ainda deve manter hard stop mesmo com piloto validado, antes de qualquer escrita real.

## 13. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- `product_groups` reconhecida como piloto apenas em hard stop;
- autorizacao piloto e payload congelado validados;
- `UNIQUE(value)` e defaults validados;
- operacao montada apenas em memoria;
- evidencia local gerada;
- nenhuma escrita realizada.

## 14. Recomendacao da proxima fase

Avancar para fase de escrita piloto real de `product_groups` com contrato before/after dedicado, mantendo escopo unico e parada obrigatoria apos o piloto.

## 15. Confirmacoes obrigatorias

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
- staging/prod alterados: nao
- insert/update/upsert/delete executado: nao
- RPC de escrita executada: nao
- executor executou escrita ampliada: nao
