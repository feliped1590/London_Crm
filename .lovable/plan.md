
# Backlog Executável: Fase 1 - Licença para Jogar

## ✅ Progresso da Implementação

### Sprint 1: Fundação - CONCLUÍDO
- [x] Migração: Tabela `pipelines` criada com RLS
- [x] Migração: Tabela `sales_goals` criada com RLS
- [x] Migração: Coluna `pipeline_id` adicionada a `deals`
- [x] Hook `usePipelines` implementado
- [x] Hook `useSalesGoals` implementado
- [x] Componente `PipelinesManager` em Settings
- [x] Componente `SalesGoalsManager` em Settings
- [x] Componente `GoalProgressWidget` no Dashboard

### Próximos Passos (Sprint 2)
- [ ] Página `/today` (Modo Execução Diário)
- [ ] Hook `useTodayData`
- [ ] Busca Global com Cmd+K
- [ ] Badge "Dias na Etapa" no Pipeline

---

## Ajustes Conceituais Incorporados

### 1. Responsável por Etapa (Documentado)
- O responsável por etapa **NÃO substitui** o `owner_id` do deal
- Define quem executa **naquela fase específica** do processo
- Serve para: SLA, cobrança operacional, clareza de ownership
- Campo: `pipeline_stages.default_owner_id` (opcional, sugere owner ao entrar na etapa)

### 2. Checklists Validados por IA (Princípios)
- IA **sugere e valida automaticamente** quando possível
- **Decisões críticas** sempre exigem confirmação humana
- IA **não bloqueia o fluxo** sem transparência ao usuário
- Tipos: `manual`, `ai_suggest` (IA marca, humano confirma), `ai_auto` (IA valida silenciosamente)

### 3. IA Proativa (Níveis Claros)
| Nível | Descrição | Fase |
|-------|-----------|------|
| 1 | Alertas e Daily Digest | Fase 3 |
| 2 | Sugestão de próxima ação | Fase 3 |
| 3 | Coaching, reorganização, scoring | Fase 3+ |

### 4. Métrica Norte da Fase 1
- **Tempo médio diário de uso do CRM por usuário**
- Uso recorrente = valor percebido
- Meta: +20% após implementação

---

## Estrutura de Entrega

### Sprint 1: Fundação (1-2 semanas)

#### 1.1 Tabela `pipelines` + Migração de Dados
**Complexidade:** Média | **Risco:** Baixo

**Entregáveis:**
- Criar tabela `pipelines` com campos:
  - `id`, `name`, `description`, `type` (sales, post_sales, support)
  - `is_default`, `is_active`, `created_by`, `created_at`
- Criar índices e RLS policies
- Criar pipeline padrão "Vendas" automaticamente
- Adicionar `pipeline_id` à tabela `deals` (FK opcional)
- Migrar todos os deals existentes para pipeline padrão

**SQL Proposto:**
```sql
-- Tabela de Pipelines
CREATE TABLE public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'sales',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_type CHECK (type IN ('sales', 'post_sales', 'support'))
);

-- Adicionar pipeline_id aos deals
ALTER TABLE deals ADD COLUMN pipeline_id UUID REFERENCES pipelines(id);

-- Índices
CREATE INDEX idx_pipelines_type ON pipelines(type);
CREATE INDEX idx_pipelines_active ON pipelines(is_active);
CREATE INDEX idx_deals_pipeline ON deals(pipeline_id);

-- RLS
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pipelines"
  ON pipelines FOR SELECT
  USING (public.is_authenticated());

CREATE POLICY "Admins can manage pipelines"
  ON pipelines FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
```

**Arquivos a criar/modificar:**
- `src/types/crm.ts` - Adicionar tipo `Pipeline`
- `src/hooks/usePipelines.ts` - Hook para CRUD de pipelines
- `src/components/settings/PipelinesManager.tsx` - UI de gerenciamento

---

#### 1.2 Tabela `sales_goals` + Widget de Metas
**Complexidade:** Média | **Risco:** Baixo

