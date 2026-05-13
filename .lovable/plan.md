# Formatação profissional dos campos da tabela de itens

Aplicar formatação numérica padrão pt-BR nos três campos editáveis da tabela de itens do pedido (e replicar na proposta).

## Campos afetados

| Campo     | Formato exibido     | Decimais | Notas |
|-----------|---------------------|----------|-------|
| Qtd       | `1.234,000`         | 3        | Separador de milhar + 3 casas |
| Fator KG  | `1.234,56` (contábil)| 2       | Separador de milhar + alinhado à direita |
| Com %     | `5,00 %`            | 2        | Sufixo `%`, alinhado à direita |
| IPI %     | `5,00 %`            | 2        | Célula somente leitura, mesma formatação |

Subtotal / Total / IPI R$ continuam usando `formatCurrency`.

## Comportamento dos inputs

Padrão "exibir formatado / editar limpo":
- **Sem foco:** valor formatado em pt-BR.
- **Com foco:** entrada com vírgula como separador decimal, sem separador de milhar.
- **No blur:** normaliza, faz parse, atualiza estado, re-renderiza formatado.
- Mantém `disabled={!canEdit}` e largura atual das colunas.

## Implementação

1. **Novo `src/components/ui/NumberInput.tsx`**
   - Props: `value: number | null`, `onChange(value)`, `decimals`, `suffix?`, `min`, `max`, `disabled`, `className`, `placeholder`.
   - Formata com `Intl.NumberFormat('pt-BR', { minimumFractionDigits, maximumFractionDigits })`.
   - Estado interno `displayValue`; sincroniza com `value` externo quando não focado.
   - Parse no blur: remove `suffix`, remove `.` (milhar), troca `,` por `.`, `Number(...)`.

2. **`src/components/orders/OrderDialog.tsx`** — substituir os três `<Input type="number">` (Qtd, Fator KG, Com %) por `<NumberInput>` com decimais 3 / 2 / 2 e `suffix=" %"` em Com %. Atualizar a célula `IPI %` para usar `Intl.NumberFormat` pt-BR com 2 casas + ` %`.

3. **`src/components/proposals/ProposalDialog.tsx`** — mesma troca nos campos equivalentes para manter paridade visual.

4. Nenhuma mudança em hooks, persistência, validação, cálculos ou schema. `quantity`, `fator_kg`, `commission_pct` e `ipi_rate` continuam armazenados como `number`.

## Arquivos

- criar `src/components/ui/NumberInput.tsx`
- editar `src/components/orders/OrderDialog.tsx`
- editar `src/components/proposals/ProposalDialog.tsx`

## Fora de escopo

- Outras telas (documentos, relatórios) não são alteradas.
- Regras de negócio e validações permanecem idênticas.
