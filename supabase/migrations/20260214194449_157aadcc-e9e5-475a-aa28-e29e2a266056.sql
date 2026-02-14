
-- =====================================================
-- FASE 4D: Integração de Pedidos ERP (Tabelas 14 + 196)
-- =====================================================

-- =====================================================
-- 1. ALTER TABLE orders - Adicionar 13 colunas
-- =====================================================

-- 1.1 Campo origin (CRÍTICO - define regras de precedência)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'CRM';

-- Adicionar CHECK constraint para origin
ALTER TABLE public.orders
ADD CONSTRAINT orders_origin_check CHECK (origin IN ('CRM', 'ERP'));

-- 1.2 Campos comerciais
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_date DATE,
ADD COLUMN IF NOT EXISTS erp_status TEXT,
ADD COLUMN IF NOT EXISTS erp_rep_code TEXT,
ADD COLUMN IF NOT EXISTS total_goods NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS total_discount NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS freight_value NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS freight_type TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS valid_until DATE;

-- 1.3 Campos de rastreio ERP
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS erp_order_code TEXT,
ADD COLUMN IF NOT EXISTS erp_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS erp_last_update_date TIMESTAMP WITH TIME ZONE;

-- 1.4 Corrigir constraint UNIQUE(number) → UNIQUE(tenant_id, number)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_number_key;
ALTER TABLE public.orders ADD CONSTRAINT orders_tenant_number_key UNIQUE (tenant_id, number);

-- 1.5 Índice UNIQUE parcial para erp_order_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tenant_erp_code
ON public.orders (tenant_id, erp_order_code) WHERE erp_order_code IS NOT NULL;

-- 1.6 Índices de performance
CREATE INDEX IF NOT EXISTS idx_orders_tenant_order_date
ON public.orders (tenant_id, order_date);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_erp_status
ON public.orders (tenant_id, erp_status) WHERE erp_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_tenant_origin
ON public.orders (tenant_id, origin);

-- =====================================================
-- 2. ALTER TABLE order_items - Adicionar tenant_id + 7 colunas
-- =====================================================

-- 2.1 Adicionar tenant_id (CRÍTICO)
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- 2.2 Popular tenant_id a partir de orders
UPDATE public.order_items oi
SET tenant_id = o.tenant_id
FROM public.orders o
WHERE oi.order_id = o.id
AND oi.tenant_id IS NULL;

-- 2.3 Definir default e NOT NULL
ALTER TABLE public.order_items
ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Garantir que não ficou nenhum NULL
UPDATE public.order_items
SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE tenant_id IS NULL;

ALTER TABLE public.order_items
ALTER COLUMN tenant_id SET NOT NULL;

-- 2.4 FK para tenants
ALTER TABLE public.order_items
ADD CONSTRAINT order_items_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- 2.5 Campos comerciais do item
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS erp_status TEXT,
ADD COLUMN IF NOT EXISTS item_date DATE,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS delivery_date DATE,
ADD COLUMN IF NOT EXISTS erp_item_sequence INTEGER,
ADD COLUMN IF NOT EXISTS erp_synced_at TIMESTAMP WITH TIME ZONE;

-- 2.6 Índices order_items
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_order_sort
ON public.order_items (tenant_id, order_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_order_items_erp_seq
ON public.order_items (order_id, erp_item_sequence) WHERE erp_item_sequence IS NOT NULL;

-- =====================================================
-- 3. CREATE TABLE order_erp_data
-- =====================================================
CREATE TABLE IF NOT EXISTS public.order_erp_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
    operation_type TEXT,
    payment_condition TEXT,
    carrier_code TEXT,
    seller_code TEXT,
    erp_order_type TEXT,
    invoice_number TEXT,
    currency_code TEXT,
    commission_pct NUMERIC(5,2),
    market_code TEXT,
    business_unit TEXT,
    session_id INTEGER,
    erp_registered_at DATE,
    erp_modified_at DATE,
    extra_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- 4. CREATE TABLE order_item_erp_data
-- =====================================================
CREATE TABLE IF NOT EXISTS public.order_item_erp_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    order_item_id UUID NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
    unit_measure TEXT,
    cost_price NUMERIC(15,5),
    cost_center TEXT,
    account_code TEXT,
    cfop TEXT,
    list_price NUMERIC(15,2),
    detail_code TEXT,
    batch_code TEXT,
    packing_list_number TEXT,
    extra_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- 5. RLS - order_erp_data
-- =====================================================
ALTER TABLE public.order_erp_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_erp_data_select"
ON public.order_erp_data FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "order_erp_data_insert"
ON public.order_erp_data FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "order_erp_data_update"
ON public.order_erp_data FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "order_erp_data_delete"
ON public.order_erp_data FOR DELETE TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

-- =====================================================
-- 6. RLS - order_item_erp_data
-- =====================================================
ALTER TABLE public.order_item_erp_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_item_erp_data_select"
ON public.order_item_erp_data FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "order_item_erp_data_insert"
ON public.order_item_erp_data FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "order_item_erp_data_update"
ON public.order_item_erp_data FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "order_item_erp_data_delete"
ON public.order_item_erp_data FOR DELETE TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

-- =====================================================
-- 7. Triggers updated_at
-- =====================================================
CREATE TRIGGER update_order_erp_data_updated_at
BEFORE UPDATE ON public.order_erp_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_order_item_erp_data_updated_at
BEFORE UPDATE ON public.order_item_erp_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 8. Índices auxiliares
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_order_erp_data_tenant
ON public.order_erp_data (tenant_id);

CREATE INDEX IF NOT EXISTS idx_order_item_erp_data_tenant
ON public.order_item_erp_data (tenant_id);
