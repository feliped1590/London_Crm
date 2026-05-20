# Liberar mudança de status do pedido para perfis com acesso total

## Diagnóstico

O botão de avançar status (Liberações) é controlado pelo hook `src/hooks/useOrderApproval.ts`. Hoje as regras são **hardcoded por role**:

```ts
allowedRoles: ['admin', 'vendedor']
// canApproveNextTransition: só passa se isAdmin OU role === 'vendedor'
// canCancelOrder: só passa se isAdmin
```

Ou seja, mesmo liberando "acesso total" ao módulo **Pedidos** para o perfil Atendente no Gerenciador de Permissões, o hook ignora isso — ele só olha para a role do usuário. Por isso a ação de mudar status não aparece.

## Mudança proposta (apenas frontend)

Ajustar `src/hooks/useOrderApproval.ts` para considerar também a permissão do módulo `orders`:

1. Importar e usar `useModulePermissions` (já é usado para `isAdmin`) para obter `hasFullAccess('orders')` e `can('orders', 'edit')`.
2. **`canApproveNextTransition`**: além de `isAdmin` e da role `vendedor`, liberar quando o usuário tiver acesso **total** ao módulo `orders` (equivalente a admin do módulo, sem exigir ownership). Para acesso **restrito** com `edit`, manter o requisito de ownership (igual ao vendedor) — assim mantemos a lógica de portfólio.
3. **`canCancelOrder` / `cancelMutation`**: liberar também para quem tem acesso total ao módulo `orders`, não apenas `isAdmin`.
4. Manter as transições internas (em_producao → produzido → faturado → entregue) restritas — quem tem acesso total a Pedidos passa a poder executá-las também, já que é esse o significado de "acesso total" no gerenciador.

## Fora de escopo

- Não alterar RLS/policies do banco — a UPDATE em `orders` e INSERT em `order_approvals` já são governados pelas policies existentes; se houver bloqueio adicional no banco para atendente, trato em seguida após validação.
- Não mexer em outros gates (edição de campos, desbloqueio de pedido travado) — só na exibição/execução das ações de mudança de status, que foi o reportado.

## Validação

Logar como o usuário Atendente com acesso total a Pedidos e confirmar que o botão "Liberar para Produção / Faturamento / Faturar / Entregue" aparece na aba **Liberações** e executa a transição.
