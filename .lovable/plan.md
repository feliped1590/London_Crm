

# Diagnóstico: Inconsistência no Pipeline de Vendas

---

## Causa Raiz Identificada

O problema está na **linha 924 do `Pipeline.tsx`**, no filtro `canAccessBySalesRep()`. Este filtro verifica se a empresa do negócio possui um `sales_rep_id` vinculado ao usuário logado via tabela `user_sales_reps`.

**O problema:** A maioria dos negócios da Fernanda foi criada com empresas que **não possuem `sales_rep_id`** ou possuem um `sales_rep_id` diferente do vendedor comercial vinculado a ela.

---

## Dados Concretos

### Fernanda Cavagnari
- **user_id:** `c3532c95-6f9a-44d6-b491-9c3b0c60fcfc`
- **Papel:** vendedor
- **Vendedor Comercial vinculado:** `da1dae28-9e01-427f-801f-e734ae4b975e` (FERNANDA CAVAGNARI)

### Negócios da Fernanda (owner_id = dela): 17 negócios encontrados

| Negócio | Empresa | `company.sales_rep_id` | Visível? |
|---|---|---|---|
| AMIGÃO SUPERMECADO | AMIGAO SUPERMERCADO | `da1dae28...` (correto) | **SIM** |
| SUPERMECADO TONHÃO | SUPERMERCADO TONHAO | `da1dae28...` (correto) | **SIM** |
| BOI GORDO | FRIGORIFICO BOI GORDO LTDA | `cca10326...` (outro!) | **NÃO** |
| FRIMAPAR | FRIMAPAR IND. E COM. | `94367496...` (outro!) | **NÃO** |
| TICK TITOS | (sem empresa) | `null` | **NÃO** |
| FRIGOPESCA | (sem empresa) | `null` | **NÃO** |
| C Vale | (sem empresa) | `null` | **NÃO** |
| PRATICK PRO | (sem empresa) | `null` | **NÃO** |
| PIF PAF | (sem empresa) | `null` | **NÃO** |
| ... (mais 8) | (sem empresa) | `null` | **NÃO** |

**Resultado:** Dos 17 negócios, apenas 2 aparecem para Fernanda. Os outros 15 são filtrados porque:
1. A empresa não tem `sales_rep_id` (`null`) → `canAccessBySalesRep(null)` retorna `false` para não-admin
2. A empresa tem um `sales_rep_id` diferente do vendedor vinculado à Fernanda

### Sheli Akemi Morita
- **user_id:** `13dcab7c-5e74-4d3b-83ba-d503d31124d3`
- **Vendedor Comercial vinculado:** `c9432087-9a4c-451e-ad91-45384f3fbac0` (SHELI AKEMI MORITA)
- **Empresas:** Todas possuem `sales_rep_id` correto e `owner_id` correto → **dados existem e estão consistentes**
- **Problema de clientes não aparecendo:** Precisa investigar se é na listagem de clientes (página Customers), que pode ter filtro semelhante por `sales_rep_id`.

---

## Análise Técnica

### Fluxo do filtro no Pipeline (linha 920-956):

```text
deals (todos via RLS) 
  → canAccessBySalesRep(company.sales_rep_id)  ← PROBLEMA AQUI
    → se admin: passa
    → se sales_rep_id é null: BLOQUEIA
    → se sales_rep_id não está em mySalesRepIds: BLOQUEIA
  → filterOwner === 'mine' && owner_id !== user.id: filtra
```

### Por que funcionava antes?
Este filtro `canAccessBySalesRep` foi adicionado recentemente como parte da implementação de governança de carteiras. Antes, o pipeline filtrava apenas por `owner_id` (linha 931). Agora há um filtro **adicional** que exige que a empresa tenha `sales_rep_id` vinculado ao usuário — mas muitos negócios foram criados **antes** dessa lógica existir, com empresas sem `sales_rep_id`.

### Por que o Admin vê tudo?
Na função `canAccessBySalesRep`, admins sempre retornam `true` (linha 34 do hook).

---

## Correção Recomendada

### Opção 1 — Ajustar o filtro no frontend (recomendada)
Modificar a lógica na linha 922-924 do `Pipeline.tsx` para que, quando o negócio pertence ao usuário (`owner_id === user.id`), o filtro de `sales_rep_id` seja **ignorado**:

```typescript
// Lógica corrigida:
if (!isAdmin) {
  const companySalesRepId = deal.companies?.sales_rep_id;
  const isMyDeal = deal.owner_id === user?.id || deal.created_by === user?.id;
  if (!isMyDeal && !canAccessBySalesRep(companySalesRepId)) return false;
}
```

Isso garante que o dono do negócio sempre veja seus próprios negócios, independente do `sales_rep_id` da empresa.

### Opção 2 — Corrigir os dados (complementar)
Atualizar o `sales_rep_id` das empresas vinculadas aos negócios da Fernanda para apontar para o vendedor comercial correto (`da1dae28...`). Isso resolveria o problema de dados, mas a Opção 1 é necessária de qualquer forma para evitar que o problema se repita.

### Recomendação
Implementar **ambas**: Opção 1 (ajuste do filtro) + Opção 2 (correção de dados). Isso corrige o bug e também normaliza os dados.

### Para Sheli (clientes não aparecendo)
Se o problema é na página de Clientes, provavelmente há um filtro semelhante usando `canAccessBySalesRep`. Como as empresas dela têm `sales_rep_id` correto, o problema pode estar em outro ponto — seria necessário confirmar em qual página exatamente os clientes não aparecem.

