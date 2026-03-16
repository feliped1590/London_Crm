# Diagnóstico Completo da Arquitetura do CRM
**Data:** 2026-03-16  
**Tipo:** Análise somente leitura — nenhuma alteração realizada

---

## 1. Estrutura do Banco de Dados

### 1.1 Visão Geral

O banco possui **~105 tabelas**, **3 views** e **~30 funções** no schema `public`. A seguir, as tabelas organizadas por domínio funcional.

---

### 1.2 Tabelas por Módulo

#### 🏢 MÓDULO: Cadastro de Empresas (Core CRM)

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `companies` | 55 | Tabela central de empresas/clientes. Contém dados cadastrais, fiscais, classificação, vínculo com vendedor comercial (`sales_rep_id`), proprietário (`owner_id`), entidade jurídica (`legal_entity_id`) e tenant. |
| `contacts` | 27 | Contatos vinculados a empresas. Suporta CPF, cargo, tipo_pessoa e campos personalizados. |
| `company_audit_log` | 8 | Histórico de alterações em empresas (field_name, old_value, new_value). |
| `companies_classification_backup` | 5 | Backup de classificação legada (industry, segmento_legado). |
| `custom_fields` | 11 | Definições de campos personalizados para company, contact, deal. |
| `entity_notes` | 6 | Notas rápidas vinculadas a qualquer entidade. |

**Chaves estrangeiras de `companies`:**
- `setor_id` → `setores(id)`
- `segmento_id` → `segmentos(id)`
- `atividade_id` → `atividades(id)`
- `sales_rep_id` → `sales_reps(id)`
- `legal_entity_id` → `legal_entities(id)`
- `default_carrier_id` → `carriers(id)`
- `parent_company_id` → `companies(id)` (auto-referência para grupo econômico)
- `tenant_id` → `tenants(id)`

---

#### 📊 MÓDULO: Classificação Cascata (Setor → Segmento → Atividade)

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `setores` | 8 | Nível 1: Setores econômicos (ex: Indústria, Comércio) |
| `segmentos` | 10 | Nível 2: Segmentos dentro de um setor |
| `atividades` | 10 | Nível 3: Atividades dentro de um segmento |

**Relacionamento:** `setores` 1:N → `segmentos` 1:N → `atividades`

---

#### 🤝 MÓDULO: Pipeline de Vendas

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `deals` | 20 | Negócios/oportunidades. Vincula empresa, contato, pipeline, stage, valor, probabilidade. |
| `pipelines` | 10 | Definição de pipelines (nome, tipo, ativo). |
| `pipeline_stages` | 11 | Estágios de cada pipeline com SLA em horas, cor, probabilidade, sort_order. |
| `deal_stage_history` | 8 | Histórico de movimentação entre estágios (from_stage, to_stage, changed_at). |
| `deal_audit_log` | 8 | Auditoria de alterações nos campos de deals. |
| `deal_participants` | 6 | Participantes de um negócio (N:N entre deals e users). |
| `deal_checklist_completions` | 6 | Checklist de ações obrigatórias por estágio. |
| `stage_checklist_items` | 8 | Definição dos itens de checklist por pipeline_stage. |
| `pipeline_automations` | 10 | Automações vinculadas a eventos do pipeline (stage_enter, stage_exit). |

**Chaves estrangeiras de `deals`:**
- `company_id` → `companies(id)`
- `contact_id` → `contacts(id)`
- `pipeline_id` → `pipelines(id)`
- `owner_id` → auth.users (lógico, sem FK direta)
- `legal_entity_id` → `legal_entities(id)`
- `tenant_id` → `tenants(id)`

---

#### 📋 MÓDULO: Tarefas

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `tasks` | ~15 | Tarefas com status, prioridade, due_date, due_time, vínculo com empresa/contato/deal. |
| `task_reminders` | ~6 | Lembretes configuráveis por tarefa. |

---

#### 📧 MÓDULO: E-mails

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `email_templates` | 8 | Templates de e-mail reutilizáveis. |
| `email_logs` | 15 | Registro de e-mails enviados com status, tracking de abertura. |

---

#### 💬 MÓDULO: WhatsApp

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `whatsapp_instances` | ~10 | Instâncias de conexão WhatsApp (Z-API). |
| `whatsapp_messages` | ~15 | Mensagens enviadas/recebidas. |
| `whatsapp_contacts` | ~8 | Contatos WhatsApp mapeados. |
| `whatsapp_templates` | ~8 | Templates de mensagens WhatsApp. |
| `whatsapp_conversation_summaries` | ~6 | Resumos de conversas gerados por IA. |
| `whatsapp_objections` | ~5 | Objeções identificadas nas conversas. |

---

