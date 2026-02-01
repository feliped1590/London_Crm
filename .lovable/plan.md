
# Plano: Paginação para Lista de Clientes

## Problema

A lista de clientes carrega e renderiza todos os ~200+ registros de uma vez, o que pode causar:
- Lentidão na renderização
- Consumo excessivo de memória
- Experiência ruim para o usuário

---

## Solução

Implementar paginação client-side com controles de navegação, exibindo **25 clientes por página**.

---

## Alterações Detalhadas

### Arquivo: `src/pages/Customers.tsx`

#### 1. Adicionar Estados de Paginação

```typescript
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 25;
```

#### 2. Reset de Página ao Filtrar

Quando o usuário faz uma busca, voltar para a primeira página:

```typescript
useEffect(() => {
  setCurrentPage(1);
}, [debouncedSearch]);
```

#### 3. Cálculo de Dados Paginados

```typescript
const paginatedCustomers = useMemo(() => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return filteredCustomers?.slice(startIndex, endIndex) || [];
}, [filteredCustomers, currentPage]);

const totalPages = Math.ceil((filteredCustomers?.length || 0) / itemsPerPage);
```

#### 4. Adicionar Controles de Paginação

Utilizar os componentes já existentes em `src/components/ui/pagination.tsx`:

```typescript
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
```

#### 5. Renderizar Paginação

Após a tabela, exibir:
- Contador de registros: "Exibindo 1-25 de 203 clientes"
- Controles: Anterior / Números / Próximo

---

## Layout da Paginação

```text
┌─────────────────────────────────────────────────────────────────┐
│  Tabela de Clientes (25 por página)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Lista com 25 clientes]                                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Exibindo 1-25 de 203 clientes                                  │
│                                                                 │
│  ← Anterior  [1] [2] [3] ... [9]  Próximo →                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/pages/Customers.tsx` | Adicionar estados de paginação, lógica de slice, controles de navegação |

---

## Detalhes Técnicos

### Estados Adicionados
- `currentPage` - Página atual (inicia em 1)
- `itemsPerPage = 25` - Constante para itens por página

### Lógica de Paginação
- `totalPages` - Total de páginas calculado
- `paginatedCustomers` - Slice do array filtrado
- Reset para página 1 ao mudar busca

### Componentes Utilizados
Reutilização dos componentes de paginação já existentes no projeto (`PaginationPrevious`, `PaginationNext`, `PaginationLink`, `PaginationEllipsis`)

---

## Resultado Esperado

1. **25 clientes por página** - Interface leve e responsiva
2. **Navegação intuitiva** - Botões anterior/próximo e números de página
3. **Contador informativo** - "Exibindo X-Y de Z clientes"
4. **Reset automático** - Voltar para página 1 ao pesquisar
5. **Performance melhorada** - Renderização de apenas 25 itens por vez
