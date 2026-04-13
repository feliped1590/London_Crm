

# Plano: Exibir Fator KG e Permitir Edição de Produto nos Itens do Pedido

## O Que Será Feito

### 1. Substituir coluna "Desc %" por "Fator KG"

A coluna "Desc %" será substituída pela coluna "Fator KG (R$/kg)" que exibe o valor do `fator_kg` cadastrado no produto. Este valor é somente leitura (vem do cadastro do produto).

**Arquivos alterados:**
- `src/components/orders/OrderDialog.tsx` — trocar header "Desc %" por "Fator KG" e renderizar `product.fator_kg` formatado como moeda
- `src/types/documents.ts` — adicionar `fator_kg?: number` ao `OrderItemDraft`

**Detalhes:**
- Na adição do item (`addProductById`), capturar `fator_kg: product.fator_kg || 0`
- Na carga de itens existentes, fazer join com `products(sku, erp_code, fator_kg)` para recuperar o valor
- Exibir na célula como `R$ 25,00` (somente leitura)
- O campo `discount_percent` continua existindo no draft e na persistência (usado internamente pela pricing engine), apenas sai da UI

### 2. Produto clicável para abrir edição

Transformar o nome/código do produto na tabela de itens em um link clicável que abre a página de Produtos com o produto em edição.

**Abordagem:** Como a edição de produtos é feita via dialog na página `/products` (não há rota individual), a melhor UX é abrir o produto em nova aba via `window.open('/products?edit=PRODUCT_ID', '_blank')`.

**Arquivos alterados:**
- `src/components/orders/OrderDialog.tsx` — envolver nome/código do produto em um botão/link clicável com `cursor-pointer` e ícone `ExternalLink`
- `src/pages/Products.tsx` — adicionar leitura do query param `edit` no mount para auto-abrir o dialog de edição do produto correspondente

**Detalhes:**
- No `OrderDialog`, a célula do produto terá um `onClick` que faz `window.open(\`/products?edit=${item.product_id}\`, '_blank')`
- No `Products.tsx`, um `useEffect` lê `searchParams.get('edit')`, busca o produto e chama `handleEdit(product)`
- Visual: texto do produto com `hover:underline text-primary cursor-pointer` e ícone `ExternalLink` pequeno

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `src/types/documents.ts` | Adicionar `fator_kg` ao `OrderItemDraft` |
| `src/components/orders/OrderDialog.tsx` | Trocar coluna Desc% por Fator KG; produto clicável |
| `src/pages/Products.tsx` | Suporte a query param `?edit=ID` para auto-abrir edição |

## Sem Impacto

- Nenhum cálculo de total alterado
- `discount_percent` continua sendo persistido normalmente (usado pela pricing engine)
- Nenhuma migration necessária (`fator_kg` já existe na tabela `products`)

