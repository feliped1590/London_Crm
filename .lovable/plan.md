
# Fase 4H -- Acesso Desenvolvedor Total + Cadastro de CNPJs

## Resumo

Duas correcoees: (1) garantir que o perfil "desenvolvedor" tenha acesso completo a todas as funcionalidades que usam `isAdmin`, e (2) criar a interface de cadastro de entidades juridicas (CNPJs) na aba CNPJs das Configuracoes.

---

## Problema 1: Acesso do Desenvolvedor

Atualmente, muitos componentes usam `isAdmin` do hook `useModulePermissions` para liberar funcionalidades administrativas (editar pedidos fora do status pendente, aprovar pedidos, gerenciar usuarios, atribuir vendedores, etc). Porem, `isAdmin` verifica apenas a role `admin`, excluindo o `desenvolvedor`.

### Solucao

Alterar o hook `useModulePermissions.ts` para que `isAdmin` retorne `true` tambem quando o usuario tiver a role `desenvolvedor`. Isso resolve **todos** os pontos de verificacao de uma so vez, sem precisar alterar cada componente individualmente.

**Arquivo**: `src/hooks/useModulePermissions.ts`

Adicionar uma segunda query para verificar a role `desenvolvedor` e combinar o resultado:

```
isAdmin = hasRoleAdmin || hasRoleDeveloper
```

### Componentes beneficiados automaticamente (sem alteracao)

| Componente | Funcionalidade liberada |
|---|---|
| Orders.tsx | Editar pedidos em qualquer status |
| OrderDialog.tsx | Edicao completa de pedidos |
| useOrderApproval.ts | Aprovar e cancelar pedidos |
| Settings.tsx | Criar/editar/excluir usuarios |
| CustomerDetail.tsx | Atribuir vendedor, ver audit trail |
| ProposalDialog.tsx | Editar precos fora da tabela |
| PricingTableBadge.tsx | Vincular tabelas de precos |
| TaskCalendar.tsx | Filtro por vendedor |
| WhatsApp.tsx | Seletor de usuarios |
| Pipeline.tsx | Visao global de negocios |
| ProtectedRoute.tsx | Acesso total a rotas |
| E outros... | Todas as verificacoes `isAdmin` |

---

## Problema 2: Cadastro de CNPJs

A aba "CNPJs" em Configuracoes permite apenas vincular usuarios a CNPJs existentes, mas nao existe interface para **cadastrar, editar ou desativar** as entidades juridicas (tabela `legal_entities`).

### Solucao

Adicionar um segundo Card na aba CNPJs com o CRUD de entidades juridicas:

**Arquivo**: `src/components/settings/LegalEntityPermissionsManager.tsx`

Funcionalidades do novo bloco:
- Listar todas as entidades juridicas do tenant (nome, CNPJ formatado, codigo ERP, status)
- Botao "Nova Empresa" que abre modal com campos: Nome, CNPJ, Codigo ERP (opcional)
- Edicao inline ou via modal dos dados de cada entidade
- Botao para desativar (soft delete via `active = false`) com confirmacao
- Validacao de CNPJ duplicado antes de salvar

Campos do formulario:
- **Nome** (obrigatorio): razao social ou nome fantasia
- **CNPJ** (obrigatorio): com mascara e validacao de formato
- **Codigo ERP** (opcional): campo `erp_company_code` para integracao

---

## Secao Tecnica

### Arquivos a modificar

1. **`src/hooks/useModulePermissions.ts`**
   - Adicionar query `is_developer` usando `has_role` com `_role: 'desenvolvedor'`
   - Alterar retorno de `isAdmin` para `(isAdmin || isDeveloper)`
   - Atualizar `canAccess`, `getAccessType`, `hasFullAccess` para considerar ambos

2. **`src/components/settings/LegalEntityPermissionsManager.tsx`**
   - Adicionar Card "Entidades Juridicas" com tabela listando `legal_entities`
   - Adicionar Dialog para criar nova entidade (INSERT em `legal_entities`)
   - Adicionar Dialog para editar entidade existente (UPDATE em `legal_entities`)
   - Adicionar AlertDialog para desativar entidade (UPDATE `active = false`)
   - Usar `formatCNPJ` ja existente para exibicao
   - Adicionar mascara de CNPJ no campo de input

### Nenhuma alteracao no banco
A tabela `legal_entities` ja possui as colunas necessarias (name, cnpj, active, erp_company_code, tenant_id) e RLS configurado.

### Riscos e Mitigacoes

| Risco | Mitigacao |
|---|---|
| Alterar isAdmin globalmente pode afetar logica de negocios | Desenvolvedor ja tem acesso >= admin por design; a funcao `has_role` no banco ja trata isso |
| Desativar CNPJ com pedidos vinculados | Soft delete (active=false) preserva historico; seletor filtra apenas ativos |
| CNPJ duplicado | Validacao frontend + UNIQUE INDEX no banco (tenant_id, cnpj) |
