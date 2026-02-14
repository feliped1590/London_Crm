
# Correcao: Coluna "Ult. Atendimento" mostrando "Nunca" na pagina de Remanejamento

## Problema Identificado

A view `unified_company_for_reallocation` (usada pela pagina de Remanejamento) calcula o `last_interaction_at` de forma **muito limitada** comparada a view `company_activity_summary` (usada pela pagina de Clientes).

| Fonte de dados | `company_activity_summary` | `unified_company_for_reallocation` |
|---|---|---|
| activities | Sim | Sim |
| tasks (concluidas) | Sim | **Nao** |
| email_logs (enviados) | Sim | **Nao** |
| whatsapp_messages (outbound) | Sim | **Nao** |
| Fallback para created_at | Sim | **Nao** |

Como resultado, empresas que tem interacoes registradas em tasks, emails ou WhatsApp (ou simplesmente foram criadas recentemente) aparecem como "Nunca" no Remanejamento.

## Solucao

Atualizar a CTE `crm_data` dentro da view `unified_company_for_reallocation` para usar a mesma logica abrangente da view `company_activity_summary`:

```sql
COALESCE(
  GREATEST(
    (SELECT max(a.created_at) FROM activities a WHERE a.company_id = c.id),
    (SELECT max(t.completed_at) FROM tasks t WHERE t.company_id = c.id AND t.status = 'concluida'),
    (SELECT max(el.sent_at) FROM email_logs el JOIN contacts ct ON el.contact_id = ct.id WHERE ct.company_id = c.id AND el.sent_at IS NOT NULL),
    (SELECT max(wm.created_at) FROM whatsapp_messages wm WHERE wm.company_id = c.id AND wm.direction = 'outbound')
  ),
  c.created_at
) AS last_interaction_at
```

## Escopo da mudanca

| O que muda | Detalhes |
|---|---|
| View `unified_company_for_reallocation` | Substituir subconsulta simples de `activities` pela logica completa com fallback |
| Arquivos de codigo | Nenhum - a correcao e 100% no banco de dados |

## Resultado Esperado

- A coluna "Ult. Atendimento" passara a refletir a data mais recente entre atividades, tarefas concluidas, emails enviados e mensagens WhatsApp
- Empresas sem nenhuma dessas interacoes mostrarao a data de criacao como fallback em vez de "Nunca"
- A logica fica consistente com a pagina de Clientes
