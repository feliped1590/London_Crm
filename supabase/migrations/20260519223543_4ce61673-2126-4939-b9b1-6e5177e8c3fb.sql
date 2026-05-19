
-- =====================================================
-- 1. CATÁLOGO DE ATRIBUTOS ERP
-- =====================================================
CREATE TABLE public.erp_attribute_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  erp_codigo integer NOT NULL,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'number' CHECK (tipo IN ('number','string','enum','boolean')),
  grupo_tecnico text,
  unidade text,
  tolerancia_mais numeric(15,4),
  tolerancia_menos numeric(15,4),
  aceita_tolerancia boolean NOT NULL DEFAULT true,
  obrigatorio boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, erp_codigo)
);

CREATE INDEX idx_erp_attr_catalog_tenant ON public.erp_attribute_catalog(tenant_id, ativo);

ALTER TABLE public.erp_attribute_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_attr_catalog_select" ON public.erp_attribute_catalog
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "erp_attr_catalog_insert_admin_dev" ON public.erp_attribute_catalog
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'desenvolvedor'::app_role))
  );

CREATE POLICY "erp_attr_catalog_update_admin_dev" ON public.erp_attribute_catalog
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'desenvolvedor'::app_role))
  );

CREATE POLICY "erp_attr_catalog_delete_admin_dev" ON public.erp_attribute_catalog
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'desenvolvedor'::app_role))
  );

CREATE TRIGGER trg_erp_attr_catalog_updated_at
  BEFORE UPDATE ON public.erp_attribute_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. MAPPING CAMPO CRM -> ATRIBUTO ERP
-- =====================================================
CREATE TABLE public.product_attribute_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  attribute_catalog_id uuid NOT NULL REFERENCES public.erp_attribute_catalog(id) ON DELETE CASCADE,
  crm_source text NOT NULL DEFAULT 'ficha_tecnica' CHECK (crm_source IN ('ficha_tecnica','product_column')),
  crm_path text NOT NULL,
  crm_label text,
  transform text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, attribute_catalog_id)
);

CREATE INDEX idx_prod_attr_map_tenant ON public.product_attribute_mapping(tenant_id, ativo);

ALTER TABLE public.product_attribute_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prod_attr_map_select" ON public.product_attribute_mapping
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "prod_attr_map_write_admin_dev" ON public.product_attribute_mapping
  FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'desenvolvedor'::app_role))
  )
  WITH CHECK (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'desenvolvedor'::app_role))
  );

CREATE TRIGGER trg_prod_attr_map_updated_at
  BEFORE UPDATE ON public.product_attribute_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 3. VALORES POR PRODUTO (snapshot + dirty)
-- =====================================================
CREATE TABLE public.product_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  attribute_catalog_id uuid NOT NULL REFERENCES public.erp_attribute_catalog(id) ON DELETE CASCADE,
  valor_padrao text,
  dirty boolean NOT NULL DEFAULT true,
  last_synced_value text,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, attribute_catalog_id)
);

CREATE INDEX idx_prod_attr_values_dirty ON public.product_attribute_values(product_id, dirty) WHERE dirty = true;
CREATE INDEX idx_prod_attr_values_tenant ON public.product_attribute_values(tenant_id);

ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prod_attr_values_select" ON public.product_attribute_values
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "prod_attr_values_write_admin_dev" ON public.product_attribute_values
  FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'desenvolvedor'::app_role))
  )
  WITH CHECK (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'desenvolvedor'::app_role))
  );

CREATE TRIGGER trg_prod_attr_values_updated_at
  BEFORE UPDATE ON public.product_attribute_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 4. FILA UNITÁRIA DE SYNC
-- =====================================================
CREATE TABLE public.attribute_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  attribute_catalog_id uuid NOT NULL REFERENCES public.erp_attribute_catalog(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','error','blocked_no_erp_code','blocked_validation','cancelled')),
  payload jsonb,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz,
  error_message text,
  error_code text,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE UNIQUE INDEX uq_attr_sync_pending
  ON public.attribute_sync_queue (product_id, attribute_catalog_id)
  WHERE status IN ('pending','retry','processing','blocked_no_erp_code');

CREATE INDEX idx_attr_sync_status ON public.attribute_sync_queue(status, next_retry_at);
CREATE INDEX idx_attr_sync_product ON public.attribute_sync_queue(product_id, status);

ALTER TABLE public.attribute_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attr_sync_queue_select" ON public.attribute_sync_queue
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "attr_sync_queue_admin" ON public.attribute_sync_queue
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'desenvolvedor'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'desenvolvedor'::app_role));

