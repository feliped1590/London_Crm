# Fase 22BX-R2 — Runner ERP read-only no-write para amostra real

## 1. Objetivo

Criar um runner local e estritamente no-write para consulta ERP Projedata-Iniflex com comandos `EXP_*`, gerando artifacts mascarados versionáveis e payload bruto apenas local.

## 2. Escopo

- execução read-only local para `companies` e `products`;
- consulta de configuração por env local com fallback read-only em `tenant_settings`;
- bloqueio explícito de comandos `IMP_*`;
- geração de resumo da execução sem persistência em banco.

## 3. Restrições absolutas

- sem insert/update/upsert/delete em qualquer tabela;
- sem chamadas de edge functions que persistem staging;
- sem SQL/RPC de escrita;
- sem alteração do executor `scripts/migration/phase-22k-r2-baseline-write.mjs`;
- sem commit/push.

## 4. Motivo da fase

A 22BW-R2 confirmou os comandos read-only no código, mas faltava um runner operacional seguro para executar amostra real sem risco de persistência.

## 5. Código criado

- `scripts/migration/phase-22bx-r2-erp-readonly-sample.mjs`
  - exige `--no-write`;
  - aceita apenas `--entity companies|products`;
  - limita `--limit` a no máximo `3`;
  - bloqueia comandos não `EXP_*` e comandos fora de allowlist;
  - não usa escrita Supabase;
  - grava bruto somente em `.local/erp-samples/` (quando há amostra).

## 6. Configuração necessária

Ordem de resolução:

1. env local (`INIFLEX_API_URL` + `INIFLEX_API_TOKEN`);
2. fallback read-only em `tenant_settings` (`category='erp_integration'`).

Nota operacional:

- a configuração desta frente usa somente Iniflex API (`INIFLEX_*`);
- não há Projedata API separada nesta frente.

Resultado nesta fase:

- `config_status=missing` para `companies` e `products`;
- `tenant_settings` verificado read-only sem configuração ativa;
- nenhum token impresso ou versionado.

## 7. Comandos permitidos

- `EXP_CLIENTES_V2`
- `EXP_PRODUTOS_V1`

## 8. Comandos bloqueados

- `IMP_CLIENTE_V4`
- `IMP_ITEM_VERSAO_TESTE`
- `IMP_PEDIDO_V3`
- `IMP_PEDIDO_ESPECIFICO`
- `IMP_ATRIBFICHA_V1`
- qualquer comando fora da allowlist;
- qualquer comando que não inicie com `EXP_`.

## 9. Execução clientes

Comando:

`node scripts/migration/phase-22bx-r2-erp-readonly-sample.mjs --entity companies --limit 3 --no-write`

Resultado:

- execução abortada operacionalmente por `config_status=missing` (sem chamada ERP);
- artifact de resumo gerado;
- sem payload bruto por ausência de amostra.

## 10. Execução produtos

Comando:

`node scripts/migration/phase-22bx-r2-erp-readonly-sample.mjs --entity products --limit 3 --no-write`

Resultado:

- execução abortada operacionalmente por `config_status=missing` (sem chamada ERP);
- artifact de resumo gerado;
- sem payload bruto por ausência de amostra.

## 11. Payload bruto local

- diretório preparado: `.local/erp-samples/`;
- formato planejado:
  - `.local/erp-samples/real-erp-01-companies-raw-YYYYMMDD-HHMMSS.json`
  - `.local/erp-samples/real-erp-01-products-raw-YYYYMMDD-HHMMSS.json`
- nesta execução: não criado (sem registros de entrada).

## 12. Artifacts mascarados

Gerados:

- `artifacts/migration/phase-22bx-r2-erp-readonly-sample/erp-readonly-sample-summary-20260628-121058.json`
- `artifacts/migration/phase-22bx-r2-erp-readonly-sample/erp-readonly-sample-summary-20260628-121123.json`

Não gerados nesta execução (por ausência de amostra):

- `erp-readonly-companies-masked-*.json`
- `erp-readonly-products-masked-*.json`
- `erp-readonly-collisions-masked-*.json`

## 13. Colisões preliminares

Não executadas nesta rodada por falta de payload local bruto e amostra ERP.

## 14. Registros candidatos

- `ready_candidate = 0` (companies);
- `ready_candidate = 0` (products).

## 15. Registros bloqueados

Sem bloqueio por qualidade de registro nesta rodada; bloqueio de fase ocorreu antes da coleta por `config_status_missing`.

## 16. Riscos restantes

- endpoint/token ERP não configurados no contexto atual;
- sem amostra real não há validação de qualidade/mapeamento efetivo;
- sem amostra não há análise preliminar de colisões.

## 17. Decisão final GO/PARCIAL/NO-GO

**PARCIAL**

Motivo:

- runner no-write foi criado e validado estruturalmente;
- configuração ERP permanece ausente no `restore-test`, impedindo chamada real `EXP_*`.

## 18. Recomendação da próxima fase

Habilitar configuração ERP read-only (`endpoint` + `token`) por env local seguro ou em `tenant_settings` do tenant de teste e reexecutar `companies`/`products` para coletar amostra real mascarada, seguida de colisões preliminares read-only.

## 19. Confirmações obrigatórias

- nova escrita em banco: **não**
- SQL de escrita executado: **não**
- ERP/API de escrita executada: **não**
- ERP/API read-only executada: **não** (configuração ausente)
- payload real bruto commitado: **não**
- credencial exposta/versionada: **não**
- migration: **não**
- seed/cleanup: **não**
- rollback: **não**
- filas processadas: **não**
- deploy: **não**
- commit: **não**
- push: **não**
- executor de escrita alterado: **não**
- staging/prod alterados: **não**
- executor executou escrita ampliada: **não**
