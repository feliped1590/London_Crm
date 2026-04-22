

# Plano — Aba "Janela de Acesso" em Configurações → Usuários e Permissões

## Objetivo

Criar uma interface visual para que **Administradores** e **Desenvolvedores** configurem os horários permitidos de acesso ao CRM, com suporte a configuração **por entidade jurídica (CNPJ)**, mantendo compatibilidade com as regras de tenant já existentes.

## Decisões aprovadas

- **Granularidade:** janela aplicada conforme **CNPJ ativo** do usuário (`profiles.active_legal_entity_id`).
- **Compatibilidade:** regra de **CNPJ tem prioridade**; se não houver, cai na regra do **tenant** (fallback). Nada existente quebra.
- **Permissões:** Admin e Desenvolvedor podem editar.
- **UX:** grade semanal visual + lista de exceções (feriados/liberações).

## Mudanças no banco (migração)

### Novas tabelas (espelhando as de tenant, mas por CNPJ)

```text
legal_entity_access_schedules
├── id uuid PK
├── tenant_id uuid NOT NULL          -- isolamento multi-tenant
├── legal_entity_id uuid NOT NULL    -- FK legal_entities
├── weekday smallint (0=Dom … 6=Sáb)
├── start_time time
├── end_time time
├── is_active boolean default true
└── UNIQUE (legal_entity_id, weekday, start_time, end_time)

legal_entity_access_exceptions
├── id uuid PK
├── tenant_id uuid NOT NULL
├── legal_entity_id uuid NOT NULL
├── exception_date date
├── is_allowed boolean
├── description text
└── UNIQUE (legal_entity_id, exception_date)
```

### RLS

- SELECT liberado para usuários autenticados do tenant (para a UI listar).
- INSERT/UPDATE/DELETE apenas para `admin` ou `desenvolvedor`.

### Atualizar `is_within_access_window(p_user_id)`

Nova ordem de resolução:

1. Resolver `v_legal_entity_id` via `profiles.active_legal_entity_id`.
2. Se houver CNPJ ativo **E existir regra cadastrada para esse CNPJ** → avalia exceções e horários **desse CNPJ**.
3. Caso contrário → mantém o caminho atual por `tenant_id` (fallback).
4. Admin/Desenvolvedor continuam imunes com log `admin_bypass`, agora incluindo `legal_entity_id` no `details`.

Isso garante que **nada do que já está configurado por tenant para de funcionar**.

## Mudanças no frontend

### 1. Nova sub-aba dentro de "Usuários e Permissões"

Em `src/pages/Settings.tsx`, adicionar um `TabsTrigger` chamado **"Janela de Acesso"** (ícone `Clock`), visível apenas se `isAdmin || isDeveloper`, posicionado ao lado de "Sessões".

### 2. Novo componente `AccessWindowManager`

Caminho: `src/components/settings/AccessWindowManager.tsx`

Estrutura:

```text
┌─ Seletor de CNPJ ─────────────────────────────────┐
│  [Dropdown: EMBAZEC ▾]   [● Usando regra do CNPJ] │
│                          ou [⚠ Usando regra do    │
│                              tenant (sem regra    │
│                              específica)]         │
└───────────────────────────────────────────────────┘

┌─ Horário Semanal ─────────────────────────────────┐
│  Dia       │ Intervalos                  │ Ações  │
│  Domingo   │ — (bloqueado)               │ [+]    │
│  Segunda   │ 08:00–12:00  13:00–18:00 [x]│ [+]    │
│  Terça     │ 08:00–18:00 [x]             │ [+]    │
│  ...                                              │
│  Sábado    │ 08:00–12:00 [x]             │ [+]    │
└───────────────────────────────────────────────────┘
[Aplicar "Seg–Sex 08:00–18:00" para todos]  (atalho)

┌─ Exceções (feriados / liberações) ────────────────┐
│ [+ Adicionar exceção]                             │
│  ─────────────────────────────────────────────    │
│  📅 21/04/2026  ❌ Bloqueado  "Tiradentes"   [x]  │
│  📅 26/04/2026  ✅ Liberado   "Inventário"   [x]  │
└───────────────────────────────────────────────────┘

┌─ Status atual ─────────────────────────────────────┐
│ 🟢 Acesso PERMITIDO agora (12:34 GMT-3)            │
│  Aplica-se a 8 usuários vinculados a este CNPJ     │
└────────────────────────────────────────────────────┘
```

