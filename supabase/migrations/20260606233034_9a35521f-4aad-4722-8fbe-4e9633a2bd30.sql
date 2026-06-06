
CREATE OR REPLACE FUNCTION public.review_commercial_approval_request(
  _id uuid,
  _decision text,
  _notes text DEFAULT NULL,
  _approved_value jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.order_approval_requests%ROWTYPE;
BEGIN
  IF NOT public.is_governance_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas Admin ou Desenvolvedor podem revisar solicitações';
  END IF;
  IF _decision NOT IN ('approved','rejected','cancelled') THEN
    RAISE EXCEPTION 'decisão inválida: %', _decision;
  END IF;

  UPDATE public.order_approval_requests
     SET status = _decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_notes = _notes,
         approved_value = COALESCE(_approved_value, requested_value)
   WHERE id = _id
     AND status = 'pending'
   RETURNING * INTO v_req;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já revisada';
  END IF;

  -- Audit log (best-effort; ignore failures so review still completes)
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      'governance_request_' || _decision,
      'order_approval_request',
      v_req.id,
      jsonb_build_object(
        'order_id', v_req.order_id,
        'order_item_id', v_req.order_item_id,
        'request_type', v_req.request_type,
        'rule_id', v_req.rule_id,
        'requested_value', v_req.requested_value,
        'max_allowed', v_req.max_allowed,
        'approved_value', v_req.approved_value,
        'notes', _notes,
        'requested_by', v_req.requested_by
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;
