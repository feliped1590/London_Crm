
CREATE OR REPLACE FUNCTION public.extract_attribute_value(p_product products, p_source text, p_path text)
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
  v_uuid uuid;
  v_lookup text;
BEGIN
  IF p_source = 'derived' THEN
    IF p_path = 'tipo_solda' THEN
      IF p_product.grupo_id IS NULL OR p_product.subgrupo_id IS NULL THEN RETURN NULL; END IF;
      SELECT ficha_profile INTO v_profile FROM public.product_groups WHERE id = p_product.grupo_id;
      IF v_profile IS NULL OR v_profile NOT IN ('saco_liso','saco_impresso','stand_up_liso','stand_up_impresso') THEN RETURN NULL; END IF;
      SELECT label INTO v_subgroup_label FROM public.product_subgroups WHERE id = p_product.subgrupo_id;
      IF v_subgroup_label IS NULL OR trim(v_subgroup_label) = '' THEN RETURN NULL; END IF;
      RETURN v_subgroup_label;
    END IF;
    RETURN NULL;
  END IF;

  IF p_source = 'product_column' THEN
    IF p_path IN ('width','length') THEN
      v_sanfona := COALESCE(p_product.ficha_tecnica, '{}'::jsonb) -> 'sanfona';
      v_sanfona_ativa := COALESCE((v_sanfona ->> 'ativa')::boolean, false);
      v_sanfona_local := v_sanfona ->> 'local';
      BEGIN
        v_sanfona_valor := NULLIF(v_sanfona ->> 'valor','')::numeric;
      EXCEPTION WHEN others THEN v_sanfona_valor := NULL;
      END;
      IF p_path = 'width' THEN v_base_num := p_product.width; ELSE v_base_num := p_product.length; END IF;
      IF v_base_num IS NULL THEN RETURN NULL; END IF;
      v_effective := v_base_num;
      IF v_sanfona_ativa AND v_sanfona_valor IS NOT NULL AND v_sanfona_valor > 0
         AND ((p_path = 'width' AND v_sanfona_local = 'Lateral')
           OR (p_path = 'length' AND v_sanfona_local = 'Fundo'))
      THEN v_effective := v_base_num + v_sanfona_valor; END IF;
      IF v_effective = trunc(v_effective) THEN v_text := trunc(v_effective)::text;
      ELSE v_text := v_effective::text; END IF;
      RETURN v_text;
    END IF;
    CASE p_path
      WHEN 'thickness' THEN RETURN p_product.thickness::text;
      WHEN 'fator_milheiro' THEN RETURN p_product.fator_milheiro::text;
      ELSE RETURN NULL;
    END CASE;
  END IF;

  IF p_product.ficha_tecnica IS NULL THEN RETURN NULL; END IF;
  v_parts := string_to_array(p_path, '.');
  v_current := p_product.ficha_tecnica;
  FOR i IN 1..array_length(v_parts,1) LOOP
    IF v_current IS NULL OR jsonb_typeof(v_current) <> 'object' THEN RETURN NULL; END IF;
    v_current := v_current -> v_parts[i];
  END LOOP;
  IF v_current IS NULL OR jsonb_typeof(v_current) = 'null' THEN RETURN NULL; END IF;
  IF jsonb_typeof(v_current) = 'string' THEN v_result := v_current #>> '{}';
  ELSE v_result := v_current::text; END IF;

  -- Resolve UUID -> "value" das tabelas de lookup da ficha (código esperado pelo ERP)
  IF v_result IS NOT NULL AND p_path IN ('impressao.cilindro_id','impressao.maquina_id') THEN
    BEGIN
      v_uuid := v_result::uuid;
    EXCEPTION WHEN others THEN v_uuid := NULL;
    END;
    IF v_uuid IS NOT NULL THEN
      IF p_path = 'impressao.cilindro_id' THEN
        SELECT value INTO v_lookup FROM public.product_ficha_cylinders WHERE id = v_uuid;
      ELSE
        SELECT value INTO v_lookup FROM public.product_ficha_machines WHERE id = v_uuid;
      END IF;
      IF v_lookup IS NOT NULL AND trim(v_lookup) <> '' THEN RETURN v_lookup; END IF;
      RETURN NULL;
    END IF;
  END IF;

  RETURN v_result;
END;
$function$;

-- Recalcula valores existentes e reenfileira (sem ON CONFLICT por causa do índice parcial)
DO $$
DECLARE
  r RECORD;
  v_new_value text;
  v_prod products%ROWTYPE;
  v_existing uuid;
BEGIN
  FOR r IN
    SELECT pav.id AS pav_id, pav.tenant_id, pav.product_id, pav.attribute_catalog_id,
           pam.crm_source, pam.crm_path
    FROM public.product_attribute_values pav
    JOIN public.product_attribute_mapping pam
      ON pam.attribute_catalog_id = pav.attribute_catalog_id
     AND pam.tenant_id = pav.tenant_id
    WHERE pam.crm_path IN ('impressao.cilindro_id','impressao.maquina_id')
      AND pam.ativo = true
  LOOP
    SELECT * INTO v_prod FROM public.products WHERE id = r.product_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_new_value := public.extract_attribute_value(v_prod, r.crm_source, r.crm_path);

    UPDATE public.product_attribute_values
       SET valor_padrao = v_new_value,
           dirty = true,
           last_sync_error = NULL,
           updated_at = now()
     WHERE id = r.pav_id;

    -- Reset item ativo na fila se existir; senão insere novo
    SELECT id INTO v_existing
      FROM public.attribute_sync_queue
     WHERE product_id = r.product_id
       AND attribute_catalog_id = r.attribute_catalog_id
       AND status IN ('pending','retry','processing','blocked_no_erp_code','blocked_validation','error')
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE public.attribute_sync_queue
         SET status = 'pending',
             attempt_count = 0,
             error_message = NULL,
             next_retry_at = NULL,
             updated_at = now()
       WHERE id = v_existing;
    ELSE
      INSERT INTO public.attribute_sync_queue (tenant_id, product_id, attribute_catalog_id, status, attempt_count)
      VALUES (r.tenant_id, r.product_id, r.attribute_catalog_id, 'pending', 0);
    END IF;
  END LOOP;
END $$;
