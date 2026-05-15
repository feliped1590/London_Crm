## Causa raiz identificada

Olhando o log do Postgres no exato momento do erro:

```
ERROR 23505: duplicate key value violates unique constraint "idx_products_tenant_erp_code"
UPDATE "public"."products" SET ... "erp_product_code" = $... WHERE id = $2
```

O conflito é em `(tenant_id, erp_product_code)`. Investiguei o banco:

- O produto `PA-2-LS-S-100-200-270-120` (id `6f1598…`) tem `erp_product_code = '813391'` no banco.
- **Existe 1 outro produto no mesmo tenant com `erp_product_code = ''`** (string vazia, não NULL).
- O `UPDATE` enviado pelo formulário gravou `erp_product_code = ''` (string vazia) — ou porque o usuário apagou o valor, ou porque o campo perdeu o valor original ao abrir a edição.

Existem **3 índices únicos** sobrepostos para esse mesmo par de colunas:

| Índice | Predicado |
|---|---|
| `products_tenant_erp_code_unique` | `WHERE erp_product_code IS NOT NULL AND erp_product_code <> ''` |
| `products_erp_product_code_unique` | `WHERE erp_product_code IS NOT NULL AND erp_product_code <> ''` |
| `idx_products_tenant_erp_code` | **`WHERE erp_product_code IS NOT NULL`** ← inclui string vazia |

Os dois primeiros excluem corretamente string vazia, mas o terceiro (`idx_products_tenant_erp_code`) **não** — então duas linhas com `''` colidem. É um bug de modelagem deixado pra trás em alguma migração.

## Plano

1. **Migration — corrigir os índices duplicados**
   - Dropar `idx_products_tenant_erp_code` (o único que está inconsistente).
   - Dropar também `products_erp_product_code_unique` (é literal idêntico ao `products_tenant_erp_code_unique`, redundante e custa escrita).
   - Manter apenas `products_tenant_erp_code_unique` como a fonte única de verdade.

2. **`src/pages/Products.tsx` — normalizar string vazia para NULL antes de salvar**
   - No `executeSave` (ou no payload do `updateMutation` / `createMutation`), aplicar:
     ```ts
     submitData.erp_product_code = submitData.erp_product_code?.trim() || null;
     ```
   - Mesmo tratamento já existe pra `nome_impresso`. Isso evita gravar `''` e garante semântica "produto ainda não tem código ERP".

3. **`src/pages/Products.tsx` — preservar o valor ao abrir a edição**
   - Confirmar no `handleEdit` (linha 1042) que `erp_product_code` é carregado corretamente. Se o campo estiver montado como `disabled` quando já existe valor, o usuário não consegue apagar acidentalmente. Adicionar `readOnly` quando já houver `erp_product_code` preenchido (não-vazio) no produto original — assim ninguém limpa um código ERP já vinculado.

4. **Mensagem de erro mais clara** (opcional, baixo custo)
   - Em `getDuplicateErrorMessage`, já existe um caso pra `products_erp_product_code_unique`. Adicionar também `idx_products_tenant_erp_code` e `products_tenant_erp_code_unique` à lista, com a mensagem: "Já existe outro produto com este Código ERP neste tenant."

## Fora do escopo

- Não vou mexer no fluxo de sincronização ERP nem nos triggers de `compute_structure_hash`, `protect_product_structure`, etc. — eles não estão envolvidos nesse erro.

Aprova?