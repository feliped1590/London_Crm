
-- ============================================================
-- PRIORIDADE 1: Migrar tipo/grupo/subgrupo de TEXT → FK
-- ============================================================

-- Passo 1: Criar novas colunas UUID
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tipo_id uuid;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS grupo_id uuid;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subgrupo_id uuid;

-- Passo 2: Popular os IDs com base no texto existente
UPDATE public.products p
SET tipo_id = t.id
FROM public.product_types t
WHERE p.tipo = t.value AND p.tenant_id = t.tenant_id
AND p.tipo IS NOT NULL AND p.tipo_id IS NULL;

UPDATE public.products p
SET grupo_id = g.id
FROM public.product_groups g
WHERE p.grupo = g.value AND p.tenant_id = g.tenant_id
AND p.grupo IS NOT NULL AND p.grupo_id IS NULL;

UPDATE public.products p
SET subgrupo_id = s.id
FROM public.product_subgroups s
WHERE p.subgrupo = s.value AND p.tenant_id = s.tenant_id
AND p.subgrupo IS NOT NULL AND p.subgrupo_id IS NULL;

-- Passo 3: Criar FK constraints
ALTER TABLE public.products
  ADD CONSTRAINT fk_products_tipo FOREIGN KEY (tipo_id) REFERENCES public.product_types(id),
  ADD CONSTRAINT fk_products_grupo FOREIGN KEY (grupo_id) REFERENCES public.product_groups(id),
  ADD CONSTRAINT fk_products_subgrupo FOREIGN KEY (subgrupo_id) REFERENCES public.product_subgroups(id);

-- Passo 4: Criar índices para performance multiempresa
CREATE INDEX IF NOT EXISTS idx_products_tipo_id ON public.products(tipo_id);
CREATE INDEX IF NOT EXISTS idx_products_grupo_id ON public.products(grupo_id);
CREATE INDEX IF NOT EXISTS idx_products_subgrupo_id ON public.products(subgrupo_id);
CREATE INDEX IF NOT EXISTS idx_products_family_id ON public.products(family_id);
CREATE INDEX IF NOT EXISTS idx_products_class_id ON public.products(class_id);

-- Passo 5: Remover colunas TEXT antigas
ALTER TABLE public.products DROP COLUMN IF EXISTS tipo;
ALTER TABLE public.products DROP COLUMN IF EXISTS grupo;
ALTER TABLE public.products DROP COLUMN IF EXISTS subgrupo;

-- ============================================================
-- PRIORIDADE 2: Atualizar compute_product_erp_hash
-- ============================================================
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
        coalesce(p.tipo_id::text,'') || '|' ||
        coalesce(p.grupo_id::text,'') || '|' ||
        coalesce(p.subgrupo_id::text,'') || '|' ||
        coalesce(p.family_id::text,'') || '|' ||
        coalesce(p.class_id::text,'') || '|' ||
        coalesce(p.subcategory,'') || '|' ||
        coalesce(p.unit_measure,'') || '|' ||
        coalesce(p.ncm_code,'') || '|' ||
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
