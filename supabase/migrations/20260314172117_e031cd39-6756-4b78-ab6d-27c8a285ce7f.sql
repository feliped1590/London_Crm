
-- 1. Update status validation to include 'cancelled'
CREATE OR REPLACE FUNCTION public.validate_transfer_request_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Status inválido: %. Valores aceitos: pending, approved, rejected, cancelled', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Unique partial index: only one pending request per company
CREATE UNIQUE INDEX idx_unique_pending_transfer_per_company
  ON public.customer_transfer_requests (company_id)
  WHERE status = 'pending';

-- 3. Trigger to block self-transfer (from = to)
CREATE OR REPLACE FUNCTION public.validate_transfer_request_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_requester_rep_ids UUID[];
BEGIN
  -- Block self-transfer
  IF NEW.from_sales_rep_id = NEW.to_sales_rep_id THEN
    RAISE EXCEPTION 'Não é possível solicitar transferência para a mesma carteira';
  END IF;

  -- Block if requester owns the client (from_sales_rep belongs to requester)
  SELECT array_agg(usr.sales_rep_id) INTO v_requester_rep_ids
  FROM public.user_sales_reps usr
  WHERE usr.user_id = NEW.requested_by;

  IF NEW.from_sales_rep_id = ANY(COALESCE(v_requester_rep_ids, ARRAY[]::UUID[])) THEN
    RAISE EXCEPTION 'Não é possível solicitar transferência de um cliente da sua própria carteira';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_transfer_rules
  BEFORE INSERT ON public.customer_transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_transfer_request_rules();

-- 4. Allow requester to cancel their own pending request (UPDATE policy addition)
DROP POLICY IF EXISTS "update_transfer_requests" ON public.customer_transfer_requests;

CREATE POLICY "update_transfer_requests" ON public.customer_transfer_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor')
    OR (requested_by = auth.uid() AND status = 'pending')
  );

-- 5. Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  metadata JSONB,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_update_own_notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- System can insert (via security definer functions)
CREATE POLICY "system_insert_notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;

-- 6. Function to notify on transfer request creation
CREATE OR REPLACE FUNCTION public.notify_transfer_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_name TEXT;
  v_from_rep_name TEXT;
  v_to_rep_name TEXT;
  v_requester_name TEXT;
  v_admin RECORD;
  v_owner_user_id UUID;
BEGIN
  -- Get names
  SELECT COALESCE(c.fantasia, c.name) INTO v_company_name FROM public.companies c WHERE c.id = NEW.company_id;
  SELECT sr.name INTO v_from_rep_name FROM public.sales_reps sr WHERE sr.id = NEW.from_sales_rep_id;
  SELECT sr.name INTO v_to_rep_name FROM public.sales_reps sr WHERE sr.id = NEW.to_sales_rep_id;
  SELECT p.full_name INTO v_requester_name FROM public.profiles p WHERE p.user_id = NEW.requested_by;

  -- Notify all admins
  FOR v_admin IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link, metadata, tenant_id)
    VALUES (
      v_admin.user_id,
      'Nova solicitação de transferência',
      'Cliente: ' || v_company_name || ' | De: ' || v_from_rep_name || ' → Para: ' || v_to_rep_name || ' | Solicitante: ' || v_requester_name,
      'transfer_request',
      '/customers/' || NEW.company_id,
      jsonb_build_object('request_id', NEW.id, 'company_id', NEW.company_id),
      NEW.tenant_id
    );
  END LOOP;

  -- Notify current owner (user linked to from_sales_rep)
  FOR v_admin IN
    SELECT usr.user_id FROM public.user_sales_reps usr WHERE usr.sales_rep_id = NEW.from_sales_rep_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link, metadata, tenant_id)
    VALUES (
      v_admin.user_id,
      'Solicitação de transferência para seu cliente',
      v_requester_name || ' solicitou a transferência do cliente ' || v_company_name || ' da sua carteira.',
      'transfer_request',
      '/customers/' || NEW.company_id,
      jsonb_build_object('request_id', NEW.id, 'company_id', NEW.company_id),
      NEW.tenant_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_transfer_request
  AFTER INSERT ON public.customer_transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_transfer_request();
