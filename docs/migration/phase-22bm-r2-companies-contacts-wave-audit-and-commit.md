# Fase 22BM-R2 - Auditoria da onda `companies + contacts` e commit do bloco 22BK-22BM

## 1. Objetivo

Auditar em modo read-only a onda 22BL-R2 de `companies + contacts` (N=4), validar integridade/idempotencia/escopo negativo e consolidar o bloco 22BK-22BM em commit local, sem push.

## 2. Escopo

- pre-check Git e trilha esperada;
- leitura de documentos/evidencias obrigatorias 22BK/22BL/22BI/22BH/22BG;
- auditoria read-only de 5 `companies` e 5 `contacts`;
- validacao de vinculo `contacts.company_id -> companies.id`;
- validacao de idempotencia por chave natural;
- validacao de delta da onda e acumulado;
- validacao de escopo negativo e guard rails do executor;
- evidencia JSON 22BM;
- checagem de sensiveis;
- stage seletivo e commit local.

## 3. Restricoes absolutas

- sem nova escrita em banco;
- sem reexecucao da onda 22BL-R2;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback/deploy;
- sem ERP/API/webhook/n8n/filas;
- sem alteracao do executor nesta fase;
- sem push.

## 4. Estado Git antes do commit

- branch: `main`;
- ultimo commit: `e30df857 feat(migration): add companies and contacts pilot writes`;
- `HEAD == origin/main`: verdadeiro;
- divergencia: `0 0`;
- pendencias: trilha esperada 22BK-22BL (+ artefatos auxiliares do executor na 22BL).

## 5. Resumo das fases 22BK-22BL

- **22BK-R2**: gate de expansao controlada em `GO`, com payload congelado de 4 pares;
- **22BL-R2**: escrita controlada executada em `GO`, somente `companies` e `contacts`;
- deltas da onda: `companies +4` (`1 -> 5`) e `contacts +4` (`1 -> 5`);
- hard stop final da onda registrado.

## 6. Auditoria das 5 empresas

Empresas validadas por `id` e por `(tenant_id, cnpj)` com cardinalidade `1`:

- `TMP-DOC-COMP-0001` -> `9eb4ba07-d4d4-4b45-9902-39244d6ad52c` (`TMP COMPANY 01`);
- `TMP-DOC-COMP-0002` -> `feee1c46-cb1e-4d65-a6c7-a309b187d3b7` (`TMP COMPANY 02`);
- `TMP-DOC-COMP-0003` -> `c4db0477-f726-4395-86e7-23e2fc102ba9` (`TMP COMPANY 03`);
- `TMP-DOC-COMP-0004` -> `76cc5c3d-ae91-46e9-93eb-8fe63467f323` (`TMP COMPANY 04`);
- `TMP-DOC-COMP-0005` -> `151971d7-1aa6-43b8-859c-4d570c3282d0` (`TMP COMPANY 05`).

Validacoes:

- `tenant_id=00000000-0000-0000-0000-000000000001` em todos;
- `name` persistido em uppercase em todos;
- `owner_id`, `sales_rep_id`, `legal_entity_id`, `created_by` nulos em todos.

## 7. Auditoria dos 5 contatos

Contatos validados por `id` e por `(tenant_id, company_id, email)` com cardinalidade `1`:

- `tmp.contact01@qualyvac.local` -> `06514c9c-24b8-49fd-b8e2-f744b24d307f`;
- `tmp.contact02@qualyvac.local` -> `a58db009-4425-4c56-8b7b-1659d16b9dd4`;
- `tmp.contact03@qualyvac.local` -> `a6f4298a-ad69-4e42-bf3d-2613030d7e55`;
- `tmp.contact04@qualyvac.local` -> `5af76ebf-202c-4096-aff9-468a60e7da72`;
- `tmp.contact05@qualyvac.local` -> `5c7e7c16-9298-4322-8967-a8f7ff68e944`.

Validacoes:

- `tenant_id=00000000-0000-0000-0000-000000000001` em todos;
- `first_name` persistido em uppercase em todos;
- `owner_id` e `created_by` nulos em todos.

## 8. Vinculos `contacts.company_id -> companies.id`

- join read-only validou os 5 pares esperados;
- cardinalidade da empresa referenciada = `1` para todos;
- contatos orfaos: `0`;
- `company_contacts` continua ausente/reference-only (`to_regclass(...) = null`).

