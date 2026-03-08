

# Plano: Campo Contribuinte IPI no cadastro + coluna IPI na listagem

## Resumo

Duas alterações:
1. Adicionar campo "Contribuinte de IPI" (switch Sim/Não) na aba Dados do `CustomerDetail.tsx`
2. Na listagem de clientes (`Customers.tsx`), substituir a coluna "Status" pela coluna "IPI", mostrando "Sim" ou "Não" conforme `contribuinte_ipi`

## Alterações

### 1. `CustomerDetail.tsx` — Campo editável de Contribuinte IPI

- Adicionar `contribuinte_ipi: false` ao `companyForm` state (linha 157)
- Inicializar com `customer.contribuinte_ipi ?? false` (linha 530)
- Adicionar um campo Switch na aba Dados, após Inscrição Estadual (após linha 805):
  ```
  Contribuinte de IPI: [Switch Sim/Não]
  ```
- O campo já será salvo automaticamente via `handleSaveCompany` (que faz spread de `companyForm`)
- Importar `Switch` de `@/components/ui/switch`

### 2. RPC `search_customers_paginated` — Adicionar `contribuinte_ipi` ao retorno

- Migration SQL para recriar a função adicionando `contribuinte_ipi boolean` na tabela de retorno e `c.contribuinte_ipi` no SELECT

### 3. `Customers.tsx` — Substituir coluna Status por IPI

- Adicionar `contribuinte_ipi: boolean` ao `CustomerRow` interface
- No header da tabela, trocar `<SortableHeader field="status">Status</SortableHeader>` por `IPI`
- Na célula, substituir o badge Ativo/Inativo por:
  - `contribuinte_ipi = true` → Badge "Sim" (verde)
  - `contribuinte_ipi = false` → Badge "Não" (cinza)
- Remover `'status'` do `SortField` type (já que a coluna sumiu)
- O filtro de status (Ativos/Inativos/Todos) no topo continua funcionando normalmente — apenas a coluna visual muda

## O que NÃO muda
- O filtro de status (Select Ativos/Inativos/Todos) permanece
- As ações de ativar/desativar cliente permanecem nos botões de ação
- Nenhuma edge function ou PDF é alterado

