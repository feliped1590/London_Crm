## Problema

Ao editar um produto existente e alterar **espessura** (ou largura/comprimento), o `erp_versao` é regenerado em tempo real (ex.: `175x280x0,170`), mas a **Descrição** continua com a versão antiga embutida (`...175X280X0,160`). Ao salvar, a validação exige que a descrição contenha o novo `erp_versao` e bloqueia com:

> "Descrição incompleta: deve conter a versão "175x280x0,170". Limpe o campo e clique fora para regerar."

## Causa

Em `src/pages/Products.tsx`:

- `handleEdit` (linha 1280) e `loadVersion` (linha 1256) **sempre** fazem `setIsAutoDescription(false)`.
- Por isso, os `onChange` de Largura / Comprimento / Espessura / Sanfona atualizam `erp_versao` mas pulam `recalcularDescricao` (todas as chamadas estão sob `if (isAutoDescription)`).
- Resultado: a descrição fica "presa" na versão antiga e o usuário é forçado a apagar o campo manualmente para regerar.

## Correção

Detectar, ao abrir o produto, se a descrição atual **ainda é a auto-gerada**. Se for, manter `isAutoDescription = true` para que dimensões regerem a descrição automaticamente, como acontece na criação.

### Mudanças (somente frontend, `src/pages/Products.tsx`)

1. Após `applyProductToForm(...)` em `handleEdit` e `loadVersion`, comparar:
   - `product.name` (normalizado, trim + upper) vs. `recalcularDescricao(formData)` (normalizado).
   - Se iguais → `setIsAutoDescription(true)`.
   - Se diferentes (usuário editou manualmente) → manter `false` como hoje.

2. Reforço: nos handlers de dimensão (largura/comprimento/espessura/sanfona), quando `isAutoDescription` é `false` mas o `name` atual ainda contém o `erp_versao` anterior literal, substituir somente esse token pelo novo `erp_versao`. Isso protege casos onde a descrição foi levemente editada mas a versão continua presente.

3. Nenhuma alteração de regra de negócio, banco ou ERP. Validação de submit permanece a mesma.

## Teste manual

- Abrir o produto da tela, alterar espessura de `0,160` para `0,170`.
- A Descrição deve passar de `... 175X280X0,160` para `... 175x280x0,170` automaticamente.
- Botão **Atualizar** salva sem erro de "Descrição incompleta".
- Editar manualmente a descrição (ex.: adicionar um sufixo) e depois mudar dimensão → continua respeitando edição manual, mas substituindo só o token da versão antiga pelo novo.
