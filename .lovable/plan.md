# Disparar sync do produto automaticamente após salvar

## Diagnóstico

Hoje o fluxo é:

1. Usuário cria/edita um produto na tela de Produtos.
2. Um **trigger no banco** (`trg_mark_product_pending_sync`) insere automaticamente uma linha em `product_sync_queue` com status `pending` — por isso o badge "Na fila" aparece.
3. **Nada chama a edge function `process-product-sync` na hora.** Quem drena a fila é um cron job (`dispatch-product-sync-15min`) que roda **a cada 15 minutos**.
4. Quando o usuário clica no botão "Reenviar ao ERP" (componente `ProductSyncStatus`), aí sim é feito `supabase.functions.invoke('process-product-sync', { body: { product_id } })` e o item é processado imediatamente.

Por isso parece que o item "fica preso na fila" — na verdade ele está esperando o próximo ciclo do cron. O reenvio manual só "destrava" porque é ele quem efetivamente dispara o processamento naquele momento.

O mesmo padrão (cron 15min + dispatch manual) acontece também em pedidos e empresas, mas o foco do reporte é produto.

## Mudança proposta

Disparar o processamento na hora, logo após o `INSERT`/`UPDATE` do produto no CRM — exatamente como o botão manual já faz, sem alterar lógica de fila nem do ERP.

### Onde mexer (apenas frontend)

`src/pages/Products.tsx`

- **`createMutation.onSuccess`** (linha ~739): depois de criar, chamar
  `supabase.functions.invoke('process-product-sync', { body: { product_id: createdProduct.id } })`
  em modo "fire-and-forget" (sem `await` bloqueante e sem alterar a UX atual). Se a invocação falhar, fazer apenas `console.warn` — o cron ainda processa em até 15 min como fallback, então o usuário nunca fica sem rede de segurança.

- **`updateMutation.onSuccess`** (linha ~774): mesma chamada usando `updatedProduct.id`. Hoje o toast já diz "Sincronização com ERP enfileirada", então a semântica continua correta — apenas garante que o envio acontece em segundos em vez de minutos.

### O que NÃO muda

- Trigger SQL `trg_mark_product_pending_sync` continua igual (fonte única de verdade do enfileiramento).
- `process-product-sync` continua igual (já aceita `product_id` opcional).
- Cron de 15 min continua como fallback para itens que falharem ou ficarem em `retry`.
- Botão "Reenviar ao ERP" no `ProductSyncStatus` continua funcionando como hoje, inclusive para casos de erro/retry.
- Lógica de validação, versões filhas (v2+), atributos (`process-attribute-sync`) e sync de empresas/pedidos: nada alterado.

## Resultado esperado

Ao salvar um produto novo (ou editar um existente), o item entra na fila e em ~1–3 s já sai do status "Na fila" para "Enviado" / "Erro com motivo", sem necessidade de clicar em "Reenviar ao ERP".
