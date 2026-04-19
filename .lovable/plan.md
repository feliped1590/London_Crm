

## Diagnóstico

**Problema atual** (`src/pages/Customers.tsx`, linha 702):
```tsx
{(isAdmin || isDeveloper) && (
  <CompanySyncButton companyId={customer.id} erpCode={(customer as any).erp_code} />
)}
```

O botão de envio ao ERP (ícone de avião + ícone de chave inglesa quando há pendências) só aparece para **Admin** e **Desenvolvedor**. Vendedores não conseguem:
1. Enviar clientes ao ERP
2. Ver o que está bloqueando o envio (quando o status é `Dados incompletos`)

Isso quebra o fluxo comercial — quem cadastra/edita o cliente é o vendedor, então faz sentido que ele consiga acionar o envio e corrigir as pendências.

**Observação importante**: o `useModulePermissions` hoje só expõe `isAdmin` e `isDeveloper`. Não há flag `isVendedor` exposto, mas dá para usar o RPC `has_role` que já existe no banco.

---

## Plano de implementação

### 1. Expor `isVendedor` no hook `useModulePermissions.ts`
- Adicionar nova `useQuery` chamando `supabase.rpc('has_role', { _role: 'vendedor' })`
- Retornar `isVendedor: hasRoleVendedor || false` no objeto de retorno
- Incluir no `isFullyLoaded` para evitar flash de UI

### 2. Liberar o botão de envio em `src/pages/Customers.tsx`
Trocar a condição na linha 702:
```tsx
// Antes
{(isAdmin || isDeveloper) && (<CompanySyncButton ... />)}

// Depois
{(isAdmin || isDeveloper || isVendedor) && (<CompanySyncButton ... />)}
```

O componente `CompanySyncButton` já cuida de tudo:
- Se status = `blocked_validation` → mostra ícone "Corrigir dados" (chave inglesa) e abre o `SyncValidationModal` com a lista detalhada de erros e botões "Corrigir" que navegam para a tela apropriada
- Caso contrário → executa `validate-company-sync` e, se houver pendências, mostra o mesmo modal antes de tentar enviar

### 3. Verificação na tela de detalhe do cliente (se aplicável)
Conferir se há outros pontos de entrada do `CompanySyncButton` (ex: `CustomerDetail.tsx`) com a mesma restrição e aplicar a mesma liberação para vendedores.

### 4. Segurança no backend (já protegido)
As edge functions `validate-company-sync` e `process-company-sync` rodam com service role, mas o trigger é via UI autenticada. Como o vendedor já tem acesso ao registro da empresa via RLS, liberar o botão no front é seguro — não cria novo vetor de privilégio (ele só dispara sync de empresas que ele já consegue ver/editar).

---

## Arquivos a editar

- ✏️ `src/hooks/useModulePermissions.ts` — expor `isVendedor`
- ✏️ `src/pages/Customers.tsx` — incluir `isVendedor` na condição de exibição do botão
- ✏️ `src/pages/CustomerDetail.tsx` — verificar e ajustar se houver botão de sync lá também

## Resultado esperado

- Vendedor vê o botão de avião (Enviar ao ERP) e o botão de chave inglesa (Corrigir dados) na coluna ERP da lista de clientes
- Ao clicar com pendências, abre o `SyncValidationModal` listando exatamente quais campos estão faltando (CNPJ, endereço, vendedor mapeado, usuário ERP, etc.) com botões "Corrigir" para navegar até a correção
- Admin e Desenvolvedor continuam funcionando normalmente
- Demais perfis (Atendente, Financeiro, Faturamento, Logística, Qualidade) seguem **sem** o botão, mantendo a separação de responsabilidades

