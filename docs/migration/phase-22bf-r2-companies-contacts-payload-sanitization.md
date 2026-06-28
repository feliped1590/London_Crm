# Fase 22BF-R2 - Saneamento de payload `companies + contacts` (sem escrita)

## 1. Objetivo

Produzir payload saneado, tecnicamente gravavel e auditavel para piloto minimo de `companies` e preparo de `contacts`, sem executar qualquer escrita.

## 2. Escopo

- pre-check Git;
- releitura das evidencias obrigatorias da 22BE-R2 e insumos de baseline;
- validacoes read-only de schema/constraints/FKs/triggers/RLS;
- decisao tecnica sobre viabilidade de `companies.cnpj`;
- definicao de payload saneado oficial (1 company + 1 contact preparado);
- definicao de politicas de omissao e idempotencia;
- geracao de artefato JSON e documentacao da fase.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem SQL de escrita, sem RPC de escrita;
- sem migration/seed/cleanup/rollback;
- sem alteracao de executor;
- sem alteracao de `BASELINE_SIMULATION` e `latest.json`;
- sem commit/push;
- sem ERP/API/webhook/n8n/filas/deploy.

## 4. Estado atual

- branch: `main`;
- divergencia: `0 0`;
- ultimo commit: `4a8935cd feat(migration): add product families and classes pilot writes`;
- `HEAD == origin/main`: verdadeiro;
- pendencias no inicio da fase: apenas arquivos da 22BE-R2.

## 5. Motivo do saneamento

A 22BE-R2 fechou `NO-GO` por incompatibilidade payload/schema (nao por problema de banco ou executor), exigindo fechamento de campos obrigatorios e chave idempotente operacional.

## 6. Achados da 22BE

- `companies`: sem `name`, sem `tenant_id`, sem `cnpj`, sem chave natural operacional;
- `contacts`: sem `first_name`, sem `tenant_id`, sem `company_id` resolvido;
- dependencia de `owner/sales_reps` nao pode ser usada nesta onda;
- `company_contacts` inexistente e classificada como `reference-only`.

## 7. Validacao tecnica de `companies`

Validacoes read-only executadas:

- `name` (`text`) e `tenant_id` (`uuid`) sao obrigatorios (`NOT NULL`);
- `tenant_id` possui default `'00000000-0000-0000-0000-000000000001'::uuid`;
- `cnpj` e `text` nullable;
- `owner_id`, `sales_rep_id`, `legal_entity_id`, `created_by` sao nullable;
- tenant piloto `00000000-0000-0000-0000-000000000001` existe (`count=1`);
- colisoes atuais: `name='TMP Company 01'` = 0, `cnpj='TMP-DOC-COMP-0001'` = 0;
- campos alternativos: `erp_code` existe; `external_id`, `document`, `tax_id`, `metadata` nao existem;
- indices uteis: `idx_companies_cnpj_unique`, `idx_companies_tenant_cnpj`, `idx_companies_tenant_erp_code`.

## 8. Validacao tecnica de `contacts`

Validacoes read-only executadas:

- `first_name` (`text`) e `tenant_id` (`uuid`) sao obrigatorios (`NOT NULL`);
- `email` e `text` nullable;
- `company_id` e nullable e FK para `companies(id)`;
- `tenant_id` piloto existe;
- colisoes atuais: `email='tmp.contact01@qualyvac.local'` = 0;
- indice de idempotencia tecnica: `idx_contacts_tenant_company_email_unique`;
- nenhum check constraint de formato de email foi encontrado.

## 9. Decisao sobre `cnpj`

Decisao: **GO** para uso tecnico de `cnpj='TMP-DOC-COMP-0001'` neste piloto saneado.

Justificativa tecnica:

- `companies.cnpj` e `text`;
- nao foi encontrado check constraint impondo formato numerico no proprio `cnpj`;
- trigger `set_company_cnpj_root` apenas normaliza digitos para `cnpj_root` e nao bloqueia `cnpj` sintetico;
- sem colisoes atuais para o valor candidato.

Guard rail:

- nao inventar CNPJ real;
- manter valor sintetico rastreavel por `source_document`.

## 10. Payload saneado de `companies`

```json
{
  "source": "baseline_simulation_22g_r2_sanitized",
  "temp_key": "TMP-22F-R2-COMPANY-01",
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "name": "TMP Company 01",
  "cnpj": "TMP-DOC-COMP-0001",
  "source_document": "TMP-DOC-COMP-0001",
  "owner_temp_key": "TMP-22F-R2-SALESREP-01",
  "owner_write_policy": "reference_only_not_written",
  "legal_entity_id_policy": "omit_or_null",
  "sales_rep_id_policy": "omit_or_null",
  "created_by_policy": "omit_or_null"
}
```

## 11. Payload saneado de `contacts`

```json
{
  "source": "baseline_simulation_22g_r2_sanitized",
  "temp_key": "TMP-22F-R2-CONTACT-01",
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "first_name": "TMP Contact 01",
  "email": "tmp.contact01@qualyvac.local",
  "company_temp_key": "TMP-22F-R2-COMPANY-01",
  "company_resolution_policy": "defer_until_company_exists",
  "company_id_policy": "lookup_after_company_insert",
  "write_contact_in_same_phase": false
}
```

## 12. Politica de owner/sales_rep

- `owner_temp_key` mantido apenas como referencia de rastreabilidade;
- nao escrever `owner_id`;
- nao escrever `sales_rep_id` nesta onda, pois trilha `sales_reps` segue pausada para dependencia operacional.

## 13. Politica de legal_entity

- `legal_entity_id` deve permanecer omitido ou `null` enquanto nao houver resolucao deterministica com cardinalidade 1.

## 14. Politica de created_by

- `created_by` deve permanecer omitido ou `null` no piloto tecnico.

## 15. Regra de idempotencia de `companies`

Primaria:

- `(tenant_id, cnpj)`.

Fallback:

- `(tenant_id, erp_code)` apenas se `erp_code` vier preenchido e com cardinalidade 1.

Regra operacional:

- inexistente -> `insert`;
- existente aderente -> `idempotent_noop`;
- existente divergente -> `NO-GO`;
- sem overwrite/upsert destrutivo/delete.

## 16. Regra de idempotencia de `contacts`

Primaria futura:

- `(tenant_id, company_id, email)`.

Dependencia obrigatoria:

- resolver `company_id` somente apos insercao da empresa;
- se lookup de empresa nao retornar cardinalidade 1, `NO-GO`.

## 17. Ordem segura de escrita

1. `companies`
2. `contacts`

Observacao:

- contato fica apenas preparado nesta fase e nao liberado para escrita simultanea.

## 18. Riscos restantes

- contexto de RLS pode impor requisitos de sessao na fase real de escrita;
- contato permanece bloqueado ate resolver `company_id` com cardinalidade 1;
- mudancas futuras em triggers de normalizacao de `cnpj` exigem revalidacao.

## 19. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- payload saneado de empresa ficou tecnicamente gravavel;
- `tenant_id` existe e campos obrigatorios foram fechados;
- chave primaria de idempotencia de empresa ficou fechada;
- payload de contato ficou preparado com dependencia explicitamente controlada;
- nenhuma escrita foi executada e executor nao foi alterado.

## 20. Recomendacao da proxima fase

Executar gate especifico para piloto real de `companies` usando o payload saneado desta fase e manter `contacts` como etapa posterior, liberando contato apenas apos empresa existir e `company_id` ser resolvido por lookup deterministico.

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
