## Causa raiz

O pedido **PED-2026-0074** sincronizou corretamente no ERP (retorno `PEDIDO#22045#20260074`, código ERP = `22045`), mas a coluna `erp_order_code`/`erp_order_id` ficou vazia.

Log da edge function `process-order-sync` mostra exatamente:

```
[process-order-sync] Atualizando orders ... com:
{"erp_sync_status":"success","erp_order_id":22045,"erp_order_code":"22045",...}

ERROR ERRO ao atualizar orders: Pedido bloqueado: apenas o campo status
pode ser alterado. Desbloqueie primeiro para editar outros campos.
(code 23514)
```

O trigger `enforce_order_lock` na tabela `orders` rejeita qualquer UPDATE em pedido com `is_locked = true` que toque em qualquer coluna fora da whitelist (`status`, `is_locked`, `locked_at`, `locked_by`, `updated_at`).

A função `process-order-sync` atualiza a fila ANTES do `orders` (linhas 360-367 da edge function), por isso `order_sync_queue.status = 'completed'` e a UI mostra "Sincronizado", mas o `erp_order_code` no pedido nunca é gravado. Esse mesmo bug afeta:
- `PED-2026-0074` (atual, locked)
- Qualquer pedido locked que for sincronizado depois (todos pedidos aprovados ficam locked).
- Os pedidos `0072` e `0070` funcionaram porque foram sincronizados ANTES do lock.

## Correção

Ampliar a whitelist do trigger `enforce_order_lock` para incluir os campos técnicos de sync ERP, que são gravados exclusivamente pelo backend (service role) e não pelo usuário:

- `erp_sync_status`
- `erp_order_id`
- `erp_order_code`
- `erp_synced_at`
- `erp_last_sync_at`
- `erp_last_update_date`
- `pedido_terceiro` (gravado durante o enfileiramento)

Esses campos são read-only do ponto de vista do usuário (vêm do ERP), portanto liberá-los no trigger não enfraquece o lock comercial.

## Passos

1. Migração SQL substituindo `enforce_order_lock` com a whitelist ampliada (mesma lógica, apenas mais campos no `to_jsonb() - ...`).
2. Backfill do pedido **PED-2026-0074**: gravar manualmente `erp_order_code='22045'`, `erp_order_id=22045`, `erp_sync_status='success'`, `erp_synced_at`/`erp_last_sync_at` com timestamp do último log (`2026-05-18 11:14:46`).
3. (Opcional, fase 2) Adicionar fallback na edge function: se o UPDATE falhar com `23514`, fazer log estruturado em `erp_sync_logs` com severidade `warning` ao invés de só `console.error`, para alarmar via telemetria.

## Validação

- Rodar `process-order-sync` novamente em um pedido locked de teste e confirmar que `erp_order_code` é preenchido.
- Conferir UI da listagem mostrando o número do pedido ERP ao lado do número do pedido CRM.
- Verificar que o trigger continua bloqueando mudanças em campos sensíveis (ex.: `total`, `company_id`) em pedido locked.

## Fora de escopo

- Mudar a ordem de updates na edge function (queue → orders) — desnecessário após corrigir o trigger.
- Refatorar o sistema de lock — funciona corretamente, só precisa abrir exceção para campos do ERP.
