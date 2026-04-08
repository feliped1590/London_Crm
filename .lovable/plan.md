

# Plano: Mapeamento Completo dos Campos Restantes do Payload ERP

## Estado Atual (confirmado no banco)

| Campo | Situação | Ação |
|-------|----------|------|
| `freight_type` | Existe em `orders` (TEXT) — valores: `CIF`, `REDESPACHO` | Criar tabela de mapping |
| `sales_rep_id` | **NÃO existe** em `orders` | Adicionar coluna |
| `payment_terms` | **NÃO existe** em `orders` | Adicionar coluna |
| `payment_method` | **NÃO existe** em `orders` | Adicionar coluna |
| `sale_type` | **NÃO existe** em `order_items` | Adicionar coluna |
| `erp_vendor_code` | **NÃO existe** em `sales_reps` | Adicionar coluna |
| Mapper fallbacks | `tipo_venda ?? 1`, `forma_recebimento ?? 1`, `freight || '1'`, `vendedor ?? 0`, `pagto default [30]` | Remover TODOS |

---

## Etapa 1 — Migration SQL

### 1.1 Três tabelas de mapping (sem FK em tenant_id)

```sql
-- freight_type_erp_mapping
CREATE TABLE public.freight_type_erp_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  crm_freight_type TEXT NOT NULL,
  erp_freight_code TEXT NOT NULL,   -- ERP espera string no frete
  erp_freight_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, crm_freight_type)
);

-- sale_type_erp_mapping
CREATE TABLE public.sale_type_erp_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  crm_sale_type TEXT NOT NULL,
  erp_sale_type_code INTEGER NOT NULL,
  erp_sale_type_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, crm_sale_type)
);

-- payment_method_erp_mapping
CREATE TABLE public.payment_method_erp_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  crm_payment_method TEXT NOT NULL,
  erp_payment_code INTEGER NOT NULL,
  erp_payment_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, crm_payment_method)
);
```

RLS + policies (select autenticado, manage admin) em cada uma.

### 1.2 Campos novos nas tabelas existentes

```sql
ALTER TABLE public.sales_reps ADD COLUMN erp_vendor_code INTEGER;
ALTER TABLE public.orders ADD COLUMN payment_terms TEXT;
ALTER TABLE public.orders ADD COLUMN payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN sales_rep_id UUID REFERENCES public.sales_reps(id);
ALTER TABLE public.order_items ADD COLUMN sale_type TEXT DEFAULT 'venda_tributada';
```

### 1.3 Dados iniciais (via insert tool, não migration)

**Frete:**
| crm_freight_type | erp_freight_code | description |
|---|---|---|
| CIF | 0 | CIF |
| FOB | 1 | FOB |
| REDESPACHO | 2 | RTR |
| PCIF | 3 | PCIF |
| PFOB | 4 | PFOB |
| SEM | 9 | SEM FRETE |

**Tipo de venda:**
| crm_sale_type | erp_sale_type_code | description |
|---|---|---|
| venda_tributada | 1 | VENDA TRIBUTADA |
| bonificacao | 2 | BONIFICAÇÃO |
| remessa_amostra | 3 | REMESSA AMOSTRA |

**Forma de pagamento:**
| crm_payment_method | erp_payment_code | description |
|---|---|---|
| dinheiro | 1 | DINHEIRO |
| cheque | 2 | CHEQUE |
| compensacao | 3 | COMPENSAÇÃO |
| doc | 4 | DOC |
| ted | 5 | TED |
| antecipado | 6 | ANTECIPADO |
| boleto | 7 | BOLETO |

---

## Etapa 2 — Validator (`order-validator.ts`)

Adicionar à interface `OrderToValidate`:

```typescript
erp_vendedor?: number | null;
erp_frete?: string | null;
items: Array<{
  ...existing,
  tipo_venda?: number | null;
}>;
payment_conditions?: Array<{
  forma_recebimento?: number | null;
}>;
```

Novas validações (sem fallback):

- `erp_vendedor` ausente → "Vendedor não integrado ao ERP (erp_vendor_code não definido)"
- `erp_frete` ausente → "Frete não mapeado para o ERP"
- Cada item `tipo_venda` ausente → "Item N: tipo de venda não mapeado para o ERP"
- `payment_conditions` vazio → "Condições de pagamento não definidas"
- Cada parcela `forma_recebimento` ausente → "Parcela N: forma de recebimento não mapeada"

