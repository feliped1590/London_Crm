
-- Criar enum
CREATE TYPE public.dimension_profile AS ENUM ('full', 'partial', 'none');

-- Adicionar coluna
ALTER TABLE public.product_groups
ADD COLUMN dimension_profile public.dimension_profile NOT NULL DEFAULT 'none';

-- Popular dados existentes
UPDATE public.product_groups SET dimension_profile = 'full' WHERE LOWER(label) LIKE '%saco%';
UPDATE public.product_groups SET dimension_profile = 'partial' WHERE LOWER(label) LIKE '%bobina%';

-- Índice
CREATE INDEX idx_product_groups_dimension_profile ON public.product_groups (dimension_profile);
