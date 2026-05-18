## Correção da fórmula do Fator Milheiro

### Problema
A função `calcularFatorMilheiro` em `src/types/products.ts` divide por **1.000.000**, retornando `R$ 0,108` para o exemplo (50 × 120 × 150 × 0,120). O valor correto é **R$ 108,00**, ou seja, o divisor deve ser **1.000**.

```text
Atual:    fator_kg × largura × comprimento × espessura / 1.000.000
Correto:  fator_kg × largura × comprimento × espessura / 1.000
```

### Escopo da mudança
Alteração pontual em **1 linha**, com efeito em cascata em todos os pontos que já consomem a função (cálculo de preço unitário em pedidos/propostas e exibição/edição do `fator_milheiro` no cadastro de produtos).

### Arquivos afetados
- `src/types/products.ts` (linha 89) — trocar `/ 1000000` por `/ 1000` e atualizar comentário da fórmula (linhas 87-88).

### Pontos que passam a calcular corretamente (sem alterações adicionais)
- `src/utils/pricing/packagingPricing.ts` — preço de produtos vendidos por MIL quando não há tabela de preço aplicável.
- `src/pages/Products.tsx` — campo `fator_milheiro` no formulário de produto (cadastro, edição inline e import).

### Validação pós-correção
1. Conferir no preview o produto do exemplo: largura 120, comprimento 150, espessura 0,120, fator KG 50 → deve exibir **108,00**.
2. Adicionar o produto a um pedido sem tabela de preço vinculada → `unit_price` resolvido deve ser **108,00** (priceSource = `FACTOR_KG`).
3. Rodar query rápida em produtos com `unit_measure='MIL'` e `fator_milheiro` salvo para checar se os valores históricos no banco estão coerentes com a fórmula nova (se estiverem com base na fórmula antiga, sinalizar para recálculo em massa).

### Fora de escopo
- Recálculo retroativo de `fator_milheiro` salvo no banco — só será proposto após a validação visual confirmar a fórmula e o usuário decidir se quer backfill.
- Recálculo de preços de pedidos/propostas já emitidos (itens travados via snapshot não devem mudar).
- Alteração da lógica de pedidos travados ou de tabelas de preço.