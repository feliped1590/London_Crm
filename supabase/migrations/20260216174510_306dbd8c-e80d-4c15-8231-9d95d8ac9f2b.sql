
-- Fix: drop only the existing conflicting policy
DROP POLICY IF EXISTS "Admins can manage sync control" ON public.erp_sync_control;

-- =====================================================
-- 1. NOVOS CAMPOS NA TABELA PRODUCTS
-- =====================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS erp_versao TEXT,
  ADD COLUMN IF NOT EXISTS origem_alteracao TEXT DEFAULT 'CRM',
  ADD COLUMN IF NOT EXISTS pendente_envio BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS erp_hash TEXT,
  ADD COLUMN IF NOT EXISTS erp_last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS crm_last_update_at TIMESTAMPTZ DEFAULT now();

-- =====================================================
-- 2. TABELA DE FILA DE SINCRONIZAÇÃO CRM → ERP
-- =====================================================

CREATE TABLE IF NOT EXISTS public.product_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  error_message TEXT,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.product_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sync queue"
  ON public.product_sync_queue
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_sync_pending
  ON public.product_sync_queue(product_id)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_product_sync_queue_status
  ON public.product_sync_queue(status, next_retry_at);

-- =====================================================
-- 3. TABELA DE LOG DE SINCRONIZAÇÃO
-- =====================================================

CREATE TABLE IF NOT EXISTS public.product_erp_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_sent JSONB,
  response_received JSONB,
  error_details TEXT,
  erp_product_code TEXT,
  erp_versao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.product_erp_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync logs"
  ON public.product_erp_sync_log
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_sync_log_product
  ON public.product_erp_sync_log(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_log_direction
  ON public.product_erp_sync_log(direction, created_at DESC);

-- =====================================================
-- 4. RECREATE POLICY ON erp_sync_control
-- =====================================================

CREATE POLICY "Admins can manage sync control"
  ON public.erp_sync_control
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 5. FUNÇÃO DE HASH
-- =====================================================

CREATE OR REPLACE FUNCTION public.compute_product_erp_hash(p products)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT encode(
    sha256(
      convert_to(
        COALESCE(p.name, '') || '|' ||
        COALESCE(p.description, '') || '|' ||
        COALESCE(p.category, '') || '|' ||
        COALESCE(p.subcategory, '') || '|' ||
        COALESCE(p.unit_measure, '') || '|' ||
        COALESCE(p.weight::TEXT, '') || '|' ||
        COALESCE(p.ncm_code::TEXT, '') || '|' ||
        COALESCE(p.erp_product_code, '') || '|' ||
        COALESCE(p.erp_versao, '') || '|' ||
        COALESCE(p.color, '') || '|' ||
        COALESCE(p.material, ''),
        'UTF8'
      )
    ),
    'hex'
  );
$$;

-- =====================================================
-- 6. TRIGGER INTELIGENTE
-- =====================================================

CREATE OR REPLACE FUNCTION public.mark_product_pending_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_hash TEXT;
BEGIN
  IF NEW.origem_alteracao = 'ERP' THEN
    RETURN NEW;
  END IF;

  v_new_hash := public.compute_product_erp_hash(NEW);

  IF TG_OP = 'INSERT' THEN
    NEW.erp_hash := v_new_hash;
    NEW.pendente_envio := true;
    NEW.crm_last_update_at := now();
    NEW.origem_alteracao := 'CRM';

    INSERT INTO public.product_sync_queue (product_id, status)
    VALUES (NEW.id, 'pending')
    ON CONFLICT DO NOTHING;

    RETURN NEW;
  END IF;

  IF OLD.erp_hash IS DISTINCT FROM v_new_hash THEN
    NEW.erp_hash := v_new_hash;
    NEW.pendente_envio := true;
    NEW.crm_last_update_at := now();
    NEW.origem_alteracao := 'CRM';

    INSERT INTO public.product_sync_queue (product_id, status)
    VALUES (NEW.id, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_product_pending_sync ON public.products;

CREATE TRIGGER trg_mark_product_pending_sync
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_product_pending_sync();
