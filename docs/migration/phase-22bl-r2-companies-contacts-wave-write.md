# Fase 22BL-R2 - Escrita controlada da onda congelada `companies + contacts` (N=4)

## 1. Objetivo

Executar a primeira expansao controlada da frente `companies + contacts`, limitada a 4 pares congelados da 22BK-R2, com evidencias globais `before/after`, idempotencia por chave natural e hard stop final obrigatorio.

## 2. Escopo permitido

- escrita somente em `companies` e `contacts`;
- limite maximo de `4` novas empresas e `4` novos contatos;
- execucao par a par (empresa -> resolve `company_id` -> contato);
- validacao de idempotencia, vinculo e escopo negativo;
- geracao de artefatos globais da fase.

## 3. Escopo proibido

- escrita em tabelas fora de `companies`/`contacts`;
- escrita em `company_contacts`, `sales_reps`, `products`, transacionais, filas e integracoes externas;
- rollback automatico;
- migration/seed/cleanup/deploy;
- commit/push.

## 4. Payload congelado usado

- `artifacts/migration/phase-22bk-r2-companies-contacts-expansion-gate/companies-contacts-expansion-payload-20260627-223027.json`
- autorizacao especifica validada:
  - `AUTORIZO A DÉCIMA ESCRITA CONTROLADA DA BASELINE 22BK-R2 SOMENTE EM companies E contacts, LIMITADA À ONDA CONGELADA, NO RESTORE-TEST nsnmlleplpzsefzkuxlb`
- pares executados:
  - `TMP-22F-R2-COMPANY-02` -> `TMP-22F-R2-CONTACT-02`
  - `TMP-22F-R2-COMPANY-03` -> `TMP-22F-R2-CONTACT-03`
  - `TMP-22F-R2-COMPANY-04` -> `TMP-22F-R2-CONTACT-04`
  - `TMP-22F-R2-COMPANY-05` -> `TMP-22F-R2-CONTACT-05`

## 5. Alteracoes feitas no executor

Arquivo alterado: `scripts/migration/phase-22k-r2-baseline-write.mjs`.

Mudancas aplicadas de forma minima e restritas ao fluxo da onda:

- novo modo de piloto: `--pilot-entity companies_contacts_wave`;
- nova autorizacao exata para 22BL-R2;
- nova funcao dedicada `executeCompaniesContactsWaveWrite()` com:
  - validacao estrita de target, batch e autorizacao;
  - validacao do payload congelado da 22BK-R2;
  - validacao de limite `N=4`, pares 02..05 e `tenant_id` fixo;
  - validacao de politicas de campos omitidos (`owner_id`, `sales_rep_id`, `legal_entity_id`, `created_by`);
  - validacao de `company_contacts` como reference-only;
  - validacao de idempotencia (`companies`: `(tenant_id, cnpj)`; `contacts`: `(tenant_id, company_id, email)`);
  - execucao par a par com tratamento `inserted`/`idempotent_noop`/abort em divergencia;
  - sem rollback automatico.
- trilha de evidencia dedicada da fase 22BL:
  - `artifacts/migration/phase-22bl-r2-companies-contacts-wave-write/`
- hard stop final exato:
  - `ESCRITA CONTROLADA CONCLUÍDA SOMENTE EM companies E contacts, LIMITADA À ONDA 22BK-R2. EXECUÇÃO AMPLIADA BLOQUEADA.`

## 6. Before global gerado

- `artifacts/migration/phase-22bl-r2-companies-contacts-wave-write/before-20260627-225537.json`
- `beforeDecision: GO`

## 7. Operacao executada por par

- Par 02: `companies=inserted`, `contacts=inserted`
- Par 03: `companies=inserted`, `contacts=inserted`
- Par 04: `companies=inserted`, `contacts=inserted`
- Par 05: `companies=inserted`, `contacts=inserted`

## 8. After global gerado

- `artifacts/migration/phase-22bl-r2-companies-contacts-wave-write/after-20260627-225537.json`
- `afterDecision: GO`

## 9. Delta de `companies`

- antes: `1`
- depois: `5`
- delta: `+4`

## 10. Delta de `contacts`

- antes: `1`
- depois: `5`
- delta: `+4`

## 11. IDs criados/encontrados

Empresas:

- `TMP-22F-R2-COMPANY-02` -> `feee1c46-cb1e-4d65-a6c7-a309b187d3b7`
- `TMP-22F-R2-COMPANY-03` -> `c4db0477-f726-4395-86e7-23e2fc102ba9`
- `TMP-22F-R2-COMPANY-04` -> `76cc5c3d-ae91-46e9-93eb-8fe63467f323`
- `TMP-22F-R2-COMPANY-05` -> `151971d7-1aa6-43b8-859c-4d570c3282d0`

Contatos:

- `TMP-22F-R2-CONTACT-02` -> `a58db009-4425-4c56-8b7b-1659d16b9dd4`
- `TMP-22F-R2-CONTACT-03` -> `a6f4298a-ad69-4e42-bf3d-2613030d7e55`
- `TMP-22F-R2-CONTACT-04` -> `5af76ebf-202c-4096-aff9-468a60e7da72`
- `TMP-22F-R2-CONTACT-05` -> `5c7e7c16-9298-4322-8967-a8f7ff68e944`

## 12. Validacao de idempotencia

- `companies` por `(tenant_id, cnpj)`: cardinalidade `1` para `0002..0005`;
- `contacts` por `(tenant_id, company_id, email)`: cardinalidade `1` para `contact02..05`;
- sem duplicidade detectada.

## 13. Validacao de vinculos

- todos os contatos 02..05 vinculados a `company_id` resolvido com cardinalidade `1`;
- sem contato orfao;
- `linksValidation` da evidencia `after` em `true` para os 4 pares.

## 14. Confirmacao de que `company_contacts` nao foi escrito

- `to_regclass('public.company_contacts') = null` antes/depois;
- continua reference-only/inexistente.

## 15. Escopo negativo

Contagens read-only mantidas:

- `sales_reps=0`
- `products=0`
- `deals=0`
- `orders=0`
- `proposals=0`

Sem sinais de escrita fora de `companies`/`contacts`.

## 16. Hard stop final

Mensagem emitida ao final:

`ESCRITA CONTROLADA CONCLUÍDA SOMENTE EM companies E contacts, LIMITADA À ONDA 22BK-R2. EXECUÇÃO AMPLIADA BLOQUEADA.`

## 17. Riscos restantes

- dependencia de trigger de uppercase continua exigindo validacao tolerante (ja contemplada);
- proximas ondas exigem novo gate humano e novo payload congelado;
- reexecucoes futuras devem observar idempotencia e escopo negativo com a mesma trilha de evidencias.

## 18. Decisao final GO/PARCIAL/NO-GO

**GO**

## 19. Recomendacao da proxima fase

Abrir fase de auditoria pos-onda 22BL-R2 (read-only), com foco em consistencia final, idempotencia de reexecucao controlada (`idempotent_noop`) e gate formal para eventual nova expansao.

## 20. Confirmacoes obrigatorias

- nova escrita em banco: sim
- tabelas escritas: `companies`, `contacts`
- quantidade de empresas criadas: 4
- quantidade de contatos criados: 4
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
- insert/update/upsert/delete fora de `companies`/`contacts`: nao
- `company_contacts` escrito: nao
- RPC de escrita executada: nao
- executor executou escrita ampliada: nao
