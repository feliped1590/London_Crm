# Fase 22BK-R2 - Gate de expansao controlada `companies + contacts` (sem escrita)

## 1. Objetivo

Definir uma onda pequena e segura para a proxima escrita controlada de `companies + contacts`, sem executar mutacao no banco nesta fase.

## 2. Escopo

- releitura de evidencias 22BE-22BI e contratos atuais;
- localizacao de candidatos adicionais no payload baseline;
- saneamento deterministico de candidatos (sem gravar);
- revalidacao read-only de schema, chaves e colisoes;
- selecao de micro-lote congelado e plano futuro de execucao;
- geracao de payload congelado e documentacao da fase.

## 3. Restricoes absolutas

- sem escrita em banco;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback/deploy;
- sem alteracao do executor;
- sem commit/push;
- sem acionar ERP/API/webhook/n8n/filas;
- sem tocar `sales_reps`, `profiles` ou `company_contacts` como alvo de escrita.

## 4. Estado atual

- branch: `main`
- ultimo commit: `e30df857 feat(migration): add companies and contacts pilot writes`
- `HEAD == origin/main`
- divergencia: `0 0`
- working tree limpa no inicio da fase.

## 5. Motivo da expansao controlada

Os pilotos unitarios de `companies` e `contacts` fecharam em `GO`; o proximo passo seguro e validar se existe micro-lote adicional com pares empresa/contato que preserve idempotencia e escopo negativo.

## 6. Resultado dos pilotos anteriores

- `companies` piloto: `GO`, 1 registro valido com chave `(tenant_id, cnpj)`.
- `contacts` piloto: `GO`, 1 registro valido com chave `(tenant_id, company_id, email)`.
- normalizacao por trigger confirmada:
  - `companies.name -> uppercase`
  - `contacts.first_name -> uppercase`.

## 7. Registros adicionais de `companies`

Candidatos encontrados no payload baseline:

- `TMP-22F-R2-COMPANY-02` (`TMP-DOC-COMP-0002`, owner `TMP-22F-R2-SALESREP-01`)
- `TMP-22F-R2-COMPANY-03` (`TMP-DOC-COMP-0003`, owner `TMP-22F-R2-SALESREP-02`)
- `TMP-22F-R2-COMPANY-04` (`TMP-DOC-COMP-0004`, owner `TMP-22F-R2-SALESREP-01`)
- `TMP-22F-R2-COMPANY-05` (`TMP-DOC-COMP-0005`, owner `TMP-22F-R2-SALESREP-02`)

Campos disponiveis no payload-base: `temp_key`, `document`, `owner`.  
Campos ausentes no payload-base (saneados nesta fase): `tenant_id`, `name`, `cnpj`, `source_document`.

## 8. Registros adicionais de `contacts`

Candidatos encontrados no payload baseline:

- `TMP-22F-R2-CONTACT-02` (`tmp.contact02@qualyvac.local`, company `TMP-22F-R2-COMPANY-02`)
- `TMP-22F-R2-CONTACT-03` (`tmp.contact03@qualyvac.local`, company `TMP-22F-R2-COMPANY-03`)
- `TMP-22F-R2-CONTACT-04` (`tmp.contact04@qualyvac.local`, company `TMP-22F-R2-COMPANY-04`)
- `TMP-22F-R2-CONTACT-05` (`tmp.contact05@qualyvac.local`, company `TMP-22F-R2-COMPANY-05`)

Campos disponiveis no payload-base: `temp_key`, `email`, `company_temp_key`.  
Campos ausentes no payload-base (saneados nesta fase): `tenant_id`, `first_name`, `company_id`.

## 9. Regras de saneamento de empresas

Regra deterministica aplicada para cada candidato `COMPANY-NN`:

- `tenant_id = 00000000-0000-0000-0000-000000000001`
- `name = TMP Company NN`
- `expected_persisted_name = TMP COMPANY NN`
- `cnpj = document`
- `source_document = document`
- `owner_temp_key = owner`
- `owner_write_policy = reference_only_not_written`
- `sales_rep_id_policy = omit_or_null`
- `legal_entity_id_policy = omit_or_null`
- `created_by_policy = omit_or_null`

## 10. Regras de saneamento de contatos

Regra deterministica aplicada para cada candidato `CONTACT-NN`:

- `tenant_id = 00000000-0000-0000-0000-000000000001`
- `first_name = TMP Contact NN`
- `expected_persisted_first_name = TMP CONTACT NN`
- `email = email do payload`
- `company_temp_key = company_temp_key do payload`
- `company_resolution_policy = lookup_after_company_insert`
- `write_after_company = true`

## 11. Revalidacao de schema/chaves

Read-only validado:

- `companies`:
  - indice `idx_companies_tenant_cnpj` presente (e `idx_companies_cnpj_unique`);
  - campos dependentes (`owner_id`, `sales_rep_id`, `legal_entity_id`, `created_by`) seguem nullable;
  - trigger `trg_uppercase_companies` presente;
  - estado atual: apenas 1 registro piloto.
- `contacts`:
  - indice `idx_contacts_tenant_company_email_unique` presente;
  - FK `contacts.company_id -> companies.id` presente;
  - `company_id`, `owner_id`, `created_by` seguem nullable;
  - trigger `trg_uppercase_contacts` presente;
  - estado atual: apenas 1 registro piloto.
- `company_contacts`: continua ausente/reference-only.

## 12. Onda selecionada

Limite selecionado: **4 pares** (maximo permitido da fase).

- empresas: `COMPANY-02..05`
- contatos: `CONTACT-02..05`

## 13. Pares empresa/contato

- `COMPANY-02 <-> CONTACT-02`
- `COMPANY-03 <-> CONTACT-03`
- `COMPANY-04 <-> CONTACT-04`
- `COMPANY-05 <-> CONTACT-05`

Todos com pareamento claro por `company_temp_key`.

## 14. Colisoes verificadas

Read-only:

- colisoes de `companies` por `(tenant_id, cnpj)` para `0002..0005`: **0** cada;
- colisoes globais por `cnpj` para `0002..0005`: **0** cada;
- colisoes de `contacts` por `email` para `contact02..05`: **0** cada.

## 15. Plano futuro de escrita

Plano proposto (nao executado nesta fase):

1. gerar before global da onda;
2. escrever empresas uma a uma;
3. apos cada empresa, resolver `company_id` por `(tenant_id, cnpj)` com cardinalidade 1;
4. escrever contato correspondente por `(tenant_id, company_id, email)`;
5. parar ao atingir o limite congelado;
6. gerar after global;
7. validar deltas `companies +N` e `contacts +N`;
8. hard stop final.

Politica de falha:

- falha de empresa -> nao escreve o contato correspondente;
- falha de contato -> parar onda e registrar parcial;
- sem rollback automatico.

## 16. Gate humano especifico

Autorizacao futura documentada:

`AUTORIZO A DÉCIMA ESCRITA CONTROLADA DA BASELINE 22BK-R2 SOMENTE EM companies E contacts, LIMITADA À ONDA CONGELADA, NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

## 17. Riscos restantes

- dependencia de contexto RLS no momento de escrita real;
- valores textuais sujeitos a uppercase por trigger exigem validacao tolerante no after;
- qualquer ampliacao alem da onda congelada exige novo gate.

## 18. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivo: ha 4 novos pares empresa/contato com saneamento deterministico, sem colisoes detectadas e com chaves de idempotencia preservadas.

## 19. Recomendacao da proxima fase

Abrir fase de preparacao da escrita controlada da onda congelada 22BK-R2 (`companies` antes de `contacts`), mantendo limite 4, evidencia before/after obrigatoria e hard stop final.

## 20. Confirmacoes obrigatorias

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