Funcionalidades:

- **Seletor de CNPJ** no topo, alimentado por `useLegalEntities().accessibleEntities`.
- **Indicador** mostrando se aquele CNPJ já tem regras próprias ou está usando o fallback do tenant.
- **Grade semanal** (7 linhas, uma por dia) com múltiplos intervalos por dia. Botão `+` por linha abre popover com dois `Input type="time"`.
- **Atalho “Aplicar Seg–Sex 08–18”** para configuração rápida de novo CNPJ.
- **Exceções**: dialog com `Calendar` (shadcn datepicker, `pointer-events-auto`), switch Liberar/Bloquear, e campo de descrição.
- **Status atual**: chama `is_within_access_window` com o `user.id` corrente (para feedback imediato). Não é a verdade absoluta, mas dá noção de "está funcionando".

### 3. Hook `useAccessWindowConfig(legalEntityId)`

Caminho: `src/hooks/useAccessWindowConfig.ts`

Encapsula:

- Listar `legal_entity_access_schedules` por CNPJ.
- Listar `legal_entity_access_exceptions` por CNPJ.
- Mutations: criar/editar/excluir intervalos e exceções (com invalidações de cache).
- Helper `hasOwnRules` para o badge "usando regra do CNPJ" vs "fallback tenant".

### 4. Validações no formulário

- `end_time > start_time` (mesmo dia).
- Não permitir intervalos sobrepostos no mesmo dia (validar antes do insert).
- `exception_date` único por CNPJ (constraint cobre, mas UI avisa antes).

## Arquivos a criar/editar

**Criar:**

- `supabase/migrations/<timestamp>_legal_entity_access_window.sql` — tabelas, RLS e nova versão de `is_within_access_window`.
- `src/components/settings/AccessWindowManager.tsx` — UI principal.
- `src/components/settings/AccessWindowDayRow.tsx` — linha da grade semanal (uma por dia).
- `src/components/settings/AccessExceptionDialog.tsx` — dialog de criar/editar exceção.
- `src/hooks/useAccessWindowConfig.ts` — hook com queries e mutations.

**Editar:**

- `src/pages/Settings.tsx` — adicionar sub-aba "Janela de Acesso" dentro de `permissions`, gated por `isAdmin || isDeveloper`.
- `docs/03-business-rules/access-calendar.md` — atualizar para refletir granularidade por CNPJ + fallback tenant.
- `docs/02-decisions/0001-access-control-calendar.md` — addendum sobre evolução para CNPJ.

## Compatibilidade e segurança

- Tenant sem regra de CNPJ + sem regra de tenant → continua **fail-safe** (libera 24/7).
- Função `is_within_access_window` permanece `SECURITY DEFINER`, `STABLE`, sem mudança de assinatura — não precisa mexer em RLS de `deals`/`orders`, em `create_app_session`, `validate_app_session` ou `force_replace_session`.
- Logs de `admin_bypass` e `outside_allowed_hours` ganham `legal_entity_id` no `details` para auditoria mais fina.
- Edge functions (`accessControl.ts`) não precisam mudar — chamam a mesma RPC.

## Como ficará a experiência

1. Admin abre **Configurações → Usuários e Permissões → Janela de Acesso**.
2. Seleciona o CNPJ no topo (ex: QUALYVAC EMBALAGENS).
3. Clica em **Aplicar Seg–Sex 08–18** ou monta a grade manualmente.
4. Adiciona feriado de Tiradentes como exceção bloqueada.
5. Vê o badge **"🟢 Acesso permitido agora"** confirmando.
6. Usuários cujo CNPJ ativo for esse passam a respeitar a janela; os demais seguem com a regra do tenant (ou 24/7 se nenhuma existir).

