## Plano — Dimensões efetivas (com sanfona) em cálculos e atributos ERP

### Princípio

| Camada | Valor exemplo | Origem |
|---|---|---|
| `products.width` / `length` / `thickness` | 100 / 250 / 0,24 | DB — limpo, imutável |
| `ficha_tecnica.sanfona` | `{ativa:true, local:'Fundo', valor:30}` | DB — editável |
| **Dimensões efetivas** (runtime) | 100 / 280 / 0,24 | computado via helper |
| **Atributo ERP** (Largura/Comprimento) | 100 / **280** | soma efetiva |
| **`erp_versao`** (string visual) | `100x250+30x0,240` | composição literal |

DB intacto. Sanfona entra **só no momento do cálculo / envio**.

### Implementação

**1. Helper único — `getEffectiveDimensions`**

`src/utils/products/effectiveDimensions.ts`:
```ts
export function getEffectiveDimensions(p) {
  const s = p.ficha_tecnica?.sanfona;
  const add = (s?.ativa && Number(s?.valor) > 0) ? Number(s.valor) : 0;
  return {
    width:     (p.width  || 0) + (s?.local === 'Lateral' ? add : 0),
    length:    (p.length || 0) + (s?.local === 'Fundo'   ? add : 0),
    thickness: p.thickness || 0,
  };
}
```

Espelho SQL: função `public.get_effective_dimensions(p_product products)` retornando `(width, length, thickness)` — reusada pelo `extract_attribute_value`.

**2. Cálculos comerciais usam efetivo**

- `src/utils/pricing/packagingPricing.ts` → no ramo `MIL`, trocar `product.width/length` por `getEffectiveDimensions(product).{width,length}` antes de `calcularFatorMilheiro`.
- Auditar com `rg "product\.(width|length|thickness)"` em `src/utils/pricing/`, `src/modules/documents/`, `src/components/orders/`, `src/components/documents/` para identificar outros pontos que multiplicam dimensões em cálculo de preço/peso — aplicar o mesmo helper.
- **Não tocar** em `unit_price` nem em qualquer input do usuário.

**3. Atributos ERP — enviar soma numérica**

Alterar SQL `extract_attribute_value`:
- Hoje, paths `width`/`length` retornam string concatenada (ex.: `"100+30"`) quando há sanfona.
- Novo: usar `get_effective_dimensions` e retornar **soma numérica** formatada (ex.: `"280"`).

Trigger `detect_dirty_attributes` continua disparando quando `ficha_tecnica` muda (já marca width/length como `is_dirty`), então `process-attribute-sync` reenvia automaticamente.

**4. `erp_versao` — sem mudança**

`generateErpVersion` (TS) e `auto_generate_erp_versao` (SQL trigger) continuam gerando `100x250+30x0,240`. É o rótulo visual da versão no ERP.

**5. Backfill**

Para produtos com sanfona ativa:
- Tocar `updated_at` em `products` (UPDATE no-op) → trigger regenera `erp_versao` automaticamente.
- `UPDATE attribute_values SET is_dirty = true` para `attribute_path IN ('width','length')` desses produtos → fila de atributos reenvia.

**6. Validação**

Produto teste (`TESTE DE IMPRESSO`, Stand Up Impresso, 100×250×0,24, sanfona Fundo 30):

| Verificação | Esperado |
|---|---|
| `products.length` no DB | `250` (intacto) |
| `erp_versao` no DB | `100x250+30x0,240` |
| Payload atributo Largura | `valor_padrao = "100"` |
| Payload atributo Comprimento | `valor_padrao = "280"` |
| Payload atributo Espessura | `valor_padrao = "0,240"` |
| Payload produto `versoes[].detalhes` | `100x250+30x0,240` |
| Preço milheiro em novo pedido | `fator × 100 × 280 × 0,24 / 1.000.000` |

### Fora de escopo

- Não tocar em `products.width/length/thickness` (continuam puros).
- Não recalcular pedidos já criados (snapshot congelado, conforme decidido).
- Não tocar em `fator_kg`/preço armazenado no produto (decidido: não há mais fator armazenado em item).
- Suporte simultâneo a Lateral + Fundo (não existe).