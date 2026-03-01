
-- 1. Rename columns in products table
ALTER TABLE public.products RENAME COLUMN category TO tipo;
ALTER TABLE public.products RENAME COLUMN material TO grupo;
ALTER TABLE public.products RENAME COLUMN color TO subgrupo;

-- 2. Rename lookup tables
ALTER TABLE public.product_categories RENAME TO product_types;
ALTER TABLE public.product_materials RENAME TO product_groups;
ALTER TABLE public.product_colors RENAME TO product_subgroups;

-- 3. Create product_families table
CREATE TABLE public.product_families (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID REFERENCES public.tenants(id)
);

-- 4. Create product_classes table
CREATE TABLE public.product_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID REFERENCES public.tenants(id)
);

-- 5. Add family_id and class_id to products
ALTER TABLE public.products ADD COLUMN family_id UUID REFERENCES public.product_families(id);
ALTER TABLE public.products ADD COLUMN class_id UUID REFERENCES public.product_classes(id);

-- 6. Add tenant_id to renamed lookup tables (if not exists)
ALTER TABLE public.product_types ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.product_groups ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.product_subgroups ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 7. Enable RLS on new tables
ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_classes ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_families
CREATE POLICY "Authenticated users can read product_families" ON public.product_families
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product_families" ON public.product_families
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_families" ON public.product_families
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete product_families" ON public.product_families
  FOR DELETE TO authenticated USING (true);

-- RLS policies for product_classes
CREATE POLICY "Authenticated users can read product_classes" ON public.product_classes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product_classes" ON public.product_classes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_classes" ON public.product_classes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete product_classes" ON public.product_classes
  FOR DELETE TO authenticated USING (true);

-- 8. Update compute_product_erp_hash function to use new column names
CREATE OR REPLACE FUNCTION public.compute_product_erp_hash(p products)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT encode(
    sha256(
      convert_to(
        coalesce(p.sku,'') || '|' ||
        coalesce(p.name,'') || '|' ||
        coalesce(p.description,'') || '|' ||
        coalesce(p.tipo,'') || '|' ||
        coalesce(p.subcategory,'') || '|' ||
        coalesce(p.unit_measure,'') || '|' ||
        coalesce(p.ncm_code,'') || '|' ||
        coalesce(p.grupo,'') || '|' ||
        coalesce(p.subgrupo,'') || '|' ||
        coalesce(p.weight::text,'') || '|' ||
        coalesce(p.erp_versao,'') || '|' ||
        coalesce(p.tipo_item,'') || '|' ||
        coalesce(p.tipo_ficha::text,'') || '|' ||
        coalesce(p.erp_grupo,'') || '|' ||
        coalesce(p.erp_subgrupo,'') || '|' ||
        coalesce(p.erp_empresa::text,'1') || '|' ||
        coalesce(p.erp_versao_detalhes,'') || '|' ||
        coalesce(p.erp_versao_roteiro::text,'') || '|' ||
        coalesce(p.erp_versao_situacao,''),
        'UTF8'
      )
    ),
    'hex'
  );
$function$;

-- 9. Update search_customers_paginated and other functions referencing products.category if any
-- (No direct references found in DB functions to products.category)
