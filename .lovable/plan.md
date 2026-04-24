Plano refinado — Permissões granulares por ação no CRM

Objetivo
- Evoluir o modelo atual de permissões por módulo (`total` / `restrito` / `none`) para um modelo explícito por ação:
  - `view` — visualizar
  - `create` — criar
  - `edit` — editar
  - `delete` — excluir
- Manter compatibilidade temporária com o modelo atual para evitar quebra em produção.
- Centralizar a autorização em uma camada reutilizável, com baixo acoplamento entre UI, backend e banco.

---

1. Arquitetura-alvo

1.1 Fonte de verdade
- A fonte de verdade de permissões técnicas deve ser o banco de dados.
- O frontend deve apenas consumir permissões resolvidas, nunca inferir privilégios sozinho.
- O backend e as funções server-side devem validar novamente permissões antes de executar mutações sensíveis.

1.2 Separação obrigatória de responsabilidades
- Permissão técnica responde: “o usuário pode tentar executar esta ação neste módulo?”
- Regra de negócio responde: “esta ação é permitida neste registro e neste estado?”
- Exemplo:
  - Usuário tem `orders.delete = true`.
  - Pedido está faturado.
  - Resultado final: exclusão bloqueada por regra de negócio.

Ordem recomendada de validação:
1. Autenticação
2. Permissão técnica de módulo/ação
3. Escopo de dados / multi-tenant / carteira / CNPJ emissor
4. Regra de negócio do domínio
5. Auditoria
6. Execução da ação

---

2. Camada central de autorização

2.1 Conceito
- Criar uma camada única chamada `permissionEngine`.
- API conceitual:
  - `permissionEngine.can(userContext, moduleKey, action)`
  - `permissionEngine.require(userContext, moduleKey, action)`
  - `permissionEngine.getModulePermissions(userContext, moduleKey)`

2.2 Local sugerido no projeto
- Código compartilhável e sem dependência de React:
  - `src/lib/permissions/types.ts`
  - `src/lib/permissions/permissionEngine.ts`
  - `src/lib/permissions/permissionPresets.ts`
  - `src/lib/permissions/moduleRegistry.ts`
- Hook React como adaptador de UI:
  - `src/hooks/useModulePermissions.ts`
- Contexto opcional para cache global de frontend:
  - `src/contexts/PermissionsContext.tsx`
- Backend functions podem replicar a mesma estrutura em `_shared` ou consumir funções SQL equivalentes:
  - `supabase/functions/_shared/permissions.ts`

2.3 Regra de ouro
- O `permissionEngine` deve receber dados já resolvidos ou chamar uma função central para resolvê-los.
- Ele não deve espalhar queries em componentes.
- Componentes devem chamar apenas APIs simples:
  - `can('orders', PermissionAction.Create)`
  - `<PermissionGate moduleKey="orders" action={PermissionAction.Edit}>...</PermissionGate>`

2.4 Consumo no frontend
- `ProtectedRoute` usa apenas `view`.
- Botões de ação usam `create`, `edit` ou `delete`.
- Telas com modo somente leitura continuam renderizando dados quando `view = true` e demais ações estão bloqueadas.

Exemplo conceitual:
```ts
can(ModuleKey.Orders, PermissionAction.View)
can(ModuleKey.Orders, PermissionAction.Create)
can(ModuleKey.Orders, PermissionAction.Edit)
can(ModuleKey.Orders, PermissionAction.Delete)
```

2.5 Consumo no backend / server-side
- Funções que alteram dados devem chamar uma verificação central antes da mutação.
- Exemplo conceitual:
```ts
await requirePermission(userId, 'orders', PermissionAction.Edit)
await assertOrderCanBeEdited(orderId)
```
- A primeira validação é técnica.
- A segunda é regra de negócio.

---

3. ENUM para actions

3.1 Banco
- Criar enum no banco:
```sql
create type public.permission_action as enum ('view', 'create', 'edit', 'delete');
```

3.2 Código TypeScript
- Criar enum ou const object tipado:
```ts
export enum PermissionAction {
  View = 'view',
  Create = 'create',
  Edit = 'edit',
  Delete = 'delete',
}
```

3.3 Aplicação
- Não usar strings soltas nos componentes.
- Componentes, hooks e funções devem importar `PermissionAction`.
- O banco deve validar actions via enum ou colunas booleanas padronizadas.