CREATE TRIGGER trg_attr_sync_queue_updated_at
  BEFORE UPDATE ON public.attribute_sync_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 5. LOG APPEND-ONLY
-- =====================================================
CREATE TABLE public.attribute_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  queue_item_id uuid REFERENCES public.attribute_sync_queue(id) ON DELETE SET NULL,
  product_id uuid,
  attribute_catalog_id uuid,
  erp_codigo integer,
  request_body jsonb,
  response_body text,
  response_status integer,
  success boolean,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attr_sync_log_product ON public.attribute_sync_log(product_id, created_at DESC);
CREATE INDEX idx_attr_sync_log_queue ON public.attribute_sync_log(queue_item_id);

ALTER TABLE public.attribute_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attr_sync_log_select" ON public.attribute_sync_log
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "attr_sync_log_admin_insert" ON public.attribute_sync_log
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'desenvolvedor'::app_role));

-- =====================================================
-- 6. FUNÇÃO: extrair valor da ficha por caminho ponteado
-- =====================================================
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
BEGIN
  IF p_source = 'product_column' THEN
    -- Colunas escalares conhecidas
    CASE p_path
      WHEN 'width' THEN RETURN p_product.width::text;
      WHEN 'length' THEN RETURN p_product.length::text;
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

-- =====================================================
-- 7. TRIGGER: detecta dirty attributes ao salvar produto
-- =====================================================
CREATE OR REPLACE FUNCTION public.detect_dirty_attributes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
  v_value text;
  v_existing_value text;
  v_existing_id uuid;
  v_changed boolean;
  v_has_erp boolean;
BEGIN
  -- Evita loop quando alteração veio do ERP
  IF NEW.origem_alteracao = 'ERP' OR NEW.origem_alteracao = 'SYNC' THEN
    RETURN NEW;
  END IF;

  v_has_erp := (NEW.erp_product_code IS NOT NULL AND length(trim(NEW.erp_product_code)) > 0);

  FOR m IN
    SELECT pam.id, pam.attribute_catalog_id, pam.crm_source, pam.crm_path
    FROM product_attribute_mapping pam
    JOIN erp_attribute_catalog c ON c.id = pam.attribute_catalog_id
    WHERE pam.tenant_id = NEW.tenant_id
      AND pam.ativo = true
      AND c.ativo = true
  LOOP
    v_value := extract_attribute_value(NEW, m.crm_source, m.crm_path);

    SELECT id, valor_padrao INTO v_existing_id, v_existing_value
    FROM product_attribute_values
    WHERE product_id = NEW.id AND attribute_catalog_id = m.attribute_catalog_id;

    v_changed := v_existing_id IS NULL OR v_existing_value IS DISTINCT FROM v_value;

    IF v_existing_id IS NULL THEN
      INSERT INTO product_attribute_values(tenant_id, product_id, attribute_catalog_id, valor_padrao, dirty)
      VALUES (NEW.tenant_id, NEW.id, m.attribute_catalog_id, v_value, true);
    ELSIF v_changed THEN
      UPDATE product_attribute_values
      SET valor_padrao = v_value, dirty = true, updated_at = now()
      WHERE id = v_existing_id;
    END IF;

    IF v_changed AND v_value IS NOT NULL THEN
      -- Enfileira
      INSERT INTO attribute_sync_queue(
        tenant_id, product_id, attribute_catalog_id,
        status, correlation_id
      ) VALUES (
        NEW.tenant_id, NEW.id, m.attribute_catalog_id,
        CASE WHEN v_has_erp THEN 'pending' ELSE 'blocked_no_erp_code' END,
        gen_random_uuid()
      )
      ON CONFLICT (product_id, attribute_catalog_id) WHERE status IN ('pending','retry','processing','blocked_no_erp_code')
      DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = now(),
        attempt_count = 0,
        error_message = NULL,
        next_retry_at = NULL;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_dirty_attributes
  AFTER INSERT OR UPDATE OF ficha_tecnica, width, length, thickness, weight, erp_product_code
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.detect_dirty_attributes();

-- =====================================================
-- 8. FUNÇÃO: liberar atributos bloqueados quando produto ganha código ERP
-- =====================================================
CREATE OR REPLACE FUNCTION public.release_blocked_attributes(p_product_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE attribute_sync_queue
  SET status = 'pending',
      attempt_count = 0,
      error_message = NULL,
      next_retry_at = NULL,
      updated_at = now()
  WHERE product_id = p_product_id
    AND status = 'blocked_no_erp_code';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
