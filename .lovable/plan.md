

# Plano: Corrigir Exibição de Deals no Pipeline

## Diagnóstico

O problema identificado é que os deals existentes não aparecem porque:

1. A migração adicionou a coluna `pipeline_id` na tabela `deals`
2. Os deals existentes ficaram com `pipeline_id = NULL`
3. A filtragem atual exige que `deal.pipeline_id === currentPipelineId`
4. Como `NULL ≠ 'bdb23ee4-...'`, todos os deals são filtrados

## Solução

Corrigir em duas frentes:

### 1. Migração de Dados (Backend)

Atualizar todos os deals existentes com `pipeline_id = NULL` para o pipeline padrão:

```sql
UPDATE deals 
SET pipeline_id = (
  SELECT id FROM pipelines WHERE is_default = true LIMIT 1
)
WHERE pipeline_id IS NULL;
```

### 2. Ajuste na Lógica de Filtragem (Frontend)

Modificar a lógica para tratar deals sem pipeline_id como pertencentes ao pipeline padrão:

**Antes (linha 410):**
```typescript
if (currentPipelineId && deal.pipeline_id !== currentPipelineId) return false;
```

**Depois:**
```typescript
// Deals sem pipeline_id são considerados do pipeline padrão
const dealPipelineId = deal.pipeline_id || defaultPipeline?.id;
if (currentPipelineId && dealPipelineId !== currentPipelineId) return false;
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Atualizar deals existentes |
| `src/pages/Pipeline.tsx` | Ajustar lógica de filtragem (linha 410) |

## Resultado Esperado

- Os 6 deals existentes voltarão a aparecer no Pipeline
- Novos deals serão criados com o `pipeline_id` correto
- Filtragem por pipeline funcionará corretamente

