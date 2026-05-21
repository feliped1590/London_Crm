## Reclassificação automática de clientes por atividade

### Regras de negócio
- **Cliente Ativo** → última interação ≤ 6 meses
- **Cliente Inativo** → última interação entre 6 e 12 meses
- **Cliente Perdido** → última interação > 12 meses
- **Leads e Prospects** → entram no recálculo normalmente. Como muitos ainda não têm interações registradas, no **kickoff** vamos assumir `last_interaction_at = hoje` para qualquer empresa sem nenhum sinal — assim ninguém começa como "Perdido" injustamente. A partir daí o relógio passa a correr de verdade conforme novas interações forem (ou não) acontecendo.
- O estágio `lead` / `prospect` em si **não muda** automaticamente — só o eixo Ativo/Inativo/Perdido é recalculado. A promoção Lead→Prospect→Cliente continua manual / via primeira venda.

> Observação: Ativo/Inativo/Perdido vira um **atributo independente** do estágio comercial (lead, prospect, cliente). Toda empresa passa a ter os dois: o estágio comercial e o status de atividade.

### Fonte de dados (unificada)
Vamos usar e estender a view `company_activity_summary`, que já consolida o "último contato". Hoje ela considera:
- `activities` (timeline)
- `tasks` concluídas
- `email_logs` enviados
- `whatsapp_messages` outbound
- `deals` (criação)
- `orders` (criação)

Vamos **adicionar** ao cálculo de `last_interaction_at`:
- `entity_notes` (observações em empresa/contato/negócio)
- `proposals` (`created_at` e `updated_at`)
- `deal_stage_history` (mudança de etapa do funil)
- `tasks.created_at` (não só conclusão — agendar tarefa já é interação)
- `orders.updated_at`

Isso vira a fonte única de verdade para "última interação" em todo o sistema (badges, filtros, dashboard, transferência de carteira por 60 dias).

### Como será aplicado
1. **Função SQL** `recompute_company_lifecycle(p_company_id uuid DEFAULT NULL)`:
   - Percorre todas as empresas (ou uma específica)
   - Lê `last_interaction_at` da view; se NULL, aplica fallback: `COALESCE(companies.updated_at, companies.created_at, now())`
   - Classifica em Ativo / Inativo / Perdido pelas faixas 6m / 12m
   - Atualiza apenas se mudou, com `origem_alteracao = 'SYSTEM_LIFECYCLE'`
2. **Backfill de kickoff** (rodado uma vez no deploy):
   - Para toda empresa **sem nenhuma interação registrada**, grava `lifecycle_baseline_at = now()` numa coluna nova
   - A view passa a usar `GREATEST(last_interaction_real, lifecycle_baseline_at)` — assim leads/prospects sem histórico começam como Ativo e só envelhecem dali em diante
3. **Job diário** via `pg_cron` (03:00 BRT) executando `recompute_company_lifecycle(NULL)`
4. **Promoção imediata**: trigger `AFTER INSERT` em `orders`, `activities`, `entity_notes` chama `recompute_company_lifecycle(NEW.company_id)` para promover de volta para Ativo sem esperar o cron
5. **Auditoria**: cada mudança automática registrada em `company_audit_log` com `action = 'lifecycle_auto_reclassify'`, valor antigo, novo e data da última interação considerada
6. **Botão manual** "Reclassificar agora" em Configurações para forçar recálculo geral

### Impacto na UI (sem mudar layout)
- `/customers` e `LifecyclePanel` do dashboard refletem os novos contadores automaticamente
- Tooltip nos badges Inativo/Perdido: "Última interação: <data> (<X meses atrás>)"

### Detalhes técnicos
- Nova coluna `companies.lifecycle_baseline_at timestamptz` (preenchida no kickoff para registros sem interação)
- Nova coluna `companies.lifecycle_updated_at timestamptz` (auditoria)
- View `company_activity_summary` recriada incluindo `entity_notes`, `proposals`, `deal_stage_history`, `tasks.created_at`, `orders.updated_at`, e usando `GREATEST(..., lifecycle_baseline_at)` como piso
- Função:
  ```text
  recompute_company_lifecycle(p_company_id uuid DEFAULT NULL)
    → JOIN company_activity_summary
    → CASE months_between(now, last) < 6  → active
            < 12 → inactive
            ELSE → lost
    → UPDATE companies SET lifecycle_stage_atividade = ...,
                           lifecycle_updated_at = now(),
                           origem_alteracao = 'SYSTEM_LIFECYCLE'
    → INSERT company_audit_log
  ```
- Cron agendado via `supabase--insert` (não migration) com `pg_cron` + `pg_net`
- Backfill único após deploy: roda a função para todas as empresas e gera relatório (quantas Ativo→Inativo, etc.)

### Pontos a confirmar antes de implementar
1. **Eixos separados ou substituição?** Hoje `lifecycle_stage` mistura `lead/prospect/customer_active/inactive/lost`. Posso:
   - (a) Manter como está e sobrescrever — quando vira Inativo deixa de ser "lead"
   - (b) Recomendado: criar coluna nova `activity_status` (ativo/inativo/perdido) separada de `lifecycle_stage` (lead/prospect/cliente), assim você enxerga "Lead Ativo", "Cliente Inativo", etc.
2. **Mudar o gatilho dos 60 dias de transferência de carteira** para usar a mesma `last_interaction_at` unificada? (recomendado, evita duas verdades)
