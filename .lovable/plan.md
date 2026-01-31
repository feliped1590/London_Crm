

# Plano: Checklists por Etapa do Pipeline

## Visao Geral

Implementar um sistema de checklists configuravel por etapa do pipeline, onde itens obrigatorios devem ser concluidos antes de permitir que um negocio avance para a proxima etapa.

---

## Conceito de UX

```text
Etapa: Qualificacao
+-----------------------------------------+
| Checklist para avancar:                |
| [x] Contato principal identificado      |
| [x] Budget confirmado                   |
| [ ] Decisor mapeado                     |
| [ ] Cronograma definido                 |
+-----------------------------------------+
| [Avancar para Proposta]  <- Bloqueado   |
+-----------------------------------------+
```

**Comportamento:**
- Quando o usuario tenta mover um negocio para outra etapa (drag & drop ou botao)
- O sistema verifica se existem itens pendentes no checklist da etapa atual
- Se houver pendencias, exibe modal solicitando conclusao dos itens
- Admin pode configurar quais itens sao obrigatorios vs opcionais

---

## Modelo de Dados

### Nova Tabela: `stage_checklist_items`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | PK |
| stage | deal_stage | Etapa do pipeline (ENUM) |
| pipeline_id | UUID | FK para pipelines (opcional, null = todas) |
| title | TEXT | Titulo do item (ex: "Proposta enviada") |
| description | TEXT | Descricao detalhada (opcional) |
| is_required | BOOLEAN | Se e obrigatorio para avancar |
| sort_order | INT | Ordem de exibicao |
| validation_type | TEXT | 'manual' | 'auto_proposal' | 'auto_task' |
| auto_condition | JSONB | Condicao para validacao automatica |
| created_at | TIMESTAMP | Data de criacao |
| created_by | UUID | Quem criou |

### Nova Tabela: `deal_checklist_completions`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | PK |
| deal_id | UUID | FK para deals |
| checklist_item_id | UUID | FK para stage_checklist_items |
| completed_at | TIMESTAMP | Quando foi concluido |
| completed_by | UUID | Quem marcou como concluido |
| notes | TEXT | Observacoes (opcional) |

---

## Arquitetura dos Componentes

```text
Settings.tsx
  +-- Tab: "Checklists"
      +-- StageChecklistManager.tsx
          +-- Lista de etapas com seus itens
          +-- Dialog para criar/editar item
          +-- Drag & drop para reordenar

Pipeline.tsx
  +-- handleDrop() -> Interceptar transicao
  +-- ChecklistValidationModal.tsx
      +-- Exibe itens pendentes
      +-- Permite marcar como concluido
      +-- Botao "Confirmar e Avancar"

DealDetailTabs
  +-- Tab: "Checklist" (nova)
      +-- DealChecklistTab.tsx
          +-- Estado atual do checklist da etapa
          +-- Progresso visual
          +-- Historico de conclusoes
```

---

## Fluxo de Validacao

```text
Usuario arrasta card para nova etapa
            |
            v
    Buscar checklist_items
    da etapa ATUAL (from_stage)
            |
            v
    Verificar deal_checklist_completions
            |
            v
    +-- Todos obrigatorios concluidos?
    |           |
    | SIM       | NAO
    |           |
    v           v
  Avancar   Abrir Modal de Validacao
            |
            v
    Usuario marca itens pendentes
            |
            v
    Confirmar e Avancar
```

---

## Tipos de Validacao

| Tipo | Comportamento |
|------|---------------|
| **manual** | Usuario marca manualmente como concluido |
| **auto_proposal** | Auto-valida se existe proposta vinculada ao deal |
| **auto_task** | Auto-valida se tarefa especifica foi concluida |
| **auto_activity** | Auto-valida se atividade tipo X foi registrada |

A validacao automatica por IA (mencionada na memoria do projeto) pode ser adicionada em fase posterior, mantendo o principio de que decisoes criticas sempre exigem confirmacao humana.

---

## Implementacao em Fases

### Fase 1 - Fundacao (Este Sprint)
1. Criar tabelas no banco (`stage_checklist_items`, `deal_checklist_completions`)
2. Criar componente `StageChecklistManager.tsx` em Configuracoes
3. Interceptar drag & drop no Pipeline para validar checklist
4. Criar `ChecklistValidationModal.tsx`

### Fase 2 - Visibilidade
5. Adicionar tab "Checklist" nos detalhes do negocio
6. Exibir progresso do checklist no card do Kanban (badge)
7. Incluir checklist no relatorio de negocios

### Fase 3 - Automacao
8. Implementar validacoes automaticas (proposta, tarefa, atividade)
9. Sugestoes de IA para validacao (principio hibrido)

---

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/xxx_stage_checklists.sql` | CRIAR - Tabelas e RLS |
| `src/components/settings/StageChecklistManager.tsx` | CRIAR - Gerenciador de itens |
| `src/components/pipeline/ChecklistValidationModal.tsx` | CRIAR - Modal de validacao |
| `src/components/pipeline/DealChecklistTab.tsx` | CRIAR - Tab de checklist no deal |
| `src/pages/Settings.tsx` | MODIFICAR - Adicionar tab "Checklists" |
| `src/pages/Pipeline.tsx` | MODIFICAR - Interceptar drag & drop |
| `src/integrations/supabase/types.ts` | AUTO-GERADO apos migracao |

---

## Detalhes Tecnicos

### Migracao SQL

```sql
-- Tabela de itens de checklist por etapa
CREATE TABLE public.stage_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage public.deal_stage NOT NULL,
    pipeline_id UUID REFERENCES public.pipelines(id),
    title TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    validation_type TEXT DEFAULT 'manual',
    auto_condition JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID
);

-- Tabela de conclusoes por deal
CREATE TABLE public.deal_checklist_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
    checklist_item_id UUID REFERENCES public.stage_checklist_items(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_by UUID,
    notes TEXT,
    UNIQUE(deal_id, checklist_item_id)
);

-- RLS
ALTER TABLE public.stage_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_checklist_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items_select" ON public.stage_checklist_items 
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_items_admin" ON public.stage_checklist_items 
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "checklist_completions_select" ON public.deal_checklist_completions 
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_completions_insert" ON public.deal_checklist_completions 
    FOR INSERT TO authenticated WITH CHECK (true);
```

### Interceptacao de Drag & Drop

```typescript
// Pipeline.tsx - handleDrop modificado
const handleDrop = async (e: React.DragEvent, targetStage: DealStage) => {
  const dealId = e.dataTransfer.getData('dealId');
  const deal = deals?.find(d => d.id === dealId);
  
  if (!deal) return;
  
  // Buscar itens pendentes do checklist da etapa atual
  const pendingItems = await getPendingChecklistItems(deal.id, deal.stage);
  
  if (pendingItems.length > 0) {
    // Abrir modal de validacao ao inves de mover diretamente
    setChecklistModalData({
      deal,
      targetStage,
      pendingItems
    });
    setChecklistModalOpen(true);
    return;
  }
  
  // Se nao ha pendencias, mover normalmente
  updateMutation.mutate({ id: dealId, stage: targetStage });
};
```

---

## Estimativa de Esforco

| Fase | Componentes | Complexidade |
|------|-------------|--------------|
| Fase 1 | 4 arquivos | Media |
| Fase 2 | 2 arquivos | Baixa |
| Fase 3 | 1 arquivo + IA | Alta |

**Inicio recomendado: Fase 1** - Entrega funcionalidade basica completa.