---

## Etapa 3 — Mapper (`order-mapper.ts`)

### Interface atualizada

```typescript
export interface CRMOrderForSync {
  ...existing obrigatórios,
  freight_type: string;       // código ERP resolvido (obrigatório)
  erp_vendedor: number;       // obrigatório
  payment_conditions: CRMPaymentCondition[];  // obrigatório (array não-vazio)
}

export interface CRMOrderItemForSync {
  ...existing,
  tipo_venda: number;         // obrigatório
}

export interface CRMPaymentCondition {
  parcela: number;
  dias: number;
  forma_recebimento: number;  // obrigatório
  tipo?: string;
}
```

### Remover fallbacks

- `tipo_venda ?? 1` → campo obrigatório direto
- `forma_recebimento ?? 1` → campo obrigatório direto
- `freight_type || '1'` → campo obrigatório direto
- `erp_vendedor ?? 0` → campo obrigatório direto
- `pagto default [{dias:30,...}]` → obrigatório receber `payment_conditions`

### Parser de pagamento (função auxiliar)

```typescript
export function parsePaymentTerms(
  terms: string,
  formaRecebimento: number
): CRMPaymentCondition[] {
  const dias = terms.split('/').map(Number).filter(d => d > 0);
  if (dias.length === 0) throw new Error('payment_terms inválido');
  return dias.map((d, i) => ({
    parcela: i + 1,
    dias: d,
    forma_recebimento: formaRecebimento,
    tipo: 'P',
  }));
}
```

---

## Etapa 4 — Edge Function (`process-order-sync`)

### 4.1 Resolver vendedor

```typescript
// orders.sales_rep_id → sales_reps.erp_vendor_code
// Fallback: companies.sales_rep_id
const repId = order.sales_rep_id || company?.sales_rep_id;
const { data: salesRep } = await supabase
  .from('sales_reps')
  .select('id, name, erp_vendor_code')
  .eq('id', repId)
  .maybeSingle();
if (!salesRep?.erp_vendor_code) throw Error('Vendedor não integrado ao ERP');
```

### 4.2 Resolver frete

```typescript
const { data: freightMapping } = await supabase
  .from('freight_type_erp_mapping')
  .select('erp_freight_code, erp_freight_description')
  .eq('crm_freight_type', order.freight_type)
  .eq('is_active', true)
  .maybeSingle();
if (!freightMapping) throw Error('Frete não mapeado para o ERP');
```

### 4.3 Resolver tipo de venda (por item)

Para cada item, buscar mapping de `sale_type` via `sale_type_erp_mapping`. Otimizar com uma query única para todos os tipos distintos.

### 4.4 Resolver forma de pagamento

```typescript
const { data: paymentMapping } = await supabase
  .from('payment_method_erp_mapping')
  .select('erp_payment_code, erp_payment_description')
  .eq('crm_payment_method', order.payment_method)
  .eq('is_active', true)
  .maybeSingle();
if (!paymentMapping) throw Error('Forma de pagamento não mapeada para o ERP');
```

### 4.5 Parsear condições de pagamento

```typescript
const paymentConditions = parsePaymentTerms(
  order.payment_terms || '30',
  paymentMapping.erp_payment_code
);
```

### 4.6 Montar `CRMOrderForSync`

Todos os campos resolvidos dinamicamente, sem nenhum fallback.

### 4.7 Observabilidade expandida

Metadata no log de sucesso/erro:

```typescript
metadata: {
  ...existentes (empresa, usuario, tipo_pedido),
  seller_name, erp_vendor_code,
  freight_type, erp_freight_code,
  payment_method, erp_payment_code,
  payment_terms,
  items_sale_types: [...],  // resumo por item
}
```

### 4.8 Atualizar SELECT do pedido

Adicionar `sales_rep_id, payment_terms, payment_method` ao SELECT, e `sales_rep_id` da company.

---

## Arquivos Impactados

| Arquivo | Ação |
|---------|------|
| Migration SQL (novo) | 3 tabelas + 5 colunas novas |
| Insert SQL (dados) | ~16 registros de mapping |
| `order-validator.ts` | +5 validações (vendedor, frete, tipo_venda, pagamento, parcelas) |
| `order-mapper.ts` | Interfaces obrigatórias, remover fallbacks, parser de parcelas |
| `process-order-sync/index.ts` | 4 queries de resolução + payload completo + logs expandidos |

