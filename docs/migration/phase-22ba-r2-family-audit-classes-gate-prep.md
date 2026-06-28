# Fase 22BA-R2 - Auditoria `product_families` + gate/preparo `product_classes` (sem escrita)

## 1. Objetivo

Executar fase combinada e acelerada com:

- auditoria pos-piloto de `product_families`;
- gate tecnico de `product_classes`;
- congelamento do payload de `product_classes`;
- definicao do gate humano para futura escrita piloto de `product_classes`.

Sem nova escrita em banco nesta fase.

## 2. Escopo

- pre-check Git e classificacao das pendencias;
- leitura obrigatoria de docs/scripts/artifacts da trilha 22AX-22AZ;
- validacoes SQL read-only de consistencia, idempotencia, delta e escopo negativo;
- validacao tecnica de schema/constraints/FKs/colisoes de `product_classes`;
- geracao de artifact de payload congelado e documentacao da fase.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback;
- sem alteracao de schema/staging/prod;
- sem ERP/API/webhook/n8n e sem filas;
- sem piloto real de `product_classes`;
- sem alteracao de `latest.json` ou `BASELINE_SIMULATION`;
- sem alteracao do executor;
- sem commit/push.

## 4. Estado atual

- branch: `main`;
- ultimo commit: `7f213984 feat(migration): add product subgroups pilot baseline write`;
- divergencia `origin/main...main`: `0 0`;
- pendencias observadas: trilha 22AX-22AZ + evidencias locais da 22AZ-R2.

Classificacao:

- sem arquivo critico inesperado bloqueante para auditoria/gate read-only.

## 5. Motivo da aceleracao controlada

- 22AZ-R2 fechou GO com escopo unico e hard stop correto;
- padrao de validacao/idempotencia dos auxiliares esta estavel;
- `product_classes` tem payload forte e schema simples;
- era possivel juntar auditoria + gate/preparo sem abrir escrita nova.

## 6. Evidencias analisadas

- `docs/migration/phase-22az-r2-pilot-product-families-write.md`
- `docs/migration/phase-22ay-r2-product-families-pilot-prep.md`
- `docs/migration/phase-22ax-r2-product-families-gate.md`
- `docs/migration/phase-22au-r2-post-product-subgroups-audit.md`
- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`
- `scripts/migration/phase-22k-r2-baseline-write.mjs`
- `artifacts/migration/phase-22az-r2-pilot-product-families-write/before-20260627-203833.json`
- `artifacts/migration/phase-22az-r2-pilot-product-families-write/after-20260627-203833.json`
- `artifacts/migration/phase-22ay-r2-product-families-pilot-prep/product-families-payload-20260627-202332.json`
- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-203833.json`

Evidencia mais recente aplicavel utilizada:

- write plan mais novo: `write-plan-20260627-203833.json`.

## 7. Auditoria de `product_families`

Registro auditado:

- `id=d1720ddd-f0a1-42eb-9428-51ca8df02c92`
- `value=TMP-PF-001`
- `label=TMP Product Family`
- `tenant_id=null`
- `sort_order=0`
- `is_active=true`
- `created_at` preenchido

Conclusao da auditoria: **GO**.

## 8. Validacao por id/value/label de `product_families`

- `COUNT(id=d1720ddd-f0a1-42eb-9428-51ca8df02c92) = 1`;
- `COUNT(value='TMP-PF-001') = 1`;
- `COUNT(label='TMP Product Family') = 1`;
- lookup por id/value/label retorna o mesmo registro esperado.

## 9. Validacao de defaults de `product_families`

- `tenant_id IS NULL`: verdadeiro;
- `sort_order=0`: verdadeiro;
- `is_active=true`: verdadeiro;
- `created_at IS NOT NULL`: verdadeiro.

## 10. Validacao de idempotencia de `product_families`

- `UNIQUE(value)` presente em `public.product_families`;
- cardinalidade de `value='TMP-PF-001'` = 1;
- duplicidade geral por `value`: inexistente (`max=1`);
- duplicidade por `tenant_id + value`: inexistente (`max=1`);
- divergencia com mesmo `value`: 0.

Conclusao:

- reexecucao do piloto deveria resultar em `idempotent_noop`.

## 11. Validacao de delta de `product_families`

- before 22AZ-R2: `6`;
- after 22AZ-R2: `7`;
- current 22BA-R2: `7`.

Delta:

- before/after: `+1`;
- after/current: `0`.

## 12. Escopo negativo

Contagens read-only atuais:

- `legal_entities=1`
- `product_types=13`
- `product_groups=22`
- `product_subgroups=54`
- `product_families=7`
- `product_classes=10`
- `sales_reps=0`
- `user_tenants=0`
- `user_legal_entities=0`
- `user_sales_reps=0`
- `companies=0`
- `contacts=0`
- `products=0`
- `deals=0`
- `orders=0`
- `order_items=0`
- `proposals=0`
- `audit_logs=0`
- `notifications=0`