**Entregáveis:**
- Criar tabela `sales_goals` com campos:
  - `id`, `user_id`, `period_type` (monthly, quarterly)
  - `period_start`, `period_end`, `target_value`, `target_deals`
  - `created_at`, `updated_at`
- Widget no Dashboard mostrando progresso da meta
- Tela simples de configuração de metas (Settings)

**SQL Proposto:**
```sql
CREATE TABLE public.sales_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_value NUMERIC DEFAULT 0,
  target_deals INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_period CHECK (period_end > period_start),
  CONSTRAINT valid_period_type CHECK (period_type IN ('monthly', 'quarterly', 'yearly'))
);

CREATE INDEX idx_goals_user ON sales_goals(user_id);
CREATE INDEX idx_goals_period ON sales_goals(period_start, period_end);

-- RLS
ALTER TABLE sales_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"
  ON sales_goals FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage goals"
  ON sales_goals FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
```

**Arquivos a criar:**
- `src/hooks/useSalesGoals.ts` - Hook para metas
- `src/components/settings/SalesGoalsManager.tsx` - Config de metas
- `src/components/dashboard/GoalProgressWidget.tsx` - Widget de progresso

---

### Sprint 2: Modo Execução Diário (1-2 semanas)

#### 2.1 Página `/today` - Modo Execução
**Complexidade:** Média | **Risco:** Baixo

**Conceito:**
- Tela focada no DIA do vendedor
- Zero configuração
- Prioridades, tarefas, follow-ups
- Base para futuras sugestões de IA

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Bom dia, João! 👋                                       │
│  Seu dia: Sexta, 31 de Janeiro                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📋 TAREFAS DE HOJE (3)                    [Ver todas →] │
│  ┌─────────────────────────────────────────────────────┐│
│  │ ☐ Follow-up Empresa XYZ               vence às 14h  ││
│  │ ☐ Enviar proposta Delta Corp          vence hoje    ││
│  │ ☐ Reunião cliente Omega               16:30         ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  ⚠️ DEALS SEM FOLLOW-UP (>5 dias)        [Ver pipeline]  │
│  ┌─────────────────────────────────────────────────────┐│
│  │ • Beta Corp - R$ 28.000 (8 dias) [Ligar] [WhatsApp] ││
│  │ • Gamma Inc - R$ 15.000 (6 dias) [Ligar] [WhatsApp] ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  📊 SEU RESUMO                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Pipeline │ │  Meta    │ │ Fechados │ │  Atrasados  │ │
│  │ R$ 320k  │ │   65%    │ │    2     │ │     1       │ │
│  └──────────┘ └──────────┘ └──────────┘ └─────────────┘ │
│                                                          │
│  🕐 PRÓXIMAS TAREFAS                                     │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Amanhã: 2 tarefas | Próxima semana: 5 tarefas      ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Arquivos a criar:**
- `src/pages/Today.tsx` - Página principal
- `src/hooks/useTodayData.ts` - Hook agregando dados do dia
- `src/components/today/TodayTaskList.tsx` - Lista de tarefas
- `src/components/today/StagnantDealsCard.tsx` - Deals parados
- `src/components/today/DailySummary.tsx` - Resumo do dia

**Modificações:**
- `src/App.tsx` - Adicionar rota `/today`
- `src/components/layout/AppSidebar.tsx` - Adicionar item "Meu Dia" no topo

---

#### 2.2 Busca Global
**Complexidade:** Baixa | **Risco:** Baixo

**Entregáveis:**
- Componente de busca no header do layout
- Busca em: Empresas, Contatos, Deals, Tarefas
- Retorna top 5 de cada categoria
- Atalho de teclado: Cmd/Ctrl + K

**Arquivos a criar:**
- `src/components/layout/GlobalSearch.tsx` - Componente de busca
- `src/hooks/useGlobalSearch.ts` - Hook de busca agregada

**Modificações:**
- `src/components/layout/AppLayout.tsx` - Adicionar busca no header

---

### Sprint 3: UX e Polish (1 semana)

#### 3.1 Badge "Dias na Etapa" nos Cards do Pipeline
**Complexidade:** Baixa | **Risco:** Muito Baixo

