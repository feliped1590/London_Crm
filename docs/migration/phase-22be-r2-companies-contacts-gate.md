# Fase 22BE-R2 - Gate conjunto `companies + contacts` (sem escrita)

## 1. Objetivo

Executar gate tecnico conjunto de `companies` e `contacts` para avaliar viabilidade de uma proxima onda controlada, sem qualquer escrita.

## 2. Escopo

- pre-check Git e leitura de evidencias obrigatorias;
- localizacao e avaliacao de payloads de `companies` e `contacts`;
- validacao read-only de schema, constraints, FKs, RLS e triggers;
- validacao de `company_contacts` como reference-only;
- definicao de ordem de escrita futura e chaves candidatas de idempotencia;
- decisao tecnica GO/PARCIAL/NO-GO;
- geracao de artefato JSON e documentacao da fase.

## 3. Restricoes absolutas

- sem SQL/RPC de escrita;
- sem insert/update/upsert/delete;
- sem migration/seed/cleanup/rollback;
- sem ERP/API/webhook/n8n e sem filas;
- sem piloto real de `companies`/`contacts`;
- sem alterar executor;
- sem commit/push.

## 4. Estado atual

- branch: `main`;
- working tree: limpa;
- divergencia `origin/main...main`: `0 0`;
- ultimo commit: `4a8935cd feat(migration): add product families and classes pilot writes`;
- `HEAD == origin/main`.

## 5. Escritas piloto ja concluidas

- `legal_entities`: GO;
- `product_types`: GO;
- `product_groups`: GO;
- `product_subgroups`: GO;
- `product_families`: GO;
- `product_classes`: GO.

## 6. Motivo da frente `companies + contacts`

- frente funcional de maior impacto para operacao de CRM;
- dependencia direta esperada entre contato e empresa;
- necessidade de validar idempotencia/relacionamento antes de qualquer escrita.

## 7. Payload encontrado de `companies`

Origens:

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs` (`BASELINE_SIMULATION.companies`);
- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`;
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-205752.json`.

Quantidade planejada: `5`.

Primeiro candidato encontrado:

- `temp_key=TMP-22F-R2-COMPANY-01`
- `document=TMP-DOC-COMP-0001`
- `owner=TMP-22F-R2-SALESREP-01`

Campos presentes no payload-base:

- `temp_key`, `document`, `owner`.

Diagnostico:

- payload fraco para escrita: nao traz `name` (obrigatorio no schema), nao traz `tenant_id` explicito, nao traz `cnpj`/`erp_code`/`external_id` para idempotencia robusta.

## 8. Payload encontrado de `contacts`

Origens:

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs` (`BASELINE_SIMULATION.contacts`);
- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`;
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-205752.json`.

Quantidade planejada: `5`.

Primeiro candidato encontrado:

- `temp_key=TMP-22F-R2-CONTACT-01`
- `email=tmp.contact01@qualyvac.local`
- `company_temp_key=TMP-22F-R2-COMPANY-01`

Campos presentes no payload-base:

- `temp_key`, `email`, `company_temp_key`.

Diagnostico:

- payload fraco para escrita: nao traz `first_name` (obrigatorio no schema), nao traz `tenant_id`, nao traz `company_id` resolvido.

## 9. Schema/constraints de `companies`

Resumo tecnico:

- total atual: `0`;
- obrigatorios sem default: `name`, `tenant_id`;
- PK: `PRIMARY KEY (id)`;
- UNIQUE constraints (table_constraints): nenhuma adicional alem da PK;
- UNIQUE indexes relevantes:
  - `idx_companies_cnpj_unique` (`cnpj`) parcial;
  - `idx_companies_tenant_cnpj` (`tenant_id`, `cnpj`) parcial.

FKs relevantes:

- `tenant_id -> tenants(id)`;
- `legal_entity_id -> legal_entities(id)`;
- `sales_rep_id -> sales_reps(id)`;
- `owner_id -> auth.users(id)`;
- outras FKs administrativas/dimensionais tambem existem.

RLS/triggers:

- RLS detectada em `companies`;
- triggers detectados (ex.: `trg_set_default_sales_rep`, `trg_compute_integration_status`, `trg_uppercase_companies`).