#### 📦 MÓDULO: Pedidos e Propostas

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `orders` | 41 | Pedidos com status, valores, frete, transportadora, entidade jurídica. |
| `order_items` | 26 | Itens dos pedidos com dados fiscais completos. |
| `order_approvals` | 7 | Fluxo de aprovação de pedidos. |
| `order_approval_rules` | 12 | Regras de aprovação (faixa de valor, desconto máximo). |
| `order_audit_log` | 8 | Auditoria de alterações em pedidos. |
| `order_erp_data` | 19 | Dados complementares do ERP para pedidos. |
| `order_item_erp_data` | 15 | Dados complementares do ERP para itens. |
| `proposals` | 36 | Propostas comerciais com link público, validade, status. |
| `proposal_items` | 18 | Itens das propostas. |
| `proposal_access_logs` | 7 | Log de acesso a propostas públicas. |

---

#### 📊 MÓDULO: Produtos

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `products` | 60 | Cadastro completo de produtos com dados fiscais (NCM, CST, alíquotas), classificação (tipo, grupo, subgrupo, família, classe), sync ERP. |
| `product_types` | 8 | Lookup: tipos de produto |
| `product_groups` | 8 | Lookup: grupos |
| `product_subgroups` | 8 | Lookup: subgrupos |
| `product_families` | 7 | Lookup: famílias |
| `product_classes` | 7 | Lookup: classes |
| `product_unit_measures` | 7 | Lookup: unidades de medida |
| `product_stock` | 9 | Estoque por produto+empresa+tenant |
| `stock_movements` | ~10 | Movimentações de estoque |
| `product_erp_data` | 30 | Dados complementares do ERP |
| `product_erp_sync_log` | 10 | Log de sincronização ERP |
| `product_sync_queue` | 11 | Fila de sincronização pendente |
| `product_ncm_audit` | 12 | Auditoria de alterações no NCM |

---

#### 💰 MÓDULO: Precificação

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `pricing_tables` | 10 | Tabelas de preço (nome, tipo, margem, validade). |
| `pricing_rules` | 11 | Regras de preço por produto/tabela. |
| `pricing_table_assignments` | 6 | Vínculo tabela↔entidade jurídica. |

---

#### 🏛️ MÓDULO: Fiscal / Tributário

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `ncm_codes` | 11 | Tabela NCM com alíquota IPI oficial. |
| `ncm_fiscal_rules` | 19 | Regras fiscais por NCM. |
| `regras_tributacao` | 63 | Regras centralizadas de tributação (ICMS, PIS, COFINS, IPI, CBS, IBS). |
| `cadastro_cfop` | 8 | Cadastro de CFOP. |
| `cadastro_cst` | 8 | Cadastro de CST. |
| `cadastro_enquadramento_ipi` | 6 | Enquadramento IPI. |
| `cadastro_imposto_seletivo` | 19 | Cadastro do Imposto Seletivo (Reforma Tributária 2026). |
| `beneficios_fiscais` | 20 | Benefícios fiscais (isenções, reduções). |
| `cliente_beneficios_fiscais` | 12 | Vínculo benefício↔empresa. |
| `credito_presumido_regras` | 21 | Regras de crédito presumido. |
| `documento_fiscal_snapshot` | 10 | Snapshot imutável de regras aplicadas em documentos. |
| `transicao_tributaria_parametros` | ~8 | Parâmetros da transição tributária 2026-2033. |
| `split_payment_registros` | ~6 | Registros de split payment. |
| `company_erp_fiscal` | 26 | Dados fiscais do ERP por empresa. |
| `company_erp_financial` | 24 | Dados financeiros do ERP por empresa. |

---

#### 👤 MÓDULO: Usuários, Papéis e Segurança

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `profiles` | 10 | Perfil do usuário (full_name, avatar, phone, email). |
| `user_roles` | 4 | Papéis: admin, vendedor, atendente, desenvolvedor. |
| `tenants` | ~5 | Organizações/tenants. |
| `user_tenants` | ~4 | Vínculo N:N entre users e tenants. |
| `user_legal_entities` | ~5 | Vínculo user↔entidade jurídica (governança multi-CNPJ). |
| `system_modules` | ~8 | Módulos do sistema. |
| `role_module_permissions` | 7 | Permissões por role+módulo (can_access, access_type). |
| `license_settings` | 7 | Configuração de licença (max_users, plano). |
| `system_settings` | ~4 | Configurações globais do sistema. |
| `user_audit_log` | ~8 | Auditoria de ações de usuários. |
| `app_sessions` | 12 | Sessões ativas com controle de idle timeout. |
| `access_violation_log` | 11 | Log de tentativas de acesso não autorizado. |
| `admin_intervention_log` | 13 | Log de intervenções administrativas com justificativa. |

