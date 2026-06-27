# Fase 22AB-R2 — Consolidar payload real de `sales_reps` (sem escrita)

## 1. Objetivo

Localizar e consolidar a origem real do payload dos 2 registros planejados de `sales_reps`, sem executar qualquer escrita.

## 2. Escopo

- pre-check Git da fase;
- leitura das evidencias/docus obrigatorias (22Y/22Z/22AA + script + artifacts);
- busca estruturada de fontes de payload em `artifacts/migration/`, `docs/migration/` e `scripts/migration/`;
- classificacao da origem como forte/parcial/ausente;
- geracao de evidencia de busca;
- sem alteracao de executor, sem commit/push.

## 3. Restricoes absolutas

- sem escrita em banco;
- sem SQL de escrita;
- sem migration/seed/cleanup/rollback;
- sem alteracao de schema;
- sem ERP/API/webhook/n8n;
- sem filas;
- sem inventar payload;
- sem alterar `latest.json` para simular sucesso;
- sem commit/push.

## 4. Estado atual

Pre-check Git:

- branch: `main`;
- ultimo commit: `61f3677f feat(migration): add controlled baseline write pilot`;
- divergencia: `0 0`;
- pendencias no inicio (esperadas):
  - `?? docs/migration/phase-22y-r2-next-pilot-selection.md`
  - `?? docs/migration/phase-22z-r2-sales-reps-pilot-prep.md`
  - `?? docs/migration/phase-22aa-r2-sales-reps-idempotency.md`
  - `?? artifacts/migration/phase-22aa-r2-sales-reps-idempotency/`

## 5. Motivo do NO-GO da 22AA-R2

O NO-GO da 22AA-R2 ocorreu porque `latest.json` e `write-plan-20260626-224906.json` tinham apenas presenca/contagem de `sales_reps`, sem payload linha-a-linha dos 2 registros planejados.

## 6. Fontes pesquisadas

Locais pesquisados:

- `artifacts/migration/`
- `docs/migration/`
- `scripts/migration/`

Palavras-chave usadas:

- `sales_reps`, `erp_vendor_code`, `vendor`, `vendedor`, `sales rep`, `baseline_22f_r2_restore_test_qualyvac`

Arquivos foco analisados:

- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-224906.json`
- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`
- `docs/migration/phase-22f-r2-baseline-exact-data-spec.md`
- `docs/migration/phase-22g-r2-baseline-dry-run.md`
- `docs/migration/phase-22h-r2-controlled-write-gate.md`

## 7. Origem do payload encontrada ou nao

Classificacao final: **origem parcial** (nao forte).

### Achado parcial 1 — Spec 22F

Em `phase-22f-r2-baseline-exact-data-spec.md` foram encontrados 2 vendedores logicos com nome e ERP code textual:

- `TMP-22F-R2-SREP-001` / `Vendedor Interno 01` / `SR-ERP-001`
- `TMP-22F-R2-SREP-002` / `Vendedor Interno 02` / `SR-ERP-002`

Lacunas:

- sem `tenant_id` explicito por registro;
- formato de `erp_vendor_code` textual e potencialmente incompativel com coluna `integer`.

### Achado parcial 2 — simulacao do script 22G

Em `phase-22g-r2-baseline-dry-run.mjs` (`BASELINE_SIMULATION`) foram encontrados 2 itens de `sales_reps`:

- `TMP-22F-R2-SALESREP-01` / `code=TMP-SR-001`
- `TMP-22F-R2-SALESREP-02` / `code=TMP-SR-002`

Lacunas:

- sem `tenant_id`;
- sem `name` explicito por registro;
- codigo textual nao compativel diretamente com `integer`;
- natureza de simulacao (nao contrato final de escrita).

## 8. Payload extraido, se houver

Nao foi possivel consolidar payload forte/executavel.

Payload consolidado forte exigido (e ausente) para cada registro:

- `tenant_id`
- `name`
- `erp_vendor_code` integer valido
- `email`/`active`/`type`/`phone` quando aplicavel

## 9. Validacao de `erp_vendor_code`

Estado de validacao:

- tipo da coluna: `integer`;
- nullable: `YES`;
- sem unique para `tenant_id + erp_vendor_code`.

Nos achados parciais:

- codigos encontrados (`SR-ERP-001`, `SR-ERP-002`, `TMP-SR-001`, `TMP-SR-002`) sao textuais;
- sem regra de conversao validada e sem fonte forte, nao e permitido inferir/normalizar nesta fase.

## 10. Validacao contra schema

Validacao read-only confirma:

- `public.sales_reps` existe;
- colunas obrigatorias: `id`, `name`, `tenant_id`;
- `erp_vendor_code` existe como `integer` e nullable;
- constraints: PK e FK de `tenant_id`;
- sem constraint unica de negocio para `tenant_id + erp_vendor_code`.

## 11. Colisoes verificadas

Checagens read-only executadas:

- contagem total em `sales_reps`;
- duplicidade por `tenant_id + erp_vendor_code`;
- duplicidade por `tenant_id + name`;
- duplicidade por `tenant_id + lower(email)`.

Resultado atual:

- `sales_reps` total: `0`;
- nenhuma duplicidade atual.

Limite:

- sem payload forte, nao ha como verificar colisao exata dos 2 registros planejados.

## 12. Evidencia JSON gerada

- `artifacts/migration/phase-22ab-r2-sales-reps-payload/sales-reps-payload-search-20260627-173203.json`

## 13. Riscos restantes

- ausencia de origem forte para payload dos 2 `sales_reps`;
- `erp_vendor_code` textual nas fontes parciais e `integer` no schema real;
- impossibilidade de validacao de idempotencia por registro;
- risco de interpretacao/incerteza se avancar sem consolidacao previa.

## 14. Decisao final GO/PARCIAL/NO-GO

**NO-GO**

Motivo:

- origem forte nao encontrada;
- payload exigido para escrita segura nao consolidado;
- `erp_vendor_code` nao validado por registro em formato compativel com schema.

## 15. Recomendacao da proxima fase

Executar fase de consolidacao formal de payload forte (sem escrita), criando um artifact de origem aprovada contendo os 2 registros finais de `sales_reps` com:

- `tenant_id` explicito;
- `name` explicito;
- `erp_vendor_code` integer valido;
- rastreabilidade da origem;
- validacao read-only final antes de qualquer preparo de execucao.

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
- executor alterado: nao
- staging/prod alterados: nao
- executor executou escrita ampliada: nao
