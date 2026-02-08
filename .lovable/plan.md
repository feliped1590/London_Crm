

# Plano: Corrigir Visibilidade da Aba Fiscal para Perfil Desenvolvedor

## Problema Identificado

A aba "Fiscal" em Configurações (`Settings.tsx`) está implementada **sem controle de acesso**, diferentemente das abas "Intervenções" e "Assistente IA" que usam verificações `isAdmin` e `isDeveloper`.

**Localização do problema:**
- Arquivo: `src/pages/Settings.tsx`
- Linhas 468-471: TabsTrigger sem condição
- Linhas 973-975: TabsContent sem condição

## Análise das RLS Policies

```text
┌────────────────────────────────────────────────────────────────┐
│           TABELAS FISCAIS - POLÍTICAS DE ACESSO                │
├────────────────────────────────────────────────────────────────┤
│ regras_tributacao:                                             │
│   ✓ SELECT: Todos autenticados (para cálculo fiscal)          │
│   ✓ INSERT/UPDATE/DELETE: Apenas has_role(..., 'admin')       │
├────────────────────────────────────────────────────────────────┤
│ beneficios_fiscais:                                            │
│   ✓ SELECT: Todos autenticados                                 │
│   ✓ INSERT/UPDATE/DELETE: Apenas has_role(..., 'admin')       │
└────────────────────────────────────────────────────────────────┘
```

Como a função `has_role` trata `desenvolvedor` como `admin`, seu perfil **deveria ter acesso total**.

## Solução Proposta

Adicionar verificação `isAdmin` tanto no `TabsTrigger` quanto no `TabsContent` da aba Fiscal, seguindo o mesmo padrão das outras abas restritas.

### Modificações no `Settings.tsx`

**1. TabsTrigger (linha 468-471):**
```tsx
// DE:
<TabsTrigger value="fiscal" className="gap-2">
  <Calculator className="h-4 w-4" />
  Fiscal
</TabsTrigger>

// PARA:
{(isAdmin || isDeveloper) && (
  <TabsTrigger value="fiscal" className="gap-2">
    <Calculator className="h-4 w-4" />
    Fiscal
  </TabsTrigger>
)}
```

**2. TabsContent (linhas 973-975):**
```tsx
// DE:
<TabsContent value="fiscal" className="mt-6 space-y-6">
  <FiscalSettingsTab />
</TabsContent>

// PARA:
{(isAdmin || isDeveloper) && (
  <TabsContent value="fiscal" className="mt-6 space-y-6">
    <FiscalSettingsTab />
  </TabsContent>
)}
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Settings.tsx` | Adicionar condição `(isAdmin \|\| isDeveloper)` na aba Fiscal |

## Resultado Esperado

Após a implementação:
- Desenvolvedores e Administradores verão a aba "Fiscal"
- Vendedores e Atendentes não terão acesso ao gerenciamento fiscal
- O acesso permanece consistente com as RLS policies do banco

## Observação Técnica

A verificação `(isAdmin || isDeveloper)` é redundante porque a função `has_role` no banco já trata desenvolvedor como admin. Porém, como a query `isDeveloper` no frontend é feita separadamente (linha 118-130), precisamos incluir ambas as verificações para garantir que a aba apareça corretamente.

