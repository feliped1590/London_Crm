
# Plano: Correção da Correspondência de IDs na Sincronização

## Problema Identificado

A verificação de status "Importado" está falhando porque há uma **incompatibilidade de IDs** entre os dois fluxos:

| Fluxo | Campo no ERP | Campo Mapeado | Valor Exemplo |
|-------|--------------|---------------|---------------|
| **Sincronização** (`sync-iniflex-clients`) | `codigo_erp` | `external_id` | `"1030"` |
| **Listagem** (`iniflex-list-correntistas`) | `codigo` ❌ | `id` | `5378317000180` (CNPJ) |

O log mostra claramente:
```json
{
  "codigo_erp": 451,
  "cnpj_cpf": 5378317000180,
  ...
}
```

A listagem usa `c.codigo || c.id || c.cnpj_cpf`, mas o ERP envia `codigo_erp` (não `codigo`).

---

## Solução

Corrigir o mapeamento do `id` na função `iniflex-list-correntistas` para usar `codigo_erp` como primeira opção, mantendo consistência com a sincronização.

---

## Alteração

**Arquivo**: `supabase/functions/iniflex-list-correntistas/index.ts`

**Linha 90 - Antes:**
```typescript
id: c.codigo || c.id || c.cnpj_cpf,
```

**Depois:**
```typescript
id: String(c.codigo_erp || c.codigo || c.id || c.cnpj_cpf),
```

Isso garante que o `id` retornado pela listagem seja o mesmo valor usado como `external_id` na sincronização.

---

## Validação

Após a correção:

1. A listagem retornará `id: "1030"` (codigo_erp como string)
2. O banco tem `external_id: "1030"`
3. A comparação `syncedClients.has(correntista.id)` retornará `true`
4. O badge mostrará "Importado" em verde ✓
5. Os contadores serão atualizados corretamente

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/iniflex-list-correntistas/index.ts` | Adicionar `codigo_erp` como primeira opção no mapeamento do `id` |

---

## Fluxo Corrigido

```text
ERP Iniflex
     │
     ▼ codigo_erp: 1030
┌────────────────────────────────────────┐
│                                        │
│  sync-iniflex-clients                  │
│  external_id = "1030" ✓                │
│                                        │
│  iniflex-list-correntistas             │
│  id = "1030" ✓ (CORRIGIDO)             │
│                                        │
└────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│  Frontend (InflexTab.tsx)              │
│                                        │
│  syncedClients.has("1030") → true ✓    │
│  isImported() → true ✓                 │
│  Badge: "Importado" (verde) ✓          │
│                                        │
└────────────────────────────────────────┘
```
