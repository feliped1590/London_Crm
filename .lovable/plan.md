<final-text>Reavaliação feita. O problema principal não é o conceito de bloqueio em si, e sim a implementação atual ter ficado “meio migrada”: o pedido já tem lock em nível de entidade, mas a UI ainda depende de estado antigo e do lock por item.

O que identifiquei agora:

1. O botão X realmente está quebrado
- Em `src/components/orders/OrderDialog.tsx`, o `Dialog` chama `onOpenChange(false)` quando tenta fechar.
- Mas `handleDialogClose` trata o parâmetro como “devo fechar?” e faz `if (!shouldClose) return;`
- Resultado: clicar no X ou fora do dialog não fecha nada e nem abre o alerta de saída.

2. O “Bloquear Pedido” pode até estar funcionando no backend, mas a tela não reflete
- O dialog recebe `order={orderToEdit}` vindo de `src/pages/Orders.tsx`.
- `orderToEdit` é um snapshot salvo em state quando o usuário abriu a edição.
- Depois do `lock_order`, a query `orders` é invalidada, mas o objeto `orderToEdit` aberto no dialog continua antigo.
- Resultado: o backend pode bloquear, mas o dialog continua achando que `is_locked = false`, então parece que “nada aconteceu”.

3. Isso explica o “não está deixando salvar”
- Se o lock no banco já aconteceu, mas a UI continua “editável”, o usuário ainda tenta salvar.
- Aí o banco barra parte das alterações pelo trigger de `orders` / `order_items`.
- Então o fluxo fica inconsistente: a UI parece aberta para edição, mas o backend já não aceita.

4. Hoje ainda existe lock por item atuando de verdade no frontend
- `toggleItemLock`, `updateItem`, `handleRemoveItem` e `OrderItemDetailModal` ainda usam `item.is_locked`.
- Então, na prática, o sistema está com 2 conceitos ao mesmo tempo:
  - lock do pedido
  - lock do item
- Isso gera confusão e comportamento duplicado.

5. O trigger de `orders` ainda não está “total”
- A regra atual compara campos manualmente.
- Ela cobre alguns campos, mas não todos os campos editáveis do pedido/logística.
- Ou seja: mesmo com pedido bloqueado, ainda existe risco de algum campo escapar se não estiver na lista comparada.

Resposta objetiva à sua pergunta:
- Não, agora que o bloqueio é no pedido, não faz sentido manter lock por item como regra de negócio.
- O campo `order_items.is_locked` pode ficar temporariamente como legado, mas deve parar de controlar edição.
- A fonte de verdade precisa ser apenas `orders.is_locked`.

Plano de correção:

1. Corrigir o fechamento do dialog
- Refatorar `handleDialogClose` para respeitar a semântica real do `onOpenChange`.
- Fazer X, overlay e botão “Cancelar/Fechar” passarem pelo mesmo fluxo.
- Se o pedido estiver editável e desbloqueado, abrir corretamente o alerta de saída.
- Se estiver bloqueado ou readonly, fechar normalmente.

2. Corrigir o estado do pedido aberto
- Em `src/pages/Orders.tsx`, parar de guardar o pedido inteiro em state.
- Guardar apenas o `orderId` em edição e derivar o pedido atual a partir da query `orders`.
- Assim, quando `lock_order` / `unlock_order` invalidar a query, o dialog reflete imediatamente o novo `is_locked`.

3. Fazer o lock refletir imediatamente na UI
- Após bloquear:
  - mostrar badge de bloqueado
  - desabilitar o formulário inteiro
  - esconder botão salvar
  - manter visualização, aba de histórico/liberações e unlock (se autorizado)
- Sem precisar fechar e reabrir o dialog.

4. Remover o lock por item da regra de negócio do frontend
- Tirar o cadeado por item da lógica de edição.
- Remover guards como:
  - `if (items[index]?.is_locked) return`
  - `disabled={locked}`
  - `OrderItemDetailModal` baseado em `draft.is_locked`
- Se quiser manter algum vestígio visual temporário, ele deve ser puramente legado, sem bloquear nada.

5. Endurecer o trigger do banco
- Substituir a comparação manual por comparação do registro inteiro, exceto campos explicitamente permitidos.
- Exemplo de abordagem:
  - permitir só `status`, `is_locked`, `locked_at`, `locked_by`, `updated_at`
  - bloquear qualquer diferença além disso
- Isso fecha a brecha dos campos de logística/outros campos não listados hoje.

6. Manter o trigger de `order_items` como proteção do pedido pai
- `INSERT/UPDATE/DELETE` em `order_items` continua proibido quando `orders.is_locked = true`
- Essa parte conceitualmente está correta e deve continuar.

7. Validar os fluxos finais
- Bloquear pedido e ver a UI travar na hora
- Salvar pedido desbloqueado normalmente
- X / cancelar / overlay funcionando
- Alteração de status funcionando mesmo com pedido bloqueado
- Unlock funcionando para admin
- Tentativa de alterar pedido/itens via API falhando no banco
- Confirmar que nenhum campo de logística escapa do lock

Arquivos que eu vou ajustar quando você aprovar:
- `src/components/orders/OrderDialog.tsx`
- `src/components/orders/OrderItemDetailModal.tsx`
- `src/pages/Orders.tsx`
- nova migration SQL para corrigir o trigger `enforce_order_lock`

Resumo final:
- O lock por item não é mais necessário como regra de negócio.
- O X não funciona por bug no `onOpenChange`.
- O botão bloquear aparenta não funcionar porque o dialog fica com um pedido “congelado” em state antigo.
- O save fica inconsistente porque o backend já bloqueou, mas a UI ainda acha que pode editar.
- O necessário agora é consolidar tudo no lock do pedido e remover o comportamento residual por item.</final-text>