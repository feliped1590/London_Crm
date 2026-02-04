

# Plano: Governanca de Carteira de Clientes (Regra de Acesso por Responsavel)

## Analise do Estado Atual

### O que ja existe:
1. **Triggers de Bloqueio para Nao-Admin:**
   - `check_deal_owner_consistency` - bloqueia criacao/edicao de deals em clientes de outros vendedores
   - `check_company_edit_permission` - bloqueia edicao de empresas de outros vendedores
   - `check_owner_change` - impede que nao-admins alterem o `owner_id`

2. **Tabela de Violacoes:**
   - `access_violation_log` - registra tentativas bloqueadas (para auditoria de seguranca)

3. **Estrutura de Carteira:**
   - `owner_id` em `companies`, `contacts`, `deals` e `crm_clients`
   - Hook `usePortfolio` para gestao de transferencias

### O que falta implementar:
1. **Governanca para Administradores** - admins passam livremente, mas precisam justificar acoes em clientes de outros
2. **Log de Intervencoes Administrativas** - nova tabela para rastrear acoes autorizadas (diferente de violacoes bloqueadas)
3. **Modal de Justificativa no Frontend** - solicitar motivo antes de prosseguir
4. **Tela de Consulta de Intervencoes** - historico visivel para admins
5. **Governanca em Tarefas e Pedidos** - aplicar mesma logica para tasks e orders

---

## Arquitetura da Solucao

```text
+-------------------------------+
|      Usuario tenta acao       |
|  (criar deal, task, order)    |
+---------------+---------------+
                |
                v
+---------------+---------------+
|   Cliente tem owner_id?       |
+---------------+---------------+
        |               |
       Sim             Nao
        |               |
        v               v
+-------+-------+   +---+---+
| owner == eu?  |   | Acao  |
+-------+-------+   | livre |
    |       |       +-------+
   Sim     Nao
    |       |
    v       v
+---+---+   +----------------+
| Acao  |   | Sou Admin?     |
| livre |   +-------+--------+
+-------+       |        |
               Sim      Nao
                |        |
                v        v
        +-------+----+  +-------+
        | Modal de   |  | ERRO  |
        | Justifica- |  | Bloqueia
        | tiva       |  +-------+
        +------+-----+
               |
               v
        +------+------+
        | Registra em |
        | admin_      |
        | intervention|
        | _log        |
        +------+------+
               |
               v
        +------+------+
        | Executa a   |
        | acao        |
        +-------------+
```

---

## Parte 1: Banco de Dados

### 1.1 Nova Tabela: `admin_intervention_log`

Diferente de `access_violation_log` (que registra tentativas bloqueadas), esta tabela registra acoes **autorizadas** feitas por admins em clientes de outros vendedores.

```sql
CREATE TABLE public.admin_intervention_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    action_type TEXT NOT NULL, 
    -- 'CREATE_DEAL', 'UPDATE_DEAL', 'MOVE_STAGE', 'CREATE_TASK', 
    -- 'CREATE_ORDER', 'UPDATE_ORDER'
    entity_type TEXT NOT NULL, -- 'deal', 'task', 'order'
    entity_id UUID NOT NULL,
    entity_name TEXT,
    client_id UUID, -- empresa afetada
    client_name TEXT,
    client_owner_id UUID, -- dono original do cliente
    client_owner_name TEXT,
    justification TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_admin_intervention_log_admin 
    ON admin_intervention_log(admin_user_id);
CREATE INDEX idx_admin_intervention_log_created 
    ON admin_intervention_log(created_at DESC);
CREATE INDEX idx_admin_intervention_log_client 
    ON admin_intervention_log(client_id);

-- RLS: apenas admins podem ver
ALTER TABLE admin_intervention_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all interventions"
    ON admin_intervention_log FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert interventions"
    ON admin_intervention_log FOR INSERT
    WITH CHECK (true);
```

### 1.2 Extender Governanca para Tasks e Orders

Novos triggers para bloquear nao-admins:

```sql
-- Trigger para tasks vinculadas a clientes de outros
CREATE OR REPLACE FUNCTION check_task_owner_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_company_owner_id UUID;
    v_company_owner_name TEXT;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        IF NEW.company_id IS NOT NULL THEN
            SELECT c.owner_id, p.full_name
            INTO v_company_owner_id, v_company_owner_name
            FROM companies c
            LEFT JOIN profiles p ON p.user_id = c.owner_id
            WHERE c.id = NEW.company_id;
            
            IF v_company_owner_id IS NOT NULL 
               AND v_company_owner_id != auth.uid() THEN
                INSERT INTO access_violation_log (...)
                RAISE EXCEPTION 'Este cliente pertence ao vendedor %.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Similar para orders
CREATE OR REPLACE FUNCTION check_order_owner_consistency()
-- (mesma logica)
```

---

## Parte 2: Frontend

### 2.1 Componente: AdminInterventionModal

Novo componente reutilizavel similar ao `SLAJustificationModal`:

**Arquivo:** `src/components/governance/AdminInterventionModal.tsx`

```tsx
interface AdminInterventionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientOwnerName: string;
  actionDescription: string;
  onConfirm: (justification: string) => void;
  isLoading?: boolean;
}

// Modal com:
// - Icone de alerta
// - Mensagem: "Voce esta prestes a [actionDescription] 
//   para o cliente [clientName], que pertence a [clientOwnerName]"
// - Campo de texto obrigatorio para justificativa
// - Aviso de que sera registrado
// - Botoes Cancelar / Confirmar
```

### 2.2 Hook: usePortfolioGovernance

Novo hook centralizado para verificar e registrar intervencoes:

**Arquivo:** `src/hooks/usePortfolioGovernance.ts`

