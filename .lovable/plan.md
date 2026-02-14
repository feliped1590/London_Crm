
# Fase 4C -- Integracao de Produtos ERP (Tabela 9 - MATERIAL)

## Resumo

Expandir a tabela `products` com 12 colunas comerciais/rastreio e criar tabela auxiliar `product_erp_data` para dados operacionais do ERP CIGAM. Criar Edge Function `erp-import-products` para ETL com merge inteligente.

## Decisoes Arquiteturais Consolidadas

### 1. Fonte Oficial de Preco
- `unit_price` = preco oficial do CRM (usado em propostas/pedidos)
- `price_cash` / `price_term` = referencia ERP (apenas informativo, nunca usado em calculos)
- ERP nunca sobrescreve `unit_price`. Na importacao inicial, se `unit_price` for NULL, pode ser populado com `price_cash` como sugestao

### 2. Controle de Ativo
- `active` = controlado exclusivamente pelo CRM (nunca alterado por sync ERP)
- `erp_status` = status vindo do ERP (ATIVO/INATIVO/SERVICO/OBSOLETO/MODELO)
- Na importacao: INSERT novo produto → `active = true` (default); UPDATE → `active` nao e tocado
- Dashboard pode alertar divergencias (ex: ativo no CRM mas OBSOLETO no ERP)

### 3. Tipagem de erp_status
- TEXT com CHECK constraint (nao ENUM)
- `CHECK (erp_status IN ('ATIVO','INATIVO','SERVICO','OBSOLETO','MODELO'))`
- Mais flexivel que ENUM para adicionar valores futuros

### 4. Category/Subcategory
- Manter como TEXT simples (nao criar tabela product_categories)
- Grupos/subgrupos ERP sao codigos livres que variam por tenant
- Migrar para tabela normalizada somente se surgir necessidade de hierarquia navegavel

### 5. Peso
- Sempre em KG (padrao logistico brasileiro e do ERP CIGAM)
- Nao adicionar weight_unit (simplicidade)
- Uso: estimativa de frete comercial

### 6. Indices product_erp_data
- Apenas UNIQUE(product_id), sem indice redundante (tenant_id, product_id)
- Filtro por tenant ocorre na tabela products via JOIN

---

## O que sera feito

### 1. Migration SQL

#### ALTER TABLE products — adicionar 12 colunas

| Coluna | Tipo | Nullable | Default | Justificativa |
|---|---|---|---|---|
| subcategory | TEXT | SIM | NULL | Sub_Grupo ERP para hierarquia catalogo |
| reference | TEXT | SIM | NULL | Referencia comercial/fabricante |
| weight | NUMERIC(15,5) | SIM | NULL | Peso em KG para calculo frete |
| price_cash | NUMERIC(15,2) | SIM | NULL | Preco a vista ERP (informativo) |
| price_term | NUMERIC(15,2) | SIM | NULL | Preco a prazo ERP (informativo) |
| warranty_months | INTEGER | SIM | NULL | Garantia venda em meses |
| erp_status | TEXT | SIM | NULL | Status ERP com CHECK constraint |
| unit_sale | TEXT | SIM | NULL | Unidade venda ERP |
| abc_classification | CHAR(1) | SIM | NULL | Classificacao ABC com CHECK (A/B/C) |
| erp_product_code | TEXT | SIM | NULL | Codigo material ERP (chave merge) |
| erp_synced_at | TIMESTAMPTZ | SIM | NULL | Data/hora ultima sincronizacao |
| erp_last_update_date | TIMESTAMPTZ | SIM | NULL | Controle sync incremental |

#### CREATE TABLE product_erp_data

```text
product_erp_data
+-- id                   UUID PK DEFAULT gen_random_uuid()
+-- tenant_id            UUID NOT NULL (FK tenants)
+-- product_id           UUID NOT NULL UNIQUE (FK products ON DELETE CASCADE)
+-- center_control       TEXT
+-- parent_child_qty     NUMERIC(15,6)
+-- cost_price           NUMERIC(15,5)
+-- freight_pct          NUMERIC(5,2)
+-- packaging_pct        NUMERIC(5,2)
+-- commission_pct       NUMERIC(5,2)
+-- readjust_pct         NUMERIC(5,2)
+-- readjust_date        DATE
+-- erp_product_type_id  INTEGER
+-- manufacturer_code    TEXT
+-- factory_code         TEXT
+-- short_code           INTEGER
+-- purchase_converter   NUMERIC(15,7)
+-- sale_converter       NUMERIC(15,7)
+-- finance_charges_pct  NUMERIC(5,3)
+-- freight_value        NUMERIC(15,2)
+-- volume               NUMERIC(15,6)
+-- purchase_unit        TEXT
+-- packaging_weight     NUMERIC(15,5)
+-- purchase_warranty    INTEGER
+-- business_unit        TEXT
+-- erp_price_table_code TEXT
+-- erp_registered_at    DATE
+-- erp_modified_at      DATE
+-- extra_data           JSONB DEFAULT '{}'
+-- created_at           TIMESTAMPTZ DEFAULT now()
+-- updated_at           TIMESTAMPTZ DEFAULT now()
```

