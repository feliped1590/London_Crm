## Objetivo

Unificar referências ao comando ERP de pedidos como `IMP_PEDIDO_ESPECIFICO` (confirmado pelo usuário) — hoje há divergência: o envio real usa `IMP_PEDIDO_ESPECIFICO`, mas o simulador e comentários ainda mencionam `IMP_PEDIDO_V3`.

## Alterações

1. **`src/components/integrations/OrderPayloadSimulator.tsx`**
   - Trocar `grupoComando: 'IMP_PEDIDO_V3'` por `'IMP_PEDIDO_ESPECIFICO'` no envelope (final do `handleSimulate`).
   - Atualizar o título do card: `Simulador de Payload ERP (IMP_PEDIDO_ESPECIFICO)`.

2. **`supabase/functions/process-order-sync/index.ts`**
   - Atualizar o comentário do cabeçalho: `... ao ERP Projedata (IMP_PEDIDO_ESPECIFICO).`

3. **`supabase/functions/_shared/erp/order-endpoint-resolver.ts`**
   - Atualizar o comentário do cabeçalho de `IMP_PEDIDO_V3` para `IMP_PEDIDO_ESPECIFICO`.

4. **`supabase/functions/_shared/projedata/index.ts`** (linha 35)
   - Atualizar comentário da seção: `── Pedidos (IMP_PEDIDO_ESPECIFICO) ──`.

## Fora de escopo

- Nenhuma mudança no `order-mapper.ts` (já usa `IMP_PEDIDO_ESPECIFICO`).
- Nenhuma mudança no payload em si, na fila ou na lógica de sync.
- Não mexer no erro ORA-06502 — investigação separada (próximo passo continua sendo o `erp_user_code` da Fernanda).

## Validação

- Reabrir o simulador e confirmar que o envelope agora exibe `IMP_PEDIDO_ESPECIFICO`, idêntico ao que aparece nos logs do `process-order-sync`.
