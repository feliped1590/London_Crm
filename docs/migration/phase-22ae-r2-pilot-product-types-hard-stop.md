# Fase 22AE-R2 — Preparar modo piloto `product_types` com hard stop final (sem escrita)

## 1. Objetivo

Preparar o executor para reconhecer o piloto de `product_types` com validacao completa de payload congelado e bloqueio final obrigatorio antes de qualquer mutacao.

## 2. Escopo

- manter guard rails existentes (target/name/batch/autorizacoes/flags/whitelist/blacklist);
- adicionar suporte da flag `--pilot-payload`;
- aceitar piloto somente em `legal_entities` ou `product_types`;
- validar payload congelado 22AD-R2 para `product_types`;
- validar schema/colisao por leitura (`UNIQUE(value)`, contagem, colisao `value`, colisao `label`);
- montar operacao piloto em memoria;
- gerar evidencia local da 22AE-R2;
- acionar hard stop final sem escrita real.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem SQL/RPC de escrita;
- sem seed/cleanup/rollback/migration;
- sem alteracao de schema/staging/prod;
- sem ERP/API/webhook/n8n/filas;
- sem liberar `sales_reps`, `profiles`, `company_contacts`;
- sem bypass (`--force`, `--skip-guards`, `--tables`, `--all`);
- sem commit/push/deploy.

## 4. Alteracoes feitas no executor

Arquivo alterado: `scripts/migration/phase-22k-r2-baseline-write.mjs`

Alteracoes principais:

- adicionada flag `--pilot-payload` em `ALLOWED_FLAGS` e parser;
- validacao de entidade piloto agora aceita apenas `legal_entities` e `product_types`;
- validacao de autorizacao piloto por entidade:
  - `legal_entities`: frase 22R-R2 existente;
  - `product_types`: frase 22AD-R2 especifica;
- validacao obrigatoria de `--pilot-payload` quando `--pilot-entity product_types`;
- validacao estrutural/semantica do payload congelado 22AD-R2;
- validacoes read-only de `public.product_types`:
  - `UNIQUE(value)` presente;
  - contagem atual;
  - colisao por `value`;
  - colisao por `label`;
- operacao piloto `product_types` montada apenas em memoria;
- funcao de bloqueio explicita:
  - `executeProductTypesPilotWrite()` sempre dispara erro de hard stop 22AE-R2;
- geracao de evidencia dedicada:
  - `artifacts/migration/phase-22ae-r2-pilot-product-types/pilot-product-types-*.json`;
- ramo 22T (escrita real de `legal_entities`) marcado como nao aplicavel quando o piloto selecionado e `product_types`.

## 5. Flag `--pilot-payload`

Nova flag suportada:

- `--pilot-payload <arquivo-json>`

Regra:

- obrigatoria para `--pilot-entity product_types`;
- arquivo deve existir e ser JSON valido;
- deve bater com o payload congelado oficial 22AD-R2.

## 6. Autorizacoes exigidas

- autorizacao geral exata:
  - `AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb`
- autorizacao piloto `product_types` exata:
  - `AUTORIZO A TERCEIRA ESCRITA PILOTO DA BASELINE 22AD-R2 SOMENTE EM product_types NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

## 7. Payload congelado validado

Payload validado de:

- `artifacts/migration/phase-22ad-r2-product-types-pilot-prep/product-types-payload-20260627-180436.json`

Checagens aplicadas:

- `phase = 22AD-R2`;
- origem em `phase-22g-r2-baseline-dry-run.mjs` / `BASELINE_SIMULATION.product_types`;
- exatamente 1 registro de `product_types`;
- `temp_key = TMP-22F-R2-PRODTYPE-01`;
- `value = TMP-PT-001`;
- `label = TMP Product Type`;
- `tenant_id = null`;
- politica de tenant em escopo null;
- decisao de payload aceita (`GO`/`PARCIAL`);
- idempotencia por `value`.

## 8. Validacao de schema/colisao

Validacao read-only em `public.product_types`:

- `UNIQUE (value)`: validado;
- contagem atual: `12`;
- colisao por `value='TMP-PT-001'`: `0`;
- colisao por `label='TMP Product Type'`: `0`.

## 9. Operacao piloto montada em memoria

Estrutura montada:

- `entity`: `product_types`
- `action`: `insert_pilot_planned`
- `value`: `TMP-PT-001`
- `label`: `TMP Product Type`
- `tenant_id`: `null`
- `executableIn22AE`: `false`
- `realExecutionBlocked`: `true`
- `reason`: `Hard stop final active; no database mutation allowed in 22AE-R2`

Sem chamadas reais de insert/update/upsert/delete/rpc/SQL de escrita.

## 10. Evidencia piloto gerada

Evidencia mais recente da execucao segura:

- `artifacts/migration/phase-22ae-r2-pilot-product-types/pilot-product-types-20260627-181158.json`

Tambem foram geradas evidencias auxiliares da execucao armada:

- `artifacts/migration/phase-22k-r2-baseline-write/preflight-20260627-181158.json`
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-181158.json`
- `artifacts/migration/phase-22q-r2-armed-write/before-20260627-181158.json`

## 11. Hard stop final

Hard stop acionado com mensagem:

- `EXECUÇÃO PILOTO product_types BLOQUEADA NA FASE 22AE-R2. Payload validado, mas nenhuma mutação foi executada.`

## 12. Resultado do teste

Comando executado (modo seguro armado com hard stop):

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --pilot-authorization "AUTORIZO A TERCEIRA ESCRITA PILOTO DA BASELINE 22AD-R2 SOMENTE EM product_types NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-224906.json \
  --pilot-payload artifacts/migration/phase-22ad-r2-product-types-pilot-prep/product-types-payload-20260627-180436.json \
  --pilot-entity product_types \
  --execute-pilot-write \
  --write
```

Resultado observado:

- preflight executado com `PARCIAL` aceito por politica 22N-R2 (somente `company_contacts` reference-only);
- write plan validado (`GO`);
- payload piloto validado (`true`);
- validacao piloto `product_types` (`GO`);
- evidencia 22AE gerada;
- hard stop acionado;
- nenhuma mutacao executada.

## 13. Riscos restantes

- preflight segue `PARCIAL` por `company_contacts` reference-only (esperado e aceito pela politica);
- piloto real de `product_types` ainda depende da fase de execucao controlada com contrato before/after dedicado;
- manter disciplina de abortar em divergencia futura de `value` existente.

## 14. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- `--pilot-payload` reconhecido e validado;
- `product_types` aceita como piloto apenas com hard stop;
- autorizacao piloto validada;
- payload congelado validado;
- `UNIQUE(value)` e ausencia de colisao validadas;
- operacao piloto apenas em memoria;
- evidencia 22AE gerada;
- hard stop final acionado;
- sem escrita real.

## 15. Recomendacao da proxima fase

Avancar para a fase de execucao piloto real de `product_types` com before/after formal, mantendo escopo unico, validacao de idempotencia por `value` e bloqueio de execucao ampliada.

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
- staging/prod alterados: nao
- insert/update/upsert/delete executado: nao
- RPC de escrita executada: nao
- executor executou escrita ampliada: nao
