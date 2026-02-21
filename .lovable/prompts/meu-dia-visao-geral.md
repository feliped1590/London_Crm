# PROMPT — Página "Meu Dia" (`/today`) e aba "Visão Geral" (Dashboard)

## 1. Arquitetura de Páginas

### Rota `/today` — Landing page do vendedor
Duas abas (Tabs):
- **"Meu Dia"** (aba padrão) → visão operacional do dia
- **"Visão Geral"** → dashboard analítico com widgets customizáveis

---

## 2. Aba "Meu Dia" — Componentes

### 2.1 `DailySummary` (grid 2x2 → 4 cols em desktop)
Cards resumo com ícones e cores semânticas:

| Card | Métrica | Fonte | Cor |
|------|---------|-------|-----|
| Pipeline | `SUM(deals.value) WHERE stage NOT IN ('won','lost')` | deals | `text-blue-500` |
| Meta | `(vendido_mês / sales_goals.target_value) * 100` | sales_goals + deals | `text-primary` ou `text-green-500` se ≥100% |
| Fechados | `COUNT(deals) WHERE stage='won' AND won_at >= início_mês` | deals | `text-green-500` |
| Atrasados/Próximas | Se overdue > 0: count tarefas atrasadas; senão: tarefas de amanhã | tasks | `text-destructive` ou `text-muted-foreground` |

### 2.2 `TodayTaskList`
- Filtra `tasks` por `assigned_to = auth.uid()` e `due_date = today`
- Agrupa por prioridade: `high` → `medium` → `low`
- Cada item mostra: título, empresa vinculada, horário, badge de prioridade
- Ação rápida: marcar como concluída (checkbox)
- Badge de fonte: `manual`, `deal_stage`, `automation`, `calendar`

### 2.3 `StagnantDealsCard`
- Deals onde `updated_at < now() - interval '5 days'` e `stage NOT IN ('won','lost')`
- Filtro por `owner_id = auth.uid()` (vendedor) ou todos (admin)
- Mostra: nome do deal, empresa, dias parado, valor, estágio atual
- Ação: clicar abre o deal no pipeline

---

## 3. Aba "Visão Geral" — Dashboard

### 3.1 Engine de Widgets (`useDashboardData.ts`)
- Configuração salva em `user_dashboard_configs` (por usuário)
- Drag-and-drop via `@dnd-kit` para reordenar widgets
- 27 tipos de métricas suportados agrupados em categorias:
  - **Deals**: total pipeline, won count, lost count, conversion rate, avg ticket
  - **Tasks**: pending, overdue, completed today
  - **Proposals**: open, expired, approved
  - **Orders**: pending approval, approved, total month
  - **Revenue**: month, quarter, year
  - etc.

### 3.2 Filtros por Role
- **Admin**: vê todos os dados, pode filtrar por vendedor
- **Vendedor**: vê apenas seus dados (`owner_id = auth.uid()`)
- **Gerente**: vê dados do time (via `portfolio_assignments`)

### 3.3 Widgets Especializados

#### `GoalProgressWidget`
- Busca `sales_goals` do mês corrente para o usuário
- Calcula progresso: `achieved_value / target_value * 100`
- Barra de progresso com cores: verde (≥100%), amarelo (≥70%), vermelho (<70%)
- Mostra: meta, realizado, faltante, projeção linear

#### `SellerPortfolioWidget`
- Conta empresas por status: Ativo, Prospect, Inativo
- Baseado em `companies` onde `owner_id = auth.uid()`
- Critérios:
  - **Ativo**: tem pedido nos últimos 90 dias
  - **Prospect**: sem pedido mas com deal aberto
  - **Inativo**: sem pedido e sem deal nos últimos 90 dias

---

## 4. Modelos de Dados Utilizados

### `tasks`
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  due_time?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'cancelled';
  assigned_to: string;        // profiles.id
  company_id?: string;
  contact_id?: string;
  deal_id?: string;
  source: 'manual' | 'deal_stage' | 'automation' | 'calendar';
  tenant_id: string;
  legal_entity_id?: string;
  created_at: string;
  completed_at?: string;
}
```

### `deals` (campos relevantes)
```typescript
interface DealSummary {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  owner_id: string;
  company_id?: string;
  updated_at: string;
  won_at?: string;
  lost_at?: string;
  tenant_id: string;
  legal_entity_id?: string;
}
```

### `sales_goals`
```typescript
interface SalesGoal {
  id: string;
  user_id: string;            // profiles.id
  period_type: 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  target_value: number;
  achieved_value: number;
  tenant_id: string;
  legal_entity_id?: string;
}
```

### `user_dashboard_configs`
```typescript
interface DashboardConfig {
  id: string;
  user_id: string;
  widgets: WidgetConfig[];    // JSON array com tipo, posição, tamanho
  updated_at: string;
}

interface WidgetConfig {
  id: string;
  type: string;               // ex: 'pipeline_value', 'goal_progress'
  position: number;
  size: 'small' | 'medium' | 'large';
  visible: boolean;
}
```

### Hook principal: `useTodayData.ts`
```typescript
interface TodaySummary {
  pipelineValue: number;      // SUM de deals abertos
  goalProgress: number;       // % da meta mensal
  wonThisMonth: number;       // COUNT deals ganhos no mês
  overdueCount: number;       // COUNT tarefas atrasadas
}

interface UpcomingTasksCount {
  today: number;
  tomorrow: number;
  thisWeek: number;
}
```

---

## 5. Formatação e Design System

### Moeda
```typescript
// Sempre usar formatCurrency de @/lib/formatters
formatCurrency(value: number): string  // → "R$ 1.234,56"
```

### Datas
```typescript
// Usar date-fns com locale pt-BR
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
```

### Cores semânticas (usar tokens do design system)
- Sucesso: `text-green-500`, `bg-green-50 dark:bg-green-950`
- Alerta: `text-destructive`, `bg-destructive/10`
- Info: `text-blue-500`, `bg-blue-50 dark:bg-blue-950`
- Neutro: `text-muted-foreground`, `bg-muted`
- Progresso: `text-primary`, `bg-primary/10`

### Badges de prioridade
- `high` → vermelho (`bg-destructive/10 text-destructive`)
- `medium` → amarelo (`bg-yellow-100 text-yellow-800`)
- `low` → cinza (`bg-muted text-muted-foreground`)

---

## 6. Regras de Negócio

1. **tenant_id** é obrigatório em TODAS as queries — nunca fazer query sem filtrar por tenant
2. **legal_entity_id** deve ser aplicado quando o usuário tem restrição de entidade jurídica
3. Vendedor só vê seus próprios dados (`owner_id` / `assigned_to`)
4. Admin vê tudo dentro do tenant
5. Deals "parados" = `updated_at` > 5 dias úteis sem mudança de estágio
6. Meta mensal: `period_type = 'monthly'` e `period_start <= today <= period_end`
7. Dashboard config é per-user — cada um customiza seus widgets