## 9. Validacao de idempotencia de `companies`

- indices presentes: `idx_companies_tenant_cnpj` e `idx_companies_cnpj_unique`;
- 5 chaves `(tenant_id, cnpj)` com cardinalidade `1`;
- sem duplicidade por chave natural;
- reexecucao esperada: `idempotent_noop` para as 5 empresas.

## 10. Validacao de idempotencia de `contacts`

- indice presente: `idx_contacts_tenant_company_email_unique`;
- 5 chaves `(tenant_id, company_id, email)` com cardinalidade `1`;
- sem duplicidade por chave natural;
- reexecucao esperada: `idempotent_noop` para os 5 contatos.

## 11. Validacao de delta da onda

- `companies`: before 22BL = `1`, atual = `5`, delta = `+4`;
- `contacts`: before 22BL = `1`, atual = `5`, delta = `+4`.

## 12. Validacao de delta acumulado

- `companies`: `0 -> 5`;
- `contacts`: `0 -> 5`.

## 13. Escopo negativo

Contagens atuais:

- `legal_entities=1`
- `product_types=13`
- `product_groups=22`
- `product_subgroups=54`
- `product_families=7`
- `product_classes=11`
- `companies=5`
- `contacts=5`
- `sales_reps=0`
- `user_tenants=0`
- `user_legal_entities=0`
- `user_sales_reps=0`
- `products=0`
- `deals=0`
- `orders=0`
- `order_items=0`
- `proposals=0`
- `audit_logs=0`
- `notifications=0`

## 14. Bloqueios do executor

Confirmado em `scripts/migration/phase-22k-r2-baseline-write.mjs`:

- hard stop de `companies` presente;
- hard stop de `contacts` presente;
- hard stop de `companies_contacts_wave` presente;
- limite `N=4` da onda presente;
- validacao de pares 02..05 presente;
- `company_contacts` reference-only presente;
- `sales_reps` bloqueada;
- `profiles` fora da primeira rodada executavel;
- sem execucao ampliada automatica;
- flags proibidas bloqueadas: `--force`, `--skip-guards`, `--tables`, `--all`;
- sem flag de bypass.

## 15. Evidencia JSON gerada

- `artifacts/migration/phase-22bm-r2-companies-contacts-wave-audit-and-commit/companies-contacts-wave-audit-20260627-230610.json`

## 16. Checagem de sensiveis

Checagem conservadora realizada nos arquivos da trilha 22BK-22BM e artefatos auxiliares relacionados:

- sem `.env`/`.env.*` no stage;
- sem dumps `.sql` sensiveis;
- sem ocorrencias de token/secret/senha/chaves privadas/credenciais.

## 17. Arquivos incluidos no commit

- docs: 22BK, 22BL, 22BM;
- executor: `scripts/migration/phase-22k-r2-baseline-write.mjs` (alteracao da 22BL auditada em 22BM);
- artefatos: 22BK, 22BL, 22BM;
- artefatos auxiliares gerados pelo executor na trilha de tentativas da 22BL:
  - `artifacts/migration/phase-22k-r2-baseline-write/preflight-*`
  - `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-*`
  - `artifacts/migration/phase-22q-r2-armed-write/before-*`

## 18. Commit criado

- commit local criado para consolidar 22BK-22BM:
  - `feat(migration): add companies contacts wave write`

## 19. Push executado ou nao

- push: **nao**.

## 20. Riscos restantes

- manter validacoes tolerantes aos triggers de uppercase em futuras reexecucoes idempotentes;
- qualquer ampliacao acima do lote congelado exige novo gate formal;
- limpeza de artefatos intermediarios deve seguir politica dedicada, fora desta fase.

## 21. Decisao final GO/PARCIAL/NO-GO

**GO**

## 22. Recomendacao da proxima fase

Executar a fase de push controlado do bloco 22BK-22BM sem nova escrita em banco e sem deploy.

## 23. Confirmacoes obrigatorias

- nova escrita em banco nesta fase: nao
- SQL de escrita executado nesta fase: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- push: nao
- staging/prod alterados: nao
- arquivos sensiveis commitados: nao
- executor alterado nesta fase: nao
- executor executou escrita ampliada: nao