---

#### 📈 MÓDULO: Vendedores e Carteira

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `sales_reps` | 8 | Representantes comerciais (nome, código, comissão). |
| `user_sales_reps` | ~6 | Vínculo N:N entre users e sales_reps. |
| `sales_goals` | 10 | Metas de vendas por vendedor/período. |
| `user_portfolio_delegations` | ~8 | Delegações de carteira (férias, licença). |
| `portfolio_transfers` | 18 | Histórico de transferências de carteira. |
| `customer_transfer_requests` | 12 | Solicitações de transferência de cliente. |
| `crm_activity_weights` | 6 | Pesos de atividades para score de produtividade. |
| `crm_productivity_targets` | 7 | Metas de produtividade por vendedor. |

---

#### 📊 MÓDULO: Análise de Crédito

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `credit_analyses` | 14 | Estado mais recente da análise de crédito (1:1 com company). |
| `credit_analysis_audit` | 10 | Histórico IMUTÁVEL de todas as consultas (append-only). |
| `credit_documents` | 9 | Documentos de crédito anexados. |

---

#### 🤖 MÓDULO: Bots / Automação WhatsApp

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `bot_flows` | 9 | Fluxos de bot (nome, trigger_type). |
| `bot_flow_nodes` | 9 | Nós do fluxo (posição, tipo, config). |
| `bot_flow_edges` | 8 | Conexões entre nós. |
| `bot_sessions` | 13 | Sessões ativas de bot por telefone. |
| `bot_session_data` | 5 | Dados coletados durante sessão do bot. |

---

#### 🔄 MÓDULO: Integração ERP / Sync

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `crm_clients` | 29 | Espelho de clientes do ERP (Iniflex). |
| `crm_client_addresses` | 13 | Endereços ERP. |
| `crm_orders` | 19 | Pedidos ERP (datas como TEXT DD/MM/YYYY). |
| `crm_order_items` | 11 | Itens dos pedidos ERP. |
| `crm_products` | 23 | Produtos ERP. |
| `contact_erp_data` | 22 | Dados complementares ERP de contatos. |
| `erp_sync_control` | 6 | Controle de sincronização. |
| `erp_sync_logs` | 11 | Logs de sincronização. |
| `import_logs` | 11 | Logs de importação. |
| `import_errors` | 6 | Erros de importação. |
| `import_conflict_log` | 15 | Conflitos durante importação. |
| `iniflex_sandbox_logs` | 8 | Logs do sandbox Iniflex. |

---

#### 🚚 MÓDULO: Transportadoras

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `carriers` | 17 | Cadastro de transportadoras (CNPJ, IE, endereço). |

---

#### 🏢 MÓDULO: Entidades Jurídicas (Multi-CNPJ)

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `legal_entities` | 19 | CNPJs do grupo econômico por tenant. |

---

#### 🔔 MÓDULO: Notificações

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `notifications` | 10 | Notificações do sistema. |
| `notification_preferences` | 11 | Preferências de notificação por usuário. |

---

#### 📅 MÓDULO: Google Calendar

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `google_calendar_connections` | 12 | Conexões OAuth com Google Calendar. |
| `google_calendar_sync_logs` | 10 | Logs de sincronização. |

---

#### 🔍 MÓDULO: Prospecção

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `prospecting_searches` | 5 | Buscas de prospecção realizadas. |
| `prospecting_results` | 20 | Resultados de prospecção com status (new, saved, discarded). |

---

#### 🤖 MÓDULO: IA Assistente

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `ai_assistant_configs` | 6 | Configurações do assistente IA (prompt). |
| `ai_conversations` | 6 | Conversas com a IA por usuário. |

---

#### 🖥️ MÓDULO: Dashboard

| Tabela | Colunas | Descrição |
|--------|---------|-----------|
| `user_dashboard_cards` | ~6 | Cards customizados do dashboard. |
| `user_dashboard_configs` | ~4 | Configurações do dashboard. |

---

### 1.3 Views

| View | Descrição |
|------|-----------|
| `company_activity_summary` | Consolida última atividade, último pedido, total de pedidos e valor total por empresa. Cruza `companies` com `activities`, `tasks`, `email_logs`, `whatsapp_messages`, `deals`, `orders`. |
| `profiles_safe` | View segura que oculta telefone para não-admins. |
| `search_customers_unified` | View unificada de clientes CRM + ERP com deduplicação por CNPJ. |

---

### 1.4 Enums

