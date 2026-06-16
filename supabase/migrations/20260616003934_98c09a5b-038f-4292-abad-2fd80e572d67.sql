
DO $$
DECLARE
  r RECORD;
  v_product public.products%ROWTYPE;
  v_new_value text;
BEGIN
  FOR r IN
    SELECT pav.id AS pav_id, pav.product_id, pav.attribute_catalog_id, pav.tenant_id,
           pam.crm_source, pam.crm_path
    FROM public.product_attribute_values pav
    JOIN public.product_attribute_mapping pam
      ON pam.attribute_catalog_id = pav.attribute_catalog_id
     AND pam.tenant_id = pav.tenant_id
    WHERE pam.crm_path IN ('impressao.cilindro_id','impressao.maquina_id')
      AND pam.ativo = true
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = r.product_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_new_value := public.extract_attribute_value(v_product, r.crm_source, r.crm_path);

    UPDATE public.product_attribute_values
       SET valor_padrao = v_new_value,
           dirty = true,
           updated_at = now()
     WHERE id = r.pav_id;

    INSERT INTO public.attribute_sync_queue (tenant_id, product_id, attribute_catalog_id, status, attempt_count)
    VALUES (r.tenant_id, r.product_id, r.attribute_catalog_id, 'pending', 0)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
