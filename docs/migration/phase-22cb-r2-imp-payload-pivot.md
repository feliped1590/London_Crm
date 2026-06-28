# Fase 22CB-R2 — Pivot para payloads IMP operacionais (sem escrita)

## 1. Motivo do pivot

A frente Real ERP 01 foi reorientada para payloads/comandos `IMP` já operacionais no projeto. A estratégia com `EXP_PRODUTOS` deixou de ser prioridade para planejamento de carga real.

## 2. Confirmação da integração alvo

- integração ativa: **Iniflex API**;
- validação baseada em payloads `IMP` operacionais;
- sem envio de payload ao ERP nesta fase.

## 3. Por que `EXP_PRODUTOS` deixou de ser prioridade

`EXP_*` foi útil para diagnóstico inicial, mas a trilha prática da integração já usa mappers/fluxos `IMP` para clientes, produtos e pedidos. O plano agora valida estrutura e prontidão de payload operacional sem execução de escrita.

## 4. Payloads `IMP` encontrados

### Clientes
- `IMP_CLIENTE_V4` em `supabase/functions/_shared/projedata/company-mapper.ts`
- simulador em `src/components/integrations/CustomerPayloadSimulator.tsx`

### Produtos
- `IMP_ITEM_VERSAO_TESTE` em `supabase/functions/_shared/projedata/product-mapper-v2.ts`
- referência de fluxo em `.lovable/memory/integrations/erp-product-version-sync.md`

### Pedidos
- `IMP_PEDIDO_ESPECIFICO` em `supabase/functions/_shared/projedata/order-mapper.ts`
- `IMP_PEDIDO_V3` em `docs/04-workflows/critical-flows/order-erp-sync.md`
- simulador em `src/components/integrations/OrderPayloadSimulator.tsx`

## 5. Validador no-write criado

Arquivo:

- `scripts/migration/phase-22cb-r2-imp-payload-validator.mjs`

Comandos suportados:

- `node scripts/migration/phase-22cb-r2-imp-payload-validator.mjs --entity companies --input <path> --no-write`
- `node scripts/migration/phase-22cb-r2-imp-payload-validator.mjs --entity products --input <path> --no-write`
- `node scripts/migration/phase-22cb-r2-imp-payload-validator.mjs --entity orders --input <path> --no-write`

Funções:

- leitura local de payload;
- validação estrutural por entidade;
- mascaramento de campos sensíveis;
- checagem de colisões read-only (companies/products);
- geração de write-plan sem execução.

## 6. Validação de clientes (CNPJ obrigatório)

Input utilizado (local, não versionado):

- `.local/erp-samples/imp-companies-operational-example.json`

Resultado:

- `ready_candidate=1`
- `blocked_missing_cnpj=1`

Regra aplicada:

- cliente sem CNPJ fica bloqueado para primeira carga real.

## 7. Validação de produtos

Input utilizado:

- `.local/erp-samples/imp-products-operational-example.json`

Resultado:

- `ready_candidate=2`
- `blocked_missing_name=1`

## 8. Diagnóstico de pedidos (sem liberar escrita)

Input utilizado:

- `.local/erp-samples/imp-orders-operational-example.json`

Resultado:

- `diagnostic_ready_structure=1`
- `blocked_missing_order_number=1`

Pedidos permanecem apenas diagnósticos nesta fase.

## 9. Colisões read-only

### Clientes
- checagem por `(tenant_id, cnpj)` aplicada aos `ready_candidate`.

### Produtos
- checagem por `(tenant_id, erp_product_code, versao_numero)` quando versão presente;
- checagem por `sku_unique`.

Sem colisões preliminares nos itens prontos dessa amostra.

## 10. Write-plan sem execução

Write-plan mascarado foi gerado para cada entidade validada, com `execute_write=false`.

## 11. Artifacts 22CB

- `artifacts/migration/phase-22cb-r2-imp-payload-pivot/imp-payload-discovery-20260628-143141.json`
- `artifacts/migration/phase-22cb-r2-imp-payload-pivot/imp-payload-validation-masked-20260628-143120.json`
- `artifacts/migration/phase-22cb-r2-imp-payload-pivot/imp-payload-collisions-masked-20260628-143120.json`
- `artifacts/migration/phase-22cb-r2-imp-payload-pivot/imp-payload-write-plan-masked-20260628-143120.json`
- `artifacts/migration/phase-22cb-r2-imp-payload-pivot/imp-payload-validation-masked-20260628-143125.json`
- `artifacts/migration/phase-22cb-r2-imp-payload-pivot/imp-payload-collisions-masked-20260628-143125.json`
- `artifacts/migration/phase-22cb-r2-imp-payload-pivot/imp-payload-write-plan-masked-20260628-143125.json`
- `artifacts/migration/phase-22cb-r2-imp-payload-pivot/imp-payload-validation-masked-20260628-143139.json`
- `artifacts/migration/phase-22cb-r2-imp-payload-pivot/imp-payload-collisions-masked-20260628-143139.json`
- `artifacts/migration/phase-22cb-r2-imp-payload-pivot/imp-payload-write-plan-masked-20260628-143139.json`

## 12. Próxima fase recomendada

Usar payloads reais operacionais fornecidos pelo usuário (local, fora do Git) no validador 22CB para:

1. consolidar lote de `companies` com CNPJ obrigatório;
2. consolidar lote de `products` com nome+versão;
3. manter `orders` em diagnóstico até dependências de cliente/produto estarem estabilizadas.

## 13. Confirmações obrigatórias

- nova escrita em banco: **não**
- SQL de escrita executado: **não**
- ERP/API de escrita executada: **não**
- comando `IMP_*` executado contra ERP: **não**
- payload bruto real versionado: **não**
- token exposto/versionado: **não**
- migration/seed/cleanup/rollback/deploy: **não**
- commit/push: **não**
