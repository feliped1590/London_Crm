
# Plano: Adicionar Excluir, Ativar e Desativar Clientes

## Objetivo

Adicionar na página de Clientes as mesmas funcionalidades que já existem na página de Produtos:
1. **Excluir** - Botão para remover cliente
2. **Ativar/Desativar** - Toggle para controlar status do cadastro
3. **Filtro por status** - Exibir apenas ativos, inativos ou todos

---

## Mudanças Necessárias

### 1. Banco de Dados

**Adicionar coluna `active` na tabela `companies`:**

```sql
ALTER TABLE companies 
ADD COLUMN active BOOLEAN DEFAULT true;

-- Atualizar todos os registros existentes para ativo
UPDATE companies SET active = true WHERE active IS NULL;
```

---

### 2. Página de Clientes (`src/pages/Customers.tsx`)

**Alterações:**

| Funcionalidade | Descrição |
|----------------|-----------|
| **Filtro de status** | Adicionar select "Ativos / Inativos / Todos" (similar aos Produtos) |
| **Coluna Status** | Adicionar coluna na tabela com Badge "Ativo" ou "Inativo" |
| **Botão Editar** | Adicionar botão que navega para `/customers/{id}/edit` |
| **Botão Excluir** | Adicionar botão com confirmação antes de deletar |
| **Botão Ativar/Desativar** | Toggle rápido na linha para mudar status |

**Mutations a adicionar:**
- `deleteMutation` - Excluir cliente (apenas CRM, não ERP)
- `toggleActiveMutation` - Alternar status ativo/inativo

**Regras de negócio:**
- Clientes do ERP (source: 'erp') não podem ser excluídos nem desativados
- Apenas clientes do CRM podem ser gerenciados
- Ao excluir, verificar se não há negócios vinculados (opcional: soft delete)

---

### 3. Interface Visual

**Nova aparência da tabela:**

```text
┌─────────────────┬──────────────────┬──────────┬────────────┬──────────┬─────────────────┐
│ Cliente         │ Contato Principal│ Telefone │ Últ. Ativ. │ Status   │ Ações           │
├─────────────────┼──────────────────┼──────────┼────────────┼──────────┼─────────────────┤
│ Empresa ABC     │ João Silva       │ 11 99999 │ há 2 dias  │ 🟢 Ativo │ ✏️ WhatsApp 🗑️ │
│ Empresa XYZ     │ Maria Santos     │ 21 88888 │ há 1 semana│ ⚪ Inativo│ ✏️ WhatsApp 🗑️ │
└─────────────────┴──────────────────┴──────────┴────────────┴──────────┴─────────────────┘
```

**Filtro de status:**
```text
[ Buscar clientes... ] [Ativos ▼] [🔄 Atualizar]
```

---

### 4. Ações por Tipo de Cliente

| Origem | Excluir | Ativar/Desativar | Editar |
|--------|---------|------------------|--------|
| CRM    | ✅ Sim  | ✅ Sim           | ✅ Sim |
| ERP    | ❌ Não  | ❌ Não           | ❌ Não (somente leitura) |

Para clientes ERP, os botões de ação serão desabilitados com tooltip explicativo:
> "Dados gerenciados pelo ERP"

---

## Fluxo de Exclusão

1. Usuário clica no botão 🗑️
2. Modal de confirmação aparece:
   > "Tem certeza que deseja excluir o cliente **Empresa ABC**?"
   > "Esta ação não pode ser desfeita."
3. Se confirmar → Excluir da tabela `companies`
4. Toast de sucesso: "Cliente excluído com sucesso!"

---

## Arquivos Modificados

1. **Migração SQL** - Adicionar coluna `active` em `companies`
2. **`src/pages/Customers.tsx`** - Adicionar filtro, mutations e botões de ação

---

## Benefícios

- **Consistência** - Mesma experiência da página de Produtos
- **Controle** - Possibilidade de desativar clientes sem perder dados
- **Organização** - Filtrar apenas clientes ativos na lista principal
- **Integridade** - Clientes ERP protegidos contra alterações manuais
