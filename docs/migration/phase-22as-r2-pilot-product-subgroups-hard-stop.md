# Fase 22AS-R2 - Preparar modo piloto `product_subgroups` com hard stop final (sem escrita)

## 1. Objetivo

Preparar o executor para reconhecer e validar `product_subgroups` como piloto, mantendo hard stop final antes de qualquer mutacao real.

## 2. Escopo

- manter guard rails existentes;
- aceitar `--pilot-entity product_subgroups` somente para validacao/evidencia/operacao em memoria;
- validar `--pilot-payload` congelado da 22AR-R2;
- validar schema/defaults/colisoes por leitura;
- gerar evidencia local da 22AS-R2;
- acionar hard stop final sem escrita.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback;
- sem alteracao de schema/staging/prod;
- sem ERP/API/webhook/n8n e sem filas;
- sem liberar `sales_reps`, `profiles`, `company_contacts`, `products`, `companies`, `contacts`;
- sem bypass (`--force`, `--skip-guards`, `--tables`, `--all`);
- sem commit/push/deploy.

## 4. Alteracoes feitas no executor

Arquivo alterado:

- `scripts/migration/phase-22k-r2-baseline-write.mjs`

Alteracoes da 22AS-R2:

- `ALLOWED_PILOT_ENTITIES` estendido para aceitar `product_subgroups`;
- adicionada autorizacao exata para piloto `product_subgroups`;
- validacao de payload estendida para `product_subgroups` com regras 22AR-R2;
- validacoes read-only de `product_subgroups`:
  - `UNIQUE(value)`;
  - contagem atual;
  - colisao por `value` e `label`;
  - nullable de `tenant_id` e `created_by`;
  - defaults de `sort_order`, `is_active`, `created_at`;
  - ausencia de coluna `product_group_id` e ausencia de FK para `product_groups`;
- operacao piloto de `product_subgroups` montada somente em memoria;
- funcao de bloqueio explicita adicionada:
  - `executeProductSubgroupsPilotWrite()` com erro de hard stop 22AS-R2;
- evidencia dedicada da fase:
  - `artifacts/migration/phase-22as-r2-pilot-product-subgroups/pilot-product-subgroups-*.json`;
- mensagens finais ajustadas para hard stop especifico de `product_subgroups`;
- preservados hard stops existentes de `product_types` e `product_groups`.

## 5. Autorizacoes exigidas

- autorizacao geral exata:
  - `AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb`
- autorizacao piloto `product_subgroups` exata:
  - `AUTORIZO A QUINTA ESCRITA PILOTO DA BASELINE 22AR-R2 SOMENTE EM product_subgroups NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

## 6. Payload congelado validado

Payload validado de:

- `artifacts/migration/phase-22ar-r2-product-subgroups-pilot-prep/product-subgroups-payload-20260627-190705.json`

Checagens aplicadas:

- fase `22AR-R2`;
- origem `baseline_simulation_22g_r2` / `BASELINE_SIMULATION.product_subgroups`;
- 1 registro com:
  - `temp_key=TMP-22F-R2-PRODSUBGROUP-01`
  - `value=TMP-PSG-001`
  - `label=TMP Product Subgroup`
  - `tenant_id=null`
  - `created_by=null` (ou omitido por politica);
- politica de tenant null;
- politica de created_by nao preenchido;
- defaults esperados:
  - `sort_order=0`
  - `is_active=true`
  - `created_at=now()`;
- documentacao da ausencia tecnica de vinculo com `product_groups`.

## 7. Validacao de schema/colisao/defaults

Validacao read-only em `public.product_subgroups`:

- `UNIQUE (value)`: presente;
- contagem atual: `53`;
- colisao por `value='TMP-PSG-001'`: `0`;
- colisao por `label='TMP Product Subgroup'`: `0`;
- `tenant_id` nullable: `true`;
- `created_by` nullable: `true`;
- `sort_order` default: `0`;
- `is_active` default: `true`;
- `created_at` default: `now()`.

## 8. Ausencia tecnica de vinculo com `product_groups`

Validacao read-only:

- `product_subgroups` nao possui coluna `product_group_id`;
- nao existe FK de `product_subgroups` para `product_groups`;
- payload congelado nao traz `group_value`/`parent_id`.

Conclusao:

- vinculo tecnico com `product_groups` nao e suportado no schema atual;
- nenhuma inferencia foi feita.

## 9. Operacao piloto montada em memoria

Estrutura montada:

- `entity`: `product_subgroups`
- `action`: `insert_pilot_planned`
- `value`: `TMP-PSG-001`
- `label`: `TMP Product Subgroup`
- `tenant_id`: `null`
- `created_by`: `null`
- `defaultsExpected.sort_order`: `0`
- `defaultsExpected.is_active`: `true`
- `defaultsExpected.created_at`: `now()`
- `productGroupLink.technicallySupported`: `false`
- `executableIn22AS`: `false`
- `realExecutionBlocked`: `true`
- motivo: hard stop ativo na 22AS-R2.

## 10. Evidencia piloto gerada

- `artifacts/migration/phase-22as-r2-pilot-product-subgroups/pilot-product-subgroups-20260627-191311.json`

## 11. Hard stop final

Mensagem emitida:

- `EXECUÇÃO PILOTO product_subgroups BLOQUEADA NA FASE 22AS-R2. Payload validado, mas nenhuma mutação foi executada.`

## 12. Resultado do teste

Comando executado (modo seguro armado):

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

Resultado observado:

- `preflight_decision=PARCIAL` (aceito por politica 22N-R2: somente `company_contacts` reference-only);
- `write_plan_decision=GO`;
- `pilot_payload_validated=true`;
- `pilot_validation_decision=GO`;
- evidencia piloto 22AS gerada;
- hard stop acionado;
- nenhuma mutacao executada.

## 13. Riscos restantes

- preflight global segue `PARCIAL` por `company_contacts` reference-only (esperado);
- risco semantico de relacao de negocio grupo/subgrupo permanece documentado, sem suporte tecnico no schema atual;
- proxima fase deve manter hard stop antes de qualquer escrita real de `product_subgroups`.

## 14. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- `product_subgroups` reconhecida como piloto apenas em hard stop;
- autorizacao piloto e payload congelado validados;
- `UNIQUE(value)`, defaults e ausencia de vinculo tecnico com `product_groups` validados;
- operacao montada apenas em memoria;
- evidencia local gerada;
- nenhuma escrita realizada.

## 15. Recomendacao da proxima fase

Avancar para fase de escrita piloto real de `product_subgroups` com contrato before/after dedicado, mantendo escopo unico e parada obrigatoria apos o piloto.

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
- staging/prod alterados: nao
- insert/update/upsert/delete executado: nao
- RPC de escrita executada: nao
- executor executou escrita ampliada: nao
