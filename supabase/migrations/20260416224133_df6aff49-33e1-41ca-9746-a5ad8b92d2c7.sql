
-- ============================================
-- PARTE 1: Novos campos em orders
-- ============================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS locked_by UUID NULL;

CREATE INDEX IF NOT EXISTS idx_orders_is_locked ON public.orders(is_locked) WHERE is_locked = true;

-- ============================================
-- PARTE 2: Trigger em ORDERS - bloquear UPDATE (exceto status) e DELETE
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_order_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DELETE bloqueado se locked
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_locked = true THEN
      RAISE EXCEPTION 'Pedido bloqueado não pode ser excluído. Desbloqueie primeiro (apenas admin).'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: se OLD estava locked, só permite alterar status, is_locked, locked_at, locked_by
  IF TG_OP = 'UPDATE' AND OLD.is_locked = true THEN
    -- Permite alterações que mudam apenas status e/ou os próprios campos de lock
    IF (
      OLD.number IS DISTINCT FROM NEW.number OR
      OLD.company_id IS DISTINCT FROM NEW.company_id OR
      OLD.contact_id IS DISTINCT FROM NEW.contact_id OR
      OLD.proposal_id IS DISTINCT FROM NEW.proposal_id OR
      OLD.order_type IS DISTINCT FROM NEW.order_type OR
      OLD.ipi_mode IS DISTINCT FROM NEW.ipi_mode OR
      OLD.total_value IS DISTINCT FROM NEW.total_value OR
      OLD.subtotal_products IS DISTINCT FROM NEW.subtotal_products OR
      OLD.total_ipi IS DISTINCT FROM NEW.total_ipi OR
      OLD.delivery_date IS DISTINCT FROM NEW.delivery_date OR
      OLD.payment_method IS DISTINCT FROM NEW.payment_method OR
      OLD.payment_terms IS DISTINCT FROM NEW.payment_terms OR
      OLD.carrier_id IS DISTINCT FROM NEW.carrier_id OR
      OLD.freight_type IS DISTINCT FROM NEW.freight_type OR
      OLD.observations IS DISTINCT FROM NEW.observations OR
      OLD.legal_entity_id IS DISTINCT FROM NEW.legal_entity_id OR
      OLD.sales_rep_id IS DISTINCT FROM NEW.sales_rep_id
    ) THEN
      RAISE EXCEPTION 'Pedido bloqueado: apenas o campo status pode ser alterado. Desbloqueie primeiro para editar outros campos.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_lock_update ON public.orders;
CREATE TRIGGER trg_enforce_order_lock_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_lock();

DROP TRIGGER IF EXISTS trg_enforce_order_lock_delete ON public.orders;
CREATE TRIGGER trg_enforce_order_lock_delete
  BEFORE DELETE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_lock();

-- ============================================
-- PARTE 3: Trigger em ORDER_ITEMS - bloquear INSERT/UPDATE/DELETE quando pedido pai está locked
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_order_items_parent_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_locked BOOLEAN;
  v_order_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  SELECT is_locked INTO v_parent_locked
  FROM public.orders
  WHERE id = v_order_id;

  IF v_parent_locked = true THEN
    RAISE EXCEPTION 'Pedido bloqueado: itens não podem ser modificados (operação: %).', TG_OP
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_items_parent_lock_iud ON public.order_items;
CREATE TRIGGER trg_enforce_order_items_parent_lock_iud
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_items_parent_lock();

-- ============================================
-- PARTE 4: RPC lock_order
-- ============================================
CREATE OR REPLACE FUNCTION public.lock_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_already_locked BOOLEAN;
  v_item_count INTEGER;
  v_order_number TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Verifica existência e estado atual
  SELECT is_locked, number INTO v_already_locked, v_order_number
  FROM public.orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_already_locked = true THEN
    RETURN jsonb_build_object('success', true, 'already_locked', true);
  END IF;

  -- Valida que existe ao menos 1 item
  SELECT COUNT(*) INTO v_item_count
  FROM public.order_items WHERE order_id = p_order_id;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Pedido deve possuir ao menos um item para ser bloqueado';
  END IF;

  -- Aplica lock
  UPDATE public.orders
  SET is_locked = true,
      locked_at = now(),
      locked_by = v_user_id
  WHERE id = p_order_id;

  -- Auditoria
  INSERT INTO public.order_audit_log (order_id, field_name, field_label, old_value, new_value, changed_by)
  VALUES (p_order_id, 'is_locked', 'Bloqueio', 'false', 'true', v_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_number', v_order_number,
    'locked_at', now(),
    'locked_by', v_user_id
  );
END;
$$;

-- ============================================
-- PARTE 5: RPC unlock_order (apenas admin)
-- ============================================
CREATE OR REPLACE FUNCTION public.unlock_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_locked BOOLEAN;
  v_order_number TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Verifica permissão de admin
  SELECT public.has_role(v_user_id, 'admin'::app_role) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem desbloquear pedidos';
  END IF;

  SELECT is_locked, number INTO v_locked, v_order_number
  FROM public.orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_locked = false THEN
    RETURN jsonb_build_object('success', true, 'already_unlocked', true);
  END IF;

  UPDATE public.orders
  SET is_locked = false,
      locked_at = NULL,
      locked_by = NULL
  WHERE id = p_order_id;

  INSERT INTO public.order_audit_log (order_id, field_name, field_label, old_value, new_value, changed_by)
  VALUES (p_order_id, 'is_locked', 'Desbloqueio', 'true', 'false', v_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_number', v_order_number,
    'unlocked_by', v_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_order(UUID) TO authenticated;
