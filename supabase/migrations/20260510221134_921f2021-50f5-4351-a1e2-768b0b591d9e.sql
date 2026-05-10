-- Update promote_staging_products_v2 to populate legal_entity_id (required NOT NULL).
-- Default new products to the tenant's headquarters legal entity (QUALYVAC EMBALAGENS EIRELI for Qualyvac tenant).
CREATE OR REPLACE FUNCTION public.promote_staging_products_v2(p_tenant_id uuid, p_batch_size integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_promoted integer := 0;
  v_skipped integer := 0;
  v_errors integer := 0;
  v_total integer := 0;
  rec record;
  v_raw jsonb;
  v_erp_code text;
  v_name text;
  v_erp_status text;
  v_ncm text;
  v_unit text;
  v_price numeric;
  v_weight numeric;
  v_versao text;
  v_width numeric;
  v_length numeric;
  v_thickness numeric;
  v_dim_parts text[];
  v_part text;
  v_default_legal_entity_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text));

  -- Resolve default legal entity for ERP-imported products (headquarters)
  SELECT id INTO v_default_legal_entity_id
  FROM legal_entities
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND is_headquarters = true
  LIMIT 1;

  IF v_default_legal_entity_id IS NULL THEN
    SELECT id INTO v_default_legal_entity_id
    FROM legal_entities
    WHERE tenant_id = p_tenant_id AND is_active = true
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_default_legal_entity_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma legal_entity ativa encontrada para tenant %', p_tenant_id;
  END IF;

  FOR rec IN
    SELECT id, raw_data
    FROM erp_products_staging
    WHERE tenant_id = p_tenant_id
      AND status = 'pending'
    ORDER BY created_at
    LIMIT p_batch_size
  LOOP
    v_total := v_total + 1;
    BEGIN
      v_raw := rec.raw_data;

      IF (v_raw->>'tipo_item') IS NULL OR (v_raw->>'tipo_item')::int != 1 THEN
        UPDATE erp_products_staging
        SET status = 'skipped',
            error_message = 'Tipo item ' || coalesce(v_raw->>'tipo_item','NULL') || ' - apenas tipo 1 é promovido'
        WHERE id = rec.id;
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_erp_code := trim(coalesce(
        v_raw->>'cd_material', v_raw->>'codigo', v_raw->>'cod_material',
        v_raw->>'CD_MATERIAL', v_raw->>'CODIGO', ''
      ));

      IF v_erp_code = '' THEN
        UPDATE erp_products_staging
        SET status = 'error', error_message = 'erp_code vazio'
        WHERE id = rec.id;
        v_errors := v_errors + 1;
        CONTINUE;
      END IF;

      v_name := trim(coalesce(
        v_raw->>'ds_material', v_raw->>'descricao', v_raw->>'desc_material',
        v_raw->>'DS_MATERIAL', v_raw->>'DESCRICAO', 'Produto ' || v_erp_code
      ));

      v_erp_status := CASE upper(trim(coalesce(v_raw->>'situacao_item', v_raw->>'SITUACAO_ITEM', '')))
        WHEN 'A' THEN 'ATIVO' WHEN 'I' THEN 'INATIVO'
        WHEN 'ATIVO' THEN 'ATIVO' WHEN 'INATIVO' THEN 'INATIVO'
        ELSE 'ATIVO'
      END;

      v_ncm := nullif(trim(coalesce(v_raw->>'ncm', v_raw->>'NCM', '')), '');
      v_unit := nullif(trim(coalesce(v_raw->>'unidade_medida', v_raw->>'unidade', v_raw->>'UNIDADE', '')), '');
      v_price := nullif(coalesce(v_raw->>'preco_venda', v_raw->>'PRECO_VENDA', v_raw->>'preco', '0'), '')::numeric;
      v_weight := nullif(coalesce(v_raw->>'peso_liquido', v_raw->>'PESO_LIQUIDO', v_raw->>'peso', '0'), '')::numeric;
      v_versao := nullif(trim(coalesce(v_raw->>'versao', v_raw->>'codigo_versao', v_raw->>'CODIGO_VERSAO', '')), '');

      v_width := NULL; v_length := NULL; v_thickness := NULL;
      IF v_versao IS NOT NULL AND v_versao <> '' THEN
        v_dim_parts := string_to_array(upper(v_versao), 'X');
        IF array_length(v_dim_parts, 1) = 3 THEN
          BEGIN
            v_width := nullif(trim(v_dim_parts[1]), '')::numeric;
            v_length := nullif(trim(v_dim_parts[2]), '')::numeric;
            v_thickness := nullif(trim(v_dim_parts[3]), '')::numeric;
          EXCEPTION WHEN OTHERS THEN
            v_width := NULL; v_length := NULL; v_thickness := NULL;
          END;
        ELSIF array_length(v_dim_parts, 1) = 2 THEN
          BEGIN
            v_width := nullif(trim(v_dim_parts[1]), '')::numeric;
            v_thickness := nullif(trim(v_dim_parts[2]), '')::numeric;
          EXCEPTION WHEN OTHERS THEN
            v_width := NULL; v_thickness := NULL;
          END;
        END IF;
      END IF;

      INSERT INTO products (
        tenant_id, legal_entity_id, sku, erp_product_code, name, ncm, unit_measure,
        price, weight_net, erp_status, erp_last_update_date,
        erp_versao, width, length, thickness,
        active, origem_alteracao
      ) VALUES (
        p_tenant_id, v_default_legal_entity_id,
        'ERP-' || v_erp_code, v_erp_code, v_name,
        nullif(v_ncm, ''), nullif(v_unit, ''),
        v_price, v_weight, v_erp_status, now(),
        nullif(v_versao, ''), v_width, v_length, v_thickness,
        true, 'ERP'
      )
      ON CONFLICT (tenant_id, erp_product_code) DO UPDATE SET
        name = EXCLUDED.name,
        ncm = coalesce(EXCLUDED.ncm, products.ncm),
        unit_measure = coalesce(EXCLUDED.unit_measure, products.unit_measure),
        price = coalesce(EXCLUDED.price, products.price),
        weight_net = coalesce(EXCLUDED.weight_net, products.weight_net),
        erp_status = coalesce(EXCLUDED.erp_status, products.erp_status),
        erp_last_update_date = EXCLUDED.erp_last_update_date,
        erp_versao = coalesce(EXCLUDED.erp_versao, products.erp_versao),
        width = coalesce(EXCLUDED.width, products.width),
        length = coalesce(EXCLUDED.length, products.length),
        thickness = coalesce(EXCLUDED.thickness, products.thickness),
        origem_alteracao = 'ERP',
        updated_at = now()
      WHERE products.erp_last_update_date IS NULL
         OR EXCLUDED.erp_last_update_date >= products.erp_last_update_date;

      UPDATE erp_products_staging
      SET status = 'promoted', error_message = NULL
      WHERE id = rec.id;

      v_promoted := v_promoted + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE erp_products_staging
      SET status = 'error', error_message = SQLERRM
      WHERE id = rec.id;
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'promoted', v_promoted, 'skipped', v_skipped,
    'errors', v_errors, 'total', v_total
  );
END;
$function$;