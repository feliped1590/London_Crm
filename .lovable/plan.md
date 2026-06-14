
# Configuração de Ciclo de Vida do Cliente

Centralizar em **uma tela de admin** todos os parâmetros que hoje estão hard-coded e refinar as regras de transição.

## 1. Modelo de dados

Nova tabela `lifecycle_config` (singleton por tenant, 1 linha por `tenant_id`):

| campo | tipo | default | descrição |
|---|---|---|---|
| `active_days` | int | 180 | até X dias da última interação → **Ativo** |
| `inactive_days` | int | 365 | entre `active_days` e este → **Inativo**; acima → **Perdido** |
| `lead_to_prospect_trigger` | enum | `deal_open` | `deal_open` \| `proposal_sent` \| `first_activity` \| `manual` |
| `prospect_to_customer_trigger` | enum | `order_created` | `order_created` \| `order_approved` \| `order_invoiced` |
| `lost_releases_portfolio` | bool | true | se Perdido libera carteira |
| `lost_release_requires_confirmation` | bool | true | exige confirmação antes de liberar |
| `updated_by`, `updated_at` | — | — | auditoria |

RLS: leitura por todos do tenant; escrita apenas Admin/Dev.

## 2. Refator das regras (resposta do usuário)

### Thresholds → configuráveis
`recompute_company_lifecycle` e a view `company_activity_summary` (onde aplicável) passam a **ler `lifecycle_config`** em vez de constantes 6m/12m. Default inicial mantém os valores atuais até o admin alterar.

### Lead → Prospect = "Deal aberto"
Trigger `AFTER INSERT` em `deals`: se `company.lifecycle_stage = 'lead'` e o pipeline é comercial e o estágio não é Ganho/Perdido, promove para `prospect`. Se todos os deals da empresa forem fechados (ganho ou perdido), **não rebaixa** — só sobe.

### Prospect → Cliente Ativo = "Primeiro pedido criado"
Trigger `AFTER INSERT` em `orders`: promove direto para `customer_active`, **independente do status de aprovação**. Substitui a regra atual que esperava aprovação. (Hoje já existe trigger; ajusta a condição.)

### Perdido libera carteira (com confirmação)
- `recompute_company_lifecycle` continua marcando `activity_status='perdido'` ao ultrapassar `inactive_days`.
- Nova rotina diária `flag_lost_customers_for_release`: para cada cliente que **virou** Perdido, cria registro em `portfolio_release_queue` com status `pending_confirmation`.
- Nova página admin (ou aba dentro de Realocação de Carteira) **"Clientes Perdidos – liberação pendente"**: lista, com botões **Liberar carteira** / **Manter na carteira / Reclassificar**. Só após confirmação a empresa tem `sales_rep_id` zerado e entra na fila de redistribuição existente.
- Notificação ao vendedor responsável + gestor quando entra na fila.

## 3. UI – nova tela `Settings → Ciclo de Vida do Cliente`

Seções:
1. **Janelas de atividade** — dois inputs numéricos (dias) para Ativo e Inativo, com preview textual (“Ativo: ≤ 180 dias · Inativo: 181–365 · Perdido: > 365”).
2. **Promoção Lead → Prospect** — select com as 4 opções (multi-select permitido; satisfazer qualquer uma promove).
3. **Promoção Prospect → Cliente** — select com as 3 opções.
4. **Tratamento de Perdidos** — switch "Liberar carteira automaticamente" + switch "Exigir confirmação antes de liberar".
5. Botão **Recalcular agora** que dispara `recompute_company_lifecycle(NULL)` on-demand.
6. Auditoria: última alteração (quem / quando).

Acesso restrito a Admin/Dev (`useModulePermissions`).

## 4. Recalculo & retrocompatibilidade

- Ao salvar alterações de thresholds, dispara `recompute_company_lifecycle(NULL)` em background.
- Mudar trigger Lead→Prospect ou Prospect→Cliente **não rebaixa** empresas — apenas afeta promoções futuras (evita perder histórico).
- Mudar política de Perdido para "liberar" gera fila de pendências para os perdidos atuais (em vez de liberar em massa).

## 5. Telemetria

- Log em `company_audit_log` com `origem_alteracao = 'SYSTEM_LIFECYCLE'` indicando qual regra disparou (incluir thresholds vigentes no momento).
- Log em `admin_intervention_log` quando admin altera `lifecycle_config` (com diff antes/depois).

## 6. Memória

Atualizar `mem://features/activity-status-classification` substituindo thresholds fixos por “configuráveis via `lifecycle_config`” e documentando as novas regras de promoção e fluxo de Perdidos.

## Arquivos previstos

**Migrations**
- `lifecycle_config` (tabela + RLS + seed default por tenant existente)
- `portfolio_release_queue` (tabela + RLS)
- Refator `recompute_company_lifecycle` para ler config
- Trigger `deals AFTER INSERT` (lead→prospect)
- Ajuste trigger `orders AFTER INSERT` (prospect→customer)
- Cron job diário `flag_lost_customers_for_release`

**Frontend**
- `src/pages/settings/LifecycleConfig.tsx` (nova rota)
- `src/hooks/useLifecycleConfig.ts`
- `src/components/portfolio/LostCustomersReleaseQueue.tsx`
- Entrada no menu de Settings

**Memória**
- Atualizar `mem://features/activity-status-classification`
- Nova `mem://features/lifecycle-config`
