
# Plano: Ajustar Colunas e Adicionar Importação de Produtos

## Resumo

Duas alterações são necessárias:
1. **Inverter as colunas** "Versão" e "Descrição" na tabela de produtos do Iniflex
2. **Adicionar funcionalidade de importação** para salvar produtos do ERP na tabela `products` (padrão do CRM)

---

## 1. Inversão das Colunas

### Arquivo: `src/components/integrations/InflexProductsTab.tsx`

**Alteração no cabeçalho da tabela (linhas 310-312):**

| Antes | Depois |
|-------|--------|
| Produto → Versão → Descrição | Produto → Descrição → Versão |

**Alteração nas células da tabela (linhas 324-340):**

Mover a célula de Descrição para antes da célula de Versão.

---

## 2. Funcionalidade de Importação

### Lógica de Importação

Similar ao que foi feito com clientes:
- Adicionar checkbox para seleção múltipla
- Botão "Importar Selecionados"
- Importar produtos individuais
- Badge "Importado" para produtos já existentes na tabela `products`

### Mapeamento de Campos (crm_products → products)

| Campo crm_products | Campo products |
|--------------------|----------------|
| external_id-versao | sku |
| descricao_completa ou descricao | name |
| descricao_simples | description |
| grupo | category (mapeado) |
| unidade | unit_measure |
| preco_venda | unit_price |
| ativo | active |

### Alterações no Componente

**Novos estados:**
- `selectedIds: Set<string>` - IDs selecionados para importação
- `importingIds: Set<string>` - IDs em processo de importação

**Novas queries:**
- Query para buscar `products.sku` existentes (para detectar já importados)

**Nova mutation:**
- `importMutation` - insere/atualiza produto na tabela `products`

**Novos elementos de UI:**
- Checkbox no cabeçalho e em cada linha
- Botão "Importar Selecionados" 
- Badge "Importado" nas linhas já existentes
- Coluna de ações com botão de importação individual

---

## Fluxo Visual Atualizado

```
┌─────────────────────────────────────────────────────────────────┐
│ [Card Sincronização ERP]                                        │
│   - Busca incremental do Iniflex                                │
│   - Salva em crm_products (staging)                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ [Tabela de Produtos - Iniflex]                                  │
│ ☐ | Produto | Descrição | Versão | Grupo | ... | Status | Ação │
│ ☐ | 200119/1| MONOCAMADA...| 220X10| LISO | ...| Importar      │
│ ☑ | 800349/1| (I) CALOPS...| VERSAO| IMPR | ...| ✓ Importado   │
│                                                                 │
│ [Importar Selecionados (2)]                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ [Tabela products - CRM Principal]                               │
│ Visualização na página /products                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/integrations/InflexProductsTab.tsx` | Inversão de colunas + lógica de importação |

Nenhuma nova Edge Function é necessária - a importação será feita diretamente via Supabase client, similar ao padrão já existente para clientes.
