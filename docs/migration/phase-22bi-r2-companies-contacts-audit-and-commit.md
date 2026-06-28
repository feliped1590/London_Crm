# Fase 22BI-R2 - Auditoria `companies + contacts` e commit do bloco 22BE-22BI

## 1. Objetivo

Fechar o ciclo piloto da frente `companies + contacts` com auditoria pos-piloto read-only, validacao de idempotencia e escopo negativo, e consolidacao do bloco 22BE-22BI em commit local.

## 2. Escopo

- auditoria read-only de `companies` e `contacts`;
- validacao de vinculo `contacts.company_id -> companies.id`;
- validacao de idempotencia por chave natural;
- validacao de deltas e escopo negativo;
- validacao de bloqueios do executor;
- checagem de sensiveis;
- geracao de evidencia JSON da fase;
- commit local sem push.

## 3. Restricoes absolutas

- sem nova escrita em banco;
- sem reexecucao de pilotos;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback/deploy;
- sem ERP/API/webhook/n8n/filas;
- sem alteracao de executor nesta fase;
- sem push.

## 4. Estado Git antes do commit

- branch: `main`
- ultimo commit: `4a8935cd feat(migration): add product families and classes pilot writes`
- `HEAD == origin/main`: verdadeiro
- divergencia: `0 0`
- pendencias: trilha 22BE-22BH e artefatos auxiliares da execucao controlada.

## 5. Resumo das fases 22BE-22BH

- **22BE-R2**: gate conjunto em `NO-GO` por mismatch payload/schema.
- **22BF-R2**: saneamento payload em `GO` para abrir pilotos controlados.
- **22BG-R2**: piloto real `companies` concluido com `GO` (registro unico por `(tenant_id, cnpj)`).
- **22BH-R2**: piloto real `contacts` concluido com `GO` (registro unico por `(tenant_id, company_id, email)`).

## 6. Auditoria de `companies`

- registro alvo encontrado por `id` e por `(tenant_id, cnpj)`;
- valores confirmados:
  - `id=9eb4ba07-d4d4-4b45-9902-39244d6ad52c`
  - `tenant_id=00000000-0000-0000-0000-000000000001`
  - `cnpj=TMP-DOC-COMP-0001`
  - `name=TMP COMPANY 01`
  - `cnpj_root=null`
  - `owner_id=null`, `sales_rep_id=null`, `legal_entity_id=null`, `created_by=null`
- cardinalidades:
  - `count(id)=1`
  - `count(tenant_id, cnpj)=1`
  - `count(name='TMP COMPANY 01')=1`

## 7. Auditoria de `contacts`

- registro alvo encontrado por `id` e por `(tenant_id, company_id, email)`;
- valores confirmados:
  - `id=06514c9c-24b8-49fd-b8e2-f744b24d307f`
  - `tenant_id=00000000-0000-0000-0000-000000000001`
  - `company_id=9eb4ba07-d4d4-4b45-9902-39244d6ad52c`
  - `first_name=TMP CONTACT 01`
  - `email=tmp.contact01@qualyvac.local`
  - `owner_id=null`, `created_by=null`
- cardinalidades:
  - `count(id)=1`
  - `count(tenant_id, company_id, email)=1`
  - `count(email='tmp.contact01@qualyvac.local')=1`

## 8. Vinculo `contacts.company_id -> companies.id`

- FK logica validada com join read-only;
- empresa referenciada existe com cardinalidade `1`;
- contato nao esta orfao;
- `to_regclass('public.company_contacts') = null` (continua reference-only/inexistente).

## 9. Validacao de idempotencia de `companies`

- indice/chave continua disponivel: `idx_companies_tenant_cnpj` (+ indice unico em `cnpj`);
- cardinalidade da chave `(tenant_id, cnpj)` = `1`;
- duplicidade de chave = `0`;
- reexecucao esperada: `idempotent_noop`.

## 10. Validacao de idempotencia de `contacts`

- indice/chave continua disponivel: `idx_contacts_tenant_company_email_unique`;
- cardinalidade da chave `(tenant_id, company_id, email)` = `1`;
- duplicidade de chave = `0`;
- reexecucao esperada: `idempotent_noop`.

## 11. Validacao de delta

- `companies`: before 22BG = `0`, atual = `1`, delta liquido = `+1`;
- `contacts`: before 22BH = `0`, atual = `1`, delta liquido = `+1`.

## 12. Escopo negativo

Contagens atuais validadas:

- `legal_entities=1`
- `product_types=13`
- `product_groups=22`
- `product_subgroups=54`
- `product_families=7`
- `product_classes=11`
- `companies=1`
- `contacts=1`
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

## 13. Bloqueios do executor

Confirmado em `scripts/migration/phase-22k-r2-baseline-write.mjs`:

- hard stop de `companies` presente;
- hard stop de `contacts` presente;
- `company_contacts` permanece reference-only;
- `salesRepsBlocked=true`;
- `profiles` permanece excluido da primeira rodada executavel;
- sem execucao ampliada automatica;
- flags proibidas bloqueadas: `--force`, `--skip-guards`, `--tables`, `--all`;
- sem flag de bypass adicional.

## 14. Evidencia JSON gerada

- `artifacts/migration/phase-22bi-r2-companies-contacts-audit-and-commit/companies-contacts-audit-20260627-222114.json`

## 15. Checagem de sensiveis

Checagem conservadora executada nos arquivos da trilha 22BE-22BI:

- nenhum `.env`/`.env.*` incluido no stage da trilha;
- nenhum dump `.sql` da trilha;
- sem ocorrencias de token/secret/senha/chave privada nos arquivos da trilha.

## 16. Arquivos incluidos no commit

- documentos: 22BE, 22BF, 22BG, 22BH e 22BI;
- executor consolidado: `scripts/migration/phase-22k-r2-baseline-write.mjs`;
- artefatos: 22BE, 22BF, 22BG, 22BH, 22BI;
- artefatos auxiliares do executor ligados ao bloco 22BG/22BH.

## 17. Commit criado

- commit local do bloco 22BE-22BI com mensagem:
  - `feat(migration): add companies and contacts pilot writes`

## 18. Push executado ou nao

- push: **nao** (somente commit local nesta fase).

## 19. Riscos restantes

- normalizacao por trigger em `name` e `first_name` deve permanecer contemplada nas validacoes idempotentes;
- ampliacao para lote maior de `contacts` exige novo gate de escopo e trilha de evidencias dedicada.

## 20. Decisao final GO/PARCIAL/NO-GO

**GO**

## 21. Recomendacao da proxima fase

Abrir fase de push controlado do marco 22BE-22BI (sem nova escrita no banco) e preparar gate da proxima onda funcional mantendo idempotencia e escopo negativo.

## 22. Confirmacoes obrigatorias

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
