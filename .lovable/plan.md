## Contexto

O backend (`product-validator.ts`) já trata `erp_product_code` como **opcional**: vazio = CREATE no ERP, preenchido = UPDATE. O `handleSubmit` em `Products.tsx` também já não bloqueia salvar sem código. Porém a UI ainda comunica como obrigatório, o que confunde o usuário.

## Mudanças (somente UI)

### `src/pages/Products.tsx` — campo "Código ERP" (linha ~1262)

- Trocar label de `Código ERP *` para `Código ERP`.
- Atualizar texto auxiliar de:
  > "Obrigatório. Não é gerado automaticamente."

  para:
  > "Opcional. Deixe em branco para que o ERP gere o código no primeiro envio. Preencha apenas se o produto já existir no ERP."

- Ajustar `placeholder` para: `"Opcional — preencher só se já existir no ERP"`.

Nenhuma outra alteração de lógica é necessária — `handleSubmit` (linhas 854–873) já não inclui `erp_product_code` nos `erpRequiredErrors`.

## Não muda

- Validação de submit (já está correta).
- Backend, mapper, validator, fila de sync.
- `ProductSyncStatus` (continua exibindo o código quando existir).
- Constraint de unicidade (`sku_unique`) — códigos preenchidos continuam não podendo duplicar.

## Risco

Mínimo: alteração textual em um único campo do formulário.
