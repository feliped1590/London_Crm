

## Diagnóstico do desalinhamento

**No banco** o enum `app_role` tem 8 valores: `admin, vendedor, atendente, desenvolvedor, financeiro, faturamento, logistica, qualidade`.

**Onde os 4 perfis novos JÁ aparecem:**
- Modal "Editar Etapa" → checkboxes de `allowed_roles` (Vendedor, Atendente, Financeiro, Faturamento, Logística, Qualidade) ✅
- `UnifiedPipelineManager.tsx` → constante `ROLE_OPTIONS` com 7 perfis ✅

**Onde NÃO aparecem (desalinhamento):**
1. **Modal "Criar Novo Usuário"** (`Settings.tsx`) → só tem Atendente, Vendedor, Administrador
2. **Modal "Editar Usuário"** (`Settings.tsx` → `EditUserForm`) → mesmo problema
3. **Tela "Permissões por Módulo"** (`PermissionsManager.tsx`) → só renderiza cards para `vendedor` e `atendente`
4. **Type `AppRole`** está duplicado e desatualizado em `Settings.tsx` (linha 51) e `PermissionsManager.tsx` (linha 14) como `'admin' | 'vendedor' | 'atendente'`
5. **`create-user` edge function** assume default `vendedor` mas não valida lista expandida

**Consequência prática:** É impossível criar um usuário "Financeiro", "Faturamento", "Logística" ou "Qualidade" pela UI, então os checkboxes de etapa para esses perfis ficam inúteis. E para os perfis que existem, não há configuração de acesso a módulos definida.

---

## Plano de implementação

### 1. Centralizar definição de roles
Criar **`src/lib/roles.ts`** como fonte única de verdade:
```typescript
export type AppRole = 'admin' | 'vendedor' | 'atendente' | 'desenvolvedor' 
                    | 'financeiro' | 'faturamento' | 'logistica' | 'qualidade';

export const ROLE_DEFINITIONS: { value: AppRole; label: string; icon: string; description: string; assignable: boolean }[] = [
  { value: 'admin',        label: 'Administrador', ...,  assignable: true  },
  { value: 'vendedor',     label: 'Vendedor', ...,       assignable: true  },
  { value: 'atendente',    label: 'Atendente', ...,      assignable: true  },
  { value: 'financeiro',   label: 'Financeiro', ...,     assignable: true  },
  { value: 'faturamento',  label: 'Faturamento', ...,    assignable: true  },
  { value: 'logistica',    label: 'Logística', ...,      assignable: true  },
  { value: 'qualidade',    label: 'Qualidade', ...,      assignable: true  },
  { value: 'desenvolvedor',label: 'Desenvolvedor', ...,  assignable: false }, // gerenciado só via DB
];
```

### 2. Atualizar modais de Usuário (`src/pages/Settings.tsx`)
- Remover o `type AppRole` local; importar de `@/lib/roles`
- Substituir `<SelectItem>` hardcoded por `.map(ROLE_DEFINITIONS.filter(r => r.assignable))` nos modais **Criar Novo Usuário** e **Editar Usuário**
- Aplicar a mesma lista no `roleLabels` para exibição na tabela de usuários

### 3. Atualizar `PermissionsManager.tsx`
- Importar `AppRole` e `ROLE_DEFINITIONS` do `@/lib/roles`
- Substituir `editableRoles: AppRole[] = ['vendedor', 'atendente']` por lista derivada de `ROLE_DEFINITIONS` (excluindo `admin` e `desenvolvedor`)
- Renderizar um card por perfil → grid responsivo `lg:grid-cols-2 xl:grid-cols-3`
- Garantir que `roleConfig` cubra os 6 perfis editáveis (com ícones apropriados: `DollarSign` para Financeiro, `FileText` para Faturamento, `Truck` para Logística, `CheckCircle` para Qualidade)

### 4. Backfill de permissões padrão (migração SQL)
Inserir registros default em `role_module_permissions` para os 4 perfis novos (Financeiro, Faturamento, Logística, Qualidade) com sugestão sensata:
- **Financeiro**: Total em Pedidos/Propostas, Restrito em Pipeline/Empresas, Sem acesso em WhatsApp
- **Faturamento**: Total em Pedidos, Restrito em Empresas/Pipeline
- **Logística**: Total em Pedidos, Restrito em Pipeline
- **Qualidade**: Restrito em Pedidos/Pipeline

(Com `ON CONFLICT DO NOTHING` para não sobrescrever ajustes manuais)

### 5. Atualizar `ProtectedRoute` / `useModulePermissions`
Verificar se o hook já lê dinamicamente da tabela `role_module_permissions` para qualquer role (provavelmente sim, mas confirmar para que perfis novos funcionem out-of-the-box).

### 6. Edge Function `create-user`
- Adicionar validação `if (!ROLE_VALUES.includes(role)) return 400`
- Manter default `vendedor`

---

## Arquivos a editar
- ➕ `src/lib/roles.ts` (novo)
- ✏️ `src/pages/Settings.tsx` (modais criar/editar usuário + tipo AppRole)
- ✏️ `src/components/settings/PermissionsManager.tsx` (cards por perfil)
- ✏️ `supabase/functions/create-user/index.ts` (validação)
- ➕ Migração SQL: backfill `role_module_permissions` para 4 perfis novos

## Resultado esperado
- Admin pode criar usuário **Financeiro/Faturamento/Logística/Qualidade** via UI
- Tela "Permissões por Módulo" mostra cards para os **6 perfis editáveis**
- Os checkboxes de `allowed_roles` por etapa do pipeline passam a ter usuários reais correspondentes
- Arquitetura RBAC totalmente alinhada entre criação de usuário, permissões de módulo e permissões de etapa

