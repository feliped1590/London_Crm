
-- Fix: Split trigger into BEFORE (set fields) and AFTER (queue insert)

-- 1. BEFORE trigger: only sets fields on NEW (no FK issues)
CREATE OR REPLACE FUNCTION public.mark_product_pending_sync_before()
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
    RETURN NEW;
  END IF;

  -- UPDATE: only if hash changed
  IF OLD.erp_hash IS DISTINCT FROM v_new_hash THEN
    NEW.erp_hash := v_new_hash;
    NEW.pendente_envio := true;
    NEW.crm_last_update_at := now();
    NEW.origem_alteracao := 'CRM';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. AFTER trigger: inserts into queue (product row exists now)
CREATE OR REPLACE FUNCTION public.mark_product_pending_sync_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.origem_alteracao = 'ERP' THEN
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

-- Drop old trigger
DROP TRIGGER IF EXISTS trg_mark_product_pending_sync ON public.products;

-- Create BEFORE trigger (sets fields)
CREATE TRIGGER trg_product_sync_before
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_product_pending_sync_before();

-- Create AFTER trigger (queues)
CREATE TRIGGER trg_product_sync_after
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_product_pending_sync_after();
