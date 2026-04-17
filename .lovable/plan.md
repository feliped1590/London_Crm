
## Plano: Pré-Validação ERP para Pedidos

Replicar o mesmo padrão dos clientes (`blocked_validation` + modal de pendências) para pedidos, evitando que itens fiquem na fila eternamente acumulando retries.

### 1. Banco — `order_sync_queue`

Migration nova:
- Adicionar `validation_errors JSONB` e `validation_fields TEXT[]`
- Atualizar `CHECK` do `status` para incluir `'blocked_validation'` e `'waiting_propagation'` (este último para paridade futura)
- Índices GIN em `validation_fields` e `validation_errors`
- View/RPC opcional `get_order_validation_breakdown` (contagem por tipo de erro) — espelhando a função de clientes

### 2. Validador compartilhado — refatorar `order-validator.ts`

Enriquecer cada erro com `fixHint` e `fixRoute` (igual ao `company-validator.ts`):

| Campo | Hint | Rota |
|---|---|---|
| `company_erp_code` | "Envie o cliente ao ERP primeiro" | `/customers/:id` |
| `erp_empresa` | "Configure código ERP da empresa emissora" | `/settings?tab=legal-entities` |
| `erp_usuario` | "Vincule código ERP ao usuário criador" | `/settings?tab=permissions` |
| `erp_fluxo_venda` | "Mapeie o tipo de pedido" | `/settings?tab=erp-mappings` |
| `erp_vendedor` | "Configure código ERP do vendedor" | `/settings?tab=sales-reps` |
| `erp_frete` / `payment_method` / `sale_type` | "Mapeie no ERP" | `/settings?tab=erp-mappings` |
| `items[].product_erp_code` / `versao` | "Preencha código ERP do produto" | `/products` |
| `items[].quantity` / `unit_price` | "Corrija no pedido" | (sem rota — abre o pedido) |
| `payment_terms` | "Defina condições de pagamento" | (abre o pedido) |

Adicionar `fields: string[]` no resultado para preencher `validation_fields`.

### 3. Nova edge function — `validate-order-sync`

Read-only. Recebe `order_id`, carrega o pedido + itens + todos os mapeamentos (igual ao `process-order-sync` faz hoje nas linhas 137-289), monta o objeto e chama `validateOrderForSync`. Retorna `{ valid, errors, fields, order_number }`.

Diferença-chave vs cliente: validação de pedidos depende de **muitos lookups** (legal_entity, profile, order_type_erp_mapping, freight_type_erp_mapping, payment_method_erp_mapping, sale_type_erp_mapping, products). Vou centralizar essa montagem em um helper compartilhado `loadOrderForValidation(supabase, orderId)` em `_shared/projedata/` para ser reusada por `process-order-sync` e `validate-order-sync` — evita duplicação.

### 4. Defesa em profundidade — `process-order-sync`

Quando `validation.valid === false` (linhas 312-315):
- Substituir `throw new Error(...)` por update do queue item para `status='blocked_validation'` com `validation_errors`, `validation_fields`, `attempt_count` resetado e `next_retry_at=null`
- **Não consome retries** e **não fica em loop**
- Continua para o próximo item da fila

### 5. Frontend — `OrderSyncStatus.tsx`

Espelhar o que foi feito em `CompanySyncStatus.tsx`:

**`OrderSyncBadge`**:
- Buscar também `validation_errors` da fila
- Adicionar config para `blocked_validation` → "Dados incompletos" (laranja, ícone AlertTriangle)
- Tooltip lista até 5 pendências (`err.message`)
- Prioridade do `displayStatus`: `blocked_validation` > pending/processing > outdated > completed

**`OrderSyncButton`**:
- Antes de enfileirar, chamar `validate-order-sync`
- Se `!valid` → abrir `SyncValidationModal` (já existe, é genérico) e **não enfileirar**
- Se já está `blocked_validation` na fila → botão muda para ícone `Wrench` "Corrigir dados pendentes" e abre o modal direto
- Se `valid` → fluxo atual (resetar fila + chamar `process-order-sync`)

### 6. Dashboard — opcional/futuro

A `IntegrationValidationPanel` hoje só cobre clientes. Não vou expandir agora (escopo é só destravar a fila), mas a estrutura (`validation_errors` JSONB + função de breakdown) fica pronta para um painel de pedidos no futuro.

### Arquivos tocados

1. **Nova migration** — colunas `validation_errors`/`validation_fields` + check constraint + índices em `order_sync_queue`
2. `supabase/functions/_shared/projedata/order-validator.ts` — adicionar `fixHint`, `fixRoute`, `fields`
3. `supabase/functions/_shared/projedata/order-types.ts` — atualizar `OrderValidationError` e `OrderValidationResult`
4. **Novo** `supabase/functions/_shared/projedata/order-loader.ts` — helper compartilhado `loadOrderForValidation`
5. **Nova edge function** `supabase/functions/validate-order-sync/index.ts`
6. `supabase/functions/process-order-sync/index.ts` — usar loader compartilhado + gravar `blocked_validation` em vez de throw
7. `src/components/orders/OrderSyncStatus.tsx` — badge `blocked_validation` + pré-validação no botão + modo "Corrigir"
8. (Reuso) `src/components/customers/SyncValidationModal.tsx` já é genérico — só precisa adicionar labels de pedidos no `FIELD_LABELS`. Vou movê-lo para `src/components/sync/SyncValidationModal.tsx` (path neutro) e atualizar imports nos dois lugares.

### Critérios de aceite

- Pedido sem produto com código ERP → modal lista "Item N: produto sem código ERP" com botão "Corrigir" indo para /products
- Pedido com tipo de venda não mapeado → modal pede mapeamento em Settings → ERP
- Pedido sem cliente sincronizado → modal pede sincronizar cliente primeiro
- Após validação falhar, **nada entra na fila**
- Pedido já travado em `blocked_validation` mostra badge laranja "Dados incompletos" e botão Wrench que abre o modal sem reenviar
- Ao corrigir as pendências e clicar enviar de novo, o item volta para `pending` e processa normalmente
- Pedido válido segue o fluxo atual sem mudança
- Zero regressão nos pedidos já sincronizados (status `completed` continua igual)
