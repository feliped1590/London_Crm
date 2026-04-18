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
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pipeline_id uuid;
  v_scope text;
  v_is_admin boolean;
  v_invalid_count int;
  v_missing_count int;
BEGIN
  -- Autorização: só admin/desenvolvedor
  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'desenvolvedor'::app_role);
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Sem permissão para salvar funil' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Validação de entrada: empresas devem existir e estar ativas
  IF _legal_entity_ids IS NOT NULL AND array_length(_legal_entity_ids, 1) > 0 THEN
    SELECT count(*) INTO v_missing_count
    FROM unnest(_legal_entity_ids) AS eid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.legal_entities le WHERE le.id = eid AND le.is_active = true
    );
    IF v_missing_count > 0 THEN
      RAISE EXCEPTION 'Uma ou mais empresas selecionadas não existem ou estão inativas'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Admin/dev pode vincular qualquer empresa; demais (defesa em profundidade)
    -- só podem vincular empresas às quais têm acesso. Hoje só admin chega aqui,
    -- mas validamos para evitar bypass futuro.
    IF NOT v_is_admin THEN
      SELECT count(*) INTO v_invalid_count
      FROM unnest(_legal_entity_ids) AS eid
      WHERE NOT public.user_has_legal_entity_access(eid);
      IF v_invalid_count > 0 THEN
        RAISE EXCEPTION 'Acesso inválido a uma ou mais empresas selecionadas'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  -- Escopo derivado (consistência total: 0 = global, 1+ = restricted)
  v_scope := CASE
    WHEN _legal_entity_ids IS NULL OR array_length(_legal_entity_ids, 1) IS NULL THEN 'global'
    ELSE 'restricted'
  END;

  IF _pipeline_id IS NULL THEN
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

  -- Reforço final: garantir consistência scope ↔ vínculos (defesa contra triggers externos)
  UPDATE public.pipelines p SET pipeline_scope = CASE
    WHEN (SELECT count(*) FROM public.pipeline_legal_entities WHERE pipeline_id = p.id) = 0 THEN 'global'
    ELSE 'restricted'
  END
  WHERE p.id = v_pipeline_id;

  RETURN v_pipeline_id;
END;
$function$;