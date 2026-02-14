
# Fase 4D -- Integracao de Pedidos ERP (Tabelas 14 PEDIDO + 196 ITEM PEDIDO)

## Resumo

Expandir tabelas `orders` (12 colunas) e `order_items` (8 colunas, incluindo tenant_id). Criar tabelas auxiliares `order_erp_data` e `order_item_erp_data`. Criar Edge Function `erp-import-orders` para ETL com regras de precedencia por origin.

## Decisoes Estrategicas Consolidadas

### 1. Campo origin (NOVO - CRITICO)
- Coluna `origin TEXT NOT NULL CHECK (origin IN ('CRM','ERP'))` em orders
- Pedidos criados manualmente → origin = 'CRM'
- Pedidos importados do ERP → origin = 'ERP'
- Elimina uso fragil de `created_by IS NULL` para definir precedencia
- DEFAULT 'CRM' para manter retrocompatibilidade

### 2. Regras de Precedencia por Origin

#### Se origin = 'ERP':
ERP **pode** atualizar:
- total_value, total_goods, total_discount
- freight_value, freight_type
- company_id (reatribuicao de empresa)
- erp_status, erp_synced_at, erp_last_update_date
- order_date, approved_at, valid_until
- observations

ERP **nao pode** alterar:
- status (ENUM CRM, soberano)

#### Se origin = 'CRM':
ERP pode **apenas** atualizar:
- erp_status
- erp_synced_at
- erp_last_update_date
- erp_order_code

ERP **nao pode** alterar:
- total_value, company_id, status, observations

### 3. Pedido Orfao (company_id)
- Se Cd_cliente nao encontra correspondencia em (tenant_id, erp_code) de companies → NAO inserir pedido
- Registrar conflito em import_conflict_log com tipo 'company_not_found'
- company_id NULL nao permitido para pedidos ERP

### 4. Protecao contra Regressao de Versao
- Antes de atualizar: se `erp_last_update_date` atual > `erp_last_update_date` recebido → PULAR
- Evita sobrescrever com dado mais antigo

### 5. Subtotal sempre calculado pelo CRM
- `subtotal = quantity * unit_price * (1 - discount_percent/100)`
- ERP pode enviar valor, mas CRM recalcula sempre

### 6. Regra de number/erp_order_code
- origin='ERP': number = Cd_pedido, erp_order_code = Cd_pedido
- origin='CRM': number gerado pelo CRM, erp_order_code preenchido apos sync

### 7. Status ERP (TEXT livre)
- erp_status TEXT sem CHECK (diferente de products)
- Situacoes de pedido ERP variam muito entre versoes CIGAM
- status ENUM CRM permanece soberano e intocado pelo ETL

---

## Estrutura Final Consolidada (orders)

### Estado atual: 13 colunas
id, number, proposal_id, company_id, contact_id, status, delivery_date, total_value, observations, created_by, created_at, updated_at, tenant_id

### Colunas novas: 13

| Coluna | Tipo | Nullable | Default | Justificativa |
|---|---|---|---|---|
| origin | TEXT NOT NULL | NAO | 'CRM' | Diferencia origem para regras de precedencia |
| order_date | DATE | SIM | NULL | Data do pedido ERP (Dt_pedido) |
| erp_status | TEXT | SIM | NULL | Situacao original ERP (informativo) |
| erp_rep_code | TEXT | SIM | NULL | Codigo representante ERP |
| total_goods | NUMERIC(15,2) | SIM | NULL | Total mercadorias antes desconto/frete |
| total_discount | NUMERIC(15,2) | SIM | NULL | Total desconto concedido |
| freight_value | NUMERIC(15,2) | SIM | NULL | Valor do frete |
| freight_type | TEXT | SIM | NULL | Tipo frete (CIF/FOB) |
| approved_at | TIMESTAMPTZ | SIM | NULL | Data aprovacao do pedido |
| valid_until | DATE | SIM | NULL | Data validade do pedido |
| erp_order_code | TEXT | SIM | NULL | Codigo pedido ERP (chave merge) |
| erp_synced_at | TIMESTAMPTZ | SIM | NULL | Ultima sincronizacao |
| erp_last_update_date | TIMESTAMPTZ | SIM | NULL | Controle sync incremental |

