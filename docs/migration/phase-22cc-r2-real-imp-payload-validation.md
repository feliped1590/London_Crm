# Fase 22CC-R2 — Validação real de payloads IMP (sem execução ERP e sem escrita)

## 1. Objetivo

Validar payloads locais reais/operacionais de `IMP_CLIENTE_V4`, `IMP_ITEM_VERSAO_TESTE` e `IMP_PEDIDO_ESPECIFICO` sem executar chamadas ERP e sem qualquer escrita em banco.

## 2. Motivo da fase

A frente Real ERP 01 pivotou para payloads `IMP` operacionais. `EXP_PRODUTOS` não é prioridade desta etapa.

## 3. Payloads informados pelo usuário

Esperados:

- `.local/erp-samples/imp-cliente-v4-real-01.json`
- `.local/erp-samples/imp-item-versao-teste-real-01.json`
- `.local/erp-samples/imp-pedido-especifico-real-01.json`

Resultado da verificação:

- os três arquivos esperados `*-real-01.json` não foram encontrados no diretório local.

## 4. Política de segurança

- nenhum comando `IMP_*` foi executado contra ERP;
- nenhuma escrita em banco/staging foi realizada;
- nenhum token foi exposto/versionado;
- nenhum payload bruto real foi commitado.

## 5. Resultado `IMP_CLIENTE_V4`

- status: não executado nesta fase (`missing_input_file`);
- regra de CNPJ obrigatório permanece ativa para primeira carga.

## 6. Resultado `IMP_ITEM_VERSAO_TESTE`

- status: não executado nesta fase (`missing_input_file`);
- validação real pendente do input `*-real-01`.

## 7. Resultado `IMP_PEDIDO_ESPECIFICO`

- status: não executado nesta fase (`missing_input_file`);
- pedidos permanecem diagnósticos até clientes/produtos resolvidos.

## 8. Candidatos prontos

- `companies`: 0 (input real ausente)
- `products`: 0 (input real ausente)
- `orders`: 0 (input real ausente)

## 9. Bloqueios

Bloqueio único nesta fase:

- ausência dos três arquivos locais com os nomes oficiais `*-real-01.json`.

## 10. Colisões read-only

- não executadas por ausência de registros vindos dos inputs reais esperados.

## 11. Write-plan sem execução

- gerado com `execute_write=false`;
- ordem futura mantida: `companies` -> `products` -> `orders`;
- todas as entidades bloqueadas por `missing_input_file`.

## 12. Decisão final

**PARCIAL**.

## 13. Recomendação da próxima fase

Adicionar os três payloads reais em `.local/erp-samples/` com os nomes oficiais e reexecutar:

- `node scripts/migration/phase-22cb-r2-imp-payload-validator.mjs --entity companies --input .local/erp-samples/imp-cliente-v4-real-01.json --no-write`
- `node scripts/migration/phase-22cb-r2-imp-payload-validator.mjs --entity products --input .local/erp-samples/imp-item-versao-teste-real-01.json --no-write`
- `node scripts/migration/phase-22cb-r2-imp-payload-validator.mjs --entity orders --input .local/erp-samples/imp-pedido-especifico-real-01.json --no-write`

## 14. Confirmações obrigatórias

- chamada ERP executada: **não**
- comando `IMP_*` executado: **não**
- nova escrita em banco: **não**
- SQL de escrita executado: **não**
- payload bruto real commitado: **não**
- token exposto/versionado: **não**
- migration: **não**
- seed/cleanup: **não**
- rollback: **não**
- filas processadas: **não**
- deploy: **não**
- commit: **não**
- push: **não**
- staging/prod alterados: **não**
