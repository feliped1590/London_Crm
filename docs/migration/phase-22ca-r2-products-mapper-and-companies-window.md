# Fase 22CA-R2 — Ajuste mapper products + janela companies (sem escrita)

## 1. Objetivo

Corrigir a normalização da amostra real de `products` (read-only) para eliminar bloqueio falso de nome e preparar abordagem com janela/filtros para `companies` sem insistência em loop.

## 2. Contexto

- `--check-config` estava `ready` para Iniflex.
- `products` retornava dados reais (`fetched_records=45507`), mas `ready_candidate=0` por `blocked_missing_name`.
- `companies` seguia com timeout/abort em chamada ampla.

## 3. Resultado da amostra real de products

Payload bruto local inspecionado:

- `.local/erp-samples/real-erp-01-products-raw-20260628-141747.json`
- array real: `records`
- inspeção segura feita apenas com chaves/tipos.

## 4. Motivo do bloqueio `blocked_missing_name`

O payload real usa campos como `desc_simples_item`, `desc_completa_item` e `desc_simples_versao`, que não estavam no fallback principal de nome/descrição do runner.

## 5. Chaves reais encontradas no payload

Chaves relevantes detectadas:

- código/SKU: `produto`, `referencia`
- nome/descrição: `desc_simples_item`, `desc_completa_item`, `desc_simples_versao`
- classificação: `codigo_tipo_item`, `codigo_grupo`, `codigo_subgrupo`, `codigo_familia`, `codigo_classe`
- data: `data_alteracao`

## 6. Ajuste de mapper

Arquivo alterado:

- `scripts/migration/phase-22bx-r2-erp-readonly-sample.mjs`

Ajustes principais:

- adição de `firstNonEmpty(record, keys)`;
- expansão dos fallbacks de `products` para código/nome/versão/classificação com os nomes reais;
- suporte opcional para `companies`:
  - `--changed-since`
  - `--date-from`
  - `--date-to`
  - `--cnpj`
  - `--erp-code`
  - `--timeout-ms`

Observação:

- para `companies`, apenas `data_alteracao` tem evidência clara no payload do `EXP_CLIENTES_V2`; demais filtros são aplicados localmente após retorno.

## 7. Resultado da reexecução products

Comando:

- `node scripts/migration/phase-22bx-r2-erp-readonly-sample.mjs --entity products --limit 3 --no-write`

Resultado:

- `operation=erp_readonly_call_succeeded`
- `sample_records=3`
- `ready_candidate=3`
- `decision=GO`

Artifacts:

- `artifacts/migration/phase-22bx-r2-erp-readonly-sample/erp-readonly-sample-summary-20260628-142430.json`
- `artifacts/migration/phase-22bx-r2-erp-readonly-sample/erp-readonly-products-masked-20260628-142430.json`
- `artifacts/migration/phase-22bx-r2-erp-readonly-sample/erp-readonly-collisions-masked-20260628-142430.json`

## 8. Ready candidates

- `products ready_candidate=3/3`.

## 9. Colisões products

Checagem preliminar read-only:

- `(tenant_id, erp_product_code, versao_numero)` (quando versão disponível)
- `sku_unique`
- `sku` (informativo)

Resultado:

- sem colisões preliminares nas 3 amostras (`0` em todas as verificações).

Artifact 22CA:

- `artifacts/migration/phase-22ca-r2-products-mapper-and-companies-window/products-collisions-masked-20260628-142304.json`

## 10. Timeout de companies

`companies` mantém `erp_readonly_call_failed` com erro de abort/timeout em chamada ampla. Não foi forçada repetição em loop infinito.

## 11. Diagnóstico de filtros para `EXP_CLIENTES_V2`

Evidência em `supabase/functions/_shared/projedata/company-mapper.ts`:

- payload explícito observado: `tipoComando`, `grupoComando`, `data_alteracao`.
- sem evidência explícita de `cnpj`, `codigo_cliente`, paginação ou limite no contrato remoto.
- no mapper original, filtragem por CNPJ ocorre localmente após retorno.

Artifact 22CA:

- `artifacts/migration/phase-22ca-r2-products-mapper-and-companies-window/companies-window-diagnostics-20260628-142304.json`

## 12. Próximo passo

Executar tentativa controlada de `companies` com janela temporal menor e timeout maior:

- `node scripts/migration/phase-22bx-r2-erp-readonly-sample.mjs --entity companies --limit 3 --no-write --changed-since 2026-06-01 --timeout-ms 120000`

Sem insistir em retries ilimitados caso continue abortando.

## 13. Confirmações obrigatórias

- nova escrita em banco: **não**
- SQL de escrita executado: **não**
- ERP/API de escrita executada: **não**
- ERP/API read-only executada: **sim** (products)
- payload real bruto commitado: **não**
- credencial exposta/versionada: **não**
- migration: **não**
- seed/cleanup: **não**
- rollback: **não**
- filas processadas: **não**
- deploy: **não**
- commit: **não**
- push: **não**
- executor de escrita alterado (`phase-22k-r2-baseline-write.mjs`): **não**
- staging/prod alterados: **não**
- executor executou escrita ampliada: **não**
