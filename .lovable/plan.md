

## Plano: Alerta de Tarefas Pendentes no Login

### 1. Migração SQL — RPC + Índice

Criar `check_pending_tasks(p_user_id UUID)` como `SECURITY DEFINER`:
- Usa `date_trunc('day', now())` para comparações sem timezone issues
- Retorna JSON com `overdue_count`, `today_count`, `overdue_tasks` (array de {id, title}), `today_tasks` (array de {id, title})
- Filtra `status != 'done'` e `assigned_to = p_user_id`

Criar índice composto:
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_owner_status_due 
ON public.tasks (assigned_to, status, due_date);
```

### 2. Hook `useLoginTaskAlert`

Novo arquivo `src/hooks/useLoginTaskAlert.ts`:
- Executa **uma vez por login** usando `sessionStorage` key `task_alert_checked_<session_id>`
- Carrega config de `system_settings` key `task_alert_config` (defaults: `enable_task_login_alert: true`, `enable_task_login_sound: true`)
- Se alert habilitado, chama RPC `check_pending_tasks`
- Se total > 0, abre modal com delay de ~800ms + fade-in
- Se som habilitado, toca audio com try/catch no `.play()`
- Retorna estado do modal e dados para o componente

### 3. Componente `TaskAlertModal`

Novo arquivo `src/components/tasks/TaskAlertModal.tsx`:
- Dialog com animação suave (fade-in com delay)
- Exibe contagens de tarefas vencidas e vencendo hoje
- Botão "Ver Tarefas" → navega para `/tasks`
- Botão "Fechar"
- Design discreto e profissional

### 4. Som de Notificação

Gerar um audio inline usando `AudioContext` Web API (tom breve de notificação), evitando necessidade de arquivo externo. Tratamento de erro no `.play()`.

### 5. Configuração no Settings (Notificações)

Adicionar seção dentro da aba **Notificações** (`CustomNotificationsManager` ou diretamente no `TabsContent value="notifications"`), visível apenas para `isDeveloper`:
- Toggle: Ativar/Desativar alerta no login (`enable_task_login_alert`)
- Toggle: Ativar/Desativar som (`enable_task_login_sound`)
- Persiste via upsert em `system_settings` key `task_alert_config`

### 6. Integração no Login

No `Auth.tsx`, após `createSessionAndNavigate` bem-sucedido: nenhuma mudança necessária — o hook será montado no `AppLayout.tsx` e verificará na primeira renderização pós-login.

Integrar `<TaskAlertModal />` no `AppLayout.tsx`, controlado pelo hook `useLoginTaskAlert`.

### Arquivos Criados/Editados

| Ação | Arquivo |
|------|---------|
| Criar | Migração SQL (RPC + índice) |
| Criar | `src/hooks/useLoginTaskAlert.ts` |
| Criar | `src/components/tasks/TaskAlertModal.tsx` |
| Editar | `src/components/layout/AppLayout.tsx` — adicionar hook + modal |
| Editar | `src/pages/Settings.tsx` — adicionar config na aba Notificações |

### Performance

- Índice composto garante query eficiente
- Hook executa apenas 1x por sessão (sessionStorage)
- Delay de 800ms não bloqueia carregamento do dashboard
- RPC é `STABLE SECURITY DEFINER` — sem overhead de RLS

