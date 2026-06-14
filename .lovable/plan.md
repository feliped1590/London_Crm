
# Saneamento do Ciclo de Vida – Baseline 01/04/2026

Objetivo: corrigir a base distorcida (4.888 “Ativos” inflados, 0 Inativos/Perdidos) aplicando 4 ações em sequência, todas numa **única migration idempotente** + recálculo.

## 1. Baseline universal = 01/04/2026

- Cria coluna `companies.lifecycle_baseline_at TIMESTAMPTZ` (se ainda não existir) e popula com **2026-04-01** para 100% dos registros (override total, mesmo que a empresa tenha sido criada antes/depois).
- Ajusta `recompute_company_lifecycle` para usar como “última atividade efetiva”:
  ```
  COALESCE(activity_summary.last_interaction_at, companies.lifecycle_baseline_at)
  ```
  Removendo o fallback antigo (`companies.created_at`) que estava mascarando inativos.
- Triggers de promoção (orders/deals/activities) atualizam `last_interaction_at` normalmente; o baseline só age quando não há interação real.

Efeito: hoje (14/06/2026) o baseline tem ~74 dias → empresas sem interação real ficam dentro da janela Ativo padrão (180d). Quando passar de 180d sem interação real, viram Inativo automaticamente; após 365d, Perdido. O usuário consegue prever exatamente quando isso vai acontecer.

## 2. Rebaixar Customer Active sem pedido → Lead

```sql
UPDATE companies c
SET lifecycle_stage = 'lead',
    activity_status = NULL
WHERE c.lifecycle_stage = 'customer_active'
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.company_id = c.id);
```
Loga cada mudança em `company_audit_log` com `origem_alteracao = 'SYSTEM_LIFECYCLE_CLEANUP_2026Q2'`.

## 3. Rebaixar Prospect sem deal → Lead

```sql
UPDATE companies c
SET lifecycle_stage = 'lead'
WHERE c.lifecycle_stage = 'prospect'
  AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.company_id = c.id);
```
Mesma auditoria.

## 4. Promover Leads com histórico real

Após os rebaixamentos, recalcula promoções na ordem certa:

- **Lead → Prospect** (qualquer lead com deal aberto em pipeline comercial, conforme `lifecycle_config.lead_to_prospect_trigger`):
  ```sql
  UPDATE companies SET lifecycle_stage='prospect'
  WHERE lifecycle_stage='lead'
    AND EXISTS (
      SELECT 1 FROM deals d
      JOIN pipelines p ON p.id = d.pipeline_id
      WHERE d.company_id = companies.id
        AND COALESCE(p.pipeline_type,'sales') = 'sales'
        AND d.stage NOT IN ('won','lost')  -- ou colunas equivalentes
    );
  ```
- **Prospect/Lead → Customer Active** (qualquer empresa com pedido, conforme `prospect_to_customer_trigger = order_created`):
  ```sql
  UPDATE companies SET lifecycle_stage='customer_active'
  WHERE lifecycle_stage IN ('lead','prospect')
    AND EXISTS (SELECT 1 FROM orders o WHERE o.company_id = companies.id);
  ```
- Ao final, roda `recompute_company_lifecycle(NULL)` para sincronizar `activity_status` (ativo/inativo/perdido) de todos os `customer_active`, agora já considerando o novo baseline.

## 5. Validação pós-execução

Query de conferência (executada após a migration) e devolvida no chat:

```
SELECT lifecycle_stage, activity_status, COUNT(*)
FROM companies GROUP BY 1,2 ORDER BY 1,2;
```

Asserções esperadas:
- Customer Active = exatamente empresas com pedido (~45 hoje).
- Prospect = empresas sem pedido **com** deal aberto.
- Lead = restante.
- Todos os customer_active iniciam como `ativo` (baseline 74d < 180d), salvo os que já têm interação real antiga.

## 6. Telemetria & memória

- Linha em `admin_intervention_log` resumindo: total rebaixados, total promovidos, baseline aplicado.
- Atualiza `mem://features/activity-status-classification` e `mem://features/lifecycle-config` registrando a regra do **baseline 01/04/2026** e o fato de que `created_at` não é mais fallback.

## Detalhes técnicos

- Tudo roda numa **única migration** transacional para não deixar estados intermediários visíveis na UI.
- Triggers existentes (`trg_promote_lead_to_prospect`, `trg_promote_to_customer_on_order`) já cobrem o futuro — esta migration só normaliza o passado.
- Sem alteração de UI nesta etapa; o `LifecycleConfigManager` continua igual e o botão “Recalcular agora” passa a refletir corretamente.
- Sem mexer em RLS/GRANTs (tabela `companies` já existente).

## Riscos

- Empresas que **deveriam** ser clientes mas o ERP ainda não importou pedidos serão temporariamente Lead/Prospect. Mitigação: assim que o pedido entrar, o trigger promove automaticamente.
- Baseline fixo é uma decisão pontual de saneamento; documentado em memória para não ser revertido por engano em recomputes futuros.
