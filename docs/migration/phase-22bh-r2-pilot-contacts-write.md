# Fase 22BH-R2 - Escrita real piloto `contacts` (escopo unico)

## 1. Objetivo

Executar escrita real piloto de somente 1 registro em `public.contacts`, com resolucao deterministica de `company_id` por lookup em `companies` via `(tenant_id, cnpj)`, mantendo hard stop obrigatorio.

## 2. Escopo permitido

- validacoes read-only de schema, FK, indice e cardinalidade;
- alteracao minima de `scripts/migration/phase-22k-r2-baseline-write.mjs` para modo piloto de `contacts`;
- escrita piloto controlada apenas em `public.contacts`;
- geracao de `before` e `after` da 22BH-R2;
- validacoes pos-escrita somente read-only.

## 3. Escopo proibido

- sem escrita em `companies`, `company_contacts`, `sales_reps`, `profiles`, `user_*`, `products` e transacionais;
- sem migration/seed/cleanup/rollback/deploy;
- sem ERP/API/webhook/n8n/filas;
- sem commit/push;
- sem execucao ampliada apos o piloto.

## 4. Motivo da escrita piloto de `contacts`

Com a empresa piloto da 22BG-R2 existente e validada por cardinalidade 1 em `(tenant_id, cnpj)`, a 22BH-R2 fecha a dependencia de `company_id` para o primeiro contato minimo com idempotencia relacional.

## 5. Payload saneado usado

Origem: `artifacts/migration/phase-22bf-r2-companies-contacts-payload-sanitization/companies-contacts-sanitized-payload-20260627-212651.json`.

Campos efetivamente permitidos para insert:

- `tenant_id = 00000000-0000-0000-0000-000000000001`
- `company_id = 9eb4ba07-d4d4-4b45-9902-39244d6ad52c` (resolvido por lookup deterministico)
- `first_name = TMP Contact 01`
- `email = tmp.contact01@qualyvac.local`

## 6. Resolucao de `company_id`

Lookup read-only aplicado:

- `tenant_id = 00000000-0000-0000-0000-000000000001`
- `cnpj = TMP-DOC-COMP-0001`

Resultado:

- cardinalidade = `1`
- `id = 9eb4ba07-d4d4-4b45-9902-39244d6ad52c`
- `name = TMP COMPANY 01`
- `owner_id = null`, `sales_rep_id = null`, `legal_entity_id = null`

## 7. Alteracoes feitas no executor

Arquivo alterado: `scripts/migration/phase-22k-r2-baseline-write.mjs`.

Alteracoes de guard rail para `contacts`:

- inclusao de `contacts` em `ALLOWED_PILOT_ENTITIES`;
- nova autorizacao piloto:
  - `AUTORIZO A NONA ESCRITA PILOTO DA BASELINE 22BH-R2 SOMENTE EM contacts NO RESTORE-TEST nsnmlleplpzsefzkuxlb`;
- novo contrato `EXPECTED_CONTACTS_PILOT_PAYLOAD`;
- nova funcao `executeContactsPilotWrite()` com:
  - validacao de target/batch/autorizacao;
  - validacao do payload saneado;
  - lookup deterministico de empresa por `(tenant_id, cnpj)` com cardinalidade obrigatoria 1;
  - validacao de `company_id` congelado;
  - idempotencia em `(tenant_id, company_id, email)` (`inserted`/`idempotent_noop`/abort em divergencia);
  - bloqueio explicito de escrita em `companies` e `company_contacts`;
- nova trilha de evidencias da 22BH em `artifacts/migration/phase-22bh-r2-pilot-contacts-write/`;
- novo hard stop final de `contacts`.

## 8. Before gerado

- `artifacts/migration/phase-22bh-r2-pilot-contacts-write/before-20260627-221252.json`

## 9. Operacao executada

Comando executado:

