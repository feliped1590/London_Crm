# Fase 22BB-R2 - Escrita real piloto `product_classes` (escopo unico acelerado)

## 1. Objetivo

Executar escrita real controlada de exatamente 1 registro em `public.product_classes`, com payload congelado da 22BA-R2, mantendo guard rails, before/after obrigatorios, idempotencia e hard stop final.

## 2. Escopo permitido

- alteracao minima do executor para habilitar piloto dedicado de `product_classes`;
- validacoes preflight e pilot read-only (target, batch, autorizacoes, payload, schema, defaults, FKs);
- escrita real unica em `public.product_classes` para `value=TMP-PC-001`;
- geracao de artefatos `before` e `after`;
- validacoes read-only pos-escrita e registro da decisao.

## 3. Escopo proibido

- qualquer escrita fora de `product_classes`;
- nova escrita em `legal_entities`, `product_types`, `product_groups`, `product_subgroups`, `product_families`;
- escrita em `sales_reps`, `profiles`, `user_tenants`, `user_legal_entities`, `user_sales_reps`, `companies`, `contacts`, `products`, `company_contacts`, `deals`, `orders`, `proposals`;
- fila/processamento externo, ERP/API/webhook/n8n;
- migration/seed/cleanup/rollback/deploy;
- commit/push.

## 4. Motivo da aceleracao controlada

- pilotos auxiliares anteriores estabilizados com hard stop e escopo unico;
- gate 22BA-R2 de `product_classes` fechado em GO;
- payload congelado com rastreabilidade completa;
- schema simples para escrita isolada (`UNIQUE(value)`, defaults claros, sem vinculo tecnico com grupo/subgrupo/familia).

## 5. Alteracoes feitas no executor

Arquivo alterado: `scripts/migration/phase-22k-r2-baseline-write.mjs`.

- adicionada entidade `product_classes` em `ALLOWED_PILOT_ENTITIES`;
- adicionadas constantes:
  - `EXPECTED_PRODUCT_CLASSES_PILOT_AUTHORIZATION`;
  - `EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD`;
- criada funcao dedicada `executeProductClassesPilotWrite()` com:
  - validacao de entidade piloto, autorizacoes, target, batch e payload congelado;
  - validacao de `UNIQUE(value)`;
  - validacao de defaults (`sort_order=0`, `is_active=true`, `created_at=now()`);
  - validacao de `tenant_id` nullable e `created_by` inexistente;
  - validacao de ausencia de colunas/FKs para `product_groups`, `product_subgroups`, `product_families`;
  - lookup por `value`;
  - `insert` apenas com `value`, `label`, `tenant_id` quando inexistente;
  - `idempotent_noop` quando registro existente e aderente;
  - `aborted`/NO-GO para divergencia;
- adicionados blocos de before/after e evidencias da fase 22BB-R2;
- hard stop final com mensagem obrigatoria da fase.

## 6. Payload usado

Origem: `artifacts/migration/phase-22ba-r2-family-audit-classes-gate-prep/product-classes-payload-20260627-204554.json`

Payload efetivo:

- `temp_key`: `TMP-22F-R2-PRODCLASS-01`
- `value`: `TMP-PC-001`
- `label`: `TMP Product Class`
- `tenant_id`: `null`
- `created_by`: `not_applicable`

Campos omitidos por politica de default:

- `sort_order`
- `is_active`
- `created_at`

## 7. Before gerado

- `artifacts/migration/phase-22bb-r2-pilot-product-classes-write/before-20260627-205752.json`
- `beforeDecision`: `GO`

Resumo:

- target/batch/autorizacoes validados;
- `productClassesCountBefore=10`;
- `lookupByValue=[]`;
- `lookupByLabel=[]`;
- `lookupByLabelCount=0`;
- `UNIQUE(value)` validado;
- `tenant_id` nullable validado;
- `created_by` not_applicable + coluna ausente validado;
- defaults esperados validados;
- ausencia tecnica de vinculo com `product_groups`, `product_subgroups`, `product_families` validada.

## 8. Operacao executada

