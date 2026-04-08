

# Plano: Sincronização Rápida — Resposta Imediata + Polling

## Problema

O botão "Enviar ao ERP" chama a Edge Function e **espera a resposta completa** (todas as queries + chamada ao ERP). Isso leva vários segundos, deixando o botão em loading e travando a UX.

## Solução

Separar em dois momentos:
1. **Disparo**: O botão apenas insere/reseta o item na fila (`order_sync_queue`) direto via Supabase client — retorno imediato (~200ms)
2. **Processamento**: A Edge Function continua sendo chamada em background (fire-and-forget)
3. **Feedback**: O badge de status já faz polling via React Query (`staleTime: 10s`), reduzir para 3s durante sincronização ativa

## Etapa 1 — Refatorar `OrderSyncButton`

No `OrderSyncStatus.tsx`, o `handleSync` passa a:

```typescript
const handleSync = async () => {
  setIsSyncing(true);
  try {
    // 1. Inserir/resetar na fila diretamente (instantâneo)
    const { data: existing } = await supabase
      .from('order_sync_queue')
      .select('id, status')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existing) {
      await supabase.from('order_sync_queue')
        .update({ status: 'pending', attempt_count: 0, error_message: null })
        .eq('id', existing.id);
    } else {
      await supabase.from('order_sync_queue')
        .insert({ order_id: orderId, status: 'pending' });
    }

    toast.success('Pedido adicionado à fila de envio');
    onSyncTriggered?.();

    // 2. Disparar Edge Function em background (fire-and-forget)
    supabase.functions.invoke('process-order-sync', {
      body: { order_id: orderId },
    }).catch(() => {}); // Não espera resposta
    
  } catch (err: any) {
    toast.error(`Erro: ${err.message}`);
  } finally {
    setIsSyncing(false);
  }
};
```

## Etapa 2 — Polling mais agressivo no Badge

No `OrderSyncBadge`, usar `refetchInterval` quando status é `pending` ou `processing`:

```typescript
const { data: queueEntry } = useQuery({
  queryKey: ['order_sync_status', orderId],
  queryFn: async () => { ... },
  staleTime: 5_000,
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    return (status === 'pending' || status === 'processing') ? 3_000 : 15_000;
  },
});
```

## Resultado Esperado

- Botão responde em < 500ms (apenas DB insert)
- Badge atualiza automaticamente a cada 3s enquanto pendente
- Quando ERP responde, badge muda para "Sincronizado" ou "Erro" automaticamente
- Zero mudança na Edge Function

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/components/orders/OrderSyncStatus.tsx` | Refatorar handleSync + polling dinâmico |