`node scripts/migration/phase-22k-r2-baseline-write.mjs --expected-target nsnmlleplpzsefzkuxlb --batch baseline_22f_r2_restore_test_qualyvac --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" --pilot-authorization "AUTORIZO A NONA ESCRITA PILOTO DA BASELINE 22BH-R2 SOMENTE EM contacts NO RESTORE-TEST nsnmlleplpzsefzkuxlb" --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-205752.json --pilot-payload artifacts/migration/phase-22bf-r2-companies-contacts-payload-sanitization/companies-contacts-sanitized-payload-20260627-212651.json --pilot-entity contacts --execute-pilot-write --write`

Resultado:

- `operation=inserted`

## 10. After gerado

- `artifacts/migration/phase-22bh-r2-pilot-contacts-write/after-20260627-221252.json`

## 11. Delta

- `+1` em `contacts`.

## 12. Registro criado/encontrado

- `id = 06514c9c-24b8-49fd-b8e2-f744b24d307f`
- `tenant_id = 00000000-0000-0000-0000-000000000001`
- `company_id = 9eb4ba07-d4d4-4b45-9902-39244d6ad52c`
- `first_name = TMP CONTACT 01` (normalizado por trigger `trg_uppercase_contacts`)
- `email = tmp.contact01@qualyvac.local`

## 13. Chave de idempotencia

- chave: `(tenant_id, company_id, email)`
- cardinalidade pos-piloto: `1` (sem duplicidade)

## 14. Campos gravados

- `tenant_id`
- `company_id`
- `first_name`
- `email`

## 15. Campos omitidos

Confirmados como nao gravados (`null` no registro piloto):

- `owner_id`
- `created_by`

## 16. Confirmacao de que `companies` nao foi escrita

- `companiesCountBefore = 1`
- `companiesCountAfter = 1`
- empresa referenciada permanece inalterada em campos chave (`cnpj`, `name`, FKs opcionais nulas).

## 17. Confirmacao de que `company_contacts` nao foi escrita

- `to_regclass('public.company_contacts') = null`
- tabela permanece inexistente/reference-only.

## 18. Hard stop final

Mensagem emitida:

`ESCRITA PILOTO CONCLUÍDA SOMENTE EM contacts. EXECUÇÃO AMPLIADA BLOQUEADA.`

## 19. Validacoes pos-escrita

Validacoes read-only executadas:

- busca por `(tenant_id, company_id, email)` retornou 1 registro;
- `duplicate_count=1` para a chave de idempotencia (sem duplicidade);
- `first_name` validado com normalizacao em caixa alta por trigger;
- `companies` sem alteracao de contagem;
- `company_contacts` inexistente;
- contagens de guarda sem evidencia de escrita fora do escopo permitido.

## 20. Riscos restantes

- trigger de uppercase em `contacts` altera `first_name` para caixa alta;
- entidades relacionais nao liberadas (`sales_reps`, `profiles`, `company_contacts`) continuam dependencias para ondas posteriores;
- qualquer ampliacao para carga multipla exige novo gate de escopo e evidencias dedicadas.

## 21. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- before e after com decisao `GO`;
- escrita confinada a `contacts`;
- delta controlado (`+1`);
- idempotencia tecnica fechada por chave relacional;
- escopo negativo preservado com hard stop obrigatorio.

## 22. Recomendacao da proxima fase

Executar auditoria pos-piloto especifica da 22BH-R2 com reexecucao idempotente controlada (`idempotent_noop`) e gate formal para definir se a proxima onda avanca para lote minimo de `contacts` ou abre nova entidade auxiliar.

## 23. Confirmacoes obrigatorias

- nova escrita em banco: sim
- tabela escrita: `contacts`
- quantidade de registros criados: 1
- SQL manual executado: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- commit: nao
- push: nao
- staging/prod alterados: nao
- insert/update/upsert/delete fora de `contacts`: nao
- `companies` escrito nesta fase: nao
- `company_contacts` escrito: nao
- RPC de escrita executada: nao
- executor executou escrita ampliada: nao
