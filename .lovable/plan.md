# Fase 4B — Drill-down dos números de venda + período explícito da meta

## Objetivo
1. Deixar visualmente claro que **Meta x Realizado** sempre se refere ao **mês corrente**, independente do filtro de período da tela.
2. Permitir **clicar em qualquer número/linha/barra de venda** nos relatórios executivos e abrir uma janela com os pedidos que originam aquele número, com totalizadores e exportação CSV.

Sem alterar RPCs, regras de negócio, RLS, segurança, filtros existentes ou relatórios clássicos.

---

## Parte 1 — Período explícito no Meta x Realizado

No card **Meta x Realizado** do *Seller360Report*, adicionar uma **badge fixa** ao lado do título:

> `Meta de {mês}/{ano} — {01/MM} a {último_dia/MM}`

Exemplo atual: `Meta de junho/2026 — 01/06 a 30/06`.

- Calculada client-side a partir de `new Date()` (mês corrente em pt-BR).
- Renderizada via `<Badge variant="outline">` dentro do header do `ExecutiveSection` (extender `ExecutiveSection` para aceitar prop `headerBadge?: ReactNode`).
- Aparece também no PDF (não usa `data-export-hide`).
- Nenhuma alteração em RPC `metas` — segue retornando os dados do período da meta cadastrada.

---

## Parte 2 — Drill-down universal de pedidos

### 2.1 Novo componente: `SalesDrillDownModal`

Arquivo: `src/components/bi/composite/SalesDrillDownModal.tsx`

Props:
```ts
{
  open: boolean;
  onClose: () => void;
  title: string;          // ex: "Pedidos de Fernanda Massi — Mai/16 a Jun/15"
  subtitle?: string;      // ex: filtros aplicados
  filters: {
    startDate: Date;
    endDate: Date;
    legalEntityId?: string | null;
    sellerId?: string | null;
    customerId?: string | null;
    productId?: string | null;
    stage?: string | null;        // para pipeline/perdas
    sourceTable?: 'bi_sales_fact' | 'deals'; // default bi_sales_fact
  };
}
```

Comportamento:
- Faz `SELECT` direto via supabase client, **respeitando RLS** (sem RPC nova):
  - **Vendas** (default): `bi_sales_fact` joinado com `orders` (número, data, cliente, vendedor, valor, status).
  - **Pipeline/Perdas/Forecast**: `deals` filtrado por `stage`, `lost_reason`, etc.
- Limite de 500 linhas; mensagem se exceder.
- Header com 3 totalizadores: **Total**, **Qtd**, **Ticket médio**.
- Tabela com colunas: Nº pedido, Data, Cliente, Vendedor, Entidade, Status, Valor.
- Linha clicável abre o pedido em nova aba (`/orders?id=...`).
- Botão **Exportar CSV** gera download client-side (mesmas colunas + cabeçalho dos filtros).
- Botão fecha modal. Modal usa `Dialog` do shadcn já existente.

### 2.2 Habilitar drill-down nos blocos

Cada bloco passa a expor um clique que abre o modal pré-filtrado:

| Bloco | Onde clicar | Filtro passado |
|---|---|---|
| KPI Vendido / Pedidos / Ticket / Clientes | Card inteiro | período + entidade + vendedor (se 360°) |
| Evolução de vendas | Ponto/barra do gráfico | recorta `startDate`/`endDate` para o dia ou mês clicado |
| Vendas por entidade | Barra | adiciona `legalEntityId` |
| Ranking vendedores | Linha | adiciona `sellerId` |
| Top clientes | Linha | adiciona `customerId` |
| Top produtos | Linha | adiciona `productId` |
| Funil comercial | Linha | `sourceTable=deals` + `stage` |
| Motivos de perda | Linha | `sourceTable=deals` + filtro de motivo |
| Forecast | Linha | `sourceTable=deals` + `stage` |

Implementação:
- `ExecutiveKpiGrid`: aceita prop opcional `onItemClick?(key)`.
- `RankingTable`: aceita prop opcional `onRowClick?(row)`; aplica `cursor-pointer hover:bg-muted/50`.
- Recharts: adicionar `onClick` no `<Bar>` / `<Area>` para capturar `activePayload`.
- Todos os cliques no PDF são neutralizados (drill-down só faz sentido no app); o modal usa portal, então não polui a captura.

### 2.3 Hook utilitário

`src/hooks/useSalesDrillDown.ts` — gerencia estado `{ open, title, filters }` e expõe `openDrillDown(...)` para os componentes de relatório passarem para baixo.

---

## Segurança e escopo

- Queries respeitam RLS existente (`bi_sales_fact` e `deals` já têm policies).
- Nenhuma alteração em RPC, schema, RLS ou permissão.
- Drill-down só aparece quando há dado — botão/linha desabilitada em estado vazio.
- Relatórios clássicos (`/reports`) intocados.
- Botões e modal escondidos no PDF via `data-export-hide`.

---

## Arquivos previstos

**Novos:**
- `src/components/bi/composite/SalesDrillDownModal.tsx`
- `src/hooks/useSalesDrillDown.ts`

**Editados:**
- `src/components/bi/composite/ExecutiveSection.tsx` (suporte a `headerBadge`)
- `src/components/bi/composite/ExecutiveKpiGrid.tsx` (`onItemClick`)
- `src/components/bi/composite/RankingTable.tsx` (`onRowClick`)
- `src/components/bi/composite/Seller360Report.tsx` (badge da meta + wiring drill-down)
- `src/components/bi/composite/CommercialExecutiveReport.tsx` (wiring drill-down nos KPIs, evolução, entidade, rankings, funil, perdas, forecast)

---

## Limitações conhecidas (assumidas)

- Drill-down em **Forecast** mostra os deals em aberto na etapa, não a projeção ponderada — explicar no subtítulo do modal.
- Tabela limitada a 500 linhas; acima disso o CSV traz a amostra e um aviso.
- Sem persistência de estado do modal entre navegações.

## Fora de escopo
- Mudar a fonte do realizado da meta.
- Drill-down no relatório clássico `/reports`.
- Server-side export (CSV é gerado no navegador).
