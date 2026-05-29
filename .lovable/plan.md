
## 1. Diagnóstico — Produtividade de BEATRIZ LEMES ALVES (comercial3@embazec.com.br)

Período: **01/05/2026 → 29/05/2026** (Este mês), tenant da Qualyvac.

| Métrica | Valor no período |
|---|---|
| Atividades criadas | **0** |
| Tarefas criadas | **0** |
| Tarefas concluídas | **0** |
| Mudanças de etapa | **0** |
| Propostas criadas | **0** |
| Pedidos criados (created_by) | **0** |
| Pedidos como sales_rep | **0** |
| Notas em deals | **0** |
| E-mails enviados | **0** |
| Updates em deals (audit) | **0** |
| **Score** | **0** |

Contexto:
- Usuário existe e tem **23 empresas** atribuídas como `sales_rep`.
- **Último login: 09/03/2026** (≈ 80 dias atrás).
- Última atividade/tarefa registrada: nenhuma.

**Conclusão:** O sistema está correto em não exibir Beatriz no ranking — ela não teve nenhuma interação registrada em maio. O motivo é operacional (usuária não está usando o CRM), não um bug.

---

## 2. Como o ranking é calculado hoje (validação da metodologia)

RPC `get_seller_productivity` agrupa interações por **`created_by` (user_id)**, não por `sales_rep_id`. Fontes:

```
activities.created_by · tasks.created_by · tasks.assigned_to (concluídas)
deal_stage_history.changed_by · proposals.created_by · orders.created_by
entity_notes.created_by · email_logs.sent_by · deal_audit_log.changed_by (distinct deal/dia)
```

Score = Σ (contagem × peso de `crm_activity_weights`).
Pesos default: activities 1, tasks_created 1, tasks_completed 2, stage_changes 3, proposals 4, orders 6, notes 1, emails 1, deal_updates 1.

**Observações importantes:**
- O label "Vendedor" no relatório é enganoso: hoje **já é por usuário** (created_by). O filtro `selectedSellerId` na verdade recebe um `user_id`.
- Pedidos/propostas/empresas atribuídos a um sales_rep mas **criados por outra pessoa** (ex.: admin lançando pelo vendedor) não contam para o vendedor — só para quem criou.
- Mudanças de etapa via automação (sem `changed_by`) ficam fora — comportamento correto.

---

## 3. O que vou implementar

### 3.1. Toggle "Por Vendedor" × "Por Usuário" no Relatório de Produtividade
Acima do ranking, adicionar um seletor:

- **Por Usuário (atual)** — quem efetivamente operou o sistema (created_by). Útil para gestão de uso/adoção.
- **Por Vendedor (sales_rep)** — quem é o dono comercial do registro (sales_rep_id em orders/proposals/deals/companies). Útil para performance comercial real, mesmo quando o lançamento é feito por outra pessoa (admin, back-office).

Para isso, criar nova RPC `get_sales_rep_productivity(p_start, p_end, p_sales_rep_id?, p_manager_user_id?)` espelhando a estrutura atual mas usando `sales_rep_id` nos eventos onde existe (orders, proposals, deals, stage_changes via deals.sales_rep_id, notes/activities via company.sales_rep_id). Tarefas e e-mails permanecem por usuário (não têm sales_rep), com nota explicando.

O hook `useSellerProductivity` ganha um parâmetro `mode: 'user' | 'sales_rep'` e chama a RPC correspondente.

### 3.2. Renomear/clarear labels na UI
- Card e filtros: "Vendedor" → "Vendedor (sales_rep)" ou "Usuário (quem operou)" conforme o modo.
- Tooltip explicando a diferença.

### 3.3. Mostrar vendedores/usuários com score zero (opcional)
Hoje quem tem 0 interação simplesmente some do ranking. Adicionar toggle "Mostrar inativos" que faz LEFT JOIN com `sales_reps` ativos (ou profiles ativos) e lista quem ficou zerado — útil para enxergar casos como o da Beatriz sem precisar abrir auditoria.

---

## 4. Fora do escopo
- Não alteramos pesos nem fórmula do score.
- Não mexemos no cálculo de "Vendedor mais produtivo" (continua usando o modo selecionado).
- WhatsApp segue desativado (já tratado).

---

## Detalhes técnicos
- Nova migration: `CREATE FUNCTION public.get_sales_rep_productivity(...)` com mesma estrutura (SECURITY DEFINER, restrita a admin/dev, multi-tenant via `get_user_tenant_ids`).
- Fontes por modo `sales_rep`:
  - orders/proposals: filtra por `sales_rep_id`
  - deals/stage_changes/notes/activities/deal_audit: join com `deals`/`companies` e usa o `sales_rep_id` da entidade
  - tasks/emails: continuam por usuário (sem sales_rep) — score parcial nesse modo
- Hook `useSellerProductivity` recebe `mode`, faz roteamento da RPC, cache key separado por modo.
- Componente `SellerProductivityReport.tsx`: novo `<Tabs>`/`<ToggleGroup>` no topo + atualização dos labels.

Posso seguir?