## 10. Schema/constraints de `contacts`

Resumo tecnico:

- total atual: `0`;
- obrigatorios sem default: `first_name`, `tenant_id`;
- PK: `PRIMARY KEY (id)`;
- UNIQUE constraints (table_constraints): nenhuma adicional alem da PK;
- UNIQUE index relevante:
  - `idx_contacts_tenant_company_email_unique` (`tenant_id`, `company_id`, `email`) parcial.

FKs relevantes:

- `company_id -> companies(id) ON DELETE SET NULL`;
- `tenant_id -> tenants(id)`;
- `owner_id -> auth.users(id)`;
- `created_by -> auth.users(id)`.

RLS/triggers:

- RLS detectada em `contacts`;
- triggers detectados (`trg_uppercase_contacts`, `update_contacts_updated_at`).

## 11. Situacao de `company_contacts`

- `to_regclass('public.company_contacts') = null`;
- tabela inexistente no schema real;
- classificada como `reference-only`;
- write plan mais recente a mantém fora de escrita;
- estrategia de relacionamento futura: `contacts.company_id`.

## 12. Dependencias e FKs

- `contacts` depende tecnicamente de `companies` via `contacts.company_id` (FK existente, nullable);
- `companies` possui FK opcional para `sales_reps` e `legal_entities`, mas payload atual nao oferece base robusta para resolver essas dependencias com seguranca.

## 13. Ordem segura de escrita futura

Ordem recomendada:

1. `companies`
2. `contacts`

Justificativa:

- mesmo com `contacts.company_id` nullable, ordem empresa->contato reduz risco de contato orfao e melhora idempotencia relacional.

## 14. Chave de idempotencia candidata para `companies`

Candidata tecnica:

- `(tenant_id, cnpj)` (suportada por index unico parcial).

Status nesta fase:

- **nao utilizavel ainda**, pois payload atual nao traz `cnpj` nem campo equivalente seguro para mapeamento direto.

## 15. Chave de idempotencia candidata para `contacts`

Candidata tecnica:

- `(tenant_id, company_id, email)` (suportada por index unico parcial).

Status nesta fase:

- **nao utilizavel ainda**, pois payload atual nao traz `company_id` resolvido e nao traz `first_name` obrigatorio.

## 16. Candidatos piloto selecionados

- empresa piloto: **nao selecionada** (payload nao forte);
- contato piloto: **nao selecionado** (payload nao forte + dependencia de `company_id` nao resolvida).

## 17. Colisoes verificadas

Estado atual das tabelas:

- `companies=0`, `contacts=0`.

Checagens:

- max duplicidade `companies` por `(tenant_id, cnpj)`: `0`;
- max duplicidade `companies` por `(tenant_id, erp_code)`: `0`;
- max duplicidade `contacts` por `(tenant_id, company_id, email)`: `0`;
- max duplicidade `contacts` por `(tenant_id, erp_contact_code)`: `0`;
- colisao do primeiro email candidato de contato: `0`.

## 18. Riscos restantes

- mismatch payload/schema para as duas entidades (campos obrigatorios ausentes);
- dependencia de resolucao de empresa para contato ainda sem regra operacional fechada;
- referencia a dono/vendedor no payload de empresa depende de trilha `sales_reps` atualmente pausada.

## 19. Decisao final GO/PARCIAL/NO-GO

**NO-GO**

Motivos:

- payload de `companies` nao atende criterios de payload forte;
- payload de `contacts` nao atende criterios de payload forte;
- chaves de idempotencia existem no schema, mas nao sao suportadas pelos campos atuais de payload.

## 20. Recomendacao da proxima fase

Executar fase de saneamento/especificacao de payload de `companies` e `contacts` (sem escrita), fechando:

- mapeamento de `name` e `first_name`;
- chave natural real para `companies` (`cnpj` ou `erp_code` validado);
- regra deterministica para resolver `contacts.company_id` a partir da empresa piloto.

Somente apos esse fechamento, reabrir gate para escolher piloto `companies`.

## 21. Confirmacoes obrigatorias

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