| Enum | Valores |
|------|---------|
| `app_role` | admin, vendedor, atendente, desenvolvedor |
| `access_level` | restrito, total |
| `deal_stage` | prospeccao, qualificacao, proposta, negociacao, fechado_ganho, fechado_perdido |
| `lifecycle_stage` | lead, prospect, customer_active, customer_inactive, customer_lost |
| `order_status` | pendente, em_producao, produzido, em_faturamento, faturado, entregue, cancelado |
| `proposal_status` | rascunho, enviada, em_analise, aprovada, recusada, expirada |
| `task_status` | pendente, em_andamento, concluida, cancelada |
| `task_priority` | baixa, media, alta, urgente |
| `regime_tributario` | simples_nacional, lucro_presumido, lucro_real |
| `tipo_pessoa` | fisica, juridica |
| `stock_movement_type` | entrada, saida, ajuste |
| `ipi_mode` | destacar, incluso, isento |
| `modelo_tributario` | legado, dual_teste, dual_transicao, novo |
| `regime_incidencia_cbs_ibs` | normal, aliquota_zero, monofasico, isento, imune, suspensao, diferimento, cashback, nao_incidencia |
| `categoria_imposto_seletivo` | bebidas_alcoolicas, bebidas_acucaradas, tabaco, veiculos, embarcacoes_aeronaves, extracao_mineral, concursos_prognosticos, nao_aplicavel |
| *(+7 outros enums fiscais)* | ... |

---

## 2. Relacionamentos entre Entidades

### 2.1 Diagrama Conceitual Principal

```
                    ┌─────────────┐
                    │   tenants   │
                    └──────┬──────┘
                           │ 1:N
                    ┌──────┴──────┐
                    │ user_tenants│ (N:N users↔tenants)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────┴──────┐  ┌─┴──────┐  ┌──┴───────────┐
       │  profiles   │  │  user  │  │ legal_entities│
       │  user_roles │  │ _sales │  │   (multi-CNPJ)│
       └──────┬──────┘  │ _reps  │  └───────┬───────┘
              │         └─┬──────┘          │
              │           │                 │
              │    ┌──────┴──────┐          │
              │    │  sales_reps │          │
              │    └──────┬──────┘          │
              │           │                 │
       ┌──────┴───────────┴─────────────────┴──────┐
       │                 companies                  │
       │  (owner_id, sales_rep_id, legal_entity_id) │
       └──────┬──────────────┬──────────────┬──────┘
              │              │              │
       ┌──────┴──────┐ ┌────┴─────┐ ┌──────┴──────┐
       │  contacts   │ │  deals   │ │   orders    │
       └─────────────┘ └────┬─────┘ └──────┬──────┘
                            │              │
                     ┌──────┴──────┐ ┌─────┴──────┐
                     │ deal_stage  │ │ order_items │
                     │ _history    │ └────────────┘
                     └─────────────┘
```

### 2.2 Tipos de Relacionamento

| Relação | Tipo | Descrição |
|---------|------|-----------|
| `companies` ↔ `contacts` | 1:N | Uma empresa tem múltiplos contatos |
| `companies` ↔ `deals` | 1:N | Uma empresa tem múltiplos negócios |
| `companies` ↔ `orders` | 1:N | Uma empresa tem múltiplos pedidos |
| `companies` ↔ `activities` | 1:N | Atividades registradas por empresa |
| `companies` ↔ `tasks` | 1:N | Tarefas vinculadas a empresa |
| `companies` ↔ `credit_analyses` | 1:1 | Uma análise de crédito por empresa |
| `deals` ↔ `pipeline_stages` | N:1 | Deal está em um estágio |
| `deals` ↔ `deal_participants` | 1:N (→ N:N users) | Participantes do negócio |
| `deals` ↔ `proposals` | 1:N | Propostas vinculadas ao deal |
| `orders` ↔ `order_items` | 1:N | Itens do pedido |
| `orders` ↔ `proposals` | N:1 | Pedido gerado a partir de proposta |
| `products` ↔ `order_items` | 1:N | Produto nos itens |
| `users` ↔ `user_roles` | 1:N | Um usuário pode ter múltiplos papéis |
| `users` ↔ `user_tenants` | N:N | Usuário em múltiplos tenants |
| `users` ↔ `user_sales_reps` | N:N | Usuário vinculado a representantes |
| `users` ↔ `user_legal_entities` | N:N | Governança multi-CNPJ |
| `setores` → `segmentos` → `atividades` | 1:N cascata | Classificação hierárquica |
| `companies` ↔ `companies` | auto-ref | Grupo econômico (parent_company_id) |

### 2.3 Entidades Centrais

1. **`companies`** — Entidade mais central (55 colunas, referenciada por ~20 tabelas)
2. **`deals`** — Segunda mais conectada (pipeline, propostas, pedidos, atividades)
3. **`profiles` / auth.users** — Identidade, referenciada em owner_id/created_by de quase todas as tabelas
4. **`tenants`** — Base do isolamento multi-tenant
5. **`products`** — Central para pedidos, propostas e fiscal

