## Auto-cálculo do preço unitário (sacos / embalagens)

Quando o item é vendido por **MIL** (milheiro) e tem dimensões + Fator KG, o preço unitário passa a ser recalculado automaticamente sempre que o usuário alterar **largura, comprimento, espessura ou Fator KG** — tanto em Pedidos quanto em Propostas. O valor digitado manualmente é sobrescrito.

### Fórmula aplicada
A função `calculatePackagingPrice` já existe em `src/utils/pricing/packagingPricing.ts` e implementa exatamente o cálculo do milheiro:

```
preço unitário (R$/MIL) = (largura_mm × comprimento_mm × espessura_µm × Fator KG) / 1.000.000
```

Validação com o item da tela: 200 × 270 × 0,12 × 29,30 / 1.000.000 × 1.000 = **R$ 189,86** ✓

(Para `unit_measure = 'KG'` o preço continua sendo o próprio Fator KG; outras unidades não recalculam.)

### Onde aplicar

1. **`src/components/orders/OrderItemDetailModal.tsx`** — modal "Detalhes do Item"
   - Em `updateDraftField`, quando o campo alterado for `width`, `length`, `thickness` ou `fator_kg`, recalcular `unit_price` via `calculatePackagingPrice` usando o `unit_measure` do draft, e recalcular `subtotal = qty × unit_price`.
   - Manter o campo "Preço Unitário" editável, mas marcado como auto-calculado (badge "auto" + tooltip explicando a fórmula). Edição manual continua possível, mas será sobrescrita na próxima alteração de dimensão/fator.

2. **`src/components/orders/OrderDialog.tsx`** — linha inline da tabela de itens
   - Em `updateItem`, quando `width`/`length`/`thickness`/`fator_kg` mudar, recalcular `unit_price` e `subtotal` com `calculatePackagingPrice`.
   - As dimensões hoje só são editáveis pelo modal; o `fator_kg` é editável inline (linha 1209-1210) — esse caso passa a recalcular o preço.

3. **`src/components/proposals/ProposalDialog.tsx`** — espelhar o mesmo comportamento das duas alterações acima nas linhas/handlers equivalentes da proposta.

### Detalhes técnicos

- Reutilizar `calculatePackagingPrice({ unit_measure, unit_price, fator_kg, width, length, thickness })` — sem nova função.
- Fallback: se faltar qualquer dimensão ou Fator KG, manter o `unit_price` atual (a função já retorna `unit_price` nesse caso, mas vamos preservar explicitamente o valor digitado para não zerar enquanto o usuário ainda está preenchendo).
- Itens **bloqueados** (`is_locked` / pedido não-pendente) não recalculam — o guard `isEditable` já cobre isso.
- `unit_measure` precisa estar disponível no draft do modal: ele já é carregado em `OrderDialog` (linha 888) e persistido no item, então basta usar `draft.unit_measure`.
- Não altera nada no banco nem em edge functions; é puramente UI/cálculo no front.

### Fora de escopo

- Não muda a hierarquia de preços (Tabela do Cliente > Regra > Tabela Padrão > Base) — o auto-cálculo só roda quando o usuário edita dimensões/fator no documento, refletindo a intenção explícita de mudar a especificação.
- Não toca em produtos cadastrados, SKU ou `erp_versao`.