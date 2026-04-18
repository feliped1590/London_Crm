-- RPC transacional: salva pipeline + vincula entities atomicamente
CREATE OR REPLACE FUNCTION public.save_pipeline_with_entities(
  _pipeline_id uuid,
  _name text,
  _description text,
  _type text,
  _is_active boolean,
  _allowed_roles text[],
  _pipeline_mode text,
  _legal_entity_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pipeline_id uuid;
  v_scope text;
  v_is_admin boolean;
BEGIN
  -- Autorização: só admin/desenvolvedor
  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'desenvolvedor'::app_role);
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Sem permissão para salvar funil' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Escopo derivado
  v_scope := CASE WHEN array_length(_legal_entity_ids, 1) IS NULL THEN 'global' ELSE 'restricted' END;

  IF _pipeline_id IS NULL THEN
    -- INSERT
    INSERT INTO public.pipelines (
      name, description, type, is_active, allowed_roles,
      pipeline_mode, pipeline_scope, created_by
    ) VALUES (
      _name, _description, _type::text, _is_active,
      CASE WHEN array_length(_allowed_roles, 1) IS NULL THEN NULL ELSE _allowed_roles END,
      _pipeline_mode, v_scope, auth.uid()
    )
    RETURNING id INTO v_pipeline_id;
  ELSE
    -- UPDATE
    UPDATE public.pipelines SET
      name = _name,
      description = _description,
      type = _type::text,
      is_active = _is_active,
      allowed_roles = CASE WHEN array_length(_allowed_roles, 1) IS NULL THEN NULL ELSE _allowed_roles END,
      pipeline_mode = _pipeline_mode,
      pipeline_scope = v_scope,
      updated_at = now()
    WHERE id = _pipeline_id
    RETURNING id INTO v_pipeline_id;

    IF v_pipeline_id IS NULL THEN
      RAISE EXCEPTION 'Funil % não encontrado', _pipeline_id;
    END IF;
  END IF;

  -- Substituir vínculos atomicamente
  DELETE FROM public.pipeline_legal_entities WHERE pipeline_id = v_pipeline_id;

  IF _legal_entity_ids IS NOT NULL AND array_length(_legal_entity_ids, 1) > 0 THEN
    INSERT INTO public.pipeline_legal_entities (pipeline_id, legal_entity_id, created_by)
    SELECT v_pipeline_id, eid, auth.uid()
    FROM unnest(_legal_entity_ids) AS eid
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_pipeline_id;
END;
$$;