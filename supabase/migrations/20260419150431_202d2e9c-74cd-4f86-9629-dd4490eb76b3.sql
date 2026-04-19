-- =====================================================
-- FASE 3: Sincronização Pipeline → Order (com dry-run)
-- =====================================================

-- 1) RPC principal: apply_pipeline_stage_to_order
-- Aplica o mapping de uma etapa do pipeline aos pedidos vinculados ao deal.
-- Respeita: dry_run, lock, transições válidas, status final, mappings inexistentes.
CREATE OR REPLACE FUNCTION public.apply_pipeline_stage_to_order(
  p_deal_id uuid,
  p_new_stage_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_id uuid;
  v_controls_order boolean;
  v_mapping RECORD;
  v_order RECORD;
  v_dry_run boolean := true; -- DEFAULT seguro: dry-run ligado
  v_tenant_id uuid;
  v_transition_valid boolean;
  v_processed int := 0;
  v_skipped int := 0;
  v_applied int := 0;
  v_logs jsonb := '[]'::jsonb;
BEGIN
  -- 1. Resolver pipeline + tenant do deal
  SELECT d.pipeline_id, d.tenant_id
  INTO v_pipeline_id, v_tenant_id
  FROM public.deals d
  WHERE d.id = p_deal_id;

  IF v_pipeline_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_pipeline', 'deal_id', p_deal_id);
  END IF;

  -- 2. Verificar se pipeline controla ordens
  SELECT controls_order_status INTO v_controls_order
  FROM public.pipelines
  WHERE id = v_pipeline_id;

  IF NOT COALESCE(v_controls_order, false) THEN
    -- Early return silencioso: pipeline puramente comercial
    RETURN jsonb_build_object('status', 'pipeline_disabled', 'pipeline_id', v_pipeline_id);
  END IF;

  -- 3. Resolver dry-run a partir de tenant_settings
  SELECT COALESCE((settings->>'pipeline_sync_dry_run')::boolean, true)
  INTO v_dry_run
  FROM public.tenant_settings
  WHERE tenant_id = v_tenant_id
    AND category = 'pipeline_sync'
  LIMIT 1;

  IF v_dry_run IS NULL THEN
    v_dry_run := true; -- Sem config → dry-run por segurança
  END IF;

  -- 4. Buscar mapping da etapa (pode haver 1 global ou específicos por order_type)
  -- Tratamos cada pedido individualmente com seu próprio order_type abaixo.

  -- 5. Iterar pedidos vinculados ao deal
  FOR v_order IN
    SELECT o.id, o.status, o.is_locked, o.order_type, o.tenant_id
    FROM public.orders o
    WHERE o.deal_id = p_deal_id
  LOOP
    v_processed := v_processed + 1;

    -- Lock por pedido para evitar concorrência (uso de hashtext porque uuid não cabe em bigint)
    PERFORM pg_advisory_xact_lock(hashtext(v_order.id::text));

    -- Buscar mapping aplicável: específico do order_type OU global (NULL)
    SELECT m.id, m.target_order_status, m.auto_apply, m.applies_to_order_type
    INTO v_mapping
    FROM public.pipeline_stage_order_status_map m
    WHERE m.pipeline_stage_id = p_new_stage_id
      AND (m.applies_to_order_type IS NULL OR m.applies_to_order_type = v_order.order_type)
    ORDER BY (m.applies_to_order_type IS NOT NULL) DESC -- prioriza específico
    LIMIT 1;

    -- 5.1 Sem mapping → skip
    IF v_mapping.id IS NULL THEN
      INSERT INTO public.pipeline_sync_skip_log (
        order_id, deal_id, pipeline_stage_id, current_status,
        attempted_status, skip_reason, triggered_by
      ) VALUES (
        v_order.id, p_deal_id, p_new_stage_id, v_order.status,
        NULL, 'no_mapping', p_actor_id
      );
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- 5.2 Pedido travado → skip
    IF v_order.is_locked THEN
      INSERT INTO public.pipeline_sync_skip_log (
        order_id, deal_id, pipeline_stage_id, current_status,
        attempted_status, skip_reason, triggered_by
      ) VALUES (
        v_order.id, p_deal_id, p_new_stage_id, v_order.status,
        v_mapping.target_order_status, 'locked', p_actor_id
      );
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- 5.3 Status já é igual ao destino → skip
    IF v_order.status::text = v_mapping.target_order_status::text THEN
      INSERT INTO public.pipeline_sync_skip_log (
        order_id, deal_id, pipeline_stage_id, current_status,
        attempted_status, skip_reason, triggered_by
      ) VALUES (
        v_order.id, p_deal_id, p_new_stage_id, v_order.status,
        v_mapping.target_order_status, 'already_same_status', p_actor_id
      );
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- 5.4 Status final → skip (nunca sobrescrever cancelado/entregue)
    IF v_order.status::text IN ('cancelado', 'entregue') THEN
      INSERT INTO public.pipeline_sync_skip_log (
        order_id, deal_id, pipeline_stage_id, current_status,
        attempted_status, skip_reason, triggered_by
      ) VALUES (
        v_order.id, p_deal_id, p_new_stage_id, v_order.status,
        v_mapping.target_order_status, 'final_status', p_actor_id
      );
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- 5.5 Validar transição (fonte única: order_status_transitions)
    SELECT EXISTS (
      SELECT 1 FROM public.order_status_transitions t
      WHERE t.from_status::text = v_order.status::text
        AND t.to_status::text = v_mapping.target_order_status::text
        AND t.order_type = v_order.order_type
        AND t.is_active = true
    ) INTO v_transition_valid;

    IF NOT v_transition_valid THEN
      INSERT INTO public.pipeline_sync_skip_log (
        order_id, deal_id, pipeline_stage_id, current_status,
        attempted_status, skip_reason, triggered_by, details
      ) VALUES (
        v_order.id, p_deal_id, p_new_stage_id, v_order.status,
        v_mapping.target_order_status, 'invalid_transition', p_actor_id,
        jsonb_build_object('order_type', v_order.order_type)
      );
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- 5.6 auto_apply = false → não aplicar via trigger, apenas registrar sugestão
    IF NOT v_mapping.auto_apply THEN
      INSERT INTO public.pipeline_sync_skip_log (
        order_id, deal_id, pipeline_stage_id, current_status,
        attempted_status, skip_reason, triggered_by, details
      ) VALUES (
        v_order.id, p_deal_id, p_new_stage_id, v_order.status,
        v_mapping.target_order_status, 'manual_only', p_actor_id,
        jsonb_build_object('hint', 'auto_apply=false: requer confirmação manual no frontend')
      );
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- 6. Aplicação (real ou dry-run)
    IF v_dry_run THEN
      INSERT INTO public.pipeline_sync_log (
        order_id, deal_id, pipeline_stage_id,
        old_status, new_status, triggered_by, reason
      ) VALUES (
        v_order.id, p_deal_id, p_new_stage_id,
        v_order.status, v_mapping.target_order_status, p_actor_id,
        'dry_run: simulação — nenhuma alteração aplicada'
      );
    ELSE
      -- Aplicação real: registra aprovação ANTES de mudar status (auditoria)
      INSERT INTO public.order_approvals (
        order_id, from_status, to_status, approved_by, notes
      ) VALUES (
        v_order.id, v_order.status, v_mapping.target_order_status::order_status,
        p_actor_id,
        format('Sincronizado automaticamente da etapa do pipeline (stage_id=%s)', p_new_stage_id)
      );

      UPDATE public.orders
      SET status = v_mapping.target_order_status::order_status,
          updated_at = now()
      WHERE id = v_order.id;

      INSERT INTO public.pipeline_sync_log (
        order_id, deal_id, pipeline_stage_id,
        old_status, new_status, triggered_by, reason
      ) VALUES (
        v_order.id, p_deal_id, p_new_stage_id,
        v_order.status, v_mapping.target_order_status, p_actor_id,
        'applied: status atualizado via pipeline_sync'
      );
      v_applied := v_applied + 1;
    END IF;

    v_logs := v_logs || jsonb_build_object(
      'order_id', v_order.id,
      'old_status', v_order.status,
      'new_status', v_mapping.target_order_status,
      'mode', CASE WHEN v_dry_run THEN 'dry_run' ELSE 'applied' END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'dry_run', v_dry_run,
    'processed', v_processed,
    'applied', v_applied,
    'skipped', v_skipped,
    'logs', v_logs
  );
END;
$$;

-- 2) Trigger function em deals
CREATE OR REPLACE FUNCTION public.trg_sync_deal_stage_to_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_controls boolean;
BEGIN
  -- Só age se a etapa realmente mudou
  IF NEW.pipeline_stage_id IS NULL OR NEW.pipeline_stage_id = OLD.pipeline_stage_id THEN
    RETURN NEW;
  END IF;

  -- Early-return se pipeline não controla ordens (zero custo para outras empresas)
  SELECT controls_order_status INTO v_controls
  FROM public.pipelines
  WHERE id = NEW.pipeline_id;

  IF NOT COALESCE(v_controls, false) THEN
    RETURN NEW;
  END IF;

  -- Dispara RPC. auth.uid() pode ser NULL em contextos system → vira 'system' implicitamente
  PERFORM public.apply_pipeline_stage_to_order(
    NEW.id,
    NEW.pipeline_stage_id,
    auth.uid()
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- NUNCA bloquear o update do deal por falha de sync. Loga e segue.
  INSERT INTO public.pipeline_sync_skip_log (
    order_id, deal_id, pipeline_stage_id, current_status,
    attempted_status, skip_reason, triggered_by, details
  ) VALUES (
    gen_random_uuid(), NEW.id, NEW.pipeline_stage_id, NULL,
    NULL, 'trigger_error', auth.uid(),
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  );
  RETURN NEW;
END;
$$;

-- 3) Trigger AFTER UPDATE OF pipeline_stage_id em deals
DROP TRIGGER IF EXISTS trg_deals_sync_to_orders ON public.deals;
CREATE TRIGGER trg_deals_sync_to_orders
AFTER UPDATE OF pipeline_stage_id ON public.deals
FOR EACH ROW
WHEN (NEW.pipeline_stage_id IS DISTINCT FROM OLD.pipeline_stage_id)
EXECUTE FUNCTION public.trg_sync_deal_stage_to_orders();

-- 4) Permissões na RPC (chamável também via supabase client p/ "Re-sincronizar" manual)
GRANT EXECUTE ON FUNCTION public.apply_pipeline_stage_to_order(uuid, uuid, uuid) TO authenticated;