
-- Table: customer_transfer_requests
CREATE TABLE public.customer_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_sales_rep_id UUID NOT NULL REFERENCES public.sales_reps(id),
  to_sales_rep_id UUID NOT NULL REFERENCES public.sales_reps(id),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_transfer_request_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Status inválido: %. Valores aceitos: pending, approved, rejected', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_transfer_status
  BEFORE INSERT OR UPDATE ON public.customer_transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_transfer_request_status();

-- RLS
ALTER TABLE public.customer_transfer_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: admins see all, others see only their own requests
CREATE POLICY "select_transfer_requests" ON public.customer_transfer_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor')
  );

-- INSERT: authenticated users, must be self
CREATE POLICY "insert_transfer_requests" ON public.customer_transfer_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- UPDATE: only admins/devs (for approval/rejection)
CREATE POLICY "update_transfer_requests" ON public.customer_transfer_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor')
  );

-- Function to approve a transfer request
CREATE OR REPLACE FUNCTION public.approve_transfer_request(p_request_id UUID, p_review_note TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
  v_reviewer_name TEXT;
BEGIN
  -- Check admin
  IF NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'desenvolvedor') THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar transferências';
  END IF;

  -- Get request
  SELECT * INTO v_request FROM public.customer_transfer_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Solicitação já foi processada';
  END IF;

  -- Get reviewer name
  SELECT full_name INTO v_reviewer_name FROM public.profiles WHERE user_id = auth.uid();

  -- Update request status
  UPDATE public.customer_transfer_requests
  SET status = 'approved', reviewed_by = auth.uid(), review_note = p_review_note, reviewed_at = now()
  WHERE id = p_request_id;

  -- Transfer: update sales_rep_id on company
  UPDATE public.companies
  SET sales_rep_id = v_request.to_sales_rep_id, updated_at = now()
  WHERE id = v_request.company_id;

  -- Log in portfolio_transfers
  INSERT INTO public.portfolio_transfers (
    entity_type, entity_id, from_sales_rep_id, to_sales_rep_id, 
    reason, transferred_by, tenant_id
  ) VALUES (
    'company', v_request.company_id, v_request.from_sales_rep_id, v_request.to_sales_rep_id,
    v_request.reason, auth.uid(), v_request.tenant_id
  );

  RETURN json_build_object('success', true, 'message', 'Transferência aprovada com sucesso');
END;
$$;

-- Index for performance
CREATE INDEX idx_transfer_requests_status ON public.customer_transfer_requests(status);
CREATE INDEX idx_transfer_requests_company ON public.customer_transfer_requests(company_id);