---

## 3. Fluxo de Dados do CRM

```
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Prospecção   │────▶│ Empresa  │────▶│ Contato  │────▶│ Negócio  │
│ prospecting_ │     │ companies│     │ contacts │     │ deals    │
│ results      │     └────┬─────┘     └──────────┘     └────┬─────┘
└──────────────┘          │                                  │
                          │                           ┌──────┴──────┐
                          │                           │ Pipeline    │
                          │                           │ Stages      │
                          │                           │ (Kanban)    │
                          │                           └──────┬──────┘
                          │                                  │
                    ┌─────┴──────┐                    ┌──────┴──────┐
                    │ Atividades │◀───────────────────│ Proposta    │
                    │ activities │                    │ proposals   │
                    │ tasks      │                    └──────┬──────┘
                    │ email_logs │                           │
                    │ whatsapp_  │                    ┌──────┴──────┐
                    │ messages   │                    │   Pedido    │
                    └────────────┘                    │   orders    │
                                                     └──────┬──────┘
                                                            │
                                                     ┌──────┴──────┐
                                                     │ Faturamento │
                                                     │ (ERP Sync)  │
                                                     └─────────────┘
```

### Detalhamento por Etapa:

1. **Prospecção** → `prospecting_searches` + `prospecting_results` → salvar lead
2. **Cadastro** → `companies` (com classificação `setores/segmentos/atividades`) + `contacts`
3. **Qualificação** → `credit_analyses` + `activities` + lifecycle_stage na company
4. **Negociação** → `deals` no pipeline → `deal_stage_history` registra movimentações
5. **Proposta** → `proposals` + `proposal_items` → link público para aprovação
6. **Pedido** → `orders` + `order_items` → fluxo de aprovação (`order_approvals`)
7. **Interações** → `activities`, `tasks`, `email_logs`, `whatsapp_messages` (todos vinculados a company/contact/deal)
8. **Faturamento** → sync com ERP via `crm_orders`, `product_sync_queue`

---

## 4. Módulos Funcionais do Sistema

| # | Módulo | Tabelas Principais | Componentes Frontend |
|---|--------|--------------------|----------------------|
| 1 | **Dashboard** | company_activity_summary, deals, tasks, sales_goals | `Dashboard.tsx`, `DashboardCardSettings`, `GoalProgressWidget`, `LifecyclePanel`, `SellerPortfolioWidget` |
| 2 | **Meu Dia** | tasks, deals, activities | `Today.tsx`, `DailySummary`, `TodayTaskList`, `StagnantDealsCard` |
| 3 | **Empresas/Clientes** | companies, contacts, company_audit_log, company_erp_* | `Customers.tsx`, `CustomerDetail.tsx`, `CustomerNew.tsx`, classificação cascade |
| 4 | **Contatos** | contacts, contact_erp_data | `Contacts.tsx` |
| 5 | **Pipeline** | deals, pipeline_stages, pipelines, deal_stage_history, deal_participants | `Pipeline.tsx`, `KanbanBoard`, `DealFormDialog`, `PipelineFilters` |
| 6 | **Tarefas** | tasks, task_reminders | `Tasks.tsx`, `TaskCalendar`, `TaskDetailDrawer` |
| 7 | **Propostas** | proposals, proposal_items, proposal_access_logs | `ProposalDialog`, `ProposalsList`, `ProposalPublic.tsx` |
| 8 | **Pedidos** | orders, order_items, order_approvals, order_approval_rules | `Orders.tsx`, `OrderDialog`, `OrderApprovalActions` |
| 9 | **Produtos** | products, product_types/groups/subgroups/families/classes/unit_measures | `Products.tsx`, `ProductLookupManager`, `NCMSelector` |
| 10 | **Estoque** | product_stock, stock_movements | `Stock.tsx` |
| 11 | **E-mails** | email_templates, email_logs | `Emails.tsx` |
| 12 | **WhatsApp** | whatsapp_instances/messages/contacts/templates | `WhatsApp.tsx`, `ChatView`, `ConversationList`, `InstanceManager` |
| 13 | **Bots** | bot_flows, bot_flow_nodes/edges, bot_sessions | `BotBuilder.tsx`, node components |
| 14 | **Prospecção** | prospecting_searches, prospecting_results | `Prospecting.tsx`, `ProspectingFilters` |
| 15 | **Análise de Crédito** | credit_analyses, credit_analysis_audit, credit_documents | `CreditAnalysisTab`, `CreditDocumentsTab`, `CreditAuditHistory` |
| 16 | **Fiscal/Tributário** | regras_tributacao, ncm_codes, ncm_fiscal_rules, beneficios_fiscais, cadastro_* | `FiscalSettingsTab`, `NCMManager`, `CreditoPresumidoManager`, `TransicaoTributariaPanel` |
| 17 | **Precificação** | pricing_tables, pricing_rules, pricing_table_assignments | `PricingTables.tsx`, `EntityAssignmentsTab` |
| 18 | **Transportadoras** | carriers | `Carriers.tsx` |
| 19 | **Insights** | (views + queries analíticas) | `Insights.tsx`, `InsightCard`, tabelas de alertas |
| 20 | **Relatórios/BI** | (queries agregadas, funções analíticas) | `Reports.tsx`, `BIAdvancedTab`, charts |
| 21 | **Configurações** | user_roles, system_modules, role_module_permissions, sales_reps, sales_goals, pipelines | `Settings.tsx`, ~20 sub-componentes |
| 22 | **Integrações ERP** | crm_clients/orders/products, erp_sync_*, import_*, product_sync_queue | `Integrations.tsx`, `InflexIntegration.tsx`, `SyncLogsTab` |
| 23 | **Governança** | admin_intervention_log, access_violation_log, portfolio_transfers, customer_transfer_requests | `AdminInterventionModal`, `TransferRequestModal`, `PortfolioProtectionModal` |
| 24 | **Realocação de Carteira** | companies (batch update sales_rep_id) | `PortfolioReallocation.tsx`, filtros e tabela de resultados |

