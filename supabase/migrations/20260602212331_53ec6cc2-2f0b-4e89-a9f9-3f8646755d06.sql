
-- 1. Relax CHECK on product_attribute_mapping.crm_source to include 'derived'
ALTER TABLE public.product_attribute_mapping
  DROP CONSTRAINT IF EXISTS product_attribute_mapping_crm_source_check;
ALTER TABLE public.product_attribute_mapping
  ADD CONSTRAINT product_attribute_mapping_crm_source_check
  CHECK (crm_source IN ('ficha_tecnica','product_column','derived'));

-- 2. Add 'skipped_out_of_scope' to attribute_sync_queue.status CHECK
ALTER TABLE public.attribute_sync_queue
  DROP CONSTRAINT IF EXISTS attribute_sync_queue_status_check;
ALTER TABLE public.attribute_sync_queue
  ADD CONSTRAINT attribute_sync_queue_status_check
  CHECK (status IN ('pending','processing','sent','error','blocked_no_erp_code','blocked_validation','cancelled','skipped_out_of_scope','retry'));

-- 3. Update extract_attribute_value to handle source 'derived' / path 'tipo_solda'
CREATE OR REPLACE FUNCTION public.extract_attribute_value(
  p_product products,
  p_source text,
  p_path text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_parts text[];
  v_current jsonb;
  v_result text;
  v_sanfona jsonb;
  v_sanfona_ativa boolean;
  v_sanfona_local text;
  v_sanfona_valor numeric;
  v_base_num numeric;
  v_effective numeric;
  v_text text;
  v_profile text;
  v_subgroup_label text;
BEGIN
  -- ─────────────── DERIVED ───────────────
  IF p_source = 'derived' THEN
    IF p_path = 'tipo_solda' THEN
      IF p_product.grupo_id IS NULL OR p_product.subgrupo_id IS NULL THEN
        RETURN NULL;
      END IF;
      SELECT ficha_profile INTO v_profile
      FROM public.product_groups
      WHERE id = p_product.grupo_id;
      IF v_profile IS NULL OR v_profile NOT IN ('saco_liso','saco_impresso','stand_up_liso','stand_up_impresso') THEN
        RETURN NULL;
      END IF;
      SELECT label INTO v_subgroup_label
      FROM public.product_subgroups
      WHERE id = p_product.subgrupo_id;
      IF v_subgroup_label IS NULL OR trim(v_subgroup_label) = '' THEN
        RETURN NULL;
      END IF;
      RETURN v_subgroup_label;
    END IF;
    RETURN NULL;
  END IF;

  -- ─────────────── PRODUCT COLUMN ───────────────
  IF p_source = 'product_column' THEN
    IF p_path IN ('width','length') THEN
      v_sanfona := COALESCE(p_product.ficha_tecnica, '{}'::jsonb) -> 'sanfona';
      v_sanfona_ativa := COALESCE((v_sanfona ->> 'ativa')::boolean, false);
      v_sanfona_local := v_sanfona ->> 'local';
      BEGIN
        v_sanfona_valor := NULLIF(v_sanfona ->> 'valor','')::numeric;
      EXCEPTION WHEN others THEN
        v_sanfona_valor := NULL;
      END;

      IF p_path = 'width' THEN
        v_base_num := p_product.width;
      ELSE
        v_base_num := p_product.length;
      END IF;

      IF v_base_num IS NULL THEN
        RETURN NULL;
      END IF;

      v_effective := v_base_num;
      IF v_sanfona_ativa
         AND v_sanfona_valor IS NOT NULL
         AND v_sanfona_valor > 0
         AND ((p_path = 'width'  AND v_sanfona_local = 'Lateral')
           OR (p_path = 'length' AND v_sanfona_local = 'Fundo'))
      THEN
        v_effective := v_base_num + v_sanfona_valor;
      END IF;

      IF v_effective = trunc(v_effective) THEN
        v_text := trunc(v_effective)::text;
      ELSE
        v_text := v_effective::text;
      END IF;
      RETURN v_text;
    END IF;

    CASE p_path
      WHEN 'thickness' THEN RETURN p_product.thickness::text;
      WHEN 'weight' THEN RETURN p_product.weight::text;
      WHEN 'fator_kg' THEN RETURN p_product.fator_kg::text;
      WHEN 'fator_milheiro' THEN RETURN p_product.fator_milheiro::text;
      ELSE RETURN NULL;
    END CASE;
  END IF;

  -- ─────────────── FICHA TECNICA (jsonb path) ───────────────
  IF p_product.ficha_tecnica IS NULL THEN
    RETURN NULL;
  END IF;

  v_parts := string_to_array(p_path, '.');
  v_current := p_product.ficha_tecnica;

  FOR i IN 1..array_length(v_parts,1) LOOP
    IF v_current IS NULL OR jsonb_typeof(v_current) <> 'object' THEN
      RETURN NULL;
    END IF;
    v_current := v_current -> v_parts[i];
  END LOOP;

  IF v_current IS NULL OR jsonb_typeof(v_current) = 'null' THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(v_current) = 'string' THEN
    v_result := v_current #>> '{}';
  ELSE
    v_result := v_current::text;
  END IF;

  RETURN v_result;
END;
$function$;

-- 4. Recriar trigger para reagir também a grupo_id e subgrupo_id
DROP TRIGGER IF EXISTS trg_detect_dirty_attributes ON public.products;
CREATE TRIGGER trg_detect_dirty_attributes
  AFTER INSERT OR UPDATE OF ficha_tecnica, width, length, thickness, weight, erp_product_code, grupo_id, subgrupo_id
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.detect_dirty_attributes();
