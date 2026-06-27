# Fase 22AT-R2 - Escrita real piloto `product_subgroups` (escopo unico e parada obrigatoria)

## 1. Objetivo

Executar a escrita real piloto de exatamente 1 registro em `public.product_subgroups`, mantendo guard rails, validando payload congelado, gerando evidencias `before/after`, validando defaults aplicados pelo banco e impondo hard stop obrigatorio apos o piloto.

## 2. Escopo executado

- pre-check Git;
- leitura obrigatoria de docs/evidencias 22AN/22AR/22AS + artifacts 22G/22O;
- ajuste do executor para habilitar somente piloto real de `product_subgroups`;
- execucao do comando real com flags obrigatorias e autorizacoes exatas;
- geracao de `before` e `after` da 22AT-R2;
- validacoes read-only pos-escrita (delta, defaults, ausencia de vinculo tecnico com `product_groups`, escopo negativo).

## 3. Restricoes respeitadas

- sem escrita em entidades fora de `product_subgroups`;
- sem upsert automatico, overwrite, delete, cleanup ou rollback;
- sem migration/seed;
- sem ERP/API/webhook/n8n/filas;
- sem deploy;
- sem commit/push.

## 4. Pre-check Git

Estado observado antes da execucao:

- branch: `main`;
- ultimo commit: `2a8268e3`;
- divergencia `origin/main...HEAD`: `0 0`;
- pendencias coerentes com trilha 22AQ-22AS + script executor em evolucao.

Nao foram identificados arquivos criticos inesperados para bloquear a 22AT-R2.

## 5. Entradas obrigatorias usadas

- `docs/migration/phase-22ar-r2-product-subgroups-pilot-prep.md`
- `docs/migration/phase-22as-r2-pilot-product-subgroups-hard-stop.md`
- `docs/migration/phase-22an-r2-post-product-groups-audit.md`
- `scripts/migration/phase-22k-r2-baseline-write.mjs`
- `artifacts/migration/phase-22ar-r2-product-subgroups-pilot-prep/product-subgroups-payload-20260627-190705.json`
- `artifacts/migration/phase-22as-r2-pilot-product-subgroups/pilot-product-subgroups-20260627-191311.json`
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-191311.json`
- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`

## 6. Ajustes no executor (22AT-R2)

Arquivo alterado:

- `scripts/migration/phase-22k-r2-baseline-write.mjs`

Mudancas aplicadas para `product_subgroups`:

- implementada `executeProductSubgroupsPilotWrite(params)` com:
  - validacao de target/batch/payload;
  - validacao de `UNIQUE(value)`;
  - validacao de nullable/defaults (`tenant_id`, `created_by`, `sort_order`, `is_active`, `created_at`);
  - validacao de ausencia de `product_group_id`;
  - validacao de ausencia de FK `product_subgroups -> product_groups`;
  - lookup por `value`;
  - `idempotent_noop` quando existente e aderente;
  - aborta com erro em divergencia;
  - insert estrito somente com `(value, label, tenant_id)`.
- criado branch de execucao real da 22AT-R2 com evidencias:
  - `artifacts/migration/phase-22at-r2-pilot-product-subgroups-write/before-*.json`
  - `artifacts/migration/phase-22at-r2-pilot-product-subgroups-write/after-*.json`
- mensagem hard stop final configurada exatamente como:
  - `ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_subgroups. EXECUÇÃO AMPLIADA BLOQUEADA.`

## 7. Comando real executado

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --pilot-authorization "AUTORIZO A QUINTA ESCRITA PILOTO DA BASELINE 22AR-R2 SOMENTE EM product_subgroups NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-191311.json \
  --pilot-payload artifacts/migration/phase-22ar-r2-product-subgroups-pilot-prep/product-subgroups-payload-20260627-190705.json \
  --pilot-entity product_subgroups \
  --execute-pilot-write \
  --write
```

Saida-chave observada:

- `pilot_validation_decision=GO`
- `pilot_write_before_decision=GO`
- `pilot_write_after_decision=GO`
- `pilot_write_operation=inserted`
- `pilot_write_delta=1`
- hard stop final emitido com a frase obrigatoria.

## 8. Evidencias geradas

- `artifacts/migration/phase-22at-r2-pilot-product-subgroups-write/before-20260627-192122.json`
- `artifacts/migration/phase-22at-r2-pilot-product-subgroups-write/after-20260627-192122.json`
- `artifacts/migration/phase-22as-r2-pilot-product-subgroups/pilot-product-subgroups-20260627-192122.json`

## 9. Resultado do `before`

De `before-20260627-192122.json`:

- `beforeDecision=GO`;
- autorizacao geral e piloto: validas;
- payload congelado: valido;
- contagem anterior `product_subgroups=53`;
- `lookupByValue=[]` e `lookupByLabelCount=0`;
- politicas/defaults validados;
- ausencia tecnica de vinculo com `product_groups` validada.

## 10. Resultado da escrita piloto

De `after-20260627-192122.json`:

- operacao: `inserted`;
- delta: `+1` (`53 -> 54`);
- registro criado:
  - `id=8f798403-516e-48cf-b675-e025240385f3`
  - `value=TMP-PSG-001`
  - `label=TMP Product Subgroup`
  - `tenant_id=null`
  - `created_by=null`
  - `sort_order=0`
  - `is_active=true`
  - `created_at` preenchido pelo banco;
- `afterDecision=GO`;
- hard stop final registrado.

## 11. Validacoes read-only pos-escrita

Consultas executadas (somente leitura):

- cardinalidade/lookup de `product_subgroups`:
  - `total_rows=54`
  - `value_rows=1` para `TMP-PSG-001`
  - `label_rows=1` para `TMP Product Subgroup`
- defaults aplicados no registro piloto:
  - `sort_order=0`
  - `is_active=true`
  - `created_at` nao nulo
- ausencia de vinculo tecnico com `product_groups`:
  - `has_product_group_id_column=false`
  - `fk_to_product_groups=0`
- escopo negativo (sem escrita ampliada):
  - `legal_entities=1`
  - `product_types=13`
  - `product_groups=22`
  - `product_subgroups=54`
  - `sales_reps=0`
  - `companies=0`
  - `contacts=0`
  - `products=0`
  - `deals=0`
  - `orders=0`
  - `order_items=0`
  - `proposals=0`
  - `audit_logs=0`
  - `notifications=0`

## 12. Riscos residuais

- risco semantico permanece: negocio pode demandar relacao grupo/subgrupo futura, mas schema atual nao expande esse vinculo;
- preflight global permanece `PARCIAL` por politica conhecida de `company_contacts` reference-only (nao bloqueante para este piloto).

## 13. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- guard rails preservados;
- `before` e `after` obrigatorios gerados com `GO`;
- escrita real limitada a 1 registro em `product_subgroups`;
- defaults aplicados corretamente;
- sem vinculo tecnico com `product_groups`;
- hard stop final obrigatorio emitido;
- escopo negativo confirmado por consulta read-only.

## 14. Recomendacao da proxima fase

Executar auditoria pos-piloto dedicada (idempotencia e escopo negativo), mantendo bloqueio de execucao ampliada e exigindo novo gate humano antes de qualquer nova entidade.

## 15. Confirmacoes obrigatorias

- nova escrita em banco: sim (somente 1 registro em `product_subgroups`)
- SQL de escrita executado: sim (insert controlado em `product_subgroups`)
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- commit: nao
- push: nao
- staging/prod alterados: nao
- execucao ampliada apos piloto: nao (bloqueada)
