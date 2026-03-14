
-- 1. Add missing columns to portfolio_transfers for transfer analytics
ALTER TABLE public.portfolio_transfers
  ADD COLUMN IF NOT EXISTS from_sales_rep_id UUID REFERENCES public.sales_reps(id),
  ADD COLUMN IF NOT EXISTS to_sales_rep_id UUID REFERENCES public.sales_reps(id),
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transfer_request_id UUID REFERENCES public.customer_transfer_requests(id);

-- 2. Recreate approve function with correct column names and enriched data
CREATE OR REPLACE FUNCTION public.approve_transfer_request(p_request_id UUID, p_review_note TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
  v_company_name TEXT;
  v_from_rep_name TEXT;
  v_to_rep_name TEXT;
BEGIN
  -- Check admin
  IF NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'desenvolvedor') THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar transferências';
  END IF;

  -- Get request with FOR UPDATE to lock the row
  SELECT * INTO v_request 
  FROM public.customer_transfer_requests 
  WHERE id = p_request_id
  FOR UPDATE;
  
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Solicitação já foi processada';
  END IF;

  -- Get names for audit
  SELECT COALESCE(c.fantasia, c.name) INTO v_company_name FROM public.companies c WHERE c.id = v_request.company_id;
  SELECT sr.name INTO v_from_rep_name FROM public.sales_reps sr WHERE sr.id = v_request.from_sales_rep_id;
  SELECT sr.name INTO v_to_rep_name FROM public.sales_reps sr WHERE sr.id = v_request.to_sales_rep_id;

  -- Step 1: Update request status
  UPDATE public.customer_transfer_requests
  SET status = 'approved', reviewed_by = auth.uid(), review_note = p_review_note, reviewed_at = now()
  WHERE id = p_request_id;

  -- Step 2: Transfer the client
  UPDATE public.companies
  SET sales_rep_id = v_request.to_sales_rep_id, updated_at = now()
  WHERE id = v_request.company_id;

  -- Step 3: Log in portfolio_transfers with full audit data
  INSERT INTO public.portfolio_transfers (
    entity_type, entity_id, entity_name,
    from_sales_rep_id, to_sales_rep_id,
    from_user_id, to_user_id,
    requested_by, approved_by, approved_at,
    reason, transferred_by, transfer_request_id,
    notes
  ) VALUES (
    'company',
    v_request.company_id,
    COALESCE(v_company_name, ''),
    v_request.from_sales_rep_id,
    v_request.to_sales_rep_id,
    -- from_user_id: user linked to old rep
    (SELECT usr.user_id FROM public.user_sales_reps usr WHERE usr.sales_rep_id = v_request.from_sales_rep_id LIMIT 1),
    -- to_user_id: user linked to new rep
    (SELECT usr.user_id FROM public.user_sales_reps usr WHERE usr.sales_rep_id = v_request.to_sales_rep_id LIMIT 1),
    v_request.requested_by,
    auth.uid(),
    now(),
    v_request.reason,
    auth.uid(),
    p_request_id,
    'Transferência via solicitação formal. De: ' || COALESCE(v_from_rep_name, '?') || ' → Para: ' || COALESCE(v_to_rep_name, '?')
  );

  RETURN json_build_object(
    'success', true, 
    'message', 'Transferência aprovada com sucesso',
    'company_name', v_company_name,
    'from_rep', v_from_rep_name,
    'to_rep', v_to_rep_name
  );
END;
$$;
