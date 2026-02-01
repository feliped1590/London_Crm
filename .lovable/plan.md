

# Plano: Alterar Data Padrão de Sincronização de Produtos

## Contexto

A sincronização de produtos está demorando muito porque a data base é `01/01/2000`, trazendo **todos** os produtos cadastrados no ERP Iniflex. Como há um volume muito grande de dados, isso causa timeout ou lentidão excessiva.

---

## Alteração Necessária

### Arquivo: `supabase/functions/sync-iniflex-products/index.ts`

**Linha 9 - Antes:**
```typescript
const DEFAULT_SYNC_DATE = '01/01/2000 00:00:00';
```

**Depois:**
```typescript
const DEFAULT_SYNC_DATE = '01/01/2025 00:00:00';
```

---

## Impacto

| Aspecto | Descrição |
|---------|-----------|
| **Performance** | Redução significativa no tempo de resposta |
| **Dados** | Traz apenas produtos alterados a partir de 01/01/2025 |
| **Comportamento** | Apenas afeta a primeira sincronização (quando não existe registro em `erp_sync_control`) |

---

## Ação Pós-Deploy

Após a alteração:
1. A Edge Function será redeployada automaticamente
2. A primeira carga trará ~1 ano de alterações (2025-2026)
3. Sincronizações seguintes usarão a data incremental normalmente

