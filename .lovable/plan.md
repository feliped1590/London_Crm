

# Plano: Paginacao Server-Side para Remanejamento de Carteira

## Objetivo
Implementar paginacao server-side na tela de Remanejamento para evitar sobrecarga de memoria ao carregar todos os clientes de uma vez.

## Contexto Atual
- A funcao RPC `get_companies_for_reallocation` ja suporta `p_limit` e `p_offset`
- Atualmente carrega ate 1000 registros de uma vez
- Existem ~200 clientes na base unificada (CRM + ERP)
- O componente de paginacao ja existe em `src/components/ui/pagination.tsx`
- A pagina Customers usa paginacao client-side como referencia

## Estrategia
Implementar paginacao **server-side** para garantir escalabilidade futura, carregando apenas 25 clientes por pagina.

---

## Etapas de Implementacao

### 1. Criar funcao RPC de contagem

Adicionar funcao no banco para retornar o total de registros com os mesmos filtros:

```text
+------------------------------------------+
|  get_companies_for_reallocation_count    |
+------------------------------------------+
| Parametros: mesmos filtros da funcao     |
| principal (states, regions, owner_id,    |
| min_days, search, no_owner)              |
| Retorno: integer (total de registros)    |
+------------------------------------------+
```

### 2. Atualizar Hook usePortfolioReallocation

Modificacoes no hook:
- Adicionar estado `currentPage` (numero da pagina atual)
- Adicionar constante `ITEMS_PER_PAGE = 25`
- Criar query separada para buscar contagem total
- Atualizar query principal para usar `p_limit` e `p_offset` dinamicos
- Resetar pagina para 1 quando filtros mudarem
- Expor funcoes `setPage`, `totalItems`, `totalPages`

### 3. Atualizar ReallocationResultsTable

Adicionar controles de paginacao ao componente:
- Exibir contador "X-Y de Z clientes"
- Botoes Anterior/Proximo
- Numeros de pagina com ellipsis para navegacao rapida

### 4. Atualizar Pagina PortfolioReallocation

- Receber props de paginacao do hook
- Passar para o componente de tabela
- Ajustar logica de "selecionar todos" para considerar apenas pagina atual

---

## Detalhes Tecnicos

### Migracao SQL
```sql
CREATE OR REPLACE FUNCTION get_companies_for_reallocation_count(
  p_states text[] DEFAULT NULL,
  p_regions text[] DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_min_days_no_interaction integer DEFAULT NULL,
  p_min_days_no_order integer DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_no_owner boolean DEFAULT NULL
)
RETURNS integer
-- Aplica mesmos filtros e retorna COUNT(*)
```

### Interface do Hook (apos alteracao)
```text
usePortfolioReallocation retorna:
  - companies (pagina atual)
  - totalItems (total geral)
  - totalPages
  - currentPage
  - setCurrentPage
  - itemsPerPage
  - (demais campos existentes)
```

### Comportamento de Selecao
- "Selecionar todos" seleciona apenas os itens da pagina atual
- Itens selecionados em paginas anteriores sao mantidos ao navegar
- Contador de selecionados permanece visivel no topo

---

## Resumo de Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Criar funcao de contagem |
| `src/hooks/usePortfolioReallocation.ts` | Estado de paginacao, queries atualizadas |
| `src/components/reallocation/ReallocationResultsTable.tsx` | Controles de paginacao |
| `src/pages/PortfolioReallocation.tsx` | Passar props de paginacao |

---

## Resultado Esperado
- Carregamento inicial rapido (25 itens)
- Navegacao fluida entre paginas
- Memoria do navegador otimizada
- Selecao funcional entre paginas
- Escalavel para milhares de clientes