Confirmacoes explicitas mantidas:

- `legal_entities=1`, `product_types=13`, `product_groups=22`, `product_subgroups=54`, `product_families=7`;
- `sales_reps=0`, `companies=0`, `contacts=0`, `products=0`;
- transacionais seguem `0`.

## 13. Payload encontrado de `product_classes`

Origem:

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`
- secao `BASELINE_SIMULATION.product_classes[0]`

Registro:

- `temp_key=TMP-22F-R2-PRODCLASS-01`
- `code=TMP-PC-001`
- `name=TMP Product Class`

Mapeamento:

- `value <- code`
- `label <- name`

Campos de dependencia no payload-base:

- nao foram encontrados `product_group_id`, `product_subgroup_id`, `product_family_id`, `group_value`, `subgroup_value`, `family_value`, `parent_id`, `tenant_id`, `created_by`.

## 14. Schema/constraints de `product_classes`

Tabela avaliada: `public.product_classes`.

Colunas:

- obrigatorias sem default: `value`, `label`;
- obrigatorias com default: `id`, `sort_order`, `is_active`, `created_at`;
- opcionais: `tenant_id` (nullable).

Constraints:

- `PRIMARY KEY (id)`;
- `UNIQUE(value)`;
- `FOREIGN KEY (tenant_id) REFERENCES tenants(id)`.

Indices:

- `product_classes_pkey`;
- `product_classes_value_key`.

Total atual:

- `product_classes=10`.

## 15. Dependencias/FKs de `product_classes`

Resultado tecnico read-only:

- sem coluna `product_group_id`;
- sem coluna `product_subgroup_id`;
- sem coluna `product_family_id`;
- sem FK para `product_groups`;
- sem FK para `product_subgroups`;
- sem FK para `product_families`;
- existe apenas FK de `tenant_id -> tenants(id)`.

Conclusao:

- nao ha dependencia tecnica obrigatoria com os auxiliares de produto anteriores.

## 16. Politica preliminar de `tenant_id`

- `tenant_id` existe e e nullable;
- politica definida: `tenant_id = null` (escopo global/null), alinhada com pilotos auxiliares anteriores.

## 17. Politica preliminar de `created_by`

- coluna `created_by` nao existe em `public.product_classes`;
- politica: `not_applicable`.

## 18. Colisoes verificadas

- `COUNT(value='TMP-PC-001') = 0`;
- `COUNT(label='TMP Product Class') = 0`;
- max duplicidade por `value` = 1;
- max duplicidade por `tenant_id + value` = 1.

Conclusao:

- sem colisao atual para o candidato de `product_classes`.

## 19. Idempotencia proposta

Chave natural proposta: `value` (ancorada em `UNIQUE(value)`).

Contrato futuro:

- se `value` nao existir: `insert` controlado;
- se existir e aderir ao payload/defaults: `idempotent_noop`;
- se existir com divergencia: `NO-GO`;
- sem overwrite/delete/cleanup automatico.

## 20. Payload congelado de `product_classes`, se GO

Como o gate tecnico fechou **GO**, payload congelado gerado:

- `artifacts/migration/phase-22ba-r2-family-audit-classes-gate-prep/product-classes-payload-20260627-204554.json`

Payload final:

- `source=baseline_simulation_22g_r2`
- `temp_key=TMP-22F-R2-PRODCLASS-01`
- `value=TMP-PC-001`
- `label=TMP Product Class`
- `tenant_id=null`
- `created_by=not_applicable`

Campos omitidos por politica de default:

- `sort_order`, `is_active`, `created_at`.

## 21. Gate humano especifico de `product_classes`, se GO

Frase definida para fase futura (apenas documentada, nao executada nesta fase):

`AUTORIZO A SÉTIMA ESCRITA PILOTO DA BASELINE 22BA-R2 SOMENTE EM product_classes NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

## 22. Comando futuro proposto

Comando proposto para fase futura (nao executado na 22BA-R2):

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

## 23. Riscos restantes

- risco semantico residual de possivel expectativa de hierarquia de negocio classe/grupo/subgrupo/familia fora do schema atual;
- fase futura ainda requer before/after dedicados e hard stop para escrita real de `product_classes`;
- manter monitoramento do comportamento PARCIAL estrutural de preflight por `company_contacts` reference-only.

## 24. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- auditoria de `product_families` fechou GO;
- delta/idempotencia/escopo negativo de `product_families` coerentes;
- payload de `product_classes` forte e rastreavel;
- schema de `product_classes` permite escrita isolada futura;
- sem colisao atual para `TMP-PC-001`;
- payload de `product_classes` congelado com politicas explicitas;
- nenhuma nova escrita executada;
- executor nao foi alterado nesta fase.

## 25. Recomendacao da proxima fase

Executar fase dedicada de preparo hard-stop para `product_classes` (ou escrita piloto direta, conforme gate humano), com before/after obrigatorios e escopo unico estrito em `product_classes`.

## 26. Confirmacoes obrigatorias

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
