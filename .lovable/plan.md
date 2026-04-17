

## Plano: Corrigir Pipeline para usar `id` da etapa como chave única

### Causa raiz (confirmada no banco)

Após a refatoração que tornou `stage` opcional, etapas novas estão sendo criadas com `stage = NULL`. O Kanban atual usa o campo `stage` como identificador de coluna em três lugares críticos:

1. `usePipelineData.stages` = `pipelineStagesData.map(s => s.stage)` → vira `[null, null, null, ...]`
2. `usePipelineData.stageConfig[s.stage]` → todas as chaves `null` se sobrescrevem
3. `KanbanBoard` filtra deals por `d.stage === stage` e usa `stage` como `key` do React

Resultado: várias colunas com mesmo nome, mesma `key`, e os deals "viajam" entre elas conforme o React reconcilia.

Adicionalmente, o `deals.stage` (string legacy) também não corresponde mais às etapas novas — deals criados em etapas com `stage = NULL` ficam órfãos.

### Solução

Migrar o Kanban para usar **`pipeline_stage_id`** (UUID da `pipeline_stages.id`) como identidade da coluna, mantendo `stage` apenas como campo legado de auditoria.

### Mudanças

**1. Banco — adicionar `pipeline_stage_id` em `deals`** (migration)
- Coluna `pipeline_stage_id UUID REFERENCES pipeline_stages(id)`
- Backfill: para cada deal, resolver via `pipeline_id` + `stage` legado
- Index em `(pipeline_id, pipeline_stage_id)`
- **Não** remover `stage` (continua para histórico/automações antigas)

**2. `usePipelineData.ts`**
- Trocar `DealStage = string` por uso direto do `PipelineStageRow` (objeto completo)
- `stages` passa a ser `PipelineStageRow[]` (não mais `string[]`)
- `stageConfig` indexado por `stage.id` (UUID) — chave sempre única
- `getStageDeals` filtra por `deal.pipeline_stage_id === stage.id`
- `handleDrop(dealId, targetStageId)` recebe ID, não string legacy
- Mutation grava `pipeline_stage_id` + também atualiza `stage` (compatibilidade) usando o `stage` legacy da etapa-alvo se existir, senão NULL
- Validações de "ganho/perdido" passam a usar `stage_status` da etapa-alvo (já temos `usePipelineStageStatus`)

**3. `KanbanBoard.tsx` / `KanbanColumn.tsx`**
- Props recebem `PipelineStageRow[]` em vez de `string[]`
- `key={stage.id}` (garantindo unicidade)
- `onDrop` passa `stage.id`
- `stagePermissions` indexado por `stage.id`

**4. `PipelineListView.tsx`** — mesma adaptação (filtros e agrupamento por `pipeline_stage_id`)

**5. Compatibilidade**
- Filtros (`filterStage`) continuam aceitando o `stage` legado quando preenchido, mas internamente resolvem para `stage.id` quando possível
- Lógica de "fechado_ganho/perdido" hardcoded em `updateMutation` (linha 289) passa a usar `stage_status === 'won'/'lost'` da etapa-alvo
- `handleDrop` para detecção de "perda" (linha 543) também passa a usar `stage_status === 'lost'`

**6. Limpeza dos dados existentes** (já confirmado: 5 etapas QV com `stage = NULL`)
- Backfill no banco preenche `pipeline_stage_id` em `deals` baseado em quem combina

### Arquivos

- **Migration nova**: adiciona `deals.pipeline_stage_id` + backfill
- `src/hooks/usePipelineData.ts`
- `src/components/pipeline/KanbanBoard.tsx`
- `src/components/pipeline/KanbanColumn.tsx`
- `src/components/pipeline/PipelineListView.tsx`
- `src/components/pipeline/PipelineFilters.tsx` (ajuste pequeno no filtro de etapa para usar IDs)
- `src/pages/Pipeline.tsx` (passar IDs nos handlers)

### O que NÃO muda

- Schema `pipeline_stages` (já está correto)
- `stage_status` e lógica de ganho/perdido por status
- `deal_stage_history` (continua gravando strings legacy)
- Aba Etapas no Settings
- Mutations CRUD de etapas

### Critérios de aceite

- Pipeline QV mostra exatamente 7 colunas distintas com nomes corretos
- Cada deal aparece em exatamente uma coluna
- Reabrir/clicar no pipeline não duplica colunas
- Drag & drop funciona entre quaisquer etapas (incluindo as com `stage = NULL`)
- Pipelines antigos (Vendas Padrão) continuam funcionando idênticos
- Aprovar proposta continua movendo para etapa `won`