---

## 5. Políticas de Segurança (RLS)

### 5.1 Padrão de Isolamento

O sistema utiliza uma **composição lógica em camadas**:

```
(Tenant Isolation) AND (Legal Entity Restriction) AND (Owner OR Admin OR Delegation OR Creator)
```

### 5.2 Resumo de Políticas por Tabela

| Tabela | SELECT | INSERT | UPDATE | DELETE | Padrão |
|--------|--------|--------|--------|--------|--------|
| **companies** | Todos autenticados | Autenticados | Owner/Creator/Admin/SalesRep/Delegação | Owner/Creator/Admin/SalesRep/Delegação | Tenant + Leitura global + Escrita restrita |
| **contacts** | Todos autenticados | Autenticados | Owner/Creator/Admin/Delegação | Apenas Admin | Tenant + Leitura global |
| **deals** | Owner/Creator/Participante/Admin/Delegação | Autenticados | Owner/Creator/Admin/Delegação | Apenas Admin | Tenant + Visibilidade restrita |
| **tasks** | Autenticados (tenant) | Autenticados | Trigger valida owner da empresa | Trigger valida owner | Tenant + Trigger de consistência |
| **orders** | Autenticados (tenant) | Autenticados (tenant) | Autenticados (tenant) | Admin | Tenant isolation |
| **activities** | Todos autenticados | Autenticados | Apenas criador | Criador ou Admin | Tenant |
| **products** | Todos autenticados (tenant) | Autenticados (tenant) | Autenticados (tenant) | Admin | Tenant |
| **profiles** | Todos autenticados | Sistema (trigger) | Próprio usuário | - | Per-user |
| **user_roles** | Todos autenticados | Admin | Admin | Admin | RBAC |
| **app_sessions** | Próprio ou Admin | SECURITY DEFINER only | SECURITY DEFINER only | Bloqueado | Funções PL/pgSQL |
| **Tabelas fiscais** | Todos autenticados | Admin | Admin | Admin | Lookup tables |
| **Tabelas ERP (crm_*)** | Autenticados | Service role | Service role | - | Sync tables |
| **Tabelas de auditoria** | Admin ou criador | Sistema | **BLOQUEADO** (imutável) | **BLOQUEADO** | Append-only |

### 5.3 Funções de Segurança Chave

| Função | Propósito |
|--------|-----------|
| `has_role(user_id, role)` | Verifica papel do usuário (SECURITY DEFINER, evita recursão RLS) |
| `has_module_access(user_id, module_key)` | Verifica acesso a módulo por RBAC |
| `get_module_access_type(user_id, module_key)` | Retorna 'total', 'restrito' ou 'none' |
| `can_manage_portfolio(user_id, owner_id, entity)` | Verifica delegação de carteira ativa |
| `can_update_credit_score(user_id)` | Admin ou desenvolvedor |
| `check_deal_owner_consistency()` | Trigger que bloqueia criação de deal em empresa de outro vendedor |
| `check_task_owner_consistency()` | Trigger que bloqueia tarefa em empresa de outro vendedor |
| `check_owner_change()` | Trigger que impede alteração de owner_id por não-admin |
| `validate_transfer_request_rules()` | Valida regras de transferência de carteira |

---

## 6. Dependências do Frontend

### 6.1 Hooks Críticos (consomem dados do banco)

