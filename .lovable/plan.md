

# Correcao do Modulo de Estoque: Trocar `companies` por `legal_entities`

## Problema

O modulo de estoque foi implementado referenciando a tabela `companies` (base de clientes), mas deveria usar a tabela `legal_entities` (entidades juridicas/CNPJs proprios da empresa, gerenciados em Configuracoes > CNPJ).

Conforme a imagem enviada, o dropdown de "Empresa" esta mostrando clientes (ex: "Gustavo Santos", "Marcos") em vez das entidades juridicas cadastradas (ex: "QUALYVAC EMBALAGENS LTDA").

---

## Alteracoes Necessarias

### 1. Migration SQL

Alterar as FKs e funcoes RPC para referenciar `legal_entities` em vez de `companies`:

- Remover FK `product_stock.company_id -> companies.id`
- Adicionar FK `product_stock.company_id -> legal_entities.id`
- Remover FK `stock_movements.company_id -> companies.id`
- Adicionar FK `stock_movements.company_id -> legal_entities.id`
- Recriar as funcoes `process_stock_movement` e `transfer_stock` para que os JOINs e validacoes internos (se houver) referenciem `legal_entities`
- Recriar o indice unico composto se necessario

### 2. Hook `src/hooks/useStock.ts`

- **`useCompaniesForStock`** -> renomear para **`useLegalEntitiesForStock`**
  - Trocar query de `companies` para `legal_entities`
  - Filtrar por `active = true` e `tenant_id`
  - Retornar `id`, `name`, `cnpj`

- **`useStockList`**: trocar o join de `companies:company_id` para `legal_entities:company_id`
- **`useStockHistory`**: trocar o join de `companies:company_id` para `legal_entities:company_id`

### 3. Pagina `src/pages/Stock.tsx`

- Atualizar todos os imports de `useCompaniesForStock` para `useLegalEntitiesForStock`
- Manter nomes de variaveis como `companies` internamente (ou renomear para `entities`) -- sem impacto funcional

---

## Arquivos Afetados

| Acao | Arquivo |
|------|---------|
| Migration | Alterar FKs de `companies` para `legal_entities` |
| Editar | `src/hooks/useStock.ts` |
| Editar | `src/pages/Stock.tsx` |

---

## Resultado

Apos a correcao, os dropdowns de empresa no modulo de estoque mostrarao apenas as entidades juridicas (CNPJs) cadastradas em Configuracoes, e nao mais os clientes da base.

