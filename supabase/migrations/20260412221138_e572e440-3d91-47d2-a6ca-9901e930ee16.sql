
-- RPC to validate stage movement permission (server-side)
CREATE OR REPLACE FUNCTION public.validate_stage_permission(
  p_deal_id UUID,
  p_target_stage TEXT,
  p_pipeline_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_allowed_roles TEXT[];
  v_user_has_role BOOLEAN;
  v_is_admin BOOLEAN;
BEGIN
  -- Check admin bypass
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'admin_bypass');
  END IF;

  -- Get allowed_roles for target stage
  SELECT ps.allowed_roles INTO v_allowed_roles
  FROM pipeline_stages ps
  WHERE ps.pipeline_id = p_pipeline_id AND ps.stage = p_target_stage;

  -- If no restriction, allow
  IF v_allowed_roles IS NULL OR array_length(v_allowed_roles, 1) IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_restriction');
  END IF;

  -- Check if user has any of the allowed roles
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = v_user_id AND ur.role = ANY(v_allowed_roles)
  ) INTO v_user_has_role;

  IF v_user_has_role THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'role_match');
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'no_permission');
END;
$$;
