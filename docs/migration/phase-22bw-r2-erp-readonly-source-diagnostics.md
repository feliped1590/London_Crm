# Fase 22BW-R2 — Diagnóstico e habilitação de fonte ERP read-only (sem escrita)

## 1. Objetivo

Identificar e validar fontes ERP/API Projedata-Iniflex de leitura segura para destravar a coleta da amostra real ERP 01.

## 2. Escopo

- pré-check Git;
- leitura de evidências 22BU/22BV;
- inspeção de código/configuração ERP;
- classificação de comandos `EXP_*` e `IMP_*`;
- proposta de testes read-only mínimos, sem execução de escrita.

## 3. Restrições absolutas

- sem escrita em banco;
- sem ERP/API de escrita;
- sem importação real no CRM;
- sem alteração de executor;
- sem commit/push.

## 4. Contexto da 22BV

A 22BV encerrou em `NO-GO` por ausência de fonte read-only ativa/configurada para amostra real (`companies=0`, `contacts=0`, `products=0`).

## 5. Código ERP/API encontrado

Arquivos centrais identificados:

- `supabase/functions/_shared/projedata/company-mapper.ts`
- `supabase/functions/erp-import-products-staging/index.ts`
- `supabase/functions/process-company-sync/index.ts`
- `supabase/functions/erp-import-contacts/index.ts`
- `src/pages/Integrations.tsx`

Achados:

- wrapper de consulta por CNPJ com `EXP_CLIENTES_V2` em `company-mapper`;
- fetch de exportação de produtos com `EXP_PRODUTOS_V1` em `erp-import-products-staging`;
- função de staging de produtos atual mistura fetch externo com persistência em `erp_products_staging` (não segura para execução direta nesta fase).

## 6. Configurações necessárias

Sem expor valores, as configurações esperadas são:

- `tenant_settings` categoria `erp_integration`:
  - `settings.endpoint`
  - `settings.token`
- fallbacks por env:
  - `INIFLEX_API_URL`, `INIFLEX_API_TOKEN`
  - `PROJEDATA_API_URL`, `PROJEDATA_API_TOKEN`
  - `PROJEDATA_CLIENT_COMMAND`, `PROJEDATA_PRODUCT_COMMAND`

Estado atual no restore-test:

- `tenant_settings` para `erp_integration`: não encontrado;
- `erp_clients_cache`, `erp_products_staging`, `contact_erp_data`, `product_erp_data`: sem linhas úteis de amostra.

## 7. Classificação dos comandos

### Read-only confirmados

- `EXP_CLIENTES_V2`
- `EXP_PRODUTOS_V1`

### Escrita/proibidos nesta fase

- `IMP_CLIENTE_V4`
- `IMP_ITEM_VERSAO_TESTE`
- `IMP_PEDIDO_V3`
- `IMP_PEDIDO_ESPECIFICO`
- `IMP_ATRIBFICHA_V1`

### Desconhecido/bloqueado

- comando de exportação read-only de contatos não está explicitamente mapeado no código atual.

## 8. Clientes — fonte read-only

- fonte: `EXP_CLIENTES_V2` (confirmada);
- situação: tecnicamente válida, porém indisponível para execução agora por falta de configuração endpoint/token e ausência de cache.

## 9. Produtos — fonte read-only

- fonte: `EXP_PRODUTOS_V1` (confirmada);
- situação: tecnicamente válida, porém a função existente acopla leitura com persistência em staging; sem modo no-write explícito, execução permanece bloqueada.

## 10. Contatos — fonte read-only ou bloqueio

- status: bloqueado;
- motivo: não há comando ERP read-only explícito de contatos mapeado na trilha atual.

## 11. Testes read-only propostos/executados

Testes propostos (não executados):

- **clientes**: execução limitada (`1` a `3`) via wrapper de `EXP_CLIENTES_V2`, sem persistência CRM.
- **produtos**: execução limitada (`1` a `3`) via `EXP_PRODUTOS_V1` com modo estritamente no-write.
- **contatos**: somente após confirmação de fonte read-only explícita.

Execução nesta fase:

- nenhum teste externo ERP foi executado.

## 12. Política de payload real

- payload bruto real não foi coletado;
- nenhuma credencial foi exposta/versionada;
- nenhum payload sensível foi commitado.

## 13. Riscos restantes

- ausência de configuração runtime ERP por tenant no restore-test;
- ausência de runner explicitamente read-only para produtos (sem inserção em staging);
- contatos sem fonte read-only clara.

## 14. Decisão final GO/PARCIAL/NO-GO

**PARCIAL**

Motivo:

- há fontes read-only confirmáveis para clientes/produtos em nível de código;
- porém ainda sem configuração operacional segura e sem execução de teste mínimo.

## 15. Recomendação da próxima fase

Implementar/usar runner read-only explícito (no-write) para `EXP_CLIENTES_V2` e `EXP_PRODUTOS_V1`, preencher configuração de endpoint/token por tenant e rodar amostra mínima (`1`-`3`) antes de repetir a coleta 22BV.

## 16. Confirmações obrigatórias

- nova escrita em banco: **não**
- SQL de escrita executado: **não**
- ERP/API de escrita executada: **não**
- ERP/API read-only executada: **não**
- payload real bruto commitado: **não**
- credencial exposta/versionada: **não**
- migration: **não**
- seed/cleanup: **não**
- rollback: **não**
- filas processadas: **não**
- deploy: **não**
- commit: **não**
- push: **não**
- executor alterado: **não**
- staging/prod alterados: **não**
- executor executou escrita ampliada: **não**
