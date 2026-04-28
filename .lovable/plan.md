Vou ajustar a sincronização de pedidos para reconhecer esse retorno da Projedata como um bloqueio definitivo, sem novas tentativas automáticas.

Plano:

1. Identificar erro definitivo da Projedata
   - No processamento de pedidos, detectar mensagens como:
     - “Não é permitido alterar/remover pedido, pois o mesmo já saiu do fluxo inicial”
   - Tratar esse caso como “não sincronizável”, e não como erro temporário.

2. Remover da fila de retry
   - Atualizar o item em `order_sync_queue` com status final, sem `next_retry_at`.
   - Manter a mensagem original do ERP para auditoria.
   - Zerar/parar novas tentativas para evitar que o pedido volte para “Na fila”.

3. Refletir corretamente no pedido
   - Atualizar o status de sync do pedido para erro final/bloqueado.
   - Registrar em `order_sync_log` e `erp_sync_logs` que foi uma falha definitiva do ERP, não uma falha técnica.

4. Ajustar a interface da lista de pedidos
   - Exibir um badge mais claro, por exemplo “Não sincronizável” ou “Bloqueado ERP”, quando esse retorno ocorrer.
   - No tooltip, mostrar uma mensagem amigável:
     “A Projedata não permite sincronizar novamente este pedido porque ele já avançou no fluxo do ERP.”
   - Evitar que o botão de sincronizar gere a impressão de que o sistema continuará tentando automaticamente.

Detalhes técnicos:

- Arquivo principal da regra: `supabase/functions/process-order-sync/index.ts`.
- O fluxo atual coloca erros do ERP novamente como `pending` até 5 tentativas. Vou criar uma classificação para erros permanentes do ERP antes desse cálculo de retry.
- A tela usa `src/components/orders/OrderSyncStatus.tsx` para badge, tooltip e botão de sincronização. Vou adicionar o tratamento visual para esse status/mensagem.
- Não será necessário criar tabela nova. A solução aproveita os campos atuais da fila (`status`, `error_message`, `next_retry_at`, `attempt_count`).