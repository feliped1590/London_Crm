# Ajuste no cadastro de Produtos — Grupo/Subgrupo (descrição) e Tipo de Ficha

## Contexto

Ao cadastrar um produto, a validação está bloqueando o salvamento exigindo "Grupo ERP", "Subgrupo ERP" e "Tipo de ficha" — mas:

- Os campos **Grupo** e **Subgrupo** do CRM (`product_groups` / `product_subgroups`) já são os mesmos cadastrados para o ERP. O que o ERP espera no payload é a **descrição** (label) do grupo/subgrupo cadastrado pelo usuário, não um código separado. Portanto não faz sentido um segundo campo "Grupo ERP" / "Subgrupo ERP".
- O **Tipo de Ficha** não tem campo no formulário, então a validação sempre falha.

## O que vai mudar

### 1. Derivar `erp_grupo` e `erp_subgrupo` automaticamente a partir da descrição

No `handleSubmit` de `src/pages/Products.tsx`, ao montar o payload do `insert`/`update` na tabela `products`:

- `erp_grupo` ← `product_groups.label` (descrição) do `grupo_id` selecionado.
- `erp_subgrupo` ← `product_subgroups.label` (descrição) do `subgrupo_id` selecionado.

Assim o payload enviado ao ERP via `product-mapper-v2.ts` recebe `grupo` e `subgrupo` como a descrição cadastrada pelo usuário, sem campo extra na UI.

### 2. Ajustar validação ERP

No bloco `erpRequiredErrors` (linhas 857–858), substituir as validações de `erp_grupo`/`erp_subgrupo` por:

- exigir `grupo_id` selecionado (mensagem: "Grupo");
- exigir `subgrupo_id` selecionado (mensagem: "Subgrupo");

### 3. Adicionar seletor "Tipo de Ficha" no formulário

Na aba **Geral**, dentro da seção de Classificação (próximo a Família/Classe/Tipo de item), adicionar um `<Select>`:

- Label: **Tipo de Ficha** *(obrigatório)*
- Opções: `1` e `2`
- Bind: `formData.tipo_ficha` (number)
- Mantém validação `if (!formData.tipo_ficha)` no `handleSubmit`.

## Arquivos afetados

- `src/pages/Products.tsx`
  - `handleSubmit`: derivar `erp_grupo`/`erp_subgrupo` a partir do `label` em `grupos.items` / `subgrupos.items`.
  - Atualização das mensagens de validação ERP.
  - Novo `<Select>` "Tipo de Ficha" (opções 1 e 2) na aba Geral.

## Fora de escopo

- Backend (`product-validator.ts` / `product-mapper-v2.ts`) **não** muda — continua lendo `erp_grupo`/`erp_subgrupo` da tabela `products`, agora preenchidos automaticamente com a descrição.
- Nenhuma migração de banco necessária.
