
CREATE OR REPLACE FUNCTION public.enqueue_all_product_attributes(p_product_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_count integer := 0;
BEGIN
  SELECT tenant_id INTO v_tenant FROM products WHERE id = p_product_id;
  IF v_tenant IS NULL THEN
    RETURN 0;
  END IF;

  -- Marca todos os valores existentes como dirty para forçar reenvio
  UPDATE product_attribute_values pav
  SET dirty = true, updated_at = now()
  WHERE pav.product_id = p_product_id
    AND pav.valor_padrao IS NOT NULL
    AND pav.valor_padrao <> ''
    AND EXISTS (
      SELECT 1 FROM product_attribute_mapping pam
      WHERE pam.attribute_catalog_id = pav.attribute_catalog_id
        AND pam.tenant_id = v_tenant
        AND pam.ativo = true
    )
    AND EXISTS (
      SELECT 1 FROM erp_attribute_catalog c
      WHERE c.id = pav.attribute_catalog_id AND c.ativo = true
    );

  -- Enfileira (ou reativa) atributos mapeados com valor preenchido
  WITH candidates AS (
    SELECT pav.attribute_catalog_id
    FROM product_attribute_values pav
    JOIN product_attribute_mapping pam
      ON pam.attribute_catalog_id = pav.attribute_catalog_id
     AND pam.tenant_id = v_tenant
     AND pam.ativo = true
    JOIN erp_attribute_catalog c
      ON c.id = pav.attribute_catalog_id AND c.ativo = true
    WHERE pav.product_id = p_product_id
      AND pav.valor_padrao IS NOT NULL
      AND pav.valor_padrao <> ''
  ),
  upsert AS (
    INSERT INTO attribute_sync_queue (tenant_id, product_id, attribute_catalog_id, status, attempt_count, error_message, next_retry_at)
    SELECT v_tenant, p_product_id, c.attribute_catalog_id, 'pending', 0, NULL, NULL
    FROM candidates c
    ON CONFLICT (product_id, attribute_catalog_id)
      WHERE status IN ('pending','retry','processing','blocked_no_erp_code')
      DO UPDATE SET status='pending', attempt_count=0, error_message=NULL, next_retry_at=NULL, updated_at=now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upsert;

  -- Para os que estão em status terminal (sent/error/cancelled/skipped) insere nova linha
  INSERT INTO attribute_sync_queue (tenant_id, product_id, attribute_catalog_id, status)
  SELECT v_tenant, p_product_id, c.attribute_catalog_id, 'pending'
  FROM (
    SELECT pav.attribute_catalog_id
    FROM product_attribute_values pav
    JOIN product_attribute_mapping pam
      ON pam.attribute_catalog_id = pav.attribute_catalog_id
     AND pam.tenant_id = v_tenant
     AND pam.ativo = true
    JOIN erp_attribute_catalog cat
      ON cat.id = pav.attribute_catalog_id AND cat.ativo = true
    WHERE pav.product_id = p_product_id
      AND pav.valor_padrao IS NOT NULL
      AND pav.valor_padrao <> ''
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM attribute_sync_queue q
    WHERE q.product_id = p_product_id
      AND q.attribute_catalog_id = c.attribute_catalog_id
      AND q.status IN ('pending','retry','processing','blocked_no_erp_code')
  );

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_all_product_attributes(uuid) TO authenticated, service_role;
