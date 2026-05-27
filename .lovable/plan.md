# Plano: Delay de navegação + Mover indicadores para nova aba em Relatórios

## 1) Delay ao clicar em uma página

### Causa raiz
`src/App.tsx` usa `lazy()` em todas as rotas com um único `<Suspense fallback={<RouteFallback />}>`. Ao clicar:
1. Navegador baixa o chunk JS da rota (rede).
2. Só depois o Suspense troca a tela — sem feedback imediato, dá sensação de "clique sem resposta".
3. Em rotas pesadas (Customers, Pipeline), somam-se as queries iniciais antes do primeiro paint útil.

### Ações (sem mudança de regra de negócio)

**A. Feedback instantâneo**
- Barra de progresso fina no topo (estilo NProgress) acionada por mudança de `location` e desligada quando o Suspense resolve. Aparece em <50ms — elimina a sensação de "travado".

**B. Prefetch dos chunks das rotas**
- No `NavLink` do menu: no `onMouseEnter`/`onFocus` disparar o `import()` da rota correspondente. Quando o usuário clica, o chunk já está em cache → transição quase instantânea.
- Prefetch automático em `requestIdleCallback` das 3 rotas mais usadas (Today, Customers, Pipeline) após login.

**C. Pequenos ajustes**
- Garantir `staleTime` adequado nas queries das páginas pesadas (já é 5min global; revisar overrides).

> Resultado esperado: clique → barra em <50ms → conteúdo em <300ms (rota pré-carregada).

---

## 2) Mover indicadores da página Clientes para nova aba em Relatórios

### Hoje em `/customers` (topo)
| Bloco | Componente | RPCs | Custo |
|---|---|---|---|
| Faixa colorida (Leads/Prospects/Ativos/Inativos/Perdidos) | `LifecyclePanel` | `get_lifecycle_counts` + `get_activity_status_counts` | 2 round-trips paralelos |
| Faixa branca (Total, Setor, Segmento, Atividade, Ativos 30d, Negócios em aberto) | `CustomerDashboardCards` | `get_dashboard_card_metrics` | 1 round-trip |

**Impacto:** não bloqueia a tabela de clientes (queries independentes), mas adiciona 3 RPCs de agregação a cada visita da página mais acessada — pressão constante no banco e ~150–400ms extras em rede.

### Mudança

1. **`src/pages/Reports.tsx`**
   - Adicionar nova aba **"Clientes"** no `<Tabs>` existente (junto com Operacional, Funil de Vendas, BI Avançado, Produtividade, Dashboard Personalizado).
   - Conteúdo da aba: `<LifecyclePanel />` + `<CustomerDashboardCards />` + botão **"Personalizar painel"** (`<DashboardCardSettings />`), na mesma ordem visual de hoje.
   - Ícone sugerido: `Users` (já importado).

2. **`src/pages/Customers.tsx`**
   - Remover `<LifecyclePanel />`, `<CustomerDashboardCards />` e o botão "Personalizar painel" do topo.
   - Manter título, ações (Enriquecer, Novo Cliente), filtros e tabela.

3. **Nada muda em:** RPCs, schema, RLS, lógica de cliques nos cards (a navegação para `/customers?lifecycle=...` continua funcionando da aba de Relatórios).

### Ganho
- `/customers`: −3 RPCs por visita → carregamento mais leve e menos carga no banco em horário de pico.
- Indicadores ficam em local apropriado (Relatórios), acessados sob demanda.

---

## Escopo fora deste plano
- Reescrita de RPCs, mudanças em RLS/schema, redesign visual dos cards.

## Ordem de execução
1. Item 2 (mover indicadores) — ganho imediato e isolado.
2. Item 1 (feedback + prefetch) — em sequência.

Posso seguir?