```typescript
export function usePortfolioGovernance() {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  
  // Verifica se cliente pertence ao usuario atual
  const checkClientOwnership = async (
    clientId: string,
    clientSource: 'crm' | 'erp'
  ) => {
    // Retorna: { isOwner, ownerId, ownerName }
  };
  
  // Registra intervencao administrativa
  const logIntervention = async (data: {
    actionType: string;
    entityType: string;
    entityId: string;
    entityName: string;
    clientId: string;
    clientName: string;
    clientOwnerId: string;
    clientOwnerName: string;
    justification: string;
    details?: Record<string, any>;
  }) => {
    await supabase.from('admin_intervention_log').insert({...});
  };
  
  return { 
    isAdmin, 
    checkClientOwnership, 
    logIntervention 
  };
}
```

### 2.3 Integracao no Pipeline.tsx

Modificar criacao/edicao de deals:

```typescript
// Antes de criar deal
const handleSubmit = async (e) => {
  e.preventDefault();
  
  const companyId = formData.company_id;
  if (companyId && isAdmin) {
    const company = companies?.find(c => c.id === companyId);
    if (company?.owner_id && company.owner_id !== user?.id) {
      // Mostrar modal de justificativa
      setPendingAction({ type: 'CREATE_DEAL', data: formData });
      setInterventionTarget({
        clientName: company.name,
        ownerName: getOwnerName(company.owner_id),
        ownerId: company.owner_id
      });
      setShowInterventionModal(true);
      return;
    }
  }
  
  // Prosseguir normalmente
  createMutation.mutate(formData);
};

// Apos confirmar justificativa
const handleInterventionConfirm = async (justification: string) => {
  await logIntervention({
    actionType: 'CREATE_DEAL',
    entityType: 'deal',
    ...
    justification
  });
  
  createMutation.mutate(pendingAction.data);
};
```

### 2.4 Integracao no Tasks.tsx

Mesma logica ao criar tarefas vinculadas a empresas:

```typescript
const handleSubmit = async (e) => {
  if (formData.company_id && isAdmin) {
    const ownership = await checkClientOwnership(formData.company_id);
    if (!ownership.isOwner) {
      // Mostrar modal para admin
      // OU bloquear para nao-admin (trigger cuida disso)
    }
  }
  createMutation.mutate(...);
};
```

### 2.5 Integracao no OrderDialog.tsx

Mesma logica ao criar/editar pedidos.

### 2.6 Tela de Consulta de Intervencoes

**Arquivo:** `src/components/settings/AdminInterventionsViewer.tsx`

Nova aba em Configuracoes para admins visualizarem o historico:

```tsx
// Tabela com colunas:
// - Data/Hora
// - Administrador
// - Acao Realizada
// - Cliente Afetado
// - Responsavel Original
// - Justificativa
// - Detalhes (expandivel)

// Filtros:
// - Por periodo
// - Por administrador
// - Por tipo de acao
// - Por cliente
```

---

## Parte 3: Fluxos Completos

### 3.1 Vendedor tenta criar deal para cliente de outro

1. Vendedor seleciona empresa no formulario
2. Ao submeter, trigger `check_deal_owner_consistency` executa
3. Trigger detecta que `owner_id != auth.uid()`
4. Trigger registra em `access_violation_log`
5. Trigger levanta excecao com mensagem clara
6. Frontend exibe toast de erro
7. Operacao cancelada

### 3.2 Admin cria deal para cliente de outro vendedor

1. Admin seleciona empresa no formulario
2. Frontend detecta que empresa tem `owner_id` diferente
3. Frontend exibe `AdminInterventionModal`
4. Admin preenche justificativa e confirma
5. Frontend registra em `admin_intervention_log`
6. Frontend executa `createMutation`
7. Trigger permite (isAdmin = true)
8. Deal criado com sucesso

### 3.3 Movimentacao de etapa no pipeline

Mesmo fluxo - se deal pertence a cliente de outro vendedor:
- Nao-admin: bloqueado pelo trigger
- Admin: modal de justificativa antes de prosseguir

---

## Resumo de Alteracoes

| Componente | Tipo | Descricao |
|------------|------|-----------|
| `admin_intervention_log` | Banco | Nova tabela de auditoria para acoes autorizadas |
| `check_task_owner_consistency` | Banco | Trigger para governanca em tarefas |
| `check_order_owner_consistency` | Banco | Trigger para governanca em pedidos |
| `AdminInterventionModal.tsx` | Frontend | Modal de justificativa reutilizavel |
| `usePortfolioGovernance.ts` | Frontend | Hook centralizado de verificacao |
| `Pipeline.tsx` | Frontend | Integracao com modal em criar/editar deals |
| `Tasks.tsx` | Frontend | Integracao com modal em criar tarefas |
| `OrderDialog.tsx` | Frontend | Integracao com modal em criar/editar pedidos |
| `AdminInterventionsViewer.tsx` | Frontend | Tela de consulta de historico |
| `Settings.tsx` | Frontend | Nova aba "Intervencoes Administrativas" |

---

## Consideracoes de Seguranca

1. **Triggers no banco garantem bloqueio** - mesmo se frontend for manipulado, o banco bloqueia
2. **Justificativa obrigatoria e imutavel** - log nao pode ser alterado ou deletado
3. **Visibilidade apenas para admins** - RLS protege os logs
4. **Auditoria completa** - toda acao fora de carteira e rastreavel

---

## Proximos Passos

1. Aprovar este plano
2. Criar migracao de banco com nova tabela e triggers
3. Criar componentes de frontend
4. Integrar nos fluxos existentes
5. Testar cenarios de bloqueio e autorizacao

