

# Ajustes Finos: Fundação v1 - ERP Iniflex

## Resumo dos Ajustes

Refinamentos pontuais na base aprovada para melhorar observabilidade e evitar problemas operacionais.

---

## 1. Tabela `erp_sync_logs` (Atualizada)

### Mudanças

| Campo | Antes | Depois |
|-------|-------|--------|
| `status` CHECK | `pending`, `success`, `failed` | `pending`, `processing`, `success`, `failed` |

### SQL Final

```sql
CREATE TABLE public.erp_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- O que foi sincronizado
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  direction TEXT NOT NULL DEFAULT 'crm_to_erp',
  
  -- Resultado
  status TEXT NOT NULL DEFAULT 'pending',
  external_id TEXT,
  error_message TEXT,
  
  -- Payloads para debug
  request_payload JSONB,
  response_payload JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Validação de status
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  CONSTRAINT valid_direction CHECK (direction IN ('crm_to_erp', 'erp_to_crm'))
);

-- Índices
CREATE INDEX idx_erp_logs_entity ON erp_sync_logs(entity_type, entity_id);
CREATE INDEX idx_erp_logs_status ON erp_sync_logs(status);
CREATE INDEX idx_erp_logs_direction ON erp_sync_logs(direction);

-- Trigger para updated_at
CREATE TRIGGER update_erp_sync_logs_updated_at
  BEFORE UPDATE ON erp_sync_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 2. Fluxo de Status

```text
INÍCIO
   │
   v
┌──────────┐
│ pending  │  ← Log criado
└────┬─────┘
     │
     v
┌──────────┐
│processing│  ← Antes de chamar ERP
└────┬─────┘
     │
     ├───────────────┐
     v               v
┌──────────┐   ┌──────────┐
│ success  │   │  failed  │
└──────────┘   └──────────┘
```

### Cenários de Falha (Pré-ERP)

| Cenário | Status Final | error_message |
|---------|--------------|---------------|
| Entidade não encontrada | `failed` | "Empresa não encontrada" |
| Validação inválida | `failed` | "CNPJ deve ter 14 dígitos" |
| Dependência falhou | `failed` | "Falha ao sincronizar empresa: ..." |
| Erro HTTP do ERP | `failed` | "HTTP 500: Internal Server Error" |
| Timeout | `failed` | "Request timeout" |

---

## 3. Constantes de Direction

Criar constante para evitar hardcode espalhado:

```typescript
// _shared/iniflex/types.ts (novo arquivo)

export const SYNC_DIRECTION = {
  CRM_TO_ERP: 'crm_to_erp',
  ERP_TO_CRM: 'erp_to_crm',
} as const;

export type SyncDirection = typeof SYNC_DIRECTION[keyof typeof SYNC_DIRECTION];

export const SYNC_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

export type SyncStatus = typeof SYNC_STATUS[keyof typeof SYNC_STATUS];
```

---

## 4. Ajustes no `erp-sync/index.ts`

### 4.1 Criar log com status `pending`

```typescript
// Criar log inicial (status: pending)
const { data: log } = await supabase
  .from('erp_sync_logs')
  .insert({
    entity_type,
    entity_id,
    direction: SYNC_DIRECTION.CRM_TO_ERP,
    status: SYNC_STATUS.PENDING,
  })
  .select('id')
  .single();
