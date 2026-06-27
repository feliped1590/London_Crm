# Fase 22AN-R2 - Auditoria pos-piloto `product_groups`, idempotencia e escopo negativo

## 1. Objetivo

Auditar a escrita piloto da 22AM-R2 em `product_groups`, sem nova escrita, confirmando consistencia do registro, idempotencia, delta e escopo negativo.

## 2. Escopo

- pre-check Git;
- leitura das evidencias obrigatorias 22AK/22AL/22AM/22AG + executor;
- validacoes SQL somente read-only para registro, defaults, idempotencia, delta e escopo negativo;
- inspecao read-only dos bloqueios do executor;
- geracao de evidencia JSON e documentacao da fase.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback;
- sem alteracao de schema/staging/prod;
- sem ERP/API/webhook/n8n e sem filas;
- sem alterar executor;
- sem commit/push;
- sem reexecutar piloto `product_groups`.

## 4. Estado atual

Pre-check Git:

- branch: `main`;
- ultimo commit: `f5639fca feat(migration): add product types pilot baseline write`;
- divergencia: `0 0`;
- pendencias: trilha esperada 22AJ-22AM (docs/artifacts) + `scripts/migration/phase-22k-r2-baseline-write.mjs` modificado da fase 22AM-R2.

Classificacao de risco das pendencias:

- sem arquivo critico inesperado nesta fase;
- pendencias estao coerentes com a trilha em andamento.

## 5. Evidencias analisadas

- `docs/migration/phase-22am-r2-pilot-product-groups-write.md`
- `docs/migration/phase-22al-r2-pilot-product-groups-hard-stop.md`
- `docs/migration/phase-22ak-r2-product-groups-pilot-prep.md`
- `docs/migration/phase-22ag-r2-post-product-types-audit.md`
- `scripts/migration/phase-22k-r2-baseline-write.mjs`
- `artifacts/migration/phase-22am-r2-pilot-product-groups-write/before-20260627-184441.json`
- `artifacts/migration/phase-22am-r2-pilot-product-groups-write/after-20260627-184441.json`
- `artifacts/migration/phase-22ak-r2-product-groups-pilot-prep/product-groups-payload-20260627-183504.json`

Evidencia adicional mais recente aplicavel utilizada:

- `artifacts/migration/phase-22al-r2-pilot-product-groups/pilot-product-groups-20260627-184441.json`

## 6. Registro auditado

- `id=c5057853-15be-440d-886f-b0093de363fa`
- `value=TMP-PG-001`
- `label=TMP Product Group`
- `tenant_id=null`
- `created_by=null`
- `dimension_profile=none`
- `ficha_profile=none`

## 7. Validacao por id/value/label

Read-only:

- contagem por `id`: `1`;
- contagem por `value='TMP-PG-001'`: `1`;
- contagem por `label='TMP Product Group'`: `1`;
- payload do registro encontrado coincide com o esperado.

## 8. Validacao dos defaults

Read-only:

- `tenant_id IS NULL`: `true`;
- `created_by IS NULL`: `true`;
- `dimension_profile='none'`: `true`;
- `ficha_profile='none'`: `true`.

Conclusao: defaults e politicas foram aplicados corretamente.

## 9. Validacao de idempotencia

Read-only:

- `UNIQUE(value)` em `public.product_groups`: presente;
- cardinalidade por `value='TMP-PG-001'`: `1`;
- divergencia com mesmo `value`: `0`.

Conclusao: se o piloto fosse reexecutado, o comportamento esperado seria `idempotent_noop` (sem novo insert).

## 10. Validacao de delta

Comparacao:

- before 22AM-R2: `21`;
- after 22AM-R2: `22`;
- current 22AN-R2: `22`.

Conclusao:

- delta before/after: `+1`;
- delta after/current: `0`;
- coerente com piloto unico da 22AM-R2.

## 11. Escopo negativo

Contagens atuais (read-only):

- `legal_entities=1`
- `product_types=13`
- `product_groups=22`
- `product_subgroups=53`
- `product_families=6`
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

Confirmacoes explicitas solicitadas:

- `legal_entities` permaneceu `1`: sim;
- `product_types` permaneceu `13`: sim;
- `sales_reps` permaneceu `0`: sim;
- `companies` permaneceu `0`: sim;
- `contacts` permaneceu `0`: sim;
- `products` permaneceu `0`: sim;
- transacionais permaneceram `0`: sim.

Para tabelas fora da lista consultada por nome, nao houve necessidade de `to_regclass`; para as tabelas solicitadas, todas existem em `public`.

## 12. Bloqueios do executor

Inspecao read-only de `scripts/migration/phase-22k-r2-baseline-write.mjs` confirma:

- `sales_reps` nao e entidade piloto permitida;
- `profiles` segue fora de `FIRST_ROUND_EXECUTABLE_ENTITIES_22Q`;
- `company_contacts` segue `reference-only`;
- nao ha execucao ampliada automatica apos piloto `product_groups`;
- hard stop de `product_groups` presente:
  - `ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_groups. EXECUÇÃO AMPLIADA BLOQUEADA.`
- hard stop de `product_types` presente:
  - `ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_types. EXECUÇÃO AMPLIADA BLOQUEADA.`
- flags proibidas continuam bloqueadas (`--force`, `--skip-guards`, `--tables`, `--all`);
- nenhuma flag de bypass nova foi adicionada.

## 13. Evidencia JSON gerada

- `artifacts/migration/phase-22an-r2-post-product-groups-audit/post-product-groups-audit-20260627-185454.json`

## 14. Riscos restantes

- preflight global do executor continua `PARCIAL` por `company_contacts` em modo reference-only (esperado por politica 22N-R2);
- risco operacional residual caso haja tentativa de abrir escopo sem novo gate humano.

## 15. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- registro piloto existe exatamente como esperado;
- idempotencia por `value` mantida sem duplicidade/divergencia;
- defaults corretos;
- delta coerente e total atual estavel;
- escopo negativo sem indicio de alteracao indevida;
- bloqueios do executor mantidos;
- nenhuma nova escrita executada na 22AN-R2.

## 16. Recomendacao da proxima fase

Executar novo gate humano para decidir proxima entidade piloto auxiliar (ou auditoria consolidada de marco), mantendo escopo unico, before/after obrigatorios e validacao de idempotencia antes de qualquer nova escrita.

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