3.4 Modelo de armazenamento recomendado
- Para simplicidade operacional e boa performance na UI, manter colunas booleanas na tabela principal:
  - `can_view boolean not null default false`
  - `can_create boolean not null default false`
  - `can_edit boolean not null default false`
  - `can_delete boolean not null default false`
- O enum continua útil para RPCs, logs e APIs:
  - `has_module_permission(_user_id uuid, _module_key text, _action permission_action)`
  - auditoria com `changed_action permission_action`

Motivo:
- Colunas booleanas simplificam matriz de permissões na interface.
- Enum evita strings livres em APIs, logs e funções de autorização.

---

4. Estrutura de banco sugerida

4.1 Tabela existente a evoluir
- `role_module_permissions`
- Adicionar colunas novas sem remover as antigas inicialmente:
```sql
alter table public.role_module_permissions
add column if not exists can_view boolean not null default false,
add column if not exists can_create boolean not null default false,
add column if not exists can_edit boolean not null default false,
add column if not exists can_delete boolean not null default false;
```

4.2 Backfill seguro
```sql
update public.role_module_permissions
set
  can_view = can_access,
  can_create = can_access and access_type = 'total',
  can_edit = can_access and access_type = 'total',
  can_delete = false;
```

Recomendação importante:
- `delete` deve iniciar desativado por padrão, mesmo para permissões legadas `total`.
- Administrador/desenvolvedor podem ter bypass técnico via função, mas ações destrutivas ainda devem respeitar regra de negócio e auditoria.

4.3 Dependência entre permissões
- `create`, `edit` e `delete` exigem `view`.
- Se `can_view = false`, as demais devem ser `false`.
- Pode ser garantido por trigger de normalização.

Regra recomendada:
```sql
if can_create or can_edit or can_delete then can_view = true;
if not can_view then can_create = false; can_edit = false; can_delete = false;
```

4.4 RPCs novas
- `get_user_module_permissions(_user_id uuid)`
  - Retorna todos os módulos com permissões granulares resolvidas.
- `has_module_permission(_user_id uuid, _module_key text, _action permission_action)`
  - Retorna booleano.
- `assert_module_permission(...)`
  - Opcional para backend, lança erro padronizado quando não autorizado.

4.5 Compatibilidade temporária
- Manter RPCs antigas durante a transição:
  - `get_user_modules`
  - `has_module_access`
- Fazer as antigas derivarem das novas ou manter ambas sincronizadas.
- O frontend pode migrar aos poucos sem quebra.

---

5. Estrutura JSON sugerida

5.1 Payload resolvido por usuário
```json
{
  "userId": "uuid",
  "roles": ["vendedor"],
  "isAdmin": false,
  "modules": {
    "orders": {
      "view": true,
      "create": true,
      "edit": true,
      "delete": false
    },
    "reports": {
      "view": true,
      "create": false,
      "edit": false,
      "delete": false
    }
  },
  "resolvedAt": "2026-04-24T00:00:00Z",
  "version": 1
}
```

5.2 Presets para modo simples
```json
{
  "none": {
    "view": false,
    "create": false,
    "edit": false,
    "delete": false
  },
  "view_only": {
    "view": true,
    "create": false,
    "edit": false,
    "delete": false
  },
  "standard": {
    "view": true,
    "create": true,
    "edit": true,
    "delete": false
  },
  "full_with_delete": {
    "view": true,
    "create": true,
    "edit": true,
    "delete": true
  }
}
```

---

6. Estratégia de cache

6.1 Frontend
- Usar React Query como cache primário.
- Query key sugerida:
  - `['permissions', user.id]`
- `useModulePermissions` deve buscar tudo uma vez e expor métodos locais:
  - `can(moduleKey, action)`
  - `getModulePermissions(moduleKey)`
  - aliases legados: `canAccess`, `hasFullAccess`, `hasRestrictedAccess`

6.2 Invalidação no frontend
- Invalidar cache quando:
  - administrador altera permissões no `PermissionsManager`;
  - usuário troca de tenant/contexto;
  - login/logout;
  - sessão é renovada com alteração de papel;
  - evento realtime opcional de alteração de permissões for recebido.

