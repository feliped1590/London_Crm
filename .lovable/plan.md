

# Plano: Supabase Realtime + Smart Cache Sync

## Resumo

Criar um utilitário `realtimeManager.ts` que registra canais Supabase Realtime para `deals`, `companies` e `tasks`, e ao receber eventos `INSERT`/`UPDATE`/`DELETE` atualiza o cache React Query usando as funções do `queryCacheManager.ts` existente. Um hook `useRealtimeSync` será inicializado dentro do `AppInitializer` apenas quando há usuário autenticado.

## Pré-requisito: Migration SQL

Habilitar realtime para as 3 tabelas (hoje só `whatsapp_messages` e `app_sessions` estão habilitadas):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
```

## Arquitetura

```text
AppInitializer (phase === 'ready' && user)
  └ useRealtimeSync(queryClient)
      ├ Canal 'crm-deals'     → postgres_changes (deals)
      ├ Canal 'crm-companies' → postgres_changes (companies)
      └ Canal 'crm-tasks'     → postgres_changes (tasks)
          │
          ├ INSERT → insertItemInList(qc, listKey, payload.new)
          ├ UPDATE → updateItemInList(qc, listKey, id, payload.new, detailPrefix)
          └ DELETE → removeItemFromList(qc, listKey, id, detailPrefix)
```

## Arquivos

### Novo: `src/lib/realtimeManager.ts`

Funções utilitárias:

- `subscribeToTable(supabase, queryClient, config)` — cria canal para uma tabela, mapeia eventos para funções do `queryCacheManager`
- `subscribeAll(supabase, queryClient)` — registra os 3 canais, retorna função de cleanup
- Cada config define: `table`, `channelName`, `listQueryKey`, `detailKeyPrefix`
- Filtragem por `user_id` do evento vs `auth.uid()` para ignorar eventos próprios (evitar double-update quando o mutation local já atualizou o cache)

### Novo: `src/hooks/useRealtimeSync.ts`

- Hook que chama `subscribeAll` no mount e cleanup no unmount
- Recebe `userId` para filtrar eventos próprios
- Só ativa quando `userId` existe

### Modificado: `src/components/AppInitializer.tsx`

- Quando `phase === 'ready'` e `user` existe, renderizar `<RealtimeSyncProvider />` que inicializa o hook
- Alternativa mais limpa: renderizar children normalmente e usar o hook dentro de um componente wrapper no `App.tsx` (dentro do `ProtectedRoute`)

### Modificado: `src/App.tsx`

- Criar componente `RealtimeSync` que usa `useRealtimeSync` e renderiza `null`
- Inserir `<RealtimeSync />` dentro do bloco protegido (após `AppInitializer`, antes das rotas)

## Tratamento de eventos

| Evento | Ação no cache |
|--------|--------------|
| INSERT deals | `insertItemInList(qc, ['deals'], payload.new)` |
| UPDATE deals | `updateItemInList(qc, ['deals'], id, payload.new, 'deal')` |
| DELETE deals | `removeItemFromList(qc, ['deals'], id, 'deal')` |
| INSERT companies | `insertItemInList(qc, ['companies'], payload.new)` |
| UPDATE companies | `updateItemInList(qc, ['companies'], id, payload.new, 'company')` |
| DELETE companies | `removeItemFromList(qc, ['companies'], id, 'company')` |
| INSERT tasks | `insertItemInList(qc, ['tasks'], payload.new)` + invalidate `['today-tasks']`, `['calendar-tasks']` |
| UPDATE tasks | `updateItemInList(qc, ['tasks'], id, payload.new, 'task')` + invalidate `['today-tasks']`, `['calendar-tasks']` |
| DELETE tasks | `removeItemFromList(qc, ['tasks'], id, 'task')` + invalidate `['today-tasks']`, `['calendar-tasks']` |

Para tasks, queries derivadas (`today-tasks`, `calendar-tasks`) recebem `invalidateQueries` porque dependem de filtros de data que não podem ser resolvidos apenas com `setQueryData`.

## Cleanup no logout

O `AuthStateListener` já limpa o cache no `SIGNED_OUT`. Os canais realtime serão limpos pelo cleanup do `useEffect` no `useRealtimeSync` quando o componente desmonta (o que acontece automaticamente quando o `ProtectedRoute` desmonta no logout).

## Proteção contra double-update

Quando o próprio usuário faz uma mutation, o cache já é atualizado pelo `queryCacheManager` local. O evento realtime chegará ~100ms depois. Para evitar flicker:
- Comparar `payload.new` com o dado já em cache — se igual, ignorar (noop)
- Implementado via check simples no handler: se `updateItemInList` encontra o item e os dados já são iguais, não faz re-render

