
-- 1. Tabela erp_products_staging
CREATE TABLE public.erp_products_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  erp_code TEXT NOT NULL,
  codigo_tipo_item INTEGER,
  data_alteracao TIMESTAMPTZ,
  raw_data JSONB NOT NULL,
  hash_data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  promoted BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staging_latest_version ON public.erp_products_staging (tenant_id, erp_code, data_alteracao DESC);
CREATE INDEX idx_staging_dedup_pending ON public.erp_products_staging (tenant_id, erp_code, hash_data) WHERE status = 'pending';
CREATE INDEX idx_staging_promote_candidates ON public.erp_products_staging (tenant_id, codigo_tipo_item, status);
CREATE INDEX idx_staging_monitor ON public.erp_products_staging (tenant_id, status);

ALTER TABLE public.erp_products_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view staging"
  ON public.erp_products_staging FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage staging"
  ON public.erp_products_staging FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Novas colunas em products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_acabado BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS erp_hash TEXT;

-- 3. Função RPC promote_staging_products_v2
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

  -- Marcar registros processing restantes (não-PA ou duplicados) como skipped
  UPDATE erp_products_staging
  SET status = 'skipped'
  WHERE tenant_id = p_tenant_id AND status = 'processing';

  -- Atualizar sync control
  IF v_max_date IS NOT NULL THEN
    INSERT INTO erp_sync_control (tenant_id, entity_type, last_sync_at, last_record_date, records_synced)
    VALUES (p_tenant_id, 'product_staging', NOW(), v_max_date, v_promoted)
    ON CONFLICT (tenant_id, entity_type)
    DO UPDATE SET
      last_sync_at = NOW(),
      last_record_date = GREATEST(erp_sync_control.last_record_date, EXCLUDED.last_record_date),
      records_synced = erp_sync_control.records_synced + EXCLUDED.records_synced,
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
