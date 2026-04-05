
-- 1. Drop and recreate promote_staging_products_v2 with UPDATE/INSERT logic
CREATE OR REPLACE FUNCTION public.promote_staging_products_v2(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_promoted int := 0;
  v_skipped_hash int := 0;
  v_skipped_type int := 0;
  v_errors int := 0;
  v_updated int;
BEGIN
  -- Advisory lock to prevent concurrent promotions
  PERFORM pg_advisory_xact_lock(hashtext('promote_staging_' || p_tenant_id::text));

  -- Mark non-type-1 as skipped
  UPDATE erp_products_staging
  SET status = 'skipped', error_message = 'Tipo de item não é Produto Acabado'
  WHERE tenant_id = p_tenant_id
    AND status = 'pending'
    AND (codigo_tipo_item IS NULL OR codigo_tipo_item <> 1);

  GET DIAGNOSTICS v_skipped_type = ROW_COUNT;

  -- Process only pending type-1 records (latest version per erp_code)
  FOR rec IN
    SELECT DISTINCT ON (erp_code) *
    FROM erp_products_staging
    WHERE tenant_id = p_tenant_id
      AND status = 'pending'
      AND codigo_tipo_item = 1
    ORDER BY erp_code, data_alteracao DESC NULLS LAST, created_at DESC
  LOOP
    BEGIN
      -- Mark as processing
      UPDATE erp_products_staging SET status = 'processing' WHERE id = rec.id;

      -- Check if product already exists and data is newer
      -- Try UPDATE first
      UPDATE products SET
        name = COALESCE(rec.raw_data->>'ds_material', name),
        erp_last_update_date = rec.data_alteracao,
        erp_synced_at = now(),
        updated_at = now(),
        origem_alteracao = 'ERP'
      WHERE tenant_id = p_tenant_id
        AND erp_product_code = rec.erp_code
        AND (erp_last_update_date IS NULL OR rec.data_alteracao IS NULL OR rec.data_alteracao >= erp_last_update_date);

      GET DIAGNOSTICS v_updated = ROW_COUNT;

      IF v_updated = 0 THEN
        -- Check if it exists but with newer data (skip)
        IF EXISTS (
          SELECT 1 FROM products
          WHERE tenant_id = p_tenant_id AND erp_product_code = rec.erp_code
        ) THEN
          -- Exists but CRM data is newer, skip
          UPDATE erp_products_staging
          SET status = 'skipped', error_message = 'CRM possui dados mais recentes'
          WHERE id = rec.id;
          v_skipped_hash := v_skipped_hash + 1;
          CONTINUE;
        END IF;

        -- Does not exist, INSERT
        INSERT INTO products (
          tenant_id, name, erp_product_code, erp_last_update_date, erp_synced_at, origem_alteracao, active
        ) VALUES (
          p_tenant_id,
          COALESCE(rec.raw_data->>'ds_material', 'Produto ' || rec.erp_code),
          rec.erp_code,
          rec.data_alteracao,
          now(),
          'ERP',
          true
        );
      END IF;

      -- Mark as processed
      UPDATE erp_products_staging SET status = 'processed' WHERE id = rec.id;
      v_promoted := v_promoted + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE erp_products_staging
      SET status = 'error',
          error_message = SQLERRM,
          retry_count = retry_count + 1
      WHERE id = rec.id;
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Update sync control
  INSERT INTO erp_sync_control (entity_type, tenant_id, last_sync_at, records_synced, sync_status)
  VALUES ('product_promotion', p_tenant_id, now(), v_promoted, 'success')
  ON CONFLICT (entity_type, tenant_id)
  DO UPDATE SET
    last_sync_at = now(),
    records_synced = erp_sync_control.records_synced + v_promoted,
    sync_status = 'success';

  RETURN jsonb_build_object(
    'promoted', v_promoted,
    'skipped_hash', v_skipped_hash,
    'skipped_type', v_skipped_type,
    'errors', v_errors
  );
END;
$$;

-- 2. Create RPC for staging status counts (avoids 1000-row limit)
CREATE OR REPLACE FUNCTION public.staging_status_counts(p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(status text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.status, COUNT(*)
  FROM erp_products_staging s
  WHERE (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
  GROUP BY s.status;
$$;
