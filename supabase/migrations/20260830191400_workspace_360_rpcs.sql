-- Workspace 360: aggregator RPC + paginated timeline UNION (alternative A).
-- Tenant/company are derived from the company row; client cannot choose tenant.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_customer_workspace_summary(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_company public.companies%ROWTYPE;
  v_tz text;
  v_today date;
  v_horizon date;
  v_open text[] := ARRAY['pendente','em_andamento'];
  v_pending int := 0;
  v_overdue int := 0;
  v_today_count int := 0;
  v_week int := 0;
  v_waiting int := 0;
  v_active_processes int := 0;
  v_sla_warning int := 0;
  v_sla_critical int := 0;
  v_docs_total int := 0;
  v_docs_waiting int := 0;
  v_docs_expired int := 0;
  v_docs_due_soon int := 0;
  v_contracts_expired int := 0;
  v_contracts_renew int := 0;
  v_health text := 'unknown';
  v_reasons jsonb := '[]'::jsonb;
  v_tasks jsonb;
  v_processes jsonb;
  v_contacts jsonb;
  v_last jsonb;
  v_team jsonb;
  v_waiting_items jsonb;
  v_deadlines jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_company FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_can_operate_company(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a este cliente' USING ERRCODE = '42501';
  END IF;

  v_tz := COALESCE(public.get_tenant_timezone(v_company.tenant_id), 'America/Sao_Paulo');
  v_today := (timezone(v_tz, now()))::date;
  v_horizon := v_today + 7;

  SELECT
    COUNT(*) FILTER (WHERE t.status::text = ANY (v_open)),
    COUNT(*) FILTER (
      WHERE t.status::text = ANY (v_open)
        AND t.due_date IS NOT NULL
        AND (timezone('UTC', t.due_date))::date < v_today
    ),
    COUNT(*) FILTER (
      WHERE t.status::text = ANY (v_open)
        AND t.due_date IS NOT NULL
        AND (timezone('UTC', t.due_date))::date = v_today
    ),
    COUNT(*) FILTER (
      WHERE t.status::text = ANY (v_open)
        AND t.due_date IS NOT NULL
        AND (timezone('UTC', t.due_date))::date > v_today
        AND (timezone('UTC', t.due_date))::date <= v_horizon
    ),
    COUNT(*) FILTER (
      WHERE t.status::text = ANY (v_open)
        AND t.waiting_on = 'customer'::public.task_waiting_on::public.task_waiting_on
    )
  INTO v_pending, v_overdue, v_today_count, v_week, v_waiting
  FROM public.tasks t
  WHERE t.company_id = p_company_id
    AND t.tenant_id = v_company.tenant_id;

  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.sort_due, x.priority_rank DESC), '[]'::jsonb)
  INTO v_tasks
  FROM (
    SELECT
      t.id,
      t.title,
      t.status,
      t.priority,
      t.due_date,
      t.due_time,
      t.waiting_on,
      t.task_kind,
      t.assigned_to,
      t.deal_id,
      t.contact_id,
      CASE t.priority
        WHEN 'urgente' THEN 4 WHEN 'alta' THEN 3 WHEN 'media' THEN 2 ELSE 1
      END AS priority_rank,
      COALESCE((timezone('UTC', t.due_date))::date, DATE '9999-12-31') AS sort_due,
      CASE
        WHEN t.due_date IS NOT NULL AND (timezone('UTC', t.due_date))::date < v_today THEN 'overdue'
        WHEN t.due_date IS NOT NULL AND (timezone('UTC', t.due_date))::date = v_today THEN 'today'
        WHEN t.due_date IS NOT NULL AND (timezone('UTC', t.due_date))::date <= v_horizon THEN 'upcoming'
        ELSE 'later'
      END AS bucket
    FROM public.tasks t
    WHERE t.company_id = p_company_id
      AND t.tenant_id = v_company.tenant_id
      AND t.status::text = ANY (v_open)
    ORDER BY sort_due, priority_rank DESC
    LIMIT 40
  ) x;

  SELECT
    COUNT(*) FILTER (WHERE COALESCE(ps.stage_status, 'open') NOT IN ('won','lost','rejected','cancelled','no_profile')),
    COUNT(*) FILTER (
      WHERE COALESCE(ps.stage_status, 'open') NOT IN ('won','lost','rejected','cancelled','no_profile')
        AND ps.sla_warning_hours IS NOT NULL
        AND EXTRACT(EPOCH FROM (now() - COALESCE(hist.entered_at, d.updated_at))) / 3600.0 >= ps.sla_warning_hours
        AND (ps.sla_hours IS NULL OR EXTRACT(EPOCH FROM (now() - COALESCE(hist.entered_at, d.updated_at))) / 3600.0 < ps.sla_hours)
    ),
    COUNT(*) FILTER (
      WHERE COALESCE(ps.stage_status, 'open') NOT IN ('won','lost','rejected','cancelled','no_profile')
        AND ps.sla_hours IS NOT NULL
        AND EXTRACT(EPOCH FROM (now() - COALESCE(hist.entered_at, d.updated_at))) / 3600.0 >= ps.sla_hours
    )
  INTO v_active_processes, v_sla_warning, v_sla_critical
  FROM public.deals d
  LEFT JOIN public.pipeline_stages ps ON ps.id = d.pipeline_stage_id
  LEFT JOIN LATERAL (
    SELECT h.changed_at AS entered_at
    FROM public.deal_stage_history h
    WHERE h.deal_id = d.id
    ORDER BY h.changed_at DESC
    LIMIT 1
  ) hist ON true
  WHERE d.company_id = p_company_id
    AND d.tenant_id = v_company.tenant_id;

  SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb)
  INTO v_processes
  FROM (
    SELECT
      d.id,
      d.name,
      d.pipeline_id,
      d.pipeline_stage_id,
      d.owner_id,
      d.expected_close_date,
      ps.name AS stage_name,
      ps.stage_status,
      false AS waiting_for_customer,
      pl.name AS pipeline_name,
      pl.pipeline_mode,
      (pl.pipeline_mode IN ('operational', 'support')) AS is_operational,
      CASE
        WHEN pl.pipeline_mode IN ('operational', 'support') THEN 'process'
        WHEN pl.pipeline_mode = 'hybrid' THEN 'service'
        ELSE 'deal'
      END AS presentation,
      CASE
        WHEN ps.sla_hours IS NOT NULL
          AND EXTRACT(EPOCH FROM (now() - COALESCE(hist.entered_at, d.updated_at))) / 3600.0 >= ps.sla_hours
          THEN 'critical'
        WHEN ps.sla_warning_hours IS NOT NULL
          AND EXTRACT(EPOCH FROM (now() - COALESCE(hist.entered_at, d.updated_at))) / 3600.0 >= ps.sla_warning_hours
          THEN 'warning'
        ELSE 'ok'
      END AS sla_state,
      COALESCE(ps.stage_status, 'open') NOT IN ('won','lost','rejected','cancelled','no_profile') AS is_open
    FROM public.deals d
    LEFT JOIN public.pipeline_stages ps ON ps.id = d.pipeline_stage_id
    LEFT JOIN public.pipelines pl ON pl.id = d.pipeline_id
    LEFT JOIN LATERAL (
      SELECT h.changed_at AS entered_at
      FROM public.deal_stage_history h
      WHERE h.deal_id = d.id
      ORDER BY h.changed_at DESC
      LIMIT 1
    ) hist ON true
    WHERE d.company_id = p_company_id
      AND d.tenant_id = v_company.tenant_id
    ORDER BY d.updated_at DESC
    LIMIT 20
  ) p;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('requested', 'waiting_customer')),
    COUNT(*) FILTER (WHERE status = 'expired' OR (expires_at IS NOT NULL AND expires_at < v_today)),
    COUNT(*) FILTER (
      WHERE expires_at IS NOT NULL AND expires_at >= v_today AND expires_at <= v_horizon
    )
  INTO v_docs_total, v_docs_waiting, v_docs_expired, v_docs_due_soon
  FROM public.customer_documents cd
  WHERE cd.company_id = p_company_id AND cd.tenant_id = v_company.tenant_id
    AND public.user_can_access_customer_document(
      cd.company_id, cd.deal_id, cd.service_engagement_id, cd.responsible_user_id, cd.created_by
    );

  SELECT
    COUNT(*) FILTER (WHERE status = 'active' AND ends_on IS NOT NULL AND ends_on < v_today),
    COUNT(*) FILTER (
      WHERE status IN ('active', 'pending_renewal')
        AND COALESCE(next_renewal_on, ends_on) IS NOT NULL
        AND COALESCE(next_renewal_on, ends_on) <= v_horizon
        AND COALESCE(next_renewal_on, ends_on) >= v_today
    )
  INTO v_contracts_expired, v_contracts_renew
  FROM public.client_contracts cc
  WHERE cc.company_id = p_company_id AND cc.tenant_id = v_company.tenant_id
    AND public.user_can_access_client_contract(cc.company_id, cc.responsible_user_id, cc.created_by);

  SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb)
  INTO v_contacts
  FROM (
    SELECT ct.id, ct.first_name, ct.last_name, ct.email, ct.mobile, ct.job_title
    FROM public.contacts ct
    WHERE ct.company_id = p_company_id
    ORDER BY ct.created_at
    LIMIT 5
  ) c;

  SELECT jsonb_build_object(
    'id', e.id,
    'source', e.source,
    'title', e.title,
    'occurred_at', e.occurred_at
  )
  INTO v_last
  FROM (
    SELECT t.id, 'task'::text AS source, t.title,
      CASE
        WHEN t.status = 'concluida' THEN COALESCE(t.completed_at, t.updated_at)
        WHEN t.status = 'cancelada' THEN t.updated_at
        ELSE t.created_at
      END AS occurred_at
    FROM public.tasks t
    WHERE t.company_id = p_company_id
    UNION ALL
    SELECT a.id, 'activity', COALESCE(a.subject, a.type), a.created_at
    FROM public.activities a
    WHERE a.company_id = p_company_id
    UNION ALL
    SELECT f.id, 'followup', COALESCE(f.description, f.channel), f.interaction_at
    FROM public.deal_followups f
    WHERE f.company_id = p_company_id AND f.deleted_at IS NULL
    ORDER BY 4 DESC
    LIMIT 1
  ) e;

  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('user_id', u.user_id, 'role', u.role)), '[]'::jsonb)
  INTO v_team
  FROM (
    SELECT v_company.owner_id AS user_id, 'owner'::text AS role
    WHERE v_company.owner_id IS NOT NULL
    UNION
    SELECT d.owner_id, 'process_owner'
    FROM public.deals d
    WHERE d.company_id = p_company_id AND d.owner_id IS NOT NULL
    UNION
    SELECT dp.user_id, 'participant'
    FROM public.deals d
    JOIN public.deal_participants dp ON dp.deal_id = d.id
    WHERE d.company_id = p_company_id
    UNION
    SELECT se.responsible_user_id, 'service'
    FROM public.service_engagements se
    WHERE se.company_id = p_company_id AND se.responsible_user_id IS NOT NULL
    UNION
    SELECT t.assigned_to, 'task'
    FROM public.tasks t
    WHERE t.company_id = p_company_id AND t.status::text = ANY (v_open) AND t.assigned_to IS NOT NULL
  ) u;

  SELECT COALESCE(jsonb_agg(row_to_json(w)), '[]'::jsonb)
  INTO v_waiting_items
  FROM (
    SELECT t.id, 'task'::text AS kind, t.title, t.due_date::text AS due_on, t.waiting_on AS waiting_on
    FROM public.tasks t
    WHERE t.company_id = p_company_id AND t.status::text = ANY (v_open) AND t.waiting_on = 'customer'::public.task_waiting_on
    UNION ALL
    SELECT cd.id, 'document', dt.name, COALESCE(cd.due_date, cd.next_due_date)::text, 'customer'
    FROM public.customer_documents cd
    JOIN public.document_types dt ON dt.id = cd.document_type_id
    WHERE cd.company_id = p_company_id AND cd.status IN ('requested', 'waiting_customer')
      AND public.user_can_access_customer_document(
        cd.company_id, cd.deal_id, cd.service_engagement_id, cd.responsible_user_id, cd.created_by
      )
    LIMIT 20
  ) w;

  SELECT COALESCE(jsonb_agg(row_to_json(dl)), '[]'::jsonb)
  INTO v_deadlines
  FROM (
    SELECT t.id, 'task'::text AS kind, t.title AS label, (timezone('UTC', t.due_date))::date AS due_on
    FROM public.tasks t
    WHERE t.company_id = p_company_id AND t.status::text = ANY (v_open) AND t.due_date IS NOT NULL
      AND (timezone('UTC', t.due_date))::date <= v_horizon
    UNION ALL
    SELECT cd.id, 'document', dt.name, COALESCE(cd.due_date, cd.expires_at, cd.next_due_date)
    FROM public.customer_documents cd
    JOIN public.document_types dt ON dt.id = cd.document_type_id
    WHERE cd.company_id = p_company_id
      AND public.user_can_access_customer_document(
        cd.company_id, cd.deal_id, cd.service_engagement_id, cd.responsible_user_id, cd.created_by
      )
      AND COALESCE(cd.due_date, cd.expires_at, cd.next_due_date) IS NOT NULL
      AND COALESCE(cd.due_date, cd.expires_at, cd.next_due_date) <= v_horizon
    UNION ALL
    SELECT cc.id, 'contract', cc.title, COALESCE(cc.next_renewal_on, cc.ends_on)
    FROM public.client_contracts cc
    WHERE cc.company_id = p_company_id
      AND public.user_can_access_client_contract(cc.company_id, cc.responsible_user_id, cc.created_by)
      AND COALESCE(cc.next_renewal_on, cc.ends_on) IS NOT NULL
      AND COALESCE(cc.next_renewal_on, cc.ends_on) <= v_horizon
    ORDER BY 4 NULLS LAST
    LIMIT 20
  ) dl;

  IF EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.company_id = p_company_id AND t.status::text = ANY (v_open)
      AND t.priority = 'urgente'
      AND t.due_date IS NOT NULL
      AND (timezone('UTC', t.due_date))::date < v_today
  ) THEN
    v_reasons := v_reasons || jsonb_build_array('Tarefa crítica atrasada');
  ELSIF v_overdue > 0 THEN
    v_reasons := v_reasons || jsonb_build_array('Tarefas atrasadas');
  END IF;
  IF v_docs_expired > 0 THEN
    v_reasons := v_reasons || jsonb_build_array('Documento vencido');
  END IF;
  IF v_contracts_expired > 0 THEN
    v_reasons := v_reasons || jsonb_build_array('Contrato vencido');
  END IF;
  IF v_sla_critical > 0 THEN
    v_reasons := v_reasons || jsonb_build_array('SLA crítico em processo');
  END IF;

  IF jsonb_array_length(v_reasons) = 0 THEN
    IF v_week > 0 OR v_today_count > 0 THEN
      v_reasons := v_reasons || jsonb_build_array('Prazos nos próximos 7 dias');
    END IF;
    IF v_docs_due_soon > 0 THEN
      v_reasons := v_reasons || jsonb_build_array('Documento próximo do vencimento');
    END IF;
    IF v_waiting > 0 THEN
      v_reasons := v_reasons || jsonb_build_array('Itens aguardando o cliente');
    END IF;
    IF v_docs_waiting > 0 THEN
      v_reasons := v_reasons || jsonb_build_array('Documento aguardando o cliente');
    END IF;
    IF v_sla_warning > 0 THEN
      v_reasons := v_reasons || jsonb_build_array('SLA em atenção');
    END IF;
    IF v_contracts_renew > 0 THEN
      v_reasons := v_reasons || jsonb_build_array('Renovação de contrato próxima');
    END IF;
  END IF;

  IF jsonb_array_length(v_reasons) > 0 AND (
    v_reasons @> '["Tarefa crítica atrasada"]'::jsonb
    OR v_reasons @> '["Documento vencido"]'::jsonb
    OR v_reasons @> '["Contrato vencido"]'::jsonb
    OR v_reasons @> '["SLA crítico em processo"]'::jsonb
  ) THEN
    v_health := 'critical';
  ELSIF jsonb_array_length(v_reasons) > 0 THEN
    v_health := 'attention';
  ELSIF v_pending = 0 AND v_active_processes = 0 AND v_docs_total = 0 THEN
    v_health := 'unknown';
    v_reasons := jsonb_build_array('Ainda não há tarefas, documentos ou processos suficientes');
  ELSE
    v_health := 'healthy';
    v_reasons := jsonb_build_array('Nenhuma pendência crítica ou prazo imediato');
  END IF;

  RETURN jsonb_build_object(
    'company_id', p_company_id,
    'as_of', v_today,
    'timezone', v_tz,
    'health', v_health,
    'health_reasons', v_reasons,
    'counts', jsonb_build_object(
      'tasks_pending', v_pending,
      'tasks_overdue', v_overdue,
      'tasks_today', v_today_count,
      'tasks_next_7_days', v_week,
      'tasks_waiting_customer', v_waiting,
      'active_processes', v_active_processes,
      'sla_warning', v_sla_warning,
      'sla_critical', v_sla_critical,
      'documents', v_docs_total,
      'documents_waiting_customer', v_docs_waiting,
      'documents_expired', v_docs_expired
    ),
    'open_tasks', COALESCE(v_tasks, '[]'::jsonb),
    'processes', COALESCE(v_processes, '[]'::jsonb),
    'primary_contacts', COALESCE(v_contacts, '[]'::jsonb),
    'last_interaction', v_last,
    'team', COALESCE(v_team, '[]'::jsonb),
    'waiting_items', COALESCE(v_waiting_items, '[]'::jsonb),
    'upcoming_deadlines', COALESCE(v_deadlines, '[]'::jsonb)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.get_customer_workspace_timeline(uuid, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_customer_workspace_timeline(
  p_company_id uuid,
  p_filter text DEFAULT 'all',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  event_id text,
  event_type text,
  event_source text,
  source_id uuid,
  event_title text,
  event_description text,
  actor_user_id uuid,
  event_legal_entity_id uuid,
  occurred_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_can_operate_company(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a este cliente' USING ERRCODE = '42501';
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.companies WHERE id = p_company_id;
  p_limit := GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));
  p_offset := GREATEST(0, COALESCE(p_offset, 0));
  p_filter := COALESCE(NULLIF(p_filter, ''), 'all');

  RETURN QUERY
  WITH timeline_events AS (
    SELECT
      ('task:' || t.id::text) AS event_id,
      CASE
        WHEN t.status = 'concluida' THEN 'task.completed'
        WHEN t.status = 'cancelada' THEN 'task.cancelled'
        ELSE 'task.created'
      END AS event_type,
      'task'::text AS event_source,
      t.id AS source_id,
      t.title,
      t.description,
      COALESCE(t.assigned_to, t.created_by) AS user_id,
      NULL::uuid AS legal_entity_id,
      CASE
        WHEN t.status = 'concluida' THEN COALESCE(t.completed_at, t.updated_at)
        WHEN t.status = 'cancelada' THEN t.updated_at
        ELSE t.created_at
      END AS occurred_at
    FROM public.tasks t
    WHERE t.company_id = p_company_id AND t.tenant_id = v_tenant

    UNION ALL
    SELECT
      ('activity:' || a.id::text),
      'activity.logged',
      'activity',
      a.id,
      COALESCE(a.subject, a.type),
      a.content,
      a.created_by,
      NULL,
      a.created_at
    FROM public.activities a
    WHERE a.company_id = p_company_id AND a.tenant_id = v_tenant

    UNION ALL
    SELECT
      ('note:' || n.id::text),
      'note.created',
      'entity_note',
      n.id,
      'Nota',
      n.content,
      n.created_by,
      NULL,
      n.created_at
    FROM public.entity_notes n
    WHERE n.entity_type = 'company' AND n.entity_id = p_company_id

    UNION ALL
    SELECT
      ('followup:' || f.id::text),
      'followup.logged',
      'deal_followup',
      f.id,
      COALESCE(fg.name, 'Interação'),
      f.description,
      f.created_by,
      f.legal_entity_id,
      f.interaction_at
    FROM public.deal_followups f
    LEFT JOIN public.followup_groups fg ON fg.id = f.followup_group_id
    WHERE f.company_id = p_company_id AND f.tenant_id = v_tenant AND f.deleted_at IS NULL

    UNION ALL
    SELECT
      ('deal:' || d.id::text),
      'process.created',
      'deal',
      d.id,
      d.name,
      NULL::text,
      COALESCE(d.created_by, d.owner_id),
      d.legal_entity_id,
      d.created_at
    FROM public.deals d
    WHERE d.company_id = p_company_id AND d.tenant_id = v_tenant

    UNION ALL
    SELECT
      ('stage:' || h.id::text),
      'process.stage_changed',
      'deal_stage_history',
      h.id,
      COALESCE(d.name, 'Processo'),
      COALESCE(h.from_stage::text, '') || ' → ' || h.to_stage::text,
      h.changed_by,
      d.legal_entity_id,
      h.changed_at
    FROM public.deal_stage_history h
    JOIN public.deals d ON d.id = h.deal_id
    WHERE d.company_id = p_company_id AND d.tenant_id = v_tenant
      AND h.from_stage IS NOT NULL

    UNION ALL
    SELECT
      ('checklist:' || cc.id::text),
      'process.checklist_completed',
      'deal_checklist_completion',
      cc.id,
      COALESCE(sci.title, 'Checklist'),
      cc.notes,
      cc.completed_by,
      d.legal_entity_id,
      COALESCE(cc.completed_at, now())
    FROM public.deal_checklist_completions cc
    JOIN public.deals d ON d.id = cc.deal_id
    LEFT JOIN public.stage_checklist_items sci ON sci.id = cc.checklist_item_id
    WHERE d.company_id = p_company_id AND d.tenant_id = v_tenant

    UNION ALL
    SELECT
      ('document:' || cd.id::text),
      'document.' || cd.status::text,
      'customer_document',
      cd.id,
      COALESCE(dt.name, 'Documento'),
      cd.notes,
      COALESCE(cd.responsible_user_id, cd.created_by),
      cd.legal_entity_id,
      COALESCE(cd.reviewed_at, cd.received_at, cd.requested_at, cd.created_at)
    FROM public.customer_documents cd
    LEFT JOIN public.document_types dt ON dt.id = cd.document_type_id
    WHERE cd.company_id = p_company_id AND cd.tenant_id = v_tenant

    UNION ALL
    SELECT
      ('contract:' || cc.id::text),
      'contract.' || cc.status::text,
      'client_contract',
      cc.id,
      cc.title,
      cc.notes,
      COALESCE(cc.responsible_user_id, cc.created_by),
      cc.legal_entity_id,
      cc.updated_at
    FROM public.client_contracts cc
    WHERE cc.company_id = p_company_id AND cc.tenant_id = v_tenant

    UNION ALL
    SELECT
      ('service:' || se.id::text),
      'service.' || se.status::text,
      'service_engagement',
      se.id,
      se.title,
      se.notes,
      COALESCE(se.responsible_user_id, se.created_by),
      se.legal_entity_id,
      se.updated_at
    FROM public.service_engagements se
    WHERE se.company_id = p_company_id AND se.tenant_id = v_tenant

    UNION ALL
    SELECT
      ('file:' || fa.id::text),
      'attachment.added',
      'file_attachment',
      fa.id,
      fa.original_name,
      fa.entity_type,
      fa.uploaded_by,
      NULL,
      fa.created_at
    FROM public.file_attachments fa
    WHERE fa.tenant_id = v_tenant
      AND (
        (fa.entity_type = 'company' AND fa.entity_id = p_company_id)
        OR (fa.entity_type = 'customer_document' AND fa.entity_id IN (
          SELECT cd.id FROM public.customer_documents cd
          WHERE cd.company_id = p_company_id
        ))
        OR (fa.entity_type = 'contract' AND fa.entity_id IN (
          SELECT cc.id FROM public.client_contracts cc
          WHERE cc.company_id = p_company_id
        ))
      )
  )
  SELECT
    te.event_id,
    te.event_type,
    te.event_source,
    te.source_id,
    te.title AS event_title,
    te.description AS event_description,
    te.user_id AS actor_user_id,
    te.legal_entity_id AS event_legal_entity_id,
    te.occurred_at
  FROM timeline_events te
  WHERE p_filter = 'all'
    OR (p_filter = 'tasks' AND te.event_source = 'task')
    OR (p_filter = 'activities' AND te.event_source IN ('activity', 'deal_followup'))
    OR (p_filter = 'processes' AND te.event_source IN ('deal', 'deal_stage_history', 'deal_checklist_completion'))
    OR (p_filter = 'documents' AND te.event_source IN ('customer_document', 'file_attachment'))
    OR (p_filter = 'contracts' AND te.event_source = 'client_contract')
    OR (p_filter = 'services' AND te.event_source = 'service_engagement')
    OR (p_filter = 'notes' AND te.event_source = 'entity_note')
  ORDER BY te.occurred_at DESC, te.event_id DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_workspace_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_customer_workspace_timeline(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_workspace_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_workspace_timeline(uuid, text, integer, integer) TO authenticated;

COMMIT;