6.3 Backend
- Preferir consulta direta para operações sensíveis.
- Cache backend opcional somente para leituras não críticas e com TTL curto.
- Para `delete`, `edit` financeiro, ERP ou ações críticas: sem cache longo; validar no momento da ação.

6.4 Impacto de performance
- Buscar permissões em lote reduz chamadas repetidas por tela.
- Checagens `can()` no frontend viram lookup em memória.
- RPC central evita múltiplas queries dispersas.

---

7. Regras de precedência e robustez

7.1 Precedência
- CRUD técnico nunca libera sozinho uma ação de negócio.
- A permissão técnica é pré-condição, não decisão final.

7.2 Exemplos
- `orders.delete = true`, mas pedido faturado: bloqueia.
- `companies.edit = true`, mas cliente pertence a outro vendedor sem delegação: bloqueia.
- `pipeline.edit = true`, mas etapa está travada por checklist obrigatório: bloqueia.

7.3 Como garantir
- Criar funções de domínio separadas:
  - `canDeleteOrderByBusinessRule(order)`
  - `canEditCompanyByOwnership(user, company)`
  - `canMoveDealByPipelineRule(deal, targetStage)`
- `permissionEngine` não deve conhecer todas as regras de domínio.
- O fluxo final deve compor:
```ts
permissionEngine.require(user, 'orders', PermissionAction.Delete)
orderPolicy.requireDeletable(order)
```

---

8. Tratamento especial para DELETE

8.1 Recomendação
- `delete` deve ser desativado por padrão.
- Preferir soft delete para entidades operacionais:
  - empresas
  - contatos
  - negócios
  - pedidos
  - propostas
  - produtos

8.2 Hard delete
- Reservar hard delete para:
  - administradores/desenvolvedores;
  - rotinas técnicas controladas;
  - dados temporários ou staging;
  - casos com auditoria explícita.

8.3 UX para delete
- Exibir ação de exclusão com destaque visual.
- Exigir confirmação.
- Para entidades críticas, exigir motivo.
- Registrar sempre em auditoria.

---

9. Auditoria de alterações de permissões

9.1 Tabela sugerida
```sql
create table public.user_permission_changes (
  id uuid primary key default gen_random_uuid(),
  changed_at timestamptz not null default now(),
  changed_by uuid not null,
  target_role text null,
  target_user_id uuid null,
  module_key text not null,
  action public.permission_action null,
  old_value boolean null,
  new_value boolean null,
  old_snapshot jsonb null,
  new_snapshot jsonb null,
  reason text null,
  source text not null default 'permissions_manager',
  tenant_id uuid null
);
```

9.2 Quando registrar
- Ao alterar qualquer permissão em role/perfil.
- Ao aplicar preset em lote.
- Ao conceder exceção direta por usuário, caso isso seja implementado futuramente.
- Ao remover permissões.

9.3 Uso
- Auditoria interna.
- Rastreabilidade de incidentes.
- Histórico de “quem liberou o quê”.
- Possível rollback manual usando snapshots.

9.4 Segurança
- Somente administradores/desenvolvedores devem consultar logs completos.
- Usuários comuns não devem ver alterações de permissões.

---

10. UX proposta

10.1 Modo simples
- Ideal para operação diária.
- Por módulo, mostrar presets:
  - Sem acesso
  - Somente visualizar
  - Criar e editar
  - Acesso completo com exclusão
- `delete` deve aparecer como opção destacada e não vir ativado por padrão.

10.2 Modo avançado
- Matriz por módulo x ação:
  - ícone de olho para `view`
  - ícone de mais para `create`
  - ícone de lápis para `edit`
  - ícone de lixeira para `delete`
- Ações dependentes devem ativar `view` automaticamente.
- Ao desativar `view`, desativar as demais ações.

10.3 Redução de confusão
- Usar labels de negócio, não termos técnicos, quando possível:
  - Visualizar
  - Criar
  - Editar
  - Excluir
- Mostrar tooltip curto para delete:
  - “Ação sensível. Pode exigir confirmação e auditoria.”
- Separar visualmente módulos críticos:
  - Pedidos
  - Financeiro/crédito
  - Configurações
  - Integrações

---

11. Migração segura sem quebra

11.1 Fase de compatibilidade
- Adicionar colunas novas e RPCs novas.
- Manter colunas antigas:
  - `can_access`
  - `access_type`
