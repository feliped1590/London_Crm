
## Refinamento UX do fluxo Salvar/Bloquear no OrderDialog

### Comportamento atual (problemas)
1. Ao clicar **"Bloquear Pedido"**, o sistema salva silenciosamente e bloqueia em sequência. O usuário não tem ciência clara de que precisa salvar antes.
2. Ao clicar **"Salvar Alterações"**, o `updateOrderMutation.onSuccess` chama `onOpenChange(false)` imediatamente — o modal fecha mesmo quando o usuário ainda pretendia bloquear.

### Solução proposta

**Parte 1 — Detectar alterações pendentes e alertar antes do bloqueio**

Adicionar detecção de "alterações não salvas" (`hasUnsavedChanges`) comparando o estado atual do formulário com o snapshot original do pedido (já existe `originalItems`; vamos estender para os outros campos via um `originalSnapshot`).

Quando o usuário clicar em **"Bloquear Pedido"**:
- Se houver alterações pendentes → abrir um `AlertDialog` informando:
  > "Existem alterações não salvas. Salve o pedido antes de bloqueá-lo."
  
  Botões:
  - **Cancelar** (fecha o alerta)
  - **Salvar e Bloquear** (executa o fluxo de salvar + bloquear, mantendo o comportamento atual encadeado)
- Se não houver alterações → executar `lock_order` direto (sem precisar passar pelo `updateOrderMutation`).

**Parte 2 — Não fechar o modal automaticamente após salvar**

Introduzir uma flag interna `keepOpenAfterSave` no `updateOrderMutation`:
- Quando o usuário clicar em **"Salvar Alterações"** (botão padrão) → manter comportamento de **fechar** o modal (esse é o comportamento esperado pelo fluxo normal).
- Quando o salvamento for parte de um fluxo encadeado (ex.: "Salvar e Bloquear", ou clique direto no Bloquear) → **não fechar** após o save; mostrar toast de sucesso intermediário ("Alterações salvas. Aplicando bloqueio...") e aguardar o `lock_order` finalizar antes de fechar.

Implementação técnica:
- Refatorar `updateOrderMutation` para aceitar um parâmetro `{ silent?: boolean; keepOpen?: boolean }` via `mutateAsync(variables)`. Quando `keepOpen = true`, o `onSuccess` **não** chamará `onOpenChange(false)` nem mostrará o toast genérico.
- Reescrever `lockOrderMutation.mutationFn` para chamar `updateOrderMutation.mutateAsync({ keepOpen: true, silent: true })` antes do RPC.
- Sequência de toasts no fluxo "Salvar e Bloquear":
  1. `toast.loading('Salvando alterações...')`
  2. Após save: `toast.success('Alterações salvas. Aplicando bloqueio...')`
  3. Após lock: `toast.success('Pedido bloqueado com sucesso')` → fecha modal.

**Parte 3 — Reaproveitamento no AlertDialog de saída**

O `AlertDialog "Sair sem bloquear"` já existente continua funcional. A ação "Bloquear e sair" passará pelo mesmo fluxo unificado (com a verificação de alterações pendentes e a sequência de toasts).

### Arquivos afetados
- `src/components/orders/OrderDialog.tsx` (única alteração)

### Detalhes técnicos
- Adicionar `originalSnapshot` (state) preenchido junto com `originalItems` no `useEffect` que carrega o pedido.
- Helper `hasUnsavedChanges()` comparando: items (qtd, preço, desconto, IPI, comissão), companyId, contactId, deliveryDate, observations, paymentMethod, paymentTerms, dealId, ipiMode, orderType, logística.
- Novo state `showLockUnsavedAlert: boolean` para o AlertDialog específico do bloqueio.
- Mutation `updateOrderMutation` refatorada para aceitar variáveis: `useMutation<Order, Error, { keepOpen?: boolean; silent?: boolean } | void>`.

### Critérios de aceite
- Clicar em **Bloquear** com alterações pendentes → mostra alerta exigindo confirmação ("Salvar e Bloquear" ou "Cancelar").
- Clicar em **Bloquear** sem alterações pendentes → bloqueia direto (sem re-save desnecessário).
- Clicar em **Salvar Alterações** isolado → comportamento atual (fecha modal após sucesso).
- Fluxo "Salvar e Bloquear" → modal permanece aberto entre o save e o lock; só fecha após o lock concluir.
- Toast de sucesso intermediário visível durante o encadeamento.

### Riscos
- Baixo. Mudança contida em um único componente; lógicas de RPC (`lock_order`, `update`) inalteradas.
- A flag `keepOpen` é opcional → comportamento padrão preservado em todos os outros call sites do `updateOrderMutation`.
