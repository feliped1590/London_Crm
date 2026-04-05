
CREATE OR REPLACE FUNCTION public.promote_staging_products_v2(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_promoted int := 0;
  v_skipped int := 0;
  v_errors int := 0;
  v_erp_code text;
  v_erp_versao text;
  v_existing_id uuid;
BEGIN
  -- Advisory lock to prevent concurrent promotions
  PERFORM pg_advisory_xact_lock(hashtext('promote_staging_' || p_tenant_id::text));

  -- 1) Mark non-finished products as skipped
  UPDATE erp_products_staging
  SET status = 'skipped',
      error_message = 'Não é Produto Acabado (tipo ' || COALESCE(codigo_tipo_item::text, '?') || ')',
      processed_at = now()
  WHERE tenant_id = p_tenant_id
    AND status = 'pending'
    AND (codigo_tipo_item IS NULL OR codigo_tipo_item <> 1);

  GET DIAGNOSTICS v_skipped = ROW_COUNT;

  -- 2) Mark pending type-1 as processing
  UPDATE erp_products_staging
  SET status = 'processing'
  WHERE tenant_id = p_tenant_id
    AND status = 'pending'
    AND codigo_tipo_item = 1;

  -- 3) Process each record (latest version per erp_code)
  FOR rec IN
    SELECT DISTINCT ON (erp_code) *
    FROM erp_products_staging
    WHERE tenant_id = p_tenant_id
      AND status = 'processing'
    ORDER BY erp_code, data_alteracao DESC NULLS LAST, created_at DESC
  LOOP
    BEGIN
      -- Parse produto field "100135/1" into code and version
      v_erp_code := COALESCE(split_part(NULLIF(rec.raw_data->>'produto', ''), '/', 1), rec.erp_code);
      v_erp_versao := NULLIF(split_part(COALESCE(rec.raw_data->>'produto', ''), '/', 2), '');

      -- Check if product already exists
      SELECT id INTO v_existing_id
      FROM products
      WHERE tenant_id = p_tenant_id
        AND erp_product_code = v_erp_code
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        -- UPDATE existing product (only if staging data is newer or same)
        UPDATE products SET
          name                = COALESCE(NULLIF(rec.raw_data->>'desc_completa_item', ''), name),
          ncm_code            = COALESCE(NULLIF(rec.raw_data->>'codigo_ncm', ''), ncm_code),
          unit_measure        = COALESCE(NULLIF(rec.raw_data->>'codigo_unidade', ''), unit_measure),
          erp_grupo           = COALESCE(NULLIF(rec.raw_data->>'desc_grupo', ''), erp_grupo),
          erp_subgrupo        = COALESCE(NULLIF(rec.raw_data->>'desc_subgrupo', ''), erp_subgrupo),
          erp_empresa         = COALESCE(
                                  (NULLIF(rec.raw_data->>'empresa', ''))::int,
                                  erp_empresa
                                ),
          tipo_item           = COALESCE(NULLIF(rec.raw_data->>'desc_tipo_item', ''), tipo_item),
          tipo_ficha          = COALESCE(
                                  (NULLIF(rec.raw_data->>'codigo_tipo_ficha', ''))::int,
                                  tipo_ficha
                                ),
          erp_versao          = COALESCE(v_erp_versao, erp_versao),
          erp_versao_detalhes = COALESCE(NULLIF(rec.raw_data->>'desc_simples_versao', ''), erp_versao_detalhes),
          erp_versao_roteiro  = COALESCE(
                                  (NULLIF(rec.raw_data->>'codigo_roteiro', ''))::int,
                                  erp_versao_roteiro
                                ),
          erp_versao_situacao = COALESCE(NULLIF(rec.raw_data->>'situacao_versao', ''), erp_versao_situacao),
          erp_status          = COALESCE(NULLIF(rec.raw_data->>'situacao_item', ''), erp_status),
          unit_price          = COALESCE(
                                  (NULLIF(rec.raw_data->>'preco_venda', ''))::numeric,
                                  unit_price
                                ),
          price_cash          = COALESCE(
                                  (NULLIF(rec.raw_data->>'preco_ultima_venda', ''))::numeric,
                                  price_cash
                                ),
          weight              = COALESCE(
                                  (NULLIF(rec.raw_data->>'peso_liquido', ''))::numeric,
                                  weight
                                ),
          reference           = COALESCE(NULLIF(rec.raw_data->>'referencia', ''), reference),
          erp_last_update_date = COALESCE(rec.data_alteracao::text, erp_last_update_date),
          erp_synced_at       = now(),
          origem_alteracao    = 'ERP',
          updated_at          = now()
        WHERE id = v_existing_id
          AND (
            rec.data_alteracao IS NULL
            OR erp_last_update_date IS NULL
            OR rec.data_alteracao::text >= erp_last_update_date
          );
      ELSE
        -- INSERT new product
        INSERT INTO products (
          tenant_id, erp_product_code, name, sku,
          ncm_code, unit_measure, erp_grupo, erp_subgrupo,
          erp_empresa, tipo_item, tipo_ficha,
          erp_versao, erp_versao_detalhes, erp_versao_roteiro,
          erp_versao_situacao, erp_status,
          unit_price, price_cash, weight, reference,
          erp_last_update_date, erp_synced_at, origem_alteracao,
          active
        ) VALUES (
          p_tenant_id,
          v_erp_code,
          COALESCE(NULLIF(rec.raw_data->>'desc_completa_item', ''), 'Produto ' || v_erp_code),
          v_erp_code,
          NULLIF(rec.raw_data->>'codigo_ncm', ''),
          NULLIF(rec.raw_data->>'codigo_unidade', ''),
          NULLIF(rec.raw_data->>'desc_grupo', ''),
          NULLIF(rec.raw_data->>'desc_subgrupo', ''),
          (NULLIF(rec.raw_data->>'empresa', ''))::int,
          NULLIF(rec.raw_data->>'desc_tipo_item', ''),
          (NULLIF(rec.raw_data->>'codigo_tipo_ficha', ''))::int,
          v_erp_versao,
          NULLIF(rec.raw_data->>'desc_simples_versao', ''),
          (NULLIF(rec.raw_data->>'codigo_roteiro', ''))::int,
          NULLIF(rec.raw_data->>'situacao_versao', ''),
          NULLIF(rec.raw_data->>'situacao_item', ''),
          (NULLIF(rec.raw_data->>'preco_venda', ''))::numeric,
          (NULLIF(rec.raw_data->>'preco_ultima_venda', ''))::numeric,
          (NULLIF(rec.raw_data->>'peso_liquido', ''))::numeric,
          NULLIF(rec.raw_data->>'referencia', ''),
          COALESCE(rec.data_alteracao::text, now()::text),
          now(),
          'ERP',
          true
        );
      END IF;

      -- Mark as promoted
      UPDATE erp_products_staging
      SET status = 'promoted', processed_at = now(), error_message = NULL
      WHERE id = rec.id;

      v_promoted := v_promoted + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Mark as error with retry control
      UPDATE erp_products_staging
      SET status = 'error',
          error_message = SQLERRM,
          processed_at = now(),
          retry_count = COALESCE(retry_count, 0) + 1
      WHERE id = rec.id;

      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Mark remaining processing records (duplicates of same erp_code) as promoted
  UPDATE erp_products_staging
  SET status = 'promoted', processed_at = now()
  WHERE tenant_id = p_tenant_id
    AND status = 'processing';

  RETURN jsonb_build_object(
    'promoted', v_promoted,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;
