# Diagnóstico — IPI não destacado no item do pedido

## Causa raiz

Apesar de NCM tributado, cliente "Contribuinte de IPI" e pedido em modo "Destacar IPI", a linha do produto sai sem IPI porque **o cadastro do produto está com `aliquota_ipi = NULL`**.

Confirmado no banco:
- `products.aliquota_ipi` está **NULL em todos** os produtos com NCM `39173290` (inclusive `1-1-LB-TR-58-400-150`).
- `ncm_codes.aliquota_ipi_oficial` também está **NULL** para o NCM `39173290` (TIPI não foi importado/preenchido para esse código).

No `OrderDialog.tsx` (linha 1018 e 1026), na hora de inserir um item:

```ts
ipi_rate = companyFiscalData.contribuinte_ipi
  ? (product.aliquota_ipi || 0)   // ← cai pra 0
  : 0;
```

Como `aliquota_ipi` vem `null`, o `|| 0` zera. O modo "Destacar" só pinta a coluna se `ipi_rate > 0`; daí o item aparece sem IPI mesmo com tudo configurado.

Resumo: as três condições do usuário (NCM tributado / cliente contribuinte / modo destacar) **estão corretas na UI, mas o dado que alimenta o cálculo (`product.aliquota_ipi`) está vazio**. Hoje o sistema não tem fallback automático do NCM para o produto.

---

## Plano de correção

### 1. Fonte da verdade: NCM → Produto (fallback automático)

Quando o produto não tiver `aliquota_ipi` definida, usar a alíquota do NCM (`ncm_codes.aliquota_ipi_oficial`).

**Onde aplicar:**
- `OrderDialog.tsx` linha 1018 e `addProductItem` (linha 1026): trocar `(product.aliquota_ipi || 0)` por `(product.aliquota_ipi ?? ncm.aliquota_ipi_oficial ?? 0)`.
- Mesma lógica em `ProposalDialog` (espelho).
- Incluir o JOIN/leitura de `ncm_codes` no `useCompanyProducts` e no `useProductSearch` (campo `aliquota_ipi_oficial`), ou consultar via `ncm_id` ao montar o item.

### 2. Auto-preenchimento na classificação do produto

Quando o admin seleciona/troca o NCM no cadastro do produto e o produto está com `aliquota_ipi` vazio, sugerir/copiar a `aliquota_ipi_oficial` do NCM (com aviso "valor herdado do NCM, pode ser sobrescrito").

- Local: `NCMSelector.tsx` + `FiscalSuggestionsCard.tsx`.

### 3. Preencher a TIPI faltante

O NCM `39173290` (e provavelmente vários outros) está sem `aliquota_ipi_oficial`. Duas ações:

- **Curto prazo:** permitir edição manual da alíquota no `NCMManager.tsx` (já existe a coluna; revisar se está editável e populada).
- **Médio prazo:** rodar/agendar `import-ncm-tipi` para popular a tabela oficial. Conferir se a fonte do TIPI usada na função traz esse capítulo 3917.

### 4. Indicador visual no item (opcional, mas evita confusão)

Na linha do item, quando `ipiMode = 'destacar'` mas `ipi_rate = 0`, exibir um badge sutil "IPI 0% — verifique cadastro do produto/NCM" para o vendedor enxergar o motivo antes de fechar o pedido.

---

## O que NÃO muda

- Lógica de `calculateIpiValue` / `calculateItemTotal` continua igual.
- Toggle "Contribuinte de IPI" no cliente continua sobrescrevendo (se cliente não é contribuinte → 0, mesmo com NCM tributado).
- Itens já salvos no pedido **não** são recalculados automaticamente (snapshot mantém o `ipi_rate` gravado no momento da inclusão); o usuário precisa remover e re-adicionar o item após o cadastro ser corrigido — ou abrimos uma ação "Recalcular IPI dos itens" no modal, se você quiser.

---

## Pergunta antes de implementar

Quer que eu **inclua o passo 4** (badge de aviso na linha) e a **ação "Recalcular IPI"** no pedido, ou prefere só o fallback NCM→Produto (passos 1 e 2) por enquanto?
