
# Plano: Correção Definitiva da Autenticação Iniflex ✅

## Status: IMPLEMENTADO

Todas as Edge Functions Iniflex agora usam o adapter centralizado com autenticação correta.

## Regras Implementadas

1. **Token no Body** - A API Novafix/Iniflex recebe `chave` no body da requisição, não no header
2. **Adapter Centralizado** - `sendToIniflex()` é o único ponto de comunicação com o ERP
3. **Logging Seguro** - Chave excluída dos logs de produção
4. **SyncResult Completo** - Todos os cenários retornam estrutura padronizada

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `_shared/iniflex/adapter.ts` | Chave no body, logging seguro, SyncResult completo |
| `iniflex-customer-lookup/index.ts` | Usa adapter, remove fetch direto |
| `iniflex-sync-contact/index.ts` | Usa adapter, remove Authorization header |
| `iniflex-sync-company/index.ts` | Usa adapter, remove Authorization header |

## Interface SyncResult

```typescript
{
  success: boolean;        // true/false
  externalId: string | null;  // ID retornado pelo ERP
  rawResponse: unknown;    // Resposta bruta para debug
  error?: string;          // Presente quando success = false
}
```

### Cenários Tratados pelo Adapter

| Cenário | success | error |
|---------|---------|-------|
| Credenciais não configuradas | false | "Credenciais do ERP não configuradas" |
| Timeout (10s) | false | "Timeout: ERP não respondeu em 10 segundos" |
| Erro HTTP 4xx/5xx | false | "HTTP {status}: {statusText}" |
| Erro de parse JSON | false | "Resposta inválida do ERP" |
| Exceção inesperada | false | {mensagem da exceção} |
| Sucesso | true | undefined |

## Segurança

- `verify_jwt = true` mantido nas Edge Functions
- Token Iniflex nunca exposto em logs
- Frontend não conhece credenciais do ERP

## Teste de Validação

**Nota:** A função `iniflex-customer-lookup` tem `verify_jwt = true`, então precisa de JWT válido.

### Opção 1: Testar via Frontend (recomendado)
Usar o wizard de "Novo Cliente" no CRM e digitar um CNPJ.

### Opção 2: Testar via curl com JWT
```bash
# Primeiro, obter um JWT válido logando no sistema
curl -X POST https://lusyhkizwoihixcvcgap.supabase.co/functions/v1/iniflex-customer-lookup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_JWT>" \
  -d '{"cnpj": "14649675000170"}'
```

### Resultado Esperado
```json
{
  "success": true,
  "found": true | false,
  "data": { ... },
  "source": "iniflex"
}
```

## Verificação de Logs

```sql
SELECT * FROM erp_sync_logs 
WHERE entity_type = 'customer_lookup' 
ORDER BY created_at DESC 
LIMIT 5;
```
