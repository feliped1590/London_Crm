
CREATE OR REPLACE FUNCTION public.promote_staging_products_v2(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promoted INTEGER := 0;
  v_skipped_hash INTEGER := 0;
  v_skipped_old INTEGER := 0;
  v_errors INTEGER := 0;
  v_max_date TIMESTAMPTZ;
  rec RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text));

  UPDATE erp_products_staging
  SET status = 'processing'
  WHERE tenant_id = p_tenant_id
    AND status = 'pending'
    AND codigo_tipo_item = 1
    AND data_alteracao IS NOT NULL
    AND retry_count < 5;

  FOR rec IN
    WITH ranked AS (
      SELECT
        s.id AS staging_id,
        s.erp_code,
        s.hash_data,
        s.data_alteracao,
        s.raw_data,
        ROW_NUMBER() OVER (PARTITION BY s.erp_code ORDER BY s.data_alteracao DESC) AS rn
      FROM erp_products_staging s
      WHERE s.tenant_id = p_tenant_id
        AND s.status = 'processing'
    )
    SELECT * FROM ranked WHERE rn = 1
  LOOP
    BEGIN
      IF EXISTS (
        SELECT 1 FROM products p
        WHERE p.tenant_id = p_tenant_id
          AND p.erp_product_code = rec.erp_code
          AND p.erp_hash = rec.hash_data
      ) THEN
        UPDATE erp_products_staging
        SET status = 'skipped', promoted = FALSE
        WHERE id = rec.staging_id;
        v_skipped_hash := v_skipped_hash + 1;
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1 FROM products p
        WHERE p.tenant_id = p_tenant_id
          AND p.erp_product_code = rec.erp_code
          AND p.erp_last_update_date IS NOT NULL
          AND p.erp_last_update_date >= rec.data_alteracao
      ) THEN
        UPDATE erp_products_staging
        SET status = 'skipped', promoted = FALSE
        WHERE id = rec.staging_id;
        v_skipped_old := v_skipped_old + 1;
        CONTINUE;
      END IF;

      INSERT INTO products (
        tenant_id, erp_product_code, name, erp_hash,
        erp_last_update_date, is_acabado, origem_alteracao, erp_synced_at, updated_at
      )
      VALUES (
        p_tenant_id, rec.erp_code,
        COALESCE(rec.raw_data->>'ds_material', 'Produto ERP ' || rec.erp_code),
        rec.hash_data, rec.data_alteracao, TRUE, 'ERP', NOW(), NOW()
      )
      ON CONFLICT (tenant_id, erp_product_code)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, products.name),
        erp_hash = EXCLUDED.erp_hash,
        erp_last_update_date = EXCLUDED.erp_last_update_date,
        is_acabado = TRUE,
        origem_alteracao = 'ERP',
        erp_synced_at = NOW(),
        updated_at = NOW()
      WHERE products.erp_last_update_date IS NULL
         OR products.erp_last_update_date < EXCLUDED.erp_last_update_date;

      UPDATE erp_products_staging
      SET status = 'processed', promoted = TRUE, promoted_at = NOW()
      WHERE id = rec.staging_id;

      v_promoted := v_promoted + 1;

      IF v_max_date IS NULL OR rec.data_alteracao > v_max_date THEN
        v_max_date := rec.data_alteracao;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      UPDATE erp_products_staging
      SET status = 'error', error_message = SQLERRM, retry_count = retry_count + 1
      WHERE id = rec.staging_id;
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Marcar apenas registros não-PA restantes como skipped (explícito)
  UPDATE erp_products_staging
  SET status = 'skipped'
  WHERE tenant_id = p_tenant_id
    AND status = 'processing'
    AND codigo_tipo_item <> 1;

  -- Registros PA que sobraram em processing (duplicados do ROW_NUMBER) → skipped
  UPDATE erp_products_staging
  SET status = 'skipped'
  WHERE tenant_id = p_tenant_id
    AND status = 'processing';

  -- Atualizar sync control (última execução, não acumulado)
  IF v_max_date IS NOT NULL THEN
    INSERT INTO erp_sync_control (tenant_id, entity_type, last_sync_at, last_record_date, records_synced)
    VALUES (p_tenant_id, 'product_staging', NOW(), v_max_date, v_promoted)
    ON CONFLICT (tenant_id, entity_type)
    DO UPDATE SET
      last_sync_at = NOW(),
      last_record_date = GREATEST(erp_sync_control.last_record_date, EXCLUDED.last_record_date),
      records_synced = EXCLUDED.records_synced,
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'promoted', v_promoted,
    'skipped_hash', v_skipped_hash,
    'skipped_old', v_skipped_old,
    'errors', v_errors,
    'max_date', v_max_date
  );
END;
$$;
