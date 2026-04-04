
-- Constraint: erp_versao não pode ser string vazia
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS chk_erp_versao_not_empty;

ALTER TABLE public.products
  ADD CONSTRAINT chk_erp_versao_not_empty
  CHECK (erp_versao IS NULL OR length(trim(erp_versao)) > 0);

-- Tabela product_sync_log
CREATE TABLE IF NOT EXISTS public.product_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  queue_item_id uuid REFERENCES public.product_sync_queue(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'crm_to_erp',
  status text NOT NULL,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  erp_hash_at_sync text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_sync_log_product ON public.product_sync_log(product_id);
CREATE INDEX IF NOT EXISTS idx_product_sync_log_status ON public.product_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_product_sync_log_created ON public.product_sync_log(created_at DESC);

ALTER TABLE public.product_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync logs"
  ON public.product_sync_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access sync logs"
  ON public.product_sync_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Atualizar BEFORE trigger para suportar 'SYNC'
CREATE OR REPLACE FUNCTION public.mark_product_pending_sync_before()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_new_hash TEXT;
BEGIN
  IF NEW.origem_alteracao IN ('ERP', 'SYNC') THEN
    RETURN NEW;
  END IF;

  v_new_hash := public.compute_product_erp_hash(NEW);

  IF TG_OP = 'INSERT' THEN
    NEW.erp_hash := v_new_hash;
    NEW.pendente_envio := true;
    NEW.crm_last_update_at := now();
    NEW.origem_alteracao := 'CRM';
    RETURN NEW;
  END IF;

  IF OLD.erp_hash IS DISTINCT FROM v_new_hash THEN
    NEW.erp_hash := v_new_hash;
    NEW.pendente_envio := true;
    NEW.crm_last_update_at := now();
    NEW.origem_alteracao := 'CRM';
  END IF;

  RETURN NEW;
END;
$$;

-- Atualizar AFTER trigger
CREATE OR REPLACE FUNCTION public.mark_product_pending_sync_after()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.origem_alteracao IN ('ERP', 'SYNC') THEN
    RETURN NEW;
  END IF;

  IF NEW.pendente_envio = true THEN
    INSERT INTO public.product_sync_queue (product_id, status)
    VALUES (NEW.id, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