### Total apos alteracao: 26 colunas

### Alteracao de constraint:
- DROP UNIQUE(number) global
- ADD UNIQUE(tenant_id, number)

---

## Estrutura Final Consolidada (order_items)

### Estado atual: 13 colunas (sem tenant_id!)
id, order_id, product_id, description, quantity, unit_price, width, length, thickness, subtotal, sort_order, created_at, discount_percent

### Colunas novas: 8

| Coluna | Tipo | Nullable | Default | Justificativa |
|---|---|---|---|---|
| tenant_id | UUID NOT NULL | NAO | derivado | CRITICO - multi-tenant RLS |
| erp_status | TEXT | SIM | NULL | Situacao do item ERP |
| item_date | DATE | SIM | NULL | Data do item (pode diferir do pedido) |
| approved_at | TIMESTAMPTZ | SIM | NULL | Data aprovacao do item |
| commission_pct | NUMERIC(5,2) | SIM | NULL | Percentual comissao item |
| delivery_date | DATE | SIM | NULL | Prazo entrega especifico |
| erp_item_sequence | INTEGER | SIM | NULL | Sequencia original ERP |
| erp_synced_at | TIMESTAMPTZ | SIM | NULL | Ultima sincronizacao |

### Total apos alteracao: 21 colunas

---

## Tabelas ERP Auxiliares

### order_erp_data
- id, tenant_id, order_id (UNIQUE), operation_type, payment_condition, carrier_code, seller_code, erp_order_type, invoice_number, currency_code, commission_pct, market_code, business_unit, session_id, erp_registered_at, erp_modified_at, extra_data JSONB, created_at, updated_at

### order_item_erp_data
- id, tenant_id, order_item_id (UNIQUE), unit_measure, cost_price, cost_center, account_code, cfop, list_price, detail_code, batch_code, packing_list_number, extra_data JSONB, created_at, updated_at

---

## Indices

| Indice | Colunas |
|---|---|
| UNIQUE | (tenant_id, number) -- substitui UNIQUE(number) global |
| UNIQUE parcial | (tenant_id, erp_order_code) WHERE erp_order_code IS NOT NULL |
| idx_orders_tenant_order_date | (tenant_id, order_date) |
| idx_orders_tenant_erp_status | (tenant_id, erp_status) WHERE erp_status IS NOT NULL |
| idx_order_items_tenant_order_sort | (tenant_id, order_id, sort_order) |
| idx_order_items_erp_seq | (order_id, erp_item_sequence) WHERE erp_item_sequence IS NOT NULL |

---

## Estrategia de Merge

### Pedidos
1. Lookup empresa: (tenant_id, erp_code) em companies → se nao encontrar, REJEITAR + log
2. Buscar pedido: (tenant_id, number) → fallback (tenant_id, erp_order_code)
3. Se encontrou e erp_last_update_date atual > recebido → PULAR (regressao)
4. Se encontrou: aplicar regras de precedencia por origin
5. Se nao encontrou: INSERT com origin='ERP', status='pendente'
6. Upsert order_erp_data

### Itens
1. Lookup product_id: (tenant_id, erp_product_code) em products
2. Buscar item: (order_id, erp_item_sequence)
3. Se encontrou: UPDATE campos
4. Se nao encontrou: INSERT
5. Recalcular subtotal = quantity * unit_price * (1 - discount_percent/100)
6. Upsert order_item_erp_data

---

## Seguranca
- RLS multi-tenant em todas as novas tabelas
- Edge Function com SUPABASE_SERVICE_ROLE_KEY (bypass RLS)
- verify_jwt = false
- Batch de 50 pedidos
