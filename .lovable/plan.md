# Múltiplas Versões de Produto

Hoje cada produto = 1 versão fixa. Vamos permitir que um mesmo item tenha N versões, cada uma com **suas próprias dimensões (L × C × E)**, mantendo o restante (nome, NCM, família, fiscal, fator KG, preço base) compartilhado.

## Modelo de dados

Adicionar à tabela `products`:
- `parent_product_id uuid` — referência ao produto-pai (NULL = é o próprio pai/v1)
- `versao_numero int` — número sequencial da versão (1, 2, 3…), gerado por trigger

Regras:
- O produto-pai (`parent_product_id IS NULL`) tem `versao_numero = 1` e guarda os atributos compartilhados (nome, NCM, família, classe, fiscal, fator KG, preço base, `erp_product_code`).
- Versões filhas herdam logicamente os atributos do pai mas têm próprias: `width`, `length`, `thickness`, `sku` (auto), `erp_versao` (auto via trigger existente), `versao_numero`.
- Constraint: `UNIQUE (parent_product_id, versao_numero)` quando filho; SKU continua único globalmente.
- Trigger atribui `versao_numero = MAX(versao_numero)+1` do mesmo pai ao inserir filho.
- Ao editar campos compartilhados no pai, propagar para filhos (ou bloquear edição nos filhos via UI).

## Backend

- `erp_product_code` é compartilhado entre pai e filhos (mesma `codigo` no ERP).
- `process-product-sync`: ao sincronizar o pai, agrupar todas as versões (pai + filhos) e enviar `versoes[]` com 1 entrada por versão (`versao: versao_numero`, `detalhes: erp_versao`, `situacao: 'A'`). O mapper `product-mapper-v2.ts` já aceita array — basta alimentar dinamicamente.
- Sequência ERP (`erp_sequences`) continua apenas para o pai; filhos não consomem código novo.

## Frontend — Cadastro (`/products`)

- Em `ProductDialog`, adicionar aba/seção **"Versões"** listando todas as versões do item (incluindo a v1).
- Botão **"Nova versão"** abre formulário compacto pedindo apenas L × C × E. Cria registro filho com `parent_product_id` = produto atual.
- Cada linha mostra: nº versão, dimensões, SKU, `erp_versao`, status ERP, ações (editar dimensões / inativar).
- Lista principal de produtos: opção de toggle "Agrupar versões" (mostra só o pai e expande) ou "Listar todas" (cada versão como linha — padrão para busca em pedidos).

## Frontend — Pedidos & Propostas

- `ProductSelector` / busca: cada versão aparece como linha separada, ex.: `IMPRESSO BOBINA – CHARQUE 500GR – v2 (15×30×0,09 NY)`.
- Snapshot do item de pedido já copia dimensões → nada muda no fluxo de pricing, IPI e auto-cálculo do saco.

## Fora de escopo
- Preço/Fator KG por versão (continuam vindo do pai).
- Estoque por versão.
- SKU manual (continua auto-gerado conforme regra atual).
- Importação retroativa de versões já existentes no ERP (pode ser feita em etapa seguinte de import).

## Migração

1. Migration: adicionar colunas + índice + trigger de numeração + constraint.
2. Backfill: todos os produtos atuais ficam `parent_product_id = NULL`, `versao_numero = 1`.
3. Ajustar trigger de `erp_versao` para considerar dimensões da própria versão (já considera).
4. UI de Versões + ajuste do `ProductSelector`.
5. Ajuste do `process-product-sync` para montar `versoes[]` dinâmico.

Após sua aprovação, implemento na ordem acima.