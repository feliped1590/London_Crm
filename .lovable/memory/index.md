# Project Memory

## Core
Multi-tenant via `tenant_id` UUID without FK. Legal entity via `user_legal_entities`.
Global read access. Updates restricted to Owner, Admin, Dev, or linked `sales_rep_id`.
`sales_rep_id` is true ownership source. `owner_id` is fallback/audit.
CRM `unit_price` is sovereign. ERP prices are informational only.
Product tech fields & dimensions are immutable. SKU and `erp_versao` auto-generated.
Bidirectional sync loops blocked by `origem_alteracao` (CRM/ERP/SYNC).
Operational pipelines use `stage`. Commercial rules apply only to 'sales' pipelines.
1 session per user. Login replaces active session.
Produtos têm visibilidade global por tenant (igual a clientes); `legal_entity_id` é apenas vínculo p/ ERP.
Todo texto livre (nomes, descrições, endereços, observações) é armazenado e exibido em MAIÚSCULAS. `<Input>`/`<Textarea>` forçam uppercase automaticamente (exceto `type=email|url|password|tel|number|date|...` ou `preserveCase`). Trigger `enforce_uppercase_text` garante no banco. E-mails, URLs, telefones, documentos e senhas preservam o case.
Versões de produto: v1=pai (parent_product_id NULL), v2+=filhos. ERP recebe `codigo=pai.erp_product_code` e `versao=String(versao_numero)`. `erp_versao_codigo` é o identificador; `erp_versao` é só descritivo dimensional.