Comando executado:

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --pilot-authorization "AUTORIZO A SÉTIMA ESCRITA PILOTO DA BASELINE 22BA-R2 SOMENTE EM product_classes NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-203833.json \
  --pilot-payload artifacts/migration/phase-22ba-r2-family-audit-classes-gate-prep/product-classes-payload-20260627-204554.json \
  --pilot-entity product_classes \
  --execute-pilot-write \
  --write
```

Resultado:

- `pilot_validation_decision=GO`
- `pilot_write_before_decision=GO`
- `pilot_write_operation=inserted`
- `pilot_write_delta=1`
- `pilot_write_record_id=79b5d092-1669-4b39-b590-565b471c1360`

## 9. After gerado

- `artifacts/migration/phase-22bb-r2-pilot-product-classes-write/after-20260627-205752.json`
- `afterDecision`: `GO`

## 10. Delta

- count before: `10`
- count after: `11`
- delta: `+1`

## 11. Registro criado/encontrado

- `id`: `79b5d092-1669-4b39-b590-565b471c1360`
- `value`: `TMP-PC-001`
- `label`: `TMP Product Class`
- `tenant_id`: `null`

## 12. Defaults aplicados

Confirmado no after e em query read-only:

- `sort_order=0`
- `is_active=true`
- `created_at` preenchido (`2026-06-27 23:58:17.567953+00`)

## 13. Ausencia de vinculo tecnico com `product_groups`

- coluna `product_group_id`: ausente;
- FK para `product_groups`: ausente.

## 14. Ausencia de vinculo tecnico com `product_subgroups`

- coluna `product_subgroup_id`: ausente;
- FK para `product_subgroups`: ausente.

## 15. Ausencia de vinculo tecnico com `product_families`

- coluna `product_family_id`: ausente;
- FK para `product_families`: ausente.

## 16. Hard stop final

Mensagem emitida pelo executor:

`ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_classes. EXECUÇÃO AMPLIADA BLOQUEADA.`

## 17. Validacoes pos-escrita

Read-only:

- `product_classes` total: `11`;
- `value='TMP-PC-001'`: 1 registro;
- `label='TMP Product Class'`: 1 registro;
- `tenant_id IS NULL`: confirmado;
- `sort_order=0`: confirmado;
- `is_active=true`: confirmado;
- `created_at IS NOT NULL`: confirmado;
- duplicidade por `value='TMP-PC-001'`: `1` (sem duplicidade).

Contagens de guarda:

- `legal_entities=1`
- `product_types=13`
- `product_groups=22`
- `product_subgroups=54`
- `product_families=7`
- `product_classes=11`
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

Conclusao de escopo negativo:

- nenhuma evidencia de alteracao em entidade bloqueada.

## 18. Riscos restantes

- risco semantico residual: possivel expectativa de negocio de hierarquia entre classe/grupo/subgrupo/familia fora do schema atual;
- `preflight_decision=PARCIAL` estrutural permanece aceito por politica 22N-R2 devido a `company_contacts` reference-only.

## 19. Decisao final GO/PARCIAL/NO-GO

**GO**

Justificativa:

- target/batch/autorizacoes corretos;
- before e after obrigatorios gerados;
- escrita unica em `product_classes`;
- delta esperado (`+1`);
- defaults aplicados corretamente;
- ausencia tecnica de vinculos indevidos preservada;
- escopo negativo preservado;
- hard stop final emitido corretamente.

## 20. Recomendacao da proxima fase

Executar auditoria pos-piloto de `product_classes` (idempotencia e escopo negativo formal), e somente com novo GO humano avaliar gate da proxima entidade.

## 21. Confirmacoes obrigatorias

- nova escrita em banco: **sim**
- tabela escrita: **product_classes**
- quantidade de registros criados: **1**
- SQL manual executado: **nao**
- migration: **nao**
- seed/cleanup: **nao**
- rollback: **nao**
- ERP/API/webhook/n8n: **nao**
- filas processadas: **nao**
- deploy: **nao**
- commit: **nao**
- push: **nao**
- staging/prod alterados: **nao**
- insert/update/upsert/delete fora de `product_classes`: **nao**
- RPC de escrita executada: **nao**
- executor executou escrita ampliada: **nao**
