# Fase 22AU-R2 - Auditoria pos-piloto `product_subgroups`, idempotencia e escopo negativo

## 1. Objetivo

Auditar a escrita piloto da 22AT-R2 em `product_subgroups`, sem nova escrita, confirmando consistencia do registro, idempotencia, delta, ausencia de vinculo tecnico com `product_groups` e preservacao de escopo negativo.

## 2. Escopo

- pre-check Git;
- leitura obrigatoria de documentos/evidencias da trilha 22AQ-22AT;
- validacoes SQL read-only para registro, defaults, `created_at`, idempotencia, delta e escopo negativo;
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
- sem reexecucao de piloto `product_subgroups`.

## 4. Estado atual

Pre-check Git:

- branch: `main`;
- `git log -1 --oneline`: `2a8268e3 feat(migration): add product groups pilot baseline write`;
- divergencia `origin/main...main`: `0 0`;
- `git status --short`: pendencias coerentes com trilha 22AQ-22AT, incluindo executor modificado de fases anteriores e artifacts/docs da trilha.

Classificacao de risco das pendencias:

- sem arquivo critico inesperado bloqueante para auditoria read-only;
- pendencias aderentes ao contexto de fases anteriores sem commit/push.

## 5. Evidencias analisadas

- `docs/migration/phase-22at-r2-pilot-product-subgroups-write.md`
- `docs/migration/phase-22as-r2-pilot-product-subgroups-hard-stop.md`
- `docs/migration/phase-22ar-r2-product-subgroups-pilot-prep.md`
- `docs/migration/phase-22aq-r2-product-subgroups-gate.md`
- `docs/migration/phase-22an-r2-post-product-groups-audit.md`
- `scripts/migration/phase-22k-r2-baseline-write.mjs`
- `artifacts/migration/phase-22at-r2-pilot-product-subgroups-write/before-20260627-192122.json`
- `artifacts/migration/phase-22at-r2-pilot-product-subgroups-write/after-20260627-192122.json`
- `artifacts/migration/phase-22ar-r2-product-subgroups-pilot-prep/product-subgroups-payload-20260627-190705.json`

Evidencia mais recente aplicavel utilizada:

- `artifacts/migration/phase-22as-r2-pilot-product-subgroups/pilot-product-subgroups-20260627-192122.json`

## 6. Registro auditado

- `id=8f798403-516e-48cf-b675-e025240385f3`
- `value=TMP-PSG-001`
- `label=TMP Product Subgroup`
- `tenant_id=null`
- `created_by=null`
- `sort_order=0`
- `is_active=true`
- `created_at=2026-06-27 22:21:45.798616+00`

## 7. Validacao por id/value/label

Read-only:

- contagem por `id`: `1`;
- contagem por `value='TMP-PSG-001'`: `1`;
- contagem por `label='TMP Product Subgroup'`: `1`;
- registro encontrado por `id` coincide com payload/defaults esperados.

## 8. Validacao dos defaults

Read-only:

- `tenant_id IS NULL`: `true`;
- `created_by IS NULL`: `true`;
- `sort_order=0`: `true`;
- `is_active=true`: `true`.

Conclusao: defaults e politicas de nulidade permanecem corretos.

## 9. Validacao de `created_at`

Read-only:

- `created_at IS NOT NULL`: `true`.

Conclusao: timestamp de criacao foi aplicado pelo banco conforme esperado.

## 10. Validacao de idempotencia

Read-only:

- `UNIQUE(value)` em `public.product_subgroups`: presente;
- cardinalidade por `value='TMP-PSG-001'`: `1`;
- divergencia com mesmo `value` (`label`, `tenant_id`, `created_by`, `sort_order`, `is_active`, `created_at`): `0`.

Conclusao: se o piloto fosse reexecutado, o comportamento esperado seria `idempotent_noop` (sem novo insert).

## 11. Validacao de delta

Comparacao:

- before 22AT-R2: `53`;
- after 22AT-R2: `54`;
- current 22AU-R2: `54`.

Conclusao:

- delta before/after: `+1`;
- delta after/current: `0`;
- coerente com piloto unico da 22AT-R2.

## 12. Ausencia tecnica de vinculo com `product_groups`

Read-only:

- `has_product_group_id_column=false`;
- `fk_to_product_groups=0`;
- registro piloto nao possui campo tecnico de vinculacao com `product_groups`.

Conclusao: ausencia tecnica de vinculo permanece preservada e nenhuma inferencia tecnica foi criada.

## 13. Escopo negativo

Contagens atuais (read-only):

- `legal_entities=1`
- `product_types=13`
- `product_groups=22`
- `product_subgroups=54`
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

Confirmacoes explicitas:

- `legal_entities` permaneceu `1`: sim;
- `product_types` permaneceu `13`: sim;
- `product_groups` permaneceu `22`: sim;
- `sales_reps` permaneceu `0`: sim;
- `companies` permaneceu `0`: sim;
- `contacts` permaneceu `0`: sim;
- `products` permaneceu `0`: sim;
- transacionais permaneceram `0`: sim.

`to_regclass` validou presenca das tabelas consultadas em `public`; nenhum caso `not_applicable` foi necessario.

## 14. Bloqueios do executor

Inspecao read-only de `scripts/migration/phase-22k-r2-baseline-write.mjs` confirma:

- `sales_reps` segue fora de `ALLOWED_PILOT_ENTITIES` (nao permitida para piloto);
- `profiles` segue excluida da primeira rodada (`FIRST_ROUND_EXECUTABLE_ENTITIES_22Q`);
- `company_contacts` segue reference-only e nao elegivel para write;
- nao ha execucao ampliada automatica apos `product_subgroups`;
- hard stop de `product_subgroups` presente:
  - `ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_subgroups. EXECUÇÃO AMPLIADA BLOQUEADA.`
- hard stop de `product_groups` presente:
  - `ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_groups. EXECUÇÃO AMPLIADA BLOQUEADA.`
- hard stop de `product_types` presente:
  - `ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_types. EXECUÇÃO AMPLIADA BLOQUEADA.`
- flags proibidas continuam bloqueadas (`--force`, `--skip-guards`, `--tables`, `--all`);
- nenhuma flag de bypass nova foi identificada.

## 15. Evidencia JSON gerada

- `artifacts/migration/phase-22au-r2-post-product-subgroups-audit/post-product-subgroups-audit-20260627-192455.json`

## 16. Riscos restantes

- risco semantico residual: relacao de negocio grupo/subgrupo ainda nao esta explicita tecnicamente no schema;
- preflight global do executor continua `PARCIAL` por `company_contacts` reference-only (esperado por politica 22N-R2).

## 17. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- registro piloto existe exatamente como esperado;
- idempotencia por `value` preservada sem duplicidade/divergencia;
- defaults e `created_at` corretos;
- delta coerente e total atual estavel (`54`);
- ausencia tecnica de vinculo com `product_groups` preservada;
- escopo negativo sem indicio de alteracao indevida;
- bloqueios do executor mantidos;
- nenhuma nova escrita executada na 22AU-R2.

## 18. Recomendacao da proxima fase

Executar novo gate humano antes de qualquer escrita adicional, mantendo escopo unico, contrato before/after e validacao formal de idempotencia/escopo negativo para a proxima entidade.

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
