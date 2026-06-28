# Fase 22BY-R2 — Reexecucao runner ERP read-only com configuracao local

## 1. Objetivo

Reexecutar o runner no-write da 22BX-R2 com configuracao local ERP para obter amostra real limitada e mascarada, sem escrita em banco.

## 2. Escopo

- validar estado Git e pendencias esperadas;
- validar protecao de arquivos locais sensiveis;
- verificar presenca de credenciais sem expor segredos;
- executar `companies` e `products` somente se configuracao completa existir;
- gerar artifact da fase 22BY.

## 3. Configuracao local usada (sem valores)

- endpoint tecnico foi informado previamente fora do runner;
- token local nao foi encontrado no ambiente atual;
- status final:
  - `api_url_present=false`
  - `api_token_present=false`
  - `provider=missing`

## 4. Protecao de `.local/` e `.env.local`

Validacoes:

- `git check-ignore .local/erp-samples/test.json` -> ignorado;
- `git check-ignore .env.local` -> ignorado;
- `git status --ignored --short .local .env.local` confirma `.env.local` ignorado;
- payload bruto real permanece fora do versionamento.

## 5. Comandos executados

Pre-check executado:

- `git branch --show-current`
- `git status --short`
- `git rev-list --left-right --count origin/main...main`
- `git log -1 --oneline`
- `git rev-parse HEAD`
- `git rev-parse origin/main`

Execucao ERP planejada (nao executada por configuracao ausente):

- `node scripts/migration/phase-22bx-r2-erp-readonly-sample.mjs --entity companies --limit 3 --no-write`
- `node scripts/migration/phase-22bx-r2-erp-readonly-sample.mjs --entity products --limit 3 --no-write`

## 6. Resultado companies

- status: nao executado;
- motivo: `config_status_missing`;
- total retornado: `0`;
- `ready_candidate`: `0`.

## 7. Resultado products

- status: nao executado;
- motivo: `config_status_missing`;
- total retornado: `0`;
- `ready_candidate`: `0`.

## 8. Payload bruto local

- caminho previsto: `.local/erp-samples/`;
- criado nesta fase: nao (sem amostra);
- payload bruto em Git: nao.

## 9. Artifacts mascarados

Gerado na fase:

- `artifacts/migration/phase-22by-r2-erp-readonly-configured-sample/erp-readonly-configured-sample-20260628-122235.json`

Referencias existentes da 22BX:

- `artifacts/migration/phase-22bx-r2-erp-readonly-sample/erp-readonly-sample-summary-20260628-121058.json`
- `artifacts/migration/phase-22bx-r2-erp-readonly-sample/erp-readonly-sample-summary-20260628-121123.json`

## 10. Colisoes preliminares

- nao executadas;
- motivo: sem amostra local bruta/normalizavel.

## 11. Registros `ready_candidate`

- companies: `0`
- products: `0`

## 12. Registros bloqueados

- sem bloqueio por qualidade de registro (nenhum registro retornado);
- bloqueio operacional da fase: configuracao ausente.

## 13. Riscos restantes

- token ERP nao configurado no ambiente local atual;
- endpoint tecnico informado pode nao corresponder ao endpoint compartilhado correto da amostra real Qualyvac;
- sem amostra nao ha validacao de qualidade nem colisoes preliminares.

## 14. Decisao final GO/PARCIAL/NO-GO

**PARCIAL**

Motivo:

- runner no-write permanece valido e seguro;
- faltou configuracao completa (`api_token_present=false`) para chamada `EXP_*`.

## 15. Recomendacao da proxima fase

Configurar localmente o token ERP nao versionado (`INIFLEX_API_TOKEN` ou `PROJEDATA_API_TOKEN`), validar provider correto para amostra real Qualyvac e reexecutar o runner 22BX para `companies` e `products` com `--no-write` para gerar amostra mascarada e colisoes.

## 16. Confirmacoes obrigatorias

- nova escrita em banco: **nao**
- SQL de escrita executado: **nao**
- ERP/API de escrita executada: **nao**
- ERP/API read-only executada: **nao**
- payload real bruto commitado: **nao**
- credencial exposta/versionada: **nao**
- migration: **nao**
- seed/cleanup: **nao**
- rollback: **nao**
- filas processadas: **nao**
- deploy: **nao**
- commit: **nao**
- push: **nao**
- executor de escrita alterado: **nao**
- staging/prod alterados: **nao**
- executor executou escrita ampliada: **nao**
