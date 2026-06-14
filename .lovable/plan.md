## Objetivo

Incluir na aba "Pedidos" do cliente (CRM) o mesmo controle de sincronização com o ERP já presente na listagem global de pedidos.

## Mudanças (apenas frontend)

Arquivo: `src/components/customers/CustomerOrdersTab.tsx`

1. Importar `OrderSyncBadge` e `OrderSyncButton` de `@/components/orders/OrderSyncStatus`.
2. Estender o type `CRMOrder` com `erp_synced_at` e `updated_at`; incluir esses campos no `select` da query `customer-orders-crm`.
3. Na tabela de pedidos CRM:
   - Adicionar coluna "Sync ERP" (após "Cód. ERP") renderizando `<OrderSyncBadge ... />`.
   - Adicionar coluna de ações à direita com `<OrderSyncButton ... />`. O `onClick` do botão usa `e.stopPropagation()` (já implementado no componente) para não disparar a edição da linha.
   - `onSyncTriggered` invalida `['customer-orders-crm', companyId]` e as queries de status do sync (`order_sync_status`, `order_sync_status_btn`).
4. Não alterar a tabela ERP (`crm_orders`) — sync só faz sentido para pedidos CRM.

## Fora do escopo

- Nenhuma mudança em backend, RLS ou edge functions (a infra de sync de pedido já existe).
- Sem alteração no `OrderDialog` (já mostra o ERP no título).
