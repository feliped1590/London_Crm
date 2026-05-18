## Objetivo

Trazer para a sincronização de pedidos a mesma experiência rápida, automática e visual que já existe nos produtos: ao salvar/atualizar um pedido, o envio ao ERP dispara sozinho e o usuário acompanha o status mudando em tempo real (fila → processando → sincronizado), sem precisar clicar em "Enviar ao ERP".

## O que já existe hoje

- **Produtos**: o `ProductSyncBadge` escuta mudanças em tempo real (Supabase Realtime) nas tabelas `products` e `product_sync_queue` e atualiza o badge instantaneamente. Há também polling rápido (3s) enquanto o status é `pending`/`processing`.
- **Pedidos**: o `OrderSyncBadge` só usa polling. O `OrderDialog` só auto-dispara sincronização **se o pedido já tinha `erp_order_id`** (reenvio). Pedidos novos e o primeiro envio precisam que o usuário aperte manualmente o botão "Enviar ao ERP".

## Mudanças propostas

### 1. Auto-disparo da sincronização ao salvar pedido (OrderDialog.tsx)

Espelhar o comportamento atual de reenvio para **criação** e **primeira edição**:

- Em `createOrderMutation.onSuccess`:
  - Inserir registro em `order_sync_queue` com `status: 'pending'` para o novo pedido.
  - Invalidar `['order_sync_status', newOrder.id]` para o badge atualizar.
  - Disparar `supabase.functions.invoke('process-order-sync', { body: { order_id } })` em fire-and-forget (sem `await`), igual ao reenvio atual.
- Em `updateOrderMutation` (linhas 545-566): remover a condição `if (order.erp_order_id)` para que **toda atualização** dispare o processo (a função já valida e ignora se nada mudou).
- Toast discreto: "Pedido salvo — enviando ao ERP em segundo plano" (igual mensagem dos produtos).

### 2. Realtime no OrderSyncBadge (OrderSyncStatus.tsx)

Adicionar hook `useOrderSyncRealtime(orderId)` igual ao `useProductSyncRealtime`:

- Canal Supabase Realtime escutando:
  - `UPDATE` em `public.orders` filtrado por `id=eq.${orderId}` (para captar `erp_order_id` e `erp_synced_at` chegando).
  - `*` em `public.order_sync_queue` filtrado por `order_id=eq.${orderId}` (para captar transições pending → processing → completed/failed).
- Em cada evento, `invalidateQueries(['order_sync_status', orderId])` e `['order_sync_status_btn', orderId]`.

Resultado: o badge muda de cor/ícone **no instante** em que o backend atualiza o status, sem esperar o polling de 3s.

### 3. Migration: habilitar Realtime nas tabelas

Garantir que `orders` e `order_sync_queue` estão na publicação `supabase_realtime`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_sync_queue;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_sync_queue REPLICA IDENTITY FULL;
```

(Usa `IF NOT EXISTS` via bloco DO para ser idempotente.)

### 4. Manter o botão "Enviar ao ERP" como fallback

O `OrderSyncButton` continua existindo para casos de erro/reenvio manual. Nada removido — só deixa de ser obrigatório no fluxo feliz.

## Fluxo visual resultante (igual aos produtos)

```text
Usuário salva pedido
        ↓
Toast: "Pedido salvo — enviando ao ERP"
        ↓
Badge muda para "Na fila" (amarelo, pulsando)      ← realtime
        ↓
Badge muda para "Processando" (azul, girando)      ← realtime
        ↓
Badge muda para "Sincronizado" (verde, check)      ← realtime
```

Tudo em ~1-3 segundos no caminho feliz, sem clique extra do usuário.

## Fora de escopo

- Mudar a lógica de validação (`validate-order-sync`) — já funciona.
- Mexer no `process-order-sync` em si — já é rápido.
- Alterar permissões/RLS — não muda nada de acesso.

## Arquivos afetados

- `src/components/orders/OrderDialog.tsx` — auto-disparo no create e remover guarda do update.
- `src/components/orders/OrderSyncStatus.tsx` — adicionar hook de realtime no badge.
- `supabase/migrations/<timestamp>_orders_realtime.sql` — habilitar publicação realtime.