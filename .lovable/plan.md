## Objetivo
Adicionar um botão no card "Ranking de Produtividade" que abre o gráfico em um modal grande (quase fullscreen), facilitando a leitura quando há muitos vendedores.

## Mudanças
Arquivo: `src/components/reports/SellerProductivityReport.tsx` (apenas frontend)

1. **Botão "Expandir"** no header do card do ranking, ao lado dos selects "Barras Verticais" e "Por Score".
   - Ícone `Maximize2` (lucide-react) + tooltip "Expandir gráfico".
   - Variante `ghost`, tamanho `icon`.

2. **Dialog de expansão** usando `@/components/ui/dialog`:
   - `max-w-[95vw]` e altura ~85vh.
   - Reaproveita o mesmo componente de gráfico (Recharts) já renderizado, apenas com container maior.
   - Mantém os mesmos seletores (tipo de gráfico, métrica) dentro do modal para o usuário continuar interagindo.
   - Botão de fechar padrão do Dialog.

3. Sem mudanças em hooks, RPCs ou lógica de cálculo — puramente apresentação.

## Fora de escopo
- Alterações no `useSellerProductivity` ou nas RPCs.
- Exportação/print do gráfico (pode ser feito depois se desejado).
