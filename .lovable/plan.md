
# Plano: Mover Negócio para "Fechado Ganho" ao Aprovar Proposta

## Objetivo
Automatizar a movimentação do negócio (deal) para a etapa "Fechado Ganho" quando uma proposta vinculada é aprovada, seja pelo sistema interno ou pelo link de aprovação do cliente.

## Análise Atual

A proposta já possui o campo `deal_id` que vincula ao negócio. Atualmente, ao aprovar:

| Cenário | Onde acontece | Ação atual |
|---------|--------------|------------|
| Aprovação interna | `ProposalDialog.tsx` | Cria pedido automaticamente |
| Aprovação pelo cliente | `proposal-approve/index.ts` | Cria pedido automaticamente |

**Falta:** Atualizar o `deal.stage` para `fechado_ganho` em ambos os cenários.

## Implementação

### 1. Atualizar ProposalDialog.tsx (Aprovação Interna)

Na função `createOrderFromProposal()`, após criar o pedido, adicionar lógica para:
- Verificar se a proposta tem um `deal_id` vinculado
- Atualizar o negócio para `stage = 'fechado_ganho'`
- Registrar no histórico de auditoria (`deal_audit_log`)

```text
┌──────────────────────────────────────────────┐
│ createOrderFromProposal()                    │
├──────────────────────────────────────────────┤
│ 1. Criar pedido (já existe)                  │
│ 2. Copiar itens da proposta (já existe)      │
│ 3. [NOVO] Verificar se tem deal_id           │
│ 4. [NOVO] Atualizar deal.stage → fechado_ganho│
│ 5. Toast: "Negócio movido para Fechado Ganho"│
└──────────────────────────────────────────────┘
```

### 2. Atualizar Edge Function (Aprovação pelo Cliente)

Na função `proposal-approve/index.ts`, após aprovar a proposta e criar o pedido:
- Buscar o `deal_id` da proposta
- Atualizar o negócio para `stage = 'fechado_ganho'`
- Registrar no `deal_audit_log` (sistema como autor)

```text
┌──────────────────────────────────────────────┐
│ proposal-approve/index.ts                    │
├──────────────────────────────────────────────┤
│ 1. Validar token e proposta (já existe)      │
│ 2. Atualizar status → aprovada (já existe)   │
│ 3. Criar pedido (já existe)                  │
│ 4. [NOVO] Se proposal.deal_id existir:       │
│    → UPDATE deals SET stage = 'fechado_ganho'│
│    → INSERT deal_audit_log (etapa alterada)  │
└──────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/proposals/ProposalDialog.tsx` | Adicionar update do deal na função `createOrderFromProposal()` |
| `supabase/functions/proposal-approve/index.ts` | Adicionar update do deal após aprovação |

## Fluxo Final

```text
                    ┌─────────────────┐
                    │ Proposta Criada │
                    │ (deal_id=xyz)   │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────▼────────┐         ┌──────────▼──────────┐
     │ Aprovação Manual│         │ Aprovação via Link  │
     │ (ProposalDialog)│         │ (Edge Function)     │
     └────────┬────────┘         └──────────┬──────────┘
              │                             │
              └──────────────┬──────────────┘
                             │
                    ┌────────▼────────┐
                    │ 1. Status →     │
                    │    'aprovada'   │
                    │ 2. Criar Pedido │
                    │ 3. Deal → Ganho │
                    └─────────────────┘
```

## Benefícios

1. **Automação completa**: O vendedor não precisa mover manualmente o negócio
2. **Consistência**: Funciona em ambos os cenários de aprovação
3. **Auditoria**: Registrado no histórico do negócio quem/quando moveu
4. **Menos erros**: Elimina esquecimento de atualizar o pipeline