| Hook | Tabelas Acessadas | Uso |
|------|-------------------|-----|
| `useAuth` | profiles, user_roles, user_tenants, user_sales_reps | Autenticação e contexto global |
| `usePipelineData` | deals, pipeline_stages, companies, contacts, deal_participants | Kanban do pipeline |
| `useDashboardData` | deals, tasks, companies, activities (aggregations) | Dashboard principal |
| `useCustomerDetail` | companies, contacts, deals, activities, orders, credit_analyses | Detalhe do cliente |
| `usePricingTables` | pricing_tables, pricing_rules, pricing_table_assignments | Precificação |
| `useProductLookups` | product_types/groups/subgroups/families/classes/unit_measures | Lookups de produtos |
| `useSalesReps` | sales_reps, user_sales_reps | Vendedores comerciais |
| `usePortfolio` | companies, sales_reps, company_activity_summary | Gestão de carteira |
| `useBIAdvanced` | deals, pipeline_stages (funções analíticas) | BI avançado |
| `useWhatsApp` | whatsapp_instances/messages/contacts | Chat WhatsApp |
| `useFiscalRules` | regras_tributacao, ncm_codes, ncm_fiscal_rules | Motor fiscal |
| `useModulePermissions` | system_modules, role_module_permissions | Controle de acesso por módulo |
| `useLegalEntities` | legal_entities, user_legal_entities | Governança multi-CNPJ |
| `useSessionGuard` | app_sessions (via RPC) | Controle de sessão única |
| `useTaskCalendar` | tasks, google_calendar_sync_logs | Calendário de tarefas |
| `useTodayData` | tasks, deals, activities | Tela "Meu Dia" |

### 6.2 Edge Functions (Backend)

| Função | Propósito |
|--------|-----------|
| `ai-assistant` | Assistente IA contextual |
| `create-user / delete-user / update-user` | CRUD de usuários (admin) |
| `credit-analysis` | Consulta de crédito externa |
| `erp-import-*` (companies, contacts, orders, products) | Importação ERP Iniflex |
| `calcular-tributacao` | Cálculo tributário |
| `generate-*-pdf` (order, proposal, report) | Geração de PDFs |
| `lookup-cnpj` | Consulta CNPJ (Receita) |
| `lookup-ncm-online` / `validate-ncm-semantic` | Validação NCM |
| `prospecting-search / prospecting-save-lead` | Prospecção |
| `send-email / send-bulk-email / process-scheduled-emails` | E-mails |
| `zapi-*` (send-message, webhook, qrcode, status) | WhatsApp Z-API |
| `google-calendar-*` | Google Calendar sync |
| `process-product-sync` | Sincronização de produtos ERP |
| `proposal-approve / proposal-public-view` | Proposta pública |
| `import-companies-bulk / import-companies-from-file` | Importação em massa |
| `import-ncm-tipi / import-products-csv` | Importação fiscal/produtos |
| `execute-automation` | Automações do pipeline |

---

## 7. Pontos de Atenção Arquitetural

### 7.1 ⚠️ Duplicação de Dados (CRM ↔ ERP)

| Área | Problema | Impacto |
|------|----------|---------|
| Clientes | `companies` (CRM) + `crm_clients` (ERP) representam a mesma entidade | View `search_customers_unified` tenta deduplicar por CNPJ, mas há redundância de dados |
| Pedidos | `orders` (CRM) + `crm_orders` (ERP) coexistem | Dificuldade em determinar fonte da verdade |
| Produtos | `products` (CRM) + `crm_products` (ERP) | Sincronização bidirecional complexa via `product_sync_queue` |
| Contatos | `contacts` (CRM) + dados em `crm_clients` | Dados de contato fragmentados |
| Dados fiscais | `company_erp_fiscal` (ERP) vs campos diretos em `companies` | Redundância fiscal |

### 7.2 ⚠️ Tabela `companies` com 55 Colunas

A tabela central acumulou campos demais (cadastrais, fiscais, ERP, classificação, flags). Isso gera:
- Queries pesadas por padrão
- Acoplamento entre módulos distintos
- Dificuldade de manutenção

### 7.3 ⚠️ Tabela `products` com 60 Colunas

Similar ao problema de `companies`. Mistura dados de catálogo, fiscal, ERP e sync em uma única tabela.

### 7.4 ⚠️ Tabela `regras_tributacao` com 63 Colunas

Concentra TODAS as regras tributárias (ICMS, PIS, COFINS, IPI, CBS, IBS, IS) em uma única tabela wide. Alta complexidade para manutenção.

### 7.5 ⚠️ Views com Subqueries Correlacionadas

