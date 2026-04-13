

# Plano: Edição Inline de Item do Pedido ao Clicar no Produto

## Problema Atual
Clicar no produto abre uma nova aba para a página de Produtos (link externo). O usuário quer editar os dados **do item no pedido** diretamente, sem sair do dialog.

## Solução

Substituir o `window.open` por um **sub-dialog de edição do item** que abre dentro do OrderDialog. O sub-dialog mostra todos os campos editáveis do item em layout espaçoso. Alterações afetam apenas o pedido atual (estado local `items`).

### 1. Criar componente `OrderItemEditDialog`

Novo arquivo: `src/components/orders/OrderItemEditDialog.tsx`

- Dialog pequeno que recebe o `OrderItemDraft` e callbacks
- Campos editáveis: Quantidade, Preço Unitário, Comissão %, IPI %
- Campos somente leitura: SKU, Descrição, Fator KG
- Botões: Salvar (aplica ao estado local) / Cancelar
- Ao salvar, chama `onSave(updatedItem)` que atualiza o `items[index]` no OrderDialog

### 2. Alterar `OrderDialog.tsx`

- Remover `ExternalLink` import e o `window.open`
- Adicionar estado: `editingItemIndex: number | null`
- No `onClick` do produto: `setEditingItemIndex(index)`
- Trocar ícone `ExternalLink` por `Edit` (lápis)
- Renderizar `<OrderItemEditDialog>` passando `items[editingItemIndex]`
- No `onSave`: atualizar item via `setItems` e fechar o sub-dialog

### 3. Comportamento

- Alterações ficam apenas no estado local (`items[]`) até o pedido ser salvo
- Nenhum outro pedido é afetado
- O sub-dialog respeita `canEdit` (campos desabilitados se não pode editar)

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/orders/OrderItemEditDialog.tsx` | Criar — sub-dialog de edição do item |
| `src/components/orders/OrderDialog.tsx` | Alterar — trocar link externo por abertura do sub-dialog |

## Sem Impacto

- Nenhuma migration necessária
- Nenhum cálculo alterado
- Persistência continua igual (só salva quando o pedido é salvo)