```

### 4.2 Atualizar para `processing` antes do ERP

```typescript
async function syncCompanyInternal(supabase: any, companyId: string, logId?: string) {
  // Buscar empresa
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error || !company) {
    // Falha PRÉ-ERP: entidade não encontrada
    await updateLog(supabase, logId, SYNC_STATUS.FAILED, null, 'Empresa não encontrada');
    return { success: false, error: 'Empresa não encontrada' };
  }

  // Validar
  const validation = validateCompany(company);
  if (!validation.valid) {
    // Falha PRÉ-ERP: validação
    await updateLog(supabase, logId, SYNC_STATUS.FAILED, null, validation.errors.join(', '));
    return { success: false, error: validation.errors.join(', ') };
  }

  // Mapear payload
  const payload = mapCompanyToIniflex(company);
  
  // *** ATUALIZAR PARA PROCESSING ANTES DE CHAMAR ERP ***
  await supabase
    .from('erp_sync_logs')
    .update({
      status: SYNC_STATUS.PROCESSING,
      request_payload: payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', logId);

  // Chamar ERP
  const result = await sendToIniflex(payload);

  if (!result.success) {
    await updateLog(supabase, logId, SYNC_STATUS.FAILED, null, result.error, result.rawResponse);
    return { success: false, error: result.error };
  }

  // Sucesso
  await supabase
    .from('companies')
    .update({
      iniflex_id: result.externalId,
      iniflex_synced_at: new Date().toISOString(),
    })
    .eq('id', companyId);

  await updateLog(supabase, logId, SYNC_STATUS.SUCCESS, result.externalId, null, result.rawResponse);

  return { success: true, externalId: result.externalId };
}
```

### 4.3 Falha em dependência também registrada

```typescript
if (entity_type === 'contact') {
  if (ensure_dependencies) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('company_id, companies(iniflex_id)')
      .eq('id', entity_id)
      .single();

    if (contact?.company_id && !contact?.companies?.iniflex_id) {
      // Criar sub-log para empresa (opcional, mas recomendado)
      const companyResult = await syncCompanyInternal(supabase, contact.company_id);
      
      if (!companyResult.success) {
        // Falha PRÉ-ERP: dependência falhou
        await updateLog(
          supabase, 
          logId, 
          SYNC_STATUS.FAILED, 
          null, 
          `Falha ao sincronizar empresa dependente: ${companyResult.error}`
        );
        return errorResponse(400, `Falha ao sincronizar empresa: ${companyResult.error}`);
      }
    }
  }
  return await syncContact(supabase, entity_id, logId);
}
```

---

## 5. Helper `updateLog` Atualizado

```typescript
async function updateLog(
  supabase: any,
  logId: string | undefined,
  status: SyncStatus,
  externalId: string | null,
  error?: string | null,
  response?: unknown
) {
  if (!logId) return;
  
  await supabase
    .from('erp_sync_logs')
    .update({
      status,
      external_id: externalId,
      error_message: error || null,
      response_payload: response || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', logId);
}
```

---

## 6. Estrutura Final de Arquivos

```
supabase/functions/
├── erp-sync/
│   └── index.ts                 # Função central
│
├── _shared/
│   └── iniflex/
│       ├── types.ts             # NOVO: Constantes e tipos
│       ├── adapter.ts           # Comunicação com Iniflex
│       ├── mapper.ts            # Mapeamento CRM ↔ ERP
│       └── validator.ts         # Validações básicas
│
├── iniflex-list-correntistas/   # Mantido
└── iniflex-import-correntista/  # Mantido
```

---

## 7. Documentação do `ensure_dependencies`

Adicionar comentário no código para referência futura:

```typescript
interface SyncRequest {
  entity_type: 'company' | 'contact';
  entity_id: string;
  
  /**
   * Se true, sincroniza dependências automaticamente.
   * Ex: para contact, sincroniza company primeiro se não existir no ERP.
   * 
   * NOTA FUTURA: Esta lógica será movida para o backend,
   * tornando a orquestração transparente para o frontend.
   * Por enquanto, o frontend deve enviar este parâmetro explicitamente.
   */
  ensure_dependencies?: boolean;
}
```

---

## Checklist dos Ajustes

| Ajuste | Status |
|--------|--------|
| Status `processing` na tabela | Incluído |
| Constraint de `direction` | Incluído |
| Constantes para evitar hardcode | Incluído |
| Trigger `updated_at` | Incluído |
| Log de falha pré-ERP (entidade não encontrada) | Incluído |
| Log de falha pré-ERP (validação) | Incluído |
| Log de falha pré-ERP (dependência) | Incluído |
| Status `processing` antes de chamar ERP | Incluído |
| Documentação `ensure_dependencies` | Incluído |

---

## Fora do Escopo (Confirmado)

- Retry automático
- Fila de processamento
- Cron jobs
- Dashboard na UI
- Múltiplos ERPs
- Sync de pedidos

---

## Detalhes Técnicos

### Arquivos a Criar

1. `supabase/functions/_shared/iniflex/types.ts` - Constantes e tipos
2. `supabase/functions/_shared/iniflex/adapter.ts` - Comunicação HTTP
3. `supabase/functions/_shared/iniflex/mapper.ts` - Mapeamentos
4. `supabase/functions/_shared/iniflex/validator.ts` - Validações
5. `supabase/functions/erp-sync/index.ts` - Função central

### Migração de Banco

1. Criar tabela `erp_sync_logs` com constraints atualizados
2. Reutilizar trigger `update_updated_at_column` existente

