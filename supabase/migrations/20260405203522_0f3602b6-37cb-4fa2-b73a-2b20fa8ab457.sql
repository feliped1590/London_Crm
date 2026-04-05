DROP FUNCTION IF EXISTS public.promote_staging_products_v2(uuid);
DROP FUNCTION IF EXISTS public.promote_staging_products_v2(uuid, integer);

CREATE OR REPLACE FUNCTION public.promote_staging_products_v2(
  p_tenant_id uuid,
  p_batch_size integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '120s'
AS $$
DECLARE
  rec RECORD;
  v_promoted int := 0;
  v_skipped_hash int := 0;
  v_skipped_type int := 0;
  v_errors int := 0;
  v_existing_id uuid;
  v_erp_code text;
  v_erp_versao text;
  v_erp_status text;
  v_raw jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('promote_staging_' || p_tenant_id::text));

  FOR rec IN
    SELECT DISTINCT ON (erp_code)
      id, erp_code, raw_data, data_alteracao, hash_data, codigo_tipo_item
    FROM public.erp_products_staging
    WHERE tenant_id = p_tenant_id
      AND status = 'pending'
    ORDER BY erp_code, data_alteracao DESC NULLS LAST
    LIMIT p_batch_size
  LOOP
    BEGIN
      v_raw := rec.raw_data;

      IF COALESCE(rec.codigo_tipo_item, 0) <> 1 THEN
        UPDATE public.erp_products_staging
        SET status = 'skipped',
            promoted_at = now(),
            error_message = 'Não é Produto Acabado (tipo=' || COALESCE(rec.codigo_tipo_item::text, 'null') || ')'
        WHERE id = rec.id;
        v_skipped_type := v_skipped_type + 1;
        CONTINUE;
      END IF;

      v_erp_code := split_part(COALESCE(v_raw->>'produto', rec.erp_code), '/', 1);
      v_erp_versao := NULLIF(split_part(COALESCE(v_raw->>'produto', ''), '/', 2), '');
      v_erp_status := CASE upper(COALESCE(NULLIF(v_raw->>'situacao_item', ''), ''))
        WHEN 'A' THEN 'ATIVO'
        WHEN 'I' THEN 'INATIVO'
        WHEN 'ATIVO' THEN 'ATIVO'
        WHEN 'INATIVO' THEN 'INATIVO'
        WHEN 'S' THEN 'SERVICO'
        WHEN 'SERVICO' THEN 'SERVICO'
        WHEN 'O' THEN 'OBSOLETO'
        WHEN 'OBSOLETO' THEN 'OBSOLETO'
        WHEN 'M' THEN 'MODELO'
        WHEN 'MODELO' THEN 'MODELO'
        ELSE NULL
      END;

      SELECT id INTO v_existing_id
      FROM public.products
      WHERE tenant_id = p_tenant_id
        AND erp_product_code = v_erp_code
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        UPDATE public.products SET
          name = COALESCE(NULLIF(v_raw->>'desc_completa_item', ''), name),
          ncm_code = COALESCE(NULLIF(v_raw->>'codigo_ncm', ''), ncm_code),
          unit_measure = COALESCE(NULLIF(v_raw->>'codigo_unidade', ''), unit_measure),
          erp_grupo = COALESCE(NULLIF(v_raw->>'desc_grupo', ''), erp_grupo),
          erp_subgrupo = COALESCE(NULLIF(v_raw->>'desc_subgrupo', ''), erp_subgrupo),
          erp_empresa = COALESCE((NULLIF(v_raw->>'empresa', ''))::int, erp_empresa),
          tipo_item = COALESCE(NULLIF(v_raw->>'desc_tipo_item', ''), tipo_item),
          tipo_ficha = COALESCE((NULLIF(v_raw->>'codigo_tipo_ficha', ''))::int, tipo_ficha),
          erp_versao = COALESCE(v_erp_versao, erp_versao),
          erp_versao_detalhes = COALESCE(NULLIF(v_raw->>'desc_simples_versao', ''), erp_versao_detalhes),
          erp_versao_roteiro = COALESCE((NULLIF(v_raw->>'codigo_roteiro', ''))::int, erp_versao_roteiro),
          erp_versao_situacao = COALESCE(NULLIF(v_raw->>'situacao_versao', ''), erp_versao_situacao),
          erp_status = COALESCE(v_erp_status, erp_status),
          unit_price = COALESCE((NULLIF(v_raw->>'preco_venda', ''))::numeric, unit_price),
          price_cash = COALESCE((NULLIF(v_raw->>'preco_ultima_venda', ''))::numeric, price_cash),
          weight = COALESCE((NULLIF(v_raw->>'peso_liquido', ''))::numeric, weight),
          reference = COALESCE(NULLIF(v_raw->>'referencia', ''), reference),
          erp_last_update_date = rec.data_alteracao,
          erp_synced_at = now(),
          origem_alteracao = 'ERP',
          updated_at = now()
        WHERE id = v_existing_id
          AND (rec.data_alteracao >= COALESCE(erp_last_update_date, '1900-01-01'::timestamptz) OR erp_last_update_date IS NULL);
      ELSE
        INSERT INTO public.products (
          tenant_id, sku, erp_product_code, name, ncm_code, unit_measure,
          erp_grupo, erp_subgrupo, erp_empresa, tipo_item, tipo_ficha,
          erp_versao, erp_versao_detalhes, erp_versao_roteiro, erp_versao_situacao,
          erp_status, unit_price, price_cash, weight, reference,
          erp_last_update_date, erp_synced_at, origem_alteracao, active
        ) VALUES (
          p_tenant_id,
          'ERP-' || v_erp_code,
          v_erp_code,
          COALESCE(NULLIF(v_raw->>'desc_completa_item', ''), 'Produto ' || v_erp_code),
          NULLIF(v_raw->>'codigo_ncm', ''),
          NULLIF(v_raw->>'codigo_unidade', ''),
          NULLIF(v_raw->>'desc_grupo', ''),
          NULLIF(v_raw->>'desc_subgrupo', ''),
          (NULLIF(v_raw->>'empresa', ''))::int,
          NULLIF(v_raw->>'desc_tipo_item', ''),
          (NULLIF(v_raw->>'codigo_tipo_ficha', ''))::int,
          v_erp_versao,
          NULLIF(v_raw->>'desc_simples_versao', ''),
          (NULLIF(v_raw->>'codigo_roteiro', ''))::int,
          NULLIF(v_raw->>'situacao_versao', ''),
          v_erp_status,
          (NULLIF(v_raw->>'preco_venda', ''))::numeric,
          (NULLIF(v_raw->>'preco_ultima_venda', ''))::numeric,
          (NULLIF(v_raw->>'peso_liquido', ''))::numeric,
          NULLIF(v_raw->>'referencia', ''),
          rec.data_alteracao,
          now(), 'ERP', true
        );
      END IF;

      UPDATE public.erp_products_staging
      SET status = 'promoted', promoted_at = now(), error_message = NULL
      WHERE id = rec.id;
      v_promoted := v_promoted + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.erp_products_staging
      SET status = 'error', error_message = SQLERRM, retry_count = retry_count + 1
      WHERE id = rec.id;
      v_errors := v_errors + 1;
    END;
  END LOOP;

  INSERT INTO public.erp_sync_control (entity, last_sync_at, last_sync_count)
  VALUES ('product_promotion', now(), v_promoted)
  ON CONFLICT (entity)
  DO UPDATE SET last_sync_at = now(), last_sync_count = v_promoted;

  RETURN jsonb_build_object(
    'promoted', v_promoted,
    'skipped_hash', v_skipped_hash,
    'skipped_type', v_skipped_type,
    'errors', v_errors,
    'batch_size', p_batch_size
  );
END;
$$;