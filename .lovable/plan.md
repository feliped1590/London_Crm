## Objetivo
Incluir o campo `comissao` em cada item do payload `IMP_PEDIDO_V3` enviado à Projedata, usando o `commission_pct` já existente no `order_items`.

## Mudanças

### 1. `supabase/functions/_shared/projedata/order-types.ts`
Adicionar `comissao: number` em `ProjedataOrderItem` (logo após `desconto_item`, mantendo a ordem do payload validado).

### 2. `supabase/functions/_shared/projedata/order-mapper.ts`
- Adicionar `commission_pct?: number` em `CRMOrderItemForSync`.
- No `mapCRMOrderToProjedata`, incluir `comissao: item.commission_pct ?? 0` no objeto de cada item.

### 3. `supabase/functions/process-order-sync/index.ts`
No `items.map(...)` (linha ~276), incluir `commission_pct: Number(item.commission_pct) || 0`.

### 4. `supabase/functions/_shared/projedata/order-loader.ts`
Adicionar `commission_pct` no `select` de `order_items` (linha 138-142) — apenas para que esteja disponível caso outros consumidores do loader passem a usar. (Não obrigatório para o fluxo de envio, pois `process-order-sync` faz o próprio select; verificar e ajustar se necessário.)

## Não muda
- Estrutura de `entregas`, `pagto`, `frete`, datas e demais campos do envelope.
- Lógica de validação (`order-validator.ts`) — `comissao = 0` é aceito pelo ERP conforme exemplos anteriores.
- UI: `commission_pct` já é editável no item do pedido.

## Risco
Nenhum — campo opcional aditivo no payload; default `0` mantém compatibilidade com pedidos sem comissão definida.