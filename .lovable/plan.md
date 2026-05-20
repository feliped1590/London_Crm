## Problemas e correções

### 1. Tarefas não aparecem na lista (somente no calendário)

**Diagnóstico**: o banco confirma que Maria Antonia tem 25 tarefas com `assigned_to = seu user_id` e os contadores das abas mostram corretamente "Pendentes 21 / Atrasadas 7". Ainda assim a lista renderiza vazia. As duas queries usam o mesmo `applyOwnerScope`, mas a query da lista faz `select` com joins embutidos (`companies(name), contacts(...), deals(...)`) enquanto a do contador não. Forte indício de que um erro silencioso (RLS num join ou parsing) está derrubando a query principal — porém `onError` apenas dispara o toast genérico, sem log.

**Ação**:
- Em `src/pages/Tasks.tsx`, expor o erro do `useQuery` da lista (logar no console e exibir mensagem específica em vez de "Nenhuma tarefa encontrada") para diagnosticar definitivamente na sessão da Maria.
- Como mitigação, simplificar o select dos joins (usar a mesma forma usada no calendário: `companies(id, name), contacts(id, first_name, last_name), deals(id, name)`) — alinhar para evitar diferença entre as duas telas.

> Se após o ajuste o erro for outro (ex.: RLS), seguimos com o fix específico em loop seguinte.

### 2. Delegação não permite Maria criar tarefa para cliente da Fernanda

**Causa**: o trigger `check_task_owner_consistency` chama `user_has_sales_rep_access`, que só verifica `user_sales_reps` (vínculo direto). Não considera delegações ativas em `user_portfolio_delegations`.

**Ação (migração)**:
- Atualizar `check_task_owner_consistency` para usar `can_manage_portfolio(auth.uid(), v_company_sales_rep_id, 'task')` no lugar de `user_has_sales_rep_access`.
- Atualizar `can_manage_portfolio` para reconhecer `p_entity_type = 'task'` — mapeando para o flag `can_manage_companies` (mesma carteira lógica usada para criar atividades/contatos com o cliente delegado).

### 3. Clique em tarefa no calendário deve abrir tela de edição

**Estado atual**: `TaskCalendar` abre `TaskDetailDrawer` (apenas leitura + concluir/reabrir). O usuário quer editar.

**Ação**:
- Em `TaskCalendar.tsx`, expor uma prop `onEditTask?: (task) => void`.
- Em `Tasks.tsx`, passar `onEditTask` para o calendário reaproveitando o `handleEdit` existente (que já popula `formData` e abre o `Dialog` de edição).
- Manter `TaskDetailDrawer` apenas como fallback quando `onEditTask` não for fornecido (preserva compatibilidade).

### 4. Cadeado do pedido — permitir desbloqueio para perfis com acesso total + dono/delegado

**Estado atual**:
- Frontend: já libera o botão para `hasOrdersFullAccess` (admin OU acesso total ao módulo Pedidos).
- Backend: a RPC `unlock_order` exige `has_role(admin)` — bloqueia o atendente.

**Regra desejada**: pode desbloquear/alterar se tiver permissão de acesso (admin OU acesso total no módulo Pedidos) **E** o cliente do pedido for da carteira dele (via `user_sales_reps`) ou delegado (via `user_portfolio_delegations`).

**Ações**:
- **Migração**: alterar `unlock_order` para autorizar quando:
  - `has_role(admin)` **OU**
  - usuário tem acesso `total` ao módulo `orders` (via `get_user_module_permissions`) **E** `can_manage_portfolio(auth.uid(), <sales_rep_id do company do pedido>, 'order')` retorna true.
  - Mensagem de erro atualizada para refletir as duas condições.
- **Frontend** (`OrderDialog.tsx`): refinar `canUnlock` para também exigir ownership/delegação quando não-admin (consulta o `usePortfolioProtection` ou hook equivalente do pedido) — evita mostrar botão que o backend recusará.

## Arquivos afetados

- `src/pages/Tasks.tsx` — logs/select da lista; passar `onEditTask` para o calendário.
- `src/components/tasks/TaskCalendar.tsx` — nova prop `onEditTask`, usar quando disponível.
- `src/components/orders/OrderDialog.tsx` — checar ownership/delegação no `canUnlock`.
- **Migração SQL** com:
  - `CREATE OR REPLACE FUNCTION can_manage_portfolio` (add branch `'task'`).
  - `CREATE OR REPLACE FUNCTION check_task_owner_consistency` (usar `can_manage_portfolio`).
  - `CREATE OR REPLACE FUNCTION unlock_order` (nova regra de autorização).