**Entregáveis:**
- Calcular dias desde última transição de etapa
- Exibir badge colorido:
  - Verde: < 7 dias
  - Amarelo: 7-14 dias
  - Vermelho: > 14 dias

**Modificações:**
- `src/pages/Pipeline.tsx` - Adicionar badge nos cards
- Usar `deal_stage_history` existente para cálculo

---

#### 3.2 Seletor de Pipeline (Preparação)
**Complexidade:** Baixa | **Risco:** Baixo

**Entregáveis:**
- Dropdown para selecionar pipeline ativo na página Pipeline
- Filtrar deals por `pipeline_id`
- Preparação para múltiplos funis

**Modificações:**
- `src/pages/Pipeline.tsx` - Adicionar seletor de pipeline

---

## Ordem de Implementação Recomendada

```
Semana 1-2 (Sprint 1)
├── 1. Migração: Tabela pipelines
├── 2. Migração: Tabela sales_goals
├── 3. Hook usePipelines + useSalesGoals
└── 4. PipelinesManager + SalesGoalsManager (Settings)

Semana 2-3 (Sprint 2)
├── 5. Página /today (estrutura básica)
├── 6. Hook useTodayData
├── 7. Componentes: TodayTaskList, StagnantDealsCard
├── 8. GlobalSearch + atalho Cmd+K
└── 9. Integrar /today no Sidebar

Semana 3-4 (Sprint 3)
├── 10. Badge "Dias na Etapa" no Pipeline
├── 11. GoalProgressWidget no Dashboard
├── 12. Seletor de Pipeline
└── 13. Testes e polish
```

---

## Critérios de Aceite

### Funcional
- [ ] Usuário pode criar/editar pipelines (Admin)
- [ ] Usuário pode ver sua meta e progresso
- [ ] Página /today carrega em < 2s
- [ ] Busca global retorna resultados em < 500ms
- [ ] Badge de dias aparece em todos os cards do pipeline

### UX
- [ ] /today é acessível com 1 clique
- [ ] Busca global abre com Cmd+K
- [ ] Layout responsivo (mobile-first)

### Técnico
- [ ] Todas as tabelas com RLS
- [ ] Índices criados para queries frequentes
- [ ] Hooks com React Query para cache

---

## O que foi SIMPLIFICADO (Confirmado)

| Feature Original | Simplificação |
|------------------|---------------|
| Configurador visual de funis | Lista simples em Settings |
| Metas por equipe/território | Apenas metas por usuário |
| Busca com filtros avançados | Top 5 por categoria, sem filtros |
| Sugestões de IA no /today | Versão inicial sem IA (Fase 3) |

---

## O que foi EXCLUÍDO (Confirmado)

- Templates de pipeline
- Histórico de metas
- Comparação entre usuários
- Funis condicionais
- IA proativa (fica para Fase 3)

---

## Próximos Passos Imediatos

1. **Aprovar plano** e criar tasks de implementação
2. **Executar migrações** das tabelas `pipelines` e `sales_goals`
3. **Implementar hooks** base (`usePipelines`, `useSalesGoals`)
4. **Criar página /today** como MVP
5. **Validar com usuário real** antes de avançar para Fase 2

---

## Detalhes Técnicos

### Novas Rotas
| Rota | Página | Descrição |
|------|--------|-----------|
| `/today` | Today.tsx | Modo Execução Diário |

### Novos Hooks
| Hook | Finalidade |
|------|------------|
| `usePipelines` | CRUD de pipelines |
| `useSalesGoals` | Metas do usuário |
| `useTodayData` | Dados agregados do dia |
| `useGlobalSearch` | Busca em todas entidades |

### Novos Componentes
| Componente | Local |
|------------|-------|
| `PipelinesManager` | Settings |
| `SalesGoalsManager` | Settings |
| `GoalProgressWidget` | Dashboard |
| `GlobalSearch` | Layout Header |
| `TodayTaskList` | Today |
| `StagnantDealsCard` | Today |
| `DailySummary` | Today |
