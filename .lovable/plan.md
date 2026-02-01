
# Plano: Correção da URL da API Iniflex (v3 → v1)

## Diagnóstico

Após análise detalhada do código:

1. **Não existe `/api/v3` hardcoded** - A busca em todo o diretório `supabase/` retornou zero ocorrências
2. **O código está correto** - O adapter usa exatamente a URL fornecida sem modificações
3. **A origem do problema é a variável de ambiente** - A secret `INIFLEX_SANDBOX_API_URL` no Vault está configurada com `/api/v3`

### Evidências

- Quando a URL manual (`/api/v1`) é informada: erro 401 (autenticação)
- Quando a URL vem do Vault (vazia na UI): erro 404 (endpoint não existe = `/api/v3`)

---

## Solução

### Ação 1: Atualizar Secret no Vault

A secret `INIFLEX_SANDBOX_API_URL` precisa ser atualizada para conter a URL correta:

**Valor atual (incorreto)**:
```
https://iniflex.novafix.ind.br/api/v3/runtime/endpoint/integracao/iniflex/json
```

**Valor correto**:
```
https://iniflex.novafix.ind.br/api/v1/runtime/endpoint/integracao/iniflex/json
```

### Ação 2: Adicionar Log de Diagnóstico (Recomendado)

Para evitar problemas futuros, adicionar log explícito antes do envio mostrando:
- A URL final que será usada
- Se é manual ou do Vault

Modificar `sandboxAdapter.ts`:
```typescript
console.log('[iniflex-sandbox] URL FINAL (ANTES DO FETCH):', SANDBOX_URL);
console.log('[iniflex-sandbox] ORIGEM:', customUrl ? 'MANUAL (UI)' : 'VAULT (ENV)');
```

### Ação 3: Validação Visual na UI (Recomendado)

Adicionar indicador na interface mostrando de onde a URL está vindo:
- Badge "Vault" quando campo vazio (usando variável de ambiente)
- Badge "Manual" quando URL digitada

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Vault (secret)** | Atualizar `INIFLEX_SANDBOX_API_URL` para `/api/v1` |
| `supabase/functions/_shared/iniflex/sandboxAdapter.ts` | Adicionar log de diagnóstico da URL final |

---

## Detalhes Técnicos

### Alteração no sandboxAdapter.ts

```typescript
// Após linha 50-51 (onde define SANDBOX_URL)
const SANDBOX_URL = customUrl || Deno.env.get('INIFLEX_SANDBOX_API_URL');
const SANDBOX_TOKEN = customToken || Deno.env.get('INIFLEX_SANDBOX_API_TOKEN');

// NOVO: Log de diagnóstico da URL final
console.log('[iniflex-sandbox] ===== DIAGNÓSTICO DE URL =====');
console.log('[iniflex-sandbox] URL FINAL:', SANDBOX_URL);
console.log('[iniflex-sandbox] ORIGEM:', customUrl ? 'MANUAL (informada via UI)' : 'VAULT (variável de ambiente)');
if (!customUrl) {
  console.log('[iniflex-sandbox] ATENÇÃO: Usando URL do Vault. Se incorreta, atualize a secret INIFLEX_SANDBOX_API_URL');
}
```

---

## Próximos Passos

1. Você precisará atualizar a secret `INIFLEX_SANDBOX_API_URL` no Vault com a URL correta
2. Implementarei o log de diagnóstico no adapter
3. Após atualização, os testes sem URL manual usarão `/api/v1` automaticamente
