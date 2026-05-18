CREATE OR REPLACE FUNCTION public.enforce_order_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old_normalized JSONB;
  v_new_normalized JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_locked = true THEN
      RAISE EXCEPTION 'Pedido bloqueado não pode ser excluído. Desbloqueie primeiro (apenas admin).'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_locked = true THEN
    v_old_normalized := to_jsonb(OLD)
      - 'status'
      - 'is_locked'
      - 'locked_at'
      - 'locked_by'
      - 'updated_at'
      - 'erp_sync_status'
      - 'erp_order_id'
      - 'erp_order_code'
      - 'erp_synced_at'
      - 'erp_last_sync_at'
      - 'erp_last_update_date'
      - 'pedido_terceiro';
    v_new_normalized := to_jsonb(NEW)
      - 'status'
      - 'is_locked'
      - 'locked_at'
      - 'locked_by'
      - 'updated_at'
      - 'erp_sync_status'
      - 'erp_order_id'
      - 'erp_order_code'
      - 'erp_synced_at'
      - 'erp_last_sync_at'
      - 'erp_last_update_date'
      - 'pedido_terceiro';

    IF v_old_normalized IS DISTINCT FROM v_new_normalized THEN
      RAISE EXCEPTION 'Pedido bloqueado: apenas o campo status pode ser alterado. Desbloqueie primeiro para editar outros campos.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;