#### Indices

| Indice | Colunas | Tipo |
|---|---|---|
| idx_products_tenant_erp_code | (tenant_id, erp_product_code) WHERE erp_product_code IS NOT NULL | UNIQUE parcial |
| idx_products_tenant_category | (tenant_id, category) | Btree |
| idx_products_tenant_active | (tenant_id, active) | Btree |

#### RLS para product_erp_data

- SELECT/INSERT/UPDATE/DELETE isolado por tenant_id via user_tenants
- Mesmo padrao de company_erp_fiscal e contact_erp_data

#### Trigger updated_at para product_erp_data

- Reutilizar funcao update_updated_at_column() existente

### 2. Edge Function erp-import-products

Fluxo:
1. Recebe array de materiais ERP com tenant_id
2. Normaliza: erp_status derivado de Tipo, datas ISO, numericos
3. Merge em products: prioridade (tenant_id, sku), fallback (tenant_id, erp_product_code)
4. INSERT: active = true (default), unit_price = price_cash se NULL
5. UPDATE: active NAO e tocado, unit_price NAO e tocado
6. Upsert em product_erp_data (campos operacionais)
7. Conflitos → import_conflict_log
8. Batches de 100

### 3. Regras de Precedencia Comercial

```text
Propostas/Pedidos:
  1. Tabela de Precos do Cliente (pricing_tables)
  2. Regra por Produto (pricing_table_rules)
  3. Tabela Padrao (is_default)
  4. products.unit_price (preco base CRM)
  
  price_cash/price_term = NUNCA usados em calculos automaticos
  Exibidos como "Referencia ERP" para consulta do vendedor
```

---

## Secao Tecnica

### Arquivos criados/modificados

| Arquivo | Acao |
|---|---|
| Migration SQL | ALTER products + CREATE product_erp_data + indices + RLS + trigger |
| `supabase/functions/erp-import-products/index.ts` | Nova Edge Function ETL |

### Payload de entrada (erp-import-products)

```text
POST /erp-import-products
{
  "tenant_id": "uuid",
  "records": [
    {
      "erp_product_code": "MAT-001",
      "name": "Fita Adesiva Industrial 50mm",
      "description": "Aplicacao em embalagens industriais",
      "category": "FITAS",
      "subcategory": "ADESIVAS",
      "reference": "REF-FT50",
      "unit_measure": "RL",
      "unit_sale": "CX",
      "weight": 0.350,
      "price_cash": 25.90,
      "price_term": 28.50,
      "warranty_months": 12,
      "erp_status": "ATIVO",
      "abc_classification": "A",
      "ncm_code": "39199090",
      "center_control": "CC01",
      "cost_price": 15.30,
      "commission_pct": 5.00,
      "freight_pct": 3.50,
      "manufacturer_code": "3M",
      "factory_code": "3M-FT50-IND",
      "purchase_converter": 1.0,
      "sale_converter": 12.0,
      "purchase_unit": "RL",
      "business_unit": "EMBALAGENS",
      "erp_registered_at": "2020-03-15",
      "erp_modified_at": "2025-01-10"
    }
  ]
}
```

### Logica de merge

```text
Para cada registro:
  1. normalizar(registro)
  2. existing = buscar por (tenant_id, sku) onde sku = erp_product_code
     || buscar por (tenant_id, erp_product_code)
  3. Se existing:
     - detectar_conflitos(existing, registro)
     - NÃO alterar active
     - NÃO alterar unit_price
     - Atualizar demais campos comerciais + erp_status
     - Upsert product_erp_data
     - resultado = "updated"
  4. Se nao existing:
     - INSERT products com active = true
     - Se unit_price IS NULL, usar price_cash como sugestao
     - INSERT product_erp_data
     - resultado = "inserted"
```

### Seguranca

- Funcao usa SUPABASE_SERVICE_ROLE_KEY para bypass de RLS
- verify_jwt = false no config.toml
- Valida tenant_id obrigatorio
- Operacoes tipadas via SDK (sem SQL arbitrario)
