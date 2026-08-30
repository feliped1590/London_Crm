-- Include deal creation in workspace timeline (not only stage history).

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

GRANT EXECUTE ON FUNCTION public.get_customer_workspace_timeline(uuid, text, integer, integer) TO authenticated;
