
CREATE OR REPLACE FUNCTION public.extract_attribute_value(
  p_product products,
  p_source text,
  p_path text
) RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_parts text[];
  v_current jsonb;
  v_result text;
  v_sanfona jsonb;
  v_sanfona_ativa boolean;
  v_sanfona_local text;
  v_sanfona_valor numeric;
  v_base_num numeric;
  v_base_text text;
BEGIN
  IF p_source = 'product_column' THEN
    -- Sanfona: aplica concatenação em width (Lateral) ou length (Fundo)
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

      v_base_text := v_base_num::text;
      -- Remove ".0" desnecessário para inteiros (100.0 → 100)
      IF v_base_num = trunc(v_base_num) THEN
        v_base_text := trunc(v_base_num)::text;
      END IF;

      IF v_sanfona_ativa
         AND v_sanfona_valor IS NOT NULL
         AND v_sanfona_valor > 0
         AND ((p_path = 'width'  AND v_sanfona_local = 'Lateral')
           OR (p_path = 'length' AND v_sanfona_local = 'Fundo'))
      THEN
        DECLARE v_sanfona_text text;
        BEGIN
          v_sanfona_text := v_sanfona_valor::text;
          IF v_sanfona_valor = trunc(v_sanfona_valor) THEN
            v_sanfona_text := trunc(v_sanfona_valor)::text;
          END IF;
          RETURN v_base_text || '+' || v_sanfona_text;
        END;
      END IF;

      RETURN v_base_text;
    END IF;

    CASE p_path
      WHEN 'thickness' THEN RETURN p_product.thickness::text;
      WHEN 'weight' THEN RETURN p_product.weight::text;
      WHEN 'fator_kg' THEN RETURN p_product.fator_kg::text;
      WHEN 'fator_milheiro' THEN RETURN p_product.fator_milheiro::text;
      ELSE RETURN NULL;
    END CASE;
  END IF;

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

  IF jsonb_typeof(v_current) IN ('string','number','boolean') THEN
    v_result := trim(both '"' FROM v_current::text);
    RETURN v_result;
  END IF;

  RETURN v_current::text;
END;
$$;
