
-- 1. Adicionar colunas
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS nome_impresso TEXT NULL;
ALTER TABLE public.product_groups ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT false;

-- 2. Migração de dados inicial
UPDATE public.product_groups SET is_printed = true WHERE label ILIKE '%impresso%';

-- 3. Trigger de validação e normalização
CREATE OR REPLACE FUNCTION public.validate_nome_impresso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_is_printed BOOLEAN;
BEGIN
  SELECT is_printed INTO v_is_printed
  FROM product_groups
  WHERE id = NEW.grupo_id;

  IF v_is_printed = true AND (NEW.nome_impresso IS NULL OR TRIM(NEW.nome_impresso) = '') THEN
    RAISE EXCEPTION 'nome_impresso é obrigatório para produtos impressos';
  END IF;

  IF NEW.nome_impresso IS NOT NULL THEN
    NEW.nome_impresso := UPPER(TRIM(NEW.nome_impresso));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_nome_impresso
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_nome_impresso();

-- 4. Recriar índice de unicidade incluindo nome_impresso
DROP INDEX IF EXISTS public.idx_products_technical_uniqueness;

CREATE UNIQUE INDEX idx_products_technical_uniqueness
ON public.products (
  tenant_id,
  COALESCE(tipo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  COALESCE(grupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  COALESCE(subgrupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  COALESCE(family_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  COALESCE(class_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  COALESCE(width::text, '-1'),
  COALESCE(length::text, '-1'),
  COALESCE(thickness::text, '-1'),
  COALESCE(nome_impresso, '')
)
WHERE active = true;
