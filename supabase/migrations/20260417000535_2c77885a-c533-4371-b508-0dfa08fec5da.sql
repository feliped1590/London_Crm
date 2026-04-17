
-- Endurecer enforce_order_lock: comparar registro inteiro, permitindo apenas
-- alterações em status, is_locked, locked_at, locked_by, updated_at.
-- Isso fecha brechas de campos de logística/outros campos que possam ser
-- adicionados no futuro e não estavam na lista manual.

CREATE OR REPLACE FUNCTION public.enforce_order_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_normalized JSONB;
  v_new_normalized JSONB;
BEGIN
  -- DELETE bloqueado se locked
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_locked = true THEN
      RAISE EXCEPTION 'Pedido bloqueado não pode ser excluído. Desbloqueie primeiro (apenas admin).'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: se OLD estava locked, comparar tudo exceto a whitelist
  IF TG_OP = 'UPDATE' AND OLD.is_locked = true THEN
    -- Normaliza removendo campos permitidos. Se sobrar diferença, bloqueia.
    v_old_normalized := to_jsonb(OLD)
      - 'status'
      - 'is_locked'
      - 'locked_at'
      - 'locked_by'
      - 'updated_at';
    v_new_normalized := to_jsonb(NEW)
      - 'status'
      - 'is_locked'
      - 'locked_at'
      - 'locked_by'
      - 'updated_at';

    IF v_old_normalized IS DISTINCT FROM v_new_normalized THEN
      RAISE EXCEPTION 'Pedido bloqueado: apenas o campo status pode ser alterado. Desbloqueie primeiro para editar outros campos.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
