# Permitir múltiplas etapas vinculadas a cada Status de Etapa

## Situação atual

No cadastro de etapas do pipeline (Configurações → Pipeline), o campo **Status da Etapa** restringe alguns valores a **apenas uma etapa por funil**:

- **Em andamento** → permite várias ✅
- **Ganho** → apenas 1 por funil ❌
- **Perdido** → apenas 1 por funil ❌
- **Reprovado** → apenas 1 por funil ❌ (bloqueio só no front)
- **Cancelado** → apenas 1 por funil ❌ (bloqueio só no front)
- **Sem Perfil** → apenas 1 por funil ❌ (bloqueio só no front)

A restrição é aplicada em três camadas:
1. **Frontend** (`STAGE_STATUS_OPTIONS.unique = true` + validação no `UnifiedPipelineManager`)
2. **Banco de dados** — índices únicos parciais para `won` e `lost`
3. **Trigger** `validate_pipeline_stage_status` (mensagem de erro amigável para `won`/`lost`)

## Objetivo

Permitir **N etapas** vinculadas a qualquer status (incluindo Ganho, Perdido, Reprovado, Cancelado e Sem Perfil), mantendo a classificação semântica de cada etapa para os dashboards e regras de negócio.

## Mudanças

### 1. Banco de dados (migração)
- Remover os índices únicos parciais `unique_won_stage_per_pipeline` e `unique_lost_stage_per_pipeline`.
- Remover (ou simplificar) o trigger `validate_pipeline_stage_status` e sua função, já que não haverá mais bloqueio de unicidade.
- Atualizar a função `get_pipeline_stage_status(p_pipeline_id)` para retornar **arrays** em vez de IDs únicos:
  - `won_stage_ids: uuid[]`
  - `lost_stage_ids: uuid[]`
  - `open_stage_ids: uuid[]` (já é array hoje)

### 2. Camada de tipos / helpers (`src/lib/stageStatus.ts`)
- Marcar todas as opções de `STAGE_STATUS_OPTIONS` como `unique: false`.
- Atualizar `PipelineStageStatusMap` para usar `wonStageIds: string[]` e `lostStageIds: string[]`.
- Atualizar `getPipelineStageStatusMap` para ler os arrays retornados pela função SQL.
- Ajustar `getWonStageForPipeline` para tolerar múltiplas etapas Ganho: usar `.limit(1)` em vez de `.maybeSingle()` e devolver a primeira pela `sort_order` (mantém comportamento atual de aprovação de proposta).

### 3. Hook `src/hooks/usePipelineStageStatus.ts`
- Refletir o novo shape (`wonStageIds`/`lostStageIds`).

### 4. Tela de Configurações do Pipeline (`UnifiedPipelineManager.tsx`)
- Remover a validação que impede salvar uma segunda etapa com status "único".
- Manter o ícone/cor por status (Trophy/Ganho, XCircle/Perdido, etc.).
- Atualizar o texto descritivo dos status (remover "(única por funil)" das descrições em `STAGE_STATUS_OPTIONS`).

### 5. Comportamento preservado
- Aprovação automática de proposta → continua movendo o deal para **a primeira** etapa com status `won` do funil (mesmo critério atual de `sort_order`).
- Dashboards, badges e cálculo de "negócio aberto/terminal" continuam funcionando, pois usam `stage_status` por linha — não dependem de unicidade.
- Mapeamento etapa → status de pedido (`pipeline_stage_order_status_map`) não muda.

## Fora do escopo
- Nenhuma mudança no Kanban, no fluxo de movimentação de deals, em automações ou em permissões de perfil.
- Nenhuma migração de dados existentes (etapas atuais continuam como estão).

## Validação após implementação
- Cadastrar duas etapas "Perdido" no mesmo funil e confirmar que ambas salvam.
- Aprovar uma proposta em um funil com múltiplas etapas Ganho e confirmar que o deal vai para a primeira (menor `sort_order`).
- Conferir badges de status na lista de etapas e no Kanban.
