# Fase 22BG-R2 - Escrita real piloto `companies` (escopo unico)

## 1. Objetivo

Executar escrita real piloto de somente 1 registro em `public.companies`, com hard stop obrigatorio e sem escrita em outras entidades.

## 2. Escopo permitido

- validacoes read-only de gate tecnico;
- alteracao minima de `scripts/migration/phase-22k-r2-baseline-write.mjs`;
- escrita piloto controlada apenas em `public.companies`;
- geracao de `before` e `after` da 22BG-R2;
- validacoes pos-escrita somente read-only.

## 3. Escopo proibido

- sem escrita em `contacts`, `company_contacts`, `sales_reps`, `profiles`, `products`, transacionais e filas;
- sem migration/seed/cleanup/rollback/deploy;
- sem ERP/API/webhook/n8n;
- sem commit/push;
- sem execucao ampliada apos piloto.

## 4. Motivo da escrita piloto de `companies`

A 22BF-R2 fechou payload saneado em `GO` para `companies`, com idempotencia definida em `(tenant_id, cnpj)` e politicas explicitas de omissao para campos dependentes.

## 5. Payload saneado usado

Origem: `artifacts/migration/phase-22bf-r2-companies-contacts-payload-sanitization/companies-contacts-sanitized-payload-20260627-212651.json`.

Campos efetivamente permitidos para insert:

- `tenant_id = 00000000-0000-0000-0000-000000000001`
- `name = TMP Company 01`
- `cnpj = TMP-DOC-COMP-0001`

## 6. Alteracoes feitas no executor

Arquivo alterado: `scripts/migration/phase-22k-r2-baseline-write.mjs`.

Alteracoes de guard rail para `companies`:

- inclusao de `companies` em `ALLOWED_PILOT_ENTITIES`;
- nova autorizacao piloto:
  - `AUTORIZO A OITAVA ESCRITA PILOTO DA BASELINE 22BG-R2 SOMENTE EM companies NO RESTORE-TEST nsnmlleplpzsefzkuxlb`;
- novo contrato `EXPECTED_COMPANIES_PILOT_PAYLOAD`;
- nova funcao `executeCompaniesPilotWrite()` com validacoes de target, batch, payload, politicas de omissao, idempotencia e escopo;
- nova trilha de `before`/`after` em `artifacts/migration/phase-22bg-r2-pilot-companies-write/`;
- novo hard stop final de `companies`.

## 7. Before gerado

Before mais recente aplicado:

- `artifacts/migration/phase-22bg-r2-pilot-companies-write/before-20260627-220034.json`

Conteudo-chave validado:

- autorizacao geral e piloto: validas;
- tenant piloto existente (cardinalidade 1);
- lookup `(tenant_id, cnpj)` presente e unico;
- indice unico parcial `(tenant_id, cnpj)` presente;
- `company_contacts` continua `null` em `to_regclass`;
- `contacts` mantido bloqueado.

## 8. Operacao executada

Comando executado:

`node scripts/migration/phase-22k-r2-baseline-write.mjs --expected-target nsnmlleplpzsefzkuxlb --batch baseline_22f_r2_restore_test_qualyvac --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" --pilot-authorization "AUTORIZO A OITAVA ESCRITA PILOTO DA BASELINE 22BG-R2 SOMENTE EM companies NO RESTORE-TEST nsnmlleplpzsefzkuxlb" --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-205752.json --pilot-payload artifacts/migration/phase-22bf-r2-companies-contacts-payload-sanitization/companies-contacts-sanitized-payload-20260627-212651.json --pilot-entity companies --execute-pilot-write --write`

Historico de execucao:

- primeira execucao: `operation=inserted`, `delta=1`, mas `afterDecision=NO-GO` por mismatch de caixa em `name` causado por trigger de uppercase;
- segunda execucao (apos ajuste de validacao para aceitar normalizacao por trigger): `operation=idempotent_noop`, `afterDecision=GO`.

## 9. After gerado

After mais recente aplicado:

- `artifacts/migration/phase-22bg-r2-pilot-companies-write/after-20260627-220034.json`

## 10. Delta

- primeira execucao: `+1` em `companies` (registro piloto criado);
- reexecucao idempotente: `0` (sem nova criacao).

## 11. Registro criado/encontrado

- `id = 9eb4ba07-d4d4-4b45-9902-39244d6ad52c`
- `tenant_id = 00000000-0000-0000-0000-000000000001`
- `name = TMP COMPANY 01` (normalizado por trigger `trg_uppercase_companies`)
- `cnpj = TMP-DOC-COMP-0001`
- `cnpj_root = null`

## 12. Chave de idempotencia

- chave: `(tenant_id, cnpj)`
- duplicidade pos-piloto: `1` (cardinalidade correta).

## 13. Campos gravados

- `tenant_id`
- `name`
- `cnpj`

## 14. Campos omitidos

Confirmados como nao gravados (null):

- `owner_id`
- `sales_rep_id`
- `legal_entity_id`
- `created_by`

## 15. Confirmacao de que `contacts` nao foi escrito

- `contacts_count = 0` antes e depois;
- nenhuma operacao de escrita em `contacts` foi executada.

## 16. Confirmacao de que `company_contacts` nao foi escrito

- `to_regclass('public.company_contacts') = null`;
- tabela permanece inexistente/reference-only.

## 17. Hard stop final

Mensagem final emitida:

`ESCRITA PILOTO CONCLUÍDA SOMENTE EM companies. EXECUÇÃO AMPLIADA BLOQUEADA.`

## 18. Validacoes pos-escrita

Validacoes read-only executadas:

- busca por `(tenant_id, cnpj)` retornou 1 registro;
- obrigatorios e chave idempotente mantidos;
- campos dependentes nulos;
- `contacts=0`;
- `company_contacts` inexistente;
- contagens de guarda sem sinal de escrita em entidades proibidas.

## 19. Riscos restantes

- trigger de uppercase altera o valor textual de `name` para caixa alta;
- `contacts` continua dependente de resolucao deterministicamente segura de `company_id`;
- RLS continua fator operacional para a fase futura de contato.

## 20. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- escrita restrita a `companies`;
- no maximo 1 registro criado no piloto;
- idempotencia comprovada em reexecucao (`idempotent_noop`);
- escopo negativo preservado;
- hard stop final aplicado.

## 21. Recomendacao da proxima fase

Abrir fase de preparacao/execucao piloto de `contacts` somente com regra de lookup de `company_id` por cardinalidade 1 a partir da empresa ja criada, mantendo os mesmos guard rails de escopo unico.

## 22. Confirmacoes obrigatorias

- nova escrita em banco: sim
- tabela escrita: `companies`
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
- insert/update/upsert/delete fora de `companies`: nao
- `contacts` escrito: nao
- `company_contacts` escrito: nao
- RPC de escrita executada: nao
- executor executou escrita ampliada: nao
