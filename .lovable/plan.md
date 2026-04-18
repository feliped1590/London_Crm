

## Diagnóstico: Deal sumiu após criação

### O que aconteceu com o "Teste pipeline"

Encontrei o deal `ee461df6...` no banco. Ele foi salvo com:
- `pipeline_id` = pipeline "Vendas" ✅
- `stage` = `"36bbd947-0625-44e1-af96-9cb7b9d660ad"` ❌ (é um UUID, deveria ser `"prospeccao"`)
- `pipeline_stage_id` = `NULL` ❌

A etapa "Prospecção" do pipeline "Vendas" tem `stage = NULL` na tabela `pipeline_stages` (apenas `id` UUID). Já as outras etapas (Qualificação, Proposta etc.) têm `stage = "qualificacao"`, `"proposta"` etc.

### Causa raiz

Em `usePipelineData.ts:125`, a lista `stages` exposta para o form usa fallback:
```ts
stageRows.map(s => s.stage ?? s.id)
```

Quando a etapa não tem `stage` legacy preenchido, o **UUID** entra na lista. O `<Select>` do `DealFormDialog` usa esses valores e grava o UUID direto em `deals.stage`. Aí o `resolveDealStageId()` no Kanban procura por `s.stage === "36bbd947..."`, não encontra, retorna `null`, e o deal **não é renderizado em coluna nenhuma** — fica órfão no banco.

Os deals antigos (Teste de Matriz, Teste de carteira etc.) funcionam porque foram criados quando essa etapa ainda tinha `stage = "prospeccao"`. A migration recente do multi-entity pipeline deixou a etapa "Prospecção" do pipeline Vendas com `stage = NULL`.

### Plano de correção

**1. Corrigir `DealFormDialog.tsx`** — usar `pipeline_stage_id` (UUID da row) como fonte de verdade no select, em vez do código legacy. O select passa a:
- `value` = `formData.pipeline_stage_id`
- `onChange` salva tanto `pipeline_stage_id` (UUID) quanto `stage` (legacy code se existir, senão `null`)
- Itens iteram sobre `stageRows` em vez da lista achatada `stages[]`

**2. Corrigir o `createMutation`** em `Pipeline.tsx` / `usePipelineData.ts` para mandar **sempre** `pipeline_stage_id` no insert (espelhando o que o drag&drop já faz na linha 665).

**3. Reparar o deal órfão** `ee461df6` via migration:
```sql
UPDATE deals 
SET pipeline_stage_id = '36bbd947-0625-44e1-af96-9cb7b9d660ad', 
    stage = NULL 
WHERE id = 'ee461df6-82c5-4ebf-90b0-9232c254e686';
```
Idem para o `fd393468` (Teste pipeline da Novafix).

**4. Reforçar `resolveDealStageId`** — adicionar fallback: se `deal.stage` parece ser um UUID (regex), tentar `stageRows.find(s => s.id === deal.stage)` antes de desistir. Defesa em profundidade contra deals já gravados com UUID em `stage`.

**5. Backfill preventivo** — verificar se há outros deals com `stage` contendo UUID em vez de código legacy e migrar para `pipeline_stage_id`:
```sql
UPDATE deals d
SET pipeline_stage_id = ps.id, stage = NULL
FROM pipeline_stages ps
WHERE d.stage = ps.id::text AND d.pipeline_stage_id IS NULL;
```

### Arquivos tocados
1. `src/components/pipeline/DealFormDialog.tsx` — select usa `pipeline_stage_id`
2. `src/pages/Pipeline.tsx` — `createMutation` envia `pipeline_stage_id`
3. `src/hooks/usePipelineData.ts` — `resolveDealStageId` com fallback para UUID em `stage`
4. **Nova migration** — repara deals órfãos + backfill defensivo

### Critérios de aceite
- ✅ Criar novo deal "Teste pipeline 2" → aparece na coluna Prospecção do pipeline Vendas
- ✅ Os 2 deals órfãos `ee461df6` e `fd393468` aparecem após o backfill
- ✅ Drag&drop continua funcionando (já usa pipeline_stage_id)
- ✅ Deals legados (`stage = "prospeccao"`) continuam aparecendo normalmente
- ✅ Pipelines com etapas sem `stage` legacy (caso do OPERAÇÃO QUALYVAC com 29 etapas customizadas) ficam usáveis

