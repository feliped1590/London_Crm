

# Plano: Incluir `erp_versao` na Descrição Automática do Produto

## Problema

A função `recalcularDescricao` gera a descrição chamando `generateProductDescription`, que tenta montar dimensões internamente (`WxLxT`), mas:

1. Para perfil "partial" (Bobina), `length` é passado como `undefined`, então a condição `w > 0 && l > 0 && t > 0` falha — dimensões nunca aparecem
2. O `erp_versao` (que já está formatado corretamente como `150x0,120`) **nunca é concatenado** na descrição final
3. Existe duplicação de lógica: `generateProductDescription` tenta formatar dimensões por conta própria, enquanto `erp_versao` já faz isso corretamente

## Solução

### 1. Remover lógica de dimensões de `generateProductDescription.ts`

A função não deve mais tentar formatar dimensões. Ela deve gerar apenas a parte textual (Família + Grupo + Subgrupo + Classe + Nome Impresso).

Remover os parâmetros `width`, `length`, `thickness` e o bloco que monta `WxLxT`.

### 2. Concatenar `erp_versao` no `recalcularDescricao` (Products.tsx)

Após chamar `generateProductDescription`, concatenar `erp_versao`:

```typescript
const recalcularDescricao = (data: typeof formData) => {
  const printed = isGroupPrinted(data.grupo_id);
  const base = generateProductDescription({
    family: getLookupLabel(familias.items, data.family_id),
    group: getLookupLabel(grupos.items, data.grupo_id),
    subgroup: getLookupLabel(subgrupos.items, data.subgrupo_id),
    productClass: getLookupLabel(classes.items, data.class_id),
    printedName: printed ? data.nome_impresso : undefined,
  });
  return [base, data.erp_versao].filter(Boolean).join(' ');
};
```

### 3. Garantir ordem de atualização nos handlers de dimensão

Nos `onChange` de width/length/thickness, a `erp_versao` é calculada **antes** de `recalcularDescricao`. Verificar que o fluxo é:

1. Atualizar dimensão → 2. Calcular `erp_versao` → 3. Recalcular `name` (que agora inclui a versão)

Isso já acontece no código atual (a versão é definida antes do `setFormData`), mas precisa garantir que `recalcularDescricao` recebe os dados com `erp_versao` já atualizado.

## Resultado Esperado

Descrição: `Laminado Transparente Impresso Bobina 2 Soldas (NP + Pet Nat) TESTE DE IMPRESSO 150x0,120`

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/utils/products/generateProductDescription.ts` | Remover parâmetros de dimensão |
| `src/pages/Products.tsx` | Concatenar `erp_versao` na descrição; remover passagem de width/length/thickness |

