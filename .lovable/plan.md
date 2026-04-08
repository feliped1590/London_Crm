

# Plano: Re-sincronização de Pedidos Editados

## Problema

Dois bloqueios atuais:

1. **`OrderSyncButton` desaparece** quando `erpOrderId` existe (linha 146: `if (erpOrderId) return null`), impedindo re-envio de pedidos já sincronizados.
2. **Após editar um pedido**, não há disparo automático nem indicação visual de que o pedido está desatualizado em relação ao ERP.

## Solução

### 1. Permitir re-sync de pedidos já sincronizados

No `OrderSyncStatus.tsx`:
- Remover `if (erpOrderId) return null` do `OrderSyncButton`
- Alterar o tooltip para "Reenviar ao ERP" quando já sincronizado
- O badge `OrderSyncBadge` continua mostrando "Sincronizado", mas após re-sync volta a mostrar "Na fila" → "Processando" → "Sincronizado"

### 2. Marcar pedido como "desatualizado" após edição

No `OrderDialog.tsx`, dentro do `updateOrderMutation.onSuccess`:
- Verificar se o pedido já foi sincronizado (`order.erp_order_id` existe)
- Se sim, atualizar `order_sync_queue` para `status = 'pending'` e disparar a Edge Function em background (mesmo padrão fire-and-forget)
- Adicionar entrada no `order_audit_log` registrando o re-envio

### 3. Badge visual de "desatualizado"

No `OrderSyncBadge`:
- Adicionar estado `outdated` quando o pedido foi editado após `erp_synced_at`
- Comparar `orders.updated_at` com `orders.erp_synced_at` — se `updated_at > erp_synced_at`, mostrar badge "Desatualizado" (amarelo)

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/components/orders/OrderSyncStatus.tsx` | Remover bloqueio de `erpOrderId`, adicionar estado "outdated", tooltip dinâmico |
| `src/components/orders/OrderDialog.tsx` | Auto re-sync após edição de pedido sincronizado |
| `src/pages/Orders.tsx` | Passar `updated_at` e `erp_synced_at` para os componentes de sync |

