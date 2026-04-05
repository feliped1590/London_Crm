

# Plano: Correção da Ingestão ERP — 100% Skip com Tabela Vazia

## Diagnóstico

O problema tem **duas causas prováveis**, ambas no trecho de extração de `erp_code`:

```typescript
const erp_code = String(rec.cd_material || rec.codigo || "").trim();
if (!erp_code) { skipped++; continue; }
```

**Causa 1 (mais provável):** Os campos `cd_material` e `codigo` não existem no payload do ERP, ou têm nomes ligeiramente diferentes. Se ambos forem `undefined`, `erp_code` fica `""` e **todos os 43.539 registros são ignorados** antes mesmo de chegarem à deduplicação.

**Causa 2 (possível):** A lógica de `batchCheckExisting` está correta (tabela vazia = Set vazio = nenhum skip), portanto o gargalo está obrigatoriamente na fase de `prepared` — os registros nem chegam lá.

A deduplicação em si **não é o problema** — o bug está antes dela.

## Solução

### 1. Adicionar logs estratégicos na edge function

Antes de corrigir, precisamos ver os campos reais do ERP. Adicionar logs no início do processamento:

- Log do **primeiro registro** recebido do ERP (`JSON.stringify(Object.keys(records[0]))`)
- Log de `prepared.length` vs `skipped` por batch
- Log de `existingKeys.size` e `newRows.length` por batch

### 2. Corrigir extração de `erp_code`

Expandir a lista de campos possíveis para o código do produto, alinhando com o que o `erp-import-products` já usa (`cd_material`). Também considerar variações de casing e campos aninhados:

```typescript
const erp_code = String(
  rec.cd_material || rec.CD_MATERIAL || 
  rec.codigo || rec.CODIGO || 
  rec.cd_produto || rec.CD_PRODUTO || ""
).trim();
```

### 3. Log de fallback para diagnóstico

Se `erp_code` for vazio, logar o registro para diagnóstico ao invés de silenciosamente ignorar:

```typescript
if (!erp_code) {
  if (skippedNoCode < 3) {
    console.warn(`[Staging] Record without erp_code, keys: ${Object.keys(rec).join(',')}`);
  }
  skippedNoCode++;
  continue;
}
```

### 4. Manter deduplicação intacta

A lógica de `batchCheckExisting` está correta. Não precisa de alteração — o problema é anterior.

## Arquivos impactados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/erp-import-products-staging/index.ts` | Adicionar logs + expandir campo erp_code + log de fallback |

## Estratégia

1. Deploy com logs estratégicos
2. Executar uma ingestão de teste
3. Verificar nos logs qual campo o ERP realmente usa
4. Ajustar extração final se necessário

## Resultado Esperado

- Identificar campo correto do código do produto
- Ingestão passa a inserir registros na staging
- Logs permitem diagnóstico rápido de problemas futuros

