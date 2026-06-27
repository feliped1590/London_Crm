# Fase 22AF-R2 — Escrita real piloto `product_types`, escopo unico e parada obrigatoria

## 1. Objetivo

Executar a escrita real piloto de somente 1 registro em `public.product_types`, usando payload congelado 22AD-R2 e mantendo bloqueio de execucao ampliada.

## 2. Escopo permitido

- validacoes read-only de target/batch/autorizacoes/payload/schema/colisao;
- escrita real somente em `public.product_types`;
- somente para payload:
  - `value=TMP-PT-001`
  - `label=TMP Product Type`
  - `tenant_id=null`
- geracao de evidencias before/after;
- parada obrigatoria apos o piloto.

## 3. Escopo proibido

- escrita em qualquer tabela diferente de `product_types`;
- escrita em `legal_entities`, `sales_reps`, `profiles`, `user_tenants`, `user_legal_entities`, `user_sales_reps`, `companies`, `contacts`, `products`, `company_contacts`;
- escrita em transacionais (`deals`, `orders`, `proposals`);
- filas, ERP/API/webhook/n8n, migration, seed, cleanup, rollback, deploy;
- uso de `--force`, `--skip-guards`, `--tables`, `--all`;
- commit/push.

## 4. Alteracoes feitas no executor

Arquivo alterado: `scripts/migration/phase-22k-r2-baseline-write.mjs`.

Alteracoes da 22AF-R2:

- implementada funcao `executeProductTypesPilotWrite()` para escrita real controlada de `product_types`;
- validacao de idempotencia por `value` sem `upsert` automatico;
- regra de divergencia: se existir `value` com payload diferente, aborta com `NO-GO`;
- criado fluxo 22AF com `before` e `after` obrigatorios em `artifacts/migration/phase-22af-r2-pilot-product-types-write/`;
- hard stop final com mensagem:
  - `ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_types. EXECUÇÃO AMPLIADA BLOQUEADA.`

## 5. Payload usado

Origem: `artifacts/migration/phase-22ad-r2-product-types-pilot-prep/product-types-payload-20260627-180436.json`

Payload aplicado:

- `value`: `TMP-PT-001`
- `label`: `TMP Product Type`
- `tenant_id`: `null`
- `temp_key`: `TMP-22F-R2-PRODTYPE-01`

## 6. Before gerado

- `artifacts/migration/phase-22af-r2-pilot-product-types-write/before-20260627-181728.json`

Conteudo chave:

- target/batch/autorizacoes: validos;
- contagem `product_types` antes: `12`;
- lookup por `value`: vazio (nao existia);
- lookup por `label`: `0`;
- `UNIQUE(value)`: validado;
- `beforeDecision`: `GO`.

## 7. Operacao executada

Operacao real executada:

- `inserted`
- tabela: `public.product_types`
- campos escritos:
  - `value`
  - `label`
  - `tenant_id`

Sem escrita em qualquer outra entidade.

## 8. After gerado

- `artifacts/migration/phase-22af-r2-pilot-product-types-write/after-20260627-181728.json`

## 9. Delta

- antes: `12`
- depois: `13`
- delta: `+1`

## 10. Registro criado/encontrado

- `id`: `522d0e75-641f-4161-bd41-94ebd50e8158`
- `value`: `TMP-PT-001`
- `label`: `TMP Product Type`
- `tenant_id`: `null`
- duplicidade por `value`: `1` (esperado: exatamente 1 registro)

## 11. Hard stop final

Mensagem emitida:

- `ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_types. EXECUÇÃO AMPLIADA BLOQUEADA.`

Execucao ampliada permaneceu bloqueada.

## 12. Validacoes pos-escrita

Read-only validado:

- `product_types.total_rows = 13`;
- `value='TMP-PT-001'` presente com contagem `1`;
- `label='TMP Product Type'` presente com contagem `1`;
- `tenant_id IS NULL` confirmado no registro piloto;
- `legal_entities=1` (sem novo toque);
- `sales_reps=0`, `user_tenants=0`, `user_legal_entities=0`, `user_sales_reps=0`;
- `companies=0`, `contacts=0`, `products=0`;
- `deals=0`, `orders=0`, `proposals=0`.

## 13. Riscos restantes

- preflight global segue `PARCIAL` por `company_contacts` reference-only (aceito por politica 22N-R2);
- manter regra de abortar se futuramente `value=TMP-PT-001` divergir do payload congelado;
- manter rollout estritamente incremental na proxima entidade.

## 14. Decisao final GO/PARCIAL/NO-GO

**GO**

Justificativa:

- target/batch/autorizacoes validos;
- before `GO`;
- escrita ocorreu somente em `product_types`;
- delta esperado `+1`;
- registro final confere com payload congelado;
- hard stop final acionado;
- nenhuma outra entidade tocada.

## 15. Recomendacao da proxima fase

Executar auditoria pos-piloto de `product_types` (idempotencia e escopo negativo) antes de definir eventual proxima entidade piloto.

## 16. Confirmacoes obrigatorias

- nova escrita em banco: sim
- tabela escrita: `product_types`
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
- insert/update/upsert/delete fora de `product_types`: nao
- RPC de escrita executada: nao
- executor executou escrita ampliada: nao