## Memories
- [Sales Goals Attribution](mem://features/sales-goals-attribution) — Metas medidas por pedidos (não deals), atribuídas por sales_rep via orders/company
- [BI Executive Composite Reports](mem://features/bi-executive-composite-reports) — Fase 1: relatórios `executivo_comercial` e `vendedor_360` no BICenter compondo RPCs existentes
- [Role-Based Access Control](mem://auth/role-based-access-control) — Admin, Sales, Support, Dev, Ops profiles and granular stage permissions
- [Licensing Model](mem://business/licensing-model) — Backend limit of 25 active users on 'professional' plan
- [WhatsApp Access](mem://security/whatsapp-access-control) — RLS on instances: users see own chats, Admins see all
- [Developer Role](mem://auth/developer-role-implementation) — Dev access to Reset Orders, ERP Settings, and Payload Simulator
- [CNPJ BrasilAPI](mem://integrations/cnpj-lookup-brasilapi) — 14-digit normalization, asterisk filtering, bulk enrichment
- [Proposal Automation](mem://features/proposal-approval-and-order-automation) — Auto-creates Orders on public approval, inherits IDs and delivery dates
- [Order Workflows](mem://features/order-approval-workflow) — Specific stages for 'Pronta Entrega' and 'Produção'
- [Pricing Policy](mem://business/product-governance-and-pricing-policy) — CRM pricing sovereignty and erp_status handling
- [Multi-CNPJ ERP Rules](mem://business/multi-cnpj-erp-mapping-rules) — Orders require `cd_empresa` matching CRM `legal_entity`
- [Projedata Product Schema](mem://business/projedata-product-schema-alignment) — 'tipo_ficha' and 'roteiro' are integers, others text
- [Delegated Access](mem://security/delegated-access-orders-logic) — Order delegation based on company `owner_id`
- [Operational RLS](mem://security/operational-rls-logic-composition) — Access = Tenant AND Legal Entity AND (Owner OR Admin OR Delegated OR Creator)
- [Fiscal Engine](mem://features/fiscal-engine-and-reformation) — Auto taxes, AI NCM validation, 2026 tax reform support
- [SaaS Multi-Tenant](mem://architecture/saas-multi-tenant-core) — `tenant_id` fallback via `get_user_tenant_ids`
- [Multi-CNPJ Governance](mem://features/multi-cnpj-governance) — Entity visibility via `user_legal_entities`
- [ERP Sync Architecture](mem://architecture/erp-sync-architecture) — Loop prevention via `origem_alteracao`, mandatory `erp_versao`
- [Session Architecture](mem://auth/session-and-licensing-architecture) — 1 concurrent session, pg_advisory_xact_lock to prevent race conditions
- [Fiscal IPI Logic](mem://features/fiscal-ipi-calculation-logic) — IPI logic based on 'Contribuinte de IPI' status
- [Portfolio Transfers](mem://features/portfolio-management-and-transfers) — Tracking in `portfolio_transfers`, 60-day inactivity highlighting
- [Sales Rep Constraints](mem://features/sales-rep-assignment-constraints) — 1:1 User-to-Sales Rep mapping, `is_default` handling
- [Commercial Logistics](mem://features/commercial-logistics-module) — Carrier rules (CIF, FOB, REDESPACHO) and defaults
- [Access Governance](mem://security/access-control-and-governance-policies) — Global read, strict updates, admin action justification
- [Portfolio Protection](mem://security/portfolio-protection-interaction-rules) — UI block on interacting with others' customers
- [Inactivity Threshold](mem://business/inactivity-threshold-and-crm-go-live-protection) — 60 days to transfer, suspended before CRM go-live
- [Hierarchy Governance](mem://business/commercial-management-hierarchy) — Bianca Mello manages orphan sales reps
- [Ownership Strategy](mem://security/ownership-standardization-strategy) — `sales_rep_id` as primary, `owner_id` for audit
- [Pricing Engine](mem://features/pricing-engine-and-rules-management) — Hierarchy: Customer Table > Product Rule > Default Table > Base Price
- [Pipeline Governance](mem://features/pipeline-governance-and-management) — Stagnation reasons, drag/drop stage restrictions
- [Pipeline Filtering](mem://features/pipeline-visibility-and-filtering) — Portfolio vs History view modes
- [Production Remediation](mem://security/production-access-remediation) — Credit-documents bucket requires ownership/admin, PDFs only
- [Product Auto Version](mem://database/product-auto-version-trigger) — `erp_versao` generated as LxCxE or LxE with comma thickness
- [SKU Architecture](mem://features/product-structural-immutability-and-sku-architecture) — Immutability of tech fields, unique SKUs via `sku_unique`
- [Audit Logging](mem://security/audit-logging-system-v2) — Immutable append-only logging for admins
- [Economic Grouping](mem://economic-grouping/explicit-entity-management) — Explicit groups via `economic_group_id` based on `cnpj_root`
- [Tenant Integrations](mem://architecture/tenant-integration-settings) — ERP credentials stored per tenant in `tenant_settings`
- [Credit Historical Integrity](mem://database/credit-analysis-historical-integrity) — Audit log vs latest state via UPSERT
- [Product Descriptions](mem://features/product-validation-and-description-rules) — Name compilation from Base, Nome do Impresso, and erp_versao
- [ERP Sync Sequence](mem://integrations/erp-product-sync-and-sequence-control) — Atomic sequential IDs via `erp_sequences`
- [Order Outbound Sync](mem://integrations/erp-order-outbound-sync) — Requires `erp_user_code`, handles sync delays
- [ERP Admin Mappings](mem://integrations/erp-mapping-administration) — Freight, payments, users, cities mappings restricted to admin/dev
- [Orders Payment Fields](mem://database/orders-payment-fields) — Parses `payment_method` and `payment_terms` for ERP
- [Customer Outbound Sync](mem://integrations/erp-customer-outbound-sync) — Manual sync, infers PF/PJ, validates full address
- [ERP Sales Rep Mapping](mem://integrations/erp-sales-rep-mapping-strategy) — Blocks customer sync if `erp_vendor_code` is missing
- [ERP User Mapping](mem://integrations/erp-user-mapping-strategy) — Prioritizes sales rep's user -> creator for `erp_user_code`
- [Projedata Mappings](mem://integrations/projedata-mapping-rules) — Rules for Regiao, Destino, Banco, Tipo de Endereco
- [Customer Integrity](mem://validation/customer-data-integrity) — Mandatory fields for customers and digit-only normalization
- [ERP Segment Mapping](mem://integrations/erp-segment-mapping-data) — Subsegments require `erp_code`
- [Commission Tracking](mem://features/order-commission-tracking) — Manual `commission_pct` at order item level (informational)
- [Order Item Display](mem://features/order-item-display-and-editing) — UI shows SKU and Fator KG instead of discount
- [Order Item Locks](mem://features/order-item-snapshot-and-lock-system) — Snapshots product details, auto-locks on non-pending save
- [Projedata Serialization](mem://integrations/projedata-serialization) — ASDCOMANDO JSON handling, standard `erp_code` definitions
- [Operational Pipelines](mem://features/operational-pipelines) — Differentiates commercial vs operational pipeline behaviors
- [ERP Result DTO](mem://integrations/erp-result-dto-and-parser) — Unified `ErpIntegrationResult` + `projedata-parser.ts` replaces manual p_retorno parsing in all 3 sync functions
- [ERP Order Pre-Validation](mem://integrations/erp-order-pre-validation) — `validate-order-sync` + `blocked_validation` queue status + shared modal prevent infinite retry loops on incomplete orders
- [Multi-Entity Pipeline Architecture](mem://architecture/multi-entity-pipeline-architecture) — Pipelines vinculados a legal_entities, classificação ortogonal de etapas (category/phase) e trigger de integridade em deals/orders/proposals
- [Pipeline Visibility by Legal Entity](mem://security/pipeline-visibility-by-legal-entity) — RLS + filtro frontend por user_legal_entities, auto-seleção segura, validação preventiva, pipelines globais sempre visíveis
- [Pipeline N:N Legal Entities](mem://architecture/pipeline-nn-legal-entities) — Tabela `pipeline_legal_entities`, 0 vínculos = global / 1+ = restrito, scope derivado, sync legado de `pipelines.legal_entity_id` via trigger
- [Ficha Técnica Schema-Driven](mem://features/ficha-tecnica-schema-driven) — Tabela `ficha_schemas` versionada, renderer dinâmico inativo (flag `ficha_renderer_version`), separação CORE vs dinâmico, snapshot por produto
- [ERP Attribute Sync](mem://integrations/erp-attribute-sync) — IMP_ATRIBFICHA_V1: 1 request = 1 atributo, fila própria com dirty tracking, dependência do erp_product_code, drain automático pós product-sync
- [ERP Product Version Sync](mem://integrations/erp-product-version-sync) — v1=pai, v2+=filhos com `parent_product_id`; payload usa `codigo=pai.erp_product_code` e `versao=String(versao_numero)`; `erp_versao_codigo` persistido após sync
- [Commercial Governance](mem://features/commercial-governance) — Motor de comissão (default/max_pct) e pagamento (rank de templates) com aprovação por exceção; save nunca trava, bloqueio só na transição de status; flags `allow_exception` por tenant; snapshots imutáveis
- [Lifecycle Config](mem://features/lifecycle-config) — Tabela `lifecycle_config` controla thresholds Ativo/Inativo/Perdido e gatilhos de promoção; fila `portfolio_release_queue` para clientes Perdidos
