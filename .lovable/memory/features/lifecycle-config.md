---
name: Lifecycle Config
description: Tabela `lifecycle_config` (singleton por tenant) controla thresholds Ativo/Inativo/Perdido e gatilhos de promoção Lead→Prospect / Prospect→Cliente. Tela em Settings → Ciclo de Vida.
type: feature
---

## Configuração centralizada

`lifecycle_config` (1 linha por tenant):
- `active_days` (default 180) – ≤ X dias = Ativo
- `inactive_days` (default 365) – > X dias = Perdido; entre ambos = Inativo
- `lead_to_prospect_trigger`: `deal_open` (default) | `proposal_sent` | `first_activity` | `manual`
- `prospect_to_customer_trigger`: `order_created` (default) | `order_approved` | `order_invoiced`
- `lost_releases_portfolio` (bool)
- `lost_release_requires_confirmation` (bool)

Leitura: todos do tenant. Escrita: Admin/Desenvolvedor.

## Funções e triggers

- `recompute_company_lifecycle(uuid?)` agora lê thresholds da `lifecycle_config`.
- `trg_promote_lead_to_prospect` AFTER INSERT em `deals` (modo `deal_open`) – só promove, nunca rebaixa.
- `trg_promote_to_customer_on_order` AFTER INSERT em `orders` (modo `order_created`) – promove direto, independente de aprovação.
- `flag_lost_customers_for_release()` – rotina diária (cron `flag_lost_customers_daily` 06:30 UTC) que enfileira clientes Perdidos em `portfolio_release_queue` quando a política exige confirmação; se confirmação=false, libera direto.

## Fila de liberação

`portfolio_release_queue` (`status`: `pending_confirmation` | `released` | `kept`). Decisão restrita a Admin/Dev pela UI em Settings → Ciclo de Vida (componente `LostCustomersReleaseQueue`). Liberar zera `sales_rep_id` e `owner_id` do cliente.

## Retrocompatibilidade

Mudar trigger Lead→Prospect ou Prospect→Cliente nunca rebaixa empresas — só afeta promoções futuras.