- Manter hooks antigos funcionando por aliases.

11.2 Fallback
- Se permissões granulares ainda não existirem para um perfil/módulo:
  - `can_view = can_access`
  - `can_create/edit = access_type = 'total'`
  - `can_delete = false`
- Em caso de erro ao carregar permissões no frontend:
  - para rotas: bloquear ou limitar a somente leitura conforme estratégia atual;
  - para mutações: bloquear por segurança.

11.3 Rollback
- Como colunas antigas permanecem, o frontend pode voltar a usar `access_type`.
- A migration inicial deve ser aditiva.
- Não remover legado até as telas críticas estarem migradas e testadas.

---

12. Riscos e mitigação

12.1 Risco: usuário perder acesso por erro de backfill
- Mitigação: migration aditiva, validação de contagem por módulo/perfil, fallback legado.

12.2 Risco: UI mostrar botão que backend bloqueia
- Mitigação: backend sempre valida de novo; frontend é conveniência, não segurança.

12.3 Risco: permissões conflitarem com regra de negócio
- Mitigação: separar permission engine de policies de domínio.

12.4 Risco: cache atrasado após alteração
- Mitigação: invalidar React Query após salvar, TTL curto, realtime opcional.

12.5 Risco: delete liberar ações perigosas
- Mitigação: delete false por padrão, soft delete, confirmação, motivo e auditoria.

---

13. Plano final de execução incremental

Etapa 1 — Preparação e inventário
- Confirmar lista final de módulos em `system_modules`.
- Confirmar perfis existentes.
- Mapear telas que hoje usam `hasRestrictedAccess`, `AccessControlledButton` e `ProtectedRoute`.

Etapa 2 — Banco aditivo
- Criar enum `permission_action`.
- Adicionar colunas `can_view`, `can_create`, `can_edit`, `can_delete`.
- Fazer backfill a partir do modelo legado.
- Garantir dependência entre permissões por trigger ou função de normalização.
- Criar tabela `user_permission_changes`.

Etapa 3 — RPCs centrais
- Criar `get_user_module_permissions`.
- Criar `has_module_permission`.
- Manter RPCs antigas compatíveis.
- Testar admin, desenvolvedor, vendedor e perfis operacionais.

Etapa 4 — Permission engine no frontend
- Criar `PermissionAction`.
- Criar `permissionEngine` puro em `src/lib/permissions`.
- Atualizar `useModulePermissions` para consumir o novo payload.
- Manter aliases antigos para não quebrar componentes existentes.

Etapa 5 — Proteção de rotas
- Atualizar `ProtectedRoute` para usar `PermissionAction.View`.
- Garantir que rotas desconhecidas mantenham comportamento seguro.

Etapa 6 — Componentes de UI
- Evoluir `AccessControl.tsx` para aceitar `action` explicitamente.
- Criar `PermissionGate` ou equivalente.
- Migrar botões críticos gradualmente.

Etapa 7 — Permissions Manager
- Implementar modo simples com presets.
- Implementar modo avançado com matriz CRUD.
- Destacar `delete` como sensível.
- Registrar alterações em `user_permission_changes`.

Etapa 8 — Backend e funções server-side
- Criar helper server-side `requirePermission`.
- Aplicar primeiro em mutações críticas:
  - pedidos
  - propostas
  - integrações ERP
  - configurações
  - financeiro/crédito
- Compor validação técnica + regra de negócio.

Etapa 9 — Testes e validação
- Testar matriz de permissões por perfil.
- Testar fallback legado.
- Testar usuário sem permissão direta por URL.
- Testar cache após alteração de permissão.
- Testar delete bloqueado por padrão.
- Testar regras de negócio sobrepondo CRUD.

Etapa 10 — Remoção gradual do legado
- Após estabilização, substituir usos de `access_type` por CRUD.
- Remover aliases somente quando não houver dependência.
- Opcionalmente manter `access_type` como campo derivado para relatórios ou compatibilidade administrativa.

---

Decisão arquitetural recomendada
- Usar permissões por role/perfil como modelo principal.
- Evitar permissões diretas por usuário no primeiro momento para reduzir complexidade.
- Permissões diretas por usuário podem ser evolução futura, como exceções auditadas.
- Centralizar autorização em `permissionEngine` + RPCs, mantendo regras de negócio em policies específicas de domínio.