A view `company_activity_summary` executa ~6 subqueries correlacionadas por linha. Em tabelas grandes, isso pode causar degradação de performance. A função `search_customers_paginated` mitiga isso com CTEs, mas a view pura ainda é custosa.

### 7.6 ⚠️ Acoplamento Frontend ↔ Enums do Banco

Os enums (`deal_stage`, `task_status`, etc.) são duplicados em `src/types/crm.ts`. Alterações no banco exigem atualização manual no frontend.

### 7.7 ⚠️ Sessões via Tabela (não JWT nativo)

O controle de sessão única (`app_sessions`) é implementado via tabela com TTL + polling. Funciona, mas adiciona latência e carga ao banco comparado a soluções baseadas em tokens.

### 7.8 ⚠️ RLS Policies em `companies` (5 policies)

A tabela `companies` tem 5 policies RLS combinadas (tenant isolation + visibilidade global + escrita restrita + legal entity). A avaliação conjunta pode impactar performance em queries com muitos JOINs.

### 7.9 ✅ Pontos Positivos

- **Multi-tenant** bem implementado com isolamento por `tenant_id` em todas as tabelas
- **Auditoria** abrangente (company_audit_log, deal_audit_log, order_audit_log, access_violation_log, admin_intervention_log)
- **Governança** robusta (justificativa de intervenção admin, proteção de carteira, validação de ownership por triggers)
- **Fiscal** preparado para Reforma Tributária 2026 (CBS/IBS, Imposto Seletivo, transição dual)
- **Imutabilidade** em tabelas de auditoria (credit_analysis_audit, documento_fiscal_snapshot)

---

## 8. Diagrama Conceitual

O diagrama abaixo mostra as entidades principais e seus relacionamentos:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TENANT (Organização)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐   N:N    ┌──────────┐   1:N    ┌────────────────┐       │
│  │  Users   │─────────▶│  Sales   │─────────▶│   Companies    │       │
│  │ Profiles │          │  Reps    │          │  (55 cols)     │       │
│  │ Roles    │          └──────────┘          └───┬───┬───┬────┘       │
│  └────┬─────┘                                    │   │   │            │
│       │                                          │   │   │            │
│       │ N:N                               1:N    │   │   │ 1:N       │
│  ┌────┴──────────┐                    ┌──────────┘   │   └──────┐    │
│  │Legal Entities │              ┌─────┴─────┐   ┌────┴────┐ ┌──┴──┐ │
│  │ (Multi-CNPJ)  │              │ Contacts  │   │  Deals  │ │Tasks│ │
│  └───────────────┘              └───────────┘   └────┬────┘ └─────┘ │
│                                                      │               │
│                                          ┌───────────┼──────────┐   │
│                                          │           │          │   │
│                                    ┌─────┴────┐ ┌───┴────┐ ┌──┴──┐│
│                                    │Proposals │ │Pipeline│ │Activ││
│                                    └─────┬────┘ │Stages  │ │ities││
│                                          │      └────────┘ └─────┘│
│                                    ┌─────┴────┐                    │
│                                    │  Orders  │                    │
│                                    │ (41 cols)│                    │
│                                    └─────┬────┘                    │
│                                          │                         │
│                                    ┌─────┴────┐                    │
│                                    │  Products│                    │
│                                    │ (60 cols)│                    │
│                                    └──────────┘                    │
│                                                                     │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │   WhatsApp   │  │  Emails  │  │   Bots   │  │  Fiscal/Tax   │  │
│  │  Instances   │  │Templates │  │  Flows   │  │  (63 cols     │  │
│  │  Messages    │  │  Logs    │  │  Nodes   │  │   regras)     │  │
│  └──────────────┘  └──────────┘  └──────────┘  └───────────────┘  │
│                                                                     │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐                     │
│  │  ERP Mirror  │  │  Credit  │  │Prospecting│                     │
│  │ crm_clients  │  │ Analyses │  │  Results  │                     │
│  │ crm_orders   │  │  Audit   │  │           │                     │
│  │ crm_products │  │  Docs    │  │           │                     │
│  └──────────────┘  └──────────┘  └───────────┘                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Estatísticas Gerais

| Métrica | Valor |
|---------|-------|
| Total de tabelas | ~105 |
| Total de views | 3 |
| Total de funções PL/pgSQL | ~30 |
| Total de enums | ~20 |
| Total de políticas RLS | ~200+ |
| Total de triggers | ~15 |
| Tabelas com >30 colunas | 5 (companies:55, products:60, regras_tributacao:63, orders:41, proposals:36) |
| Tabelas de auditoria (imutáveis) | 5 |
| Edge Functions | ~35 |
| Hooks React | ~45 |
| Páginas | ~25 |

---

*Relatório gerado automaticamente. Nenhuma alteração foi realizada no banco de dados ou no código.*
