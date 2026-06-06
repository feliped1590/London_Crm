## 1. Pedidos – remover status "Desatualizado"

O badge "Desatualizado" aparece quando `orders.updated_at` é maior que `erp_synced_at + 5s` (regra em `OrderSyncStatus.tsx`). Para os pedidos atuais, a diferença vem de edições internas (snapshots, recálculos) que não exigem reenvio ao ERP.

**Ação (one-time data fix via migração):**
- Para todo pedido com `erp_order_id IS NOT NULL` e `updated_at > erp_synced_at`, fazer `UPDATE orders SET erp_synced_at = updated_at` (sem alterar `updated_at` — usar `SET LOCAL session_replication_role = replica` para evitar trigger de touch).

Resultado: todos os pedidos hoje "Desatualizados" passam a aparecer como "Sincronizado". A lógica do badge continua válida para detectar futuras alterações reais.

## 2. Listagem de Produtos (`src/pages/Products.tsx`)

CRM trata apenas de produto acabado, então simplificar a tabela:

**Remover:**
- Coluna **Tipo** (sempre "PRODUTO ACABADO").
- Coluna **Status** (já existe filtro Ativos/Inativos).
- Filtro **"Todos os Tipos"** (Select de `filterTipo`).
- Estado `filterTipo` e seus usos nas queries (`products`, `products-count`).

**Manter/ajustar:**
- Filtro de Status (Ativos/Inativos/Todos) permanece.
- Manter `SortableHeader` em SKU, Descrição e Última Atualização (já existem) e **adicionar ordenação clicável em todas as demais colunas restantes**: Família, Unidade, NCM, Largura, Comprimento, Espessura. Para isso, estender o tipo `SortField` e habilitar `order(...)` correspondente na query.
- Cada cabeçalho passa a oferecer um pequeno filtro de texto (popover com `Input`) que aplica `ilike` na query — para colunas numéricas (Largura/Comprimento/Espessura) aceita igualdade numérica; para NCM/Família/Unidade aplica `ilike`. Estado consolidado em um objeto `columnFilters` e enviado ao Supabase junto com o `searchTerm` global.

**Linha clicável (padrão Clientes):**
- Adicionar `onClick={() => handleEdit(product)}` e `className="cursor-pointer hover:bg-muted/50"` no `<TableRow>` dos produtos.
- Garantir `e.stopPropagation()` nos botões de ação (Sync, Duplicar, Editar, Excluir) para não disparar o click da linha.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — fix one-time de `erp_synced_at`.
- `src/pages/Products.tsx` — remover Tipo/Status (coluna + filtro), adicionar sort/filtro por coluna, linha clicável.

## Fora do escopo

- Não mexer em outras telas (orders, customer, etc.).
- Não alterar regra do badge "Desatualizado" (continua válida para futuras edições reais).
