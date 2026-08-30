-- Recreate timeline as SQL so every UNION arm is returned (PL/pgSQL RETURN QUERY
-- was dropping contracts/documents/deals while tasks and follow-ups still appeared).

DROP FUNCTION IF EXISTS public.get_customer_workspace_timeline(uuid, text, integer, integer);

CREATE FUNCTION public.get_customer_workspace_timeline(
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      public.user_can_operate_company(p_company_id) AS allowed,
      (SELECT c.tenant_id FROM public.companies c WHERE c.id = p_company_id) AS tenant_id,
      GREATEST(1, LEAST(COALESCE(p_limit, 25), 100)) AS page_limit,
      GREATEST(0, COALESCE(p_offset, 0)) AS page_offset,
      COALESCE(NULLIF(p_filter, ''), 'all') AS filt
  ),
  timeline_events AS (
    SELECT
      ('task:' || t.id::text) AS event_id,
      CASE
        WHEN t.status = 'concluida' THEN 'task.completed'
        WHEN t.status = 'cancelada' THEN 'task.cancelled'
        ELSE 'task.created'
      END AS event_type,
      'task'::text AS event_source,
      t.id AS source_id,
      t.title AS event_title,
      t.description AS event_description,
      COALESCE(t.assigned_to, t.created_by) AS actor_user_id,
      NULL::uuid AS event_legal_entity_id,
      CASE
        WHEN t.status = 'concluida' THEN COALESCE(t.completed_at, t.updated_at)
        WHEN t.status = 'cancelada' THEN t.updated_at
        ELSE t.created_at
      END AS occurred_at
    FROM public.tasks t, params p
    WHERE p.allowed AND t.company_id = p_company_id AND t.tenant_id = p.tenant_id

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
    FROM public.activities a, params p
    WHERE p.allowed AND a.company_id = p_company_id AND a.tenant_id = p.tenant_id

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
    FROM public.entity_notes n, params p
    WHERE p.allowed AND n.entity_type = 'company' AND n.entity_id = p_company_id

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
    CROSS JOIN params p
    WHERE p.allowed AND f.company_id = p_company_id AND f.tenant_id = p.tenant_id AND f.deleted_at IS NULL

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
    FROM public.deals d, params p
    WHERE p.allowed AND d.company_id = p_company_id AND d.tenant_id = p.tenant_id

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
    CROSS JOIN params p
    WHERE p.allowed AND d.company_id = p_company_id AND d.tenant_id = p.tenant_id
      AND h.from_stage IS NOT NULL

    UNION ALL
    SELECT
      ('checklist:' || chk.id::text),
      'process.checklist_completed',
      'deal_checklist_completion',
      chk.id,
      COALESCE(sci.title, 'Checklist'),
      chk.notes,
      chk.completed_by,
      d.legal_entity_id,
      COALESCE(chk.completed_at, now())
    FROM public.deal_checklist_completions chk
    JOIN public.deals d ON d.id = chk.deal_id
    LEFT JOIN public.stage_checklist_items sci ON sci.id = chk.checklist_item_id
    CROSS JOIN params p
    WHERE p.allowed AND d.company_id = p_company_id AND d.tenant_id = p.tenant_id

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
    CROSS JOIN params p
    WHERE p.allowed AND cd.company_id = p_company_id AND cd.tenant_id = p.tenant_id

    UNION ALL
    SELECT
      ('contract:' || cct.id::text),
      'contract.' || cct.status::text,
      'client_contract',
      cct.id,
      cct.title,
      cct.notes,
      COALESCE(cct.responsible_user_id, cct.created_by),
      cct.legal_entity_id,
      COALESCE(cct.created_at, cct.updated_at)
    FROM public.client_contracts cct, params p
    WHERE p.allowed AND cct.company_id = p_company_id AND cct.tenant_id = p.tenant_id

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
      COALESCE(se.created_at, se.updated_at)
    FROM public.service_engagements se, params p
    WHERE p.allowed AND se.company_id = p_company_id AND se.tenant_id = p.tenant_id

    UNION ALL
    SELECT
      ('file:' || fa.id::text),
      'attachment.added',
      'file_attachment',
      fa.id,
      fa.original_name,
      fa.entity_type,
      fa.uploaded_by,
      NULL::uuid,
      fa.created_at
    FROM public.file_attachments fa, params p
    WHERE p.allowed AND fa.tenant_id = p.tenant_id
      AND (
        (fa.entity_type = 'company' AND fa.entity_id = p_company_id)
        OR (fa.entity_type = 'customer_document' AND fa.entity_id IN (
          SELECT cd.id FROM public.customer_documents cd WHERE cd.company_id = p_company_id
        ))
        OR (fa.entity_type = 'contract' AND fa.entity_id IN (
          SELECT cct.id FROM public.client_contracts cct WHERE cct.company_id = p_company_id
        ))
      )
  )
  SELECT
    te.event_id,
    te.event_type,
    te.event_source,
    te.source_id,
    te.event_title,
    te.event_description,
    te.actor_user_id,
    te.event_legal_entity_id,
    te.occurred_at
  FROM timeline_events te, params p
  WHERE auth.uid() IS NOT NULL
    AND p.allowed
    AND (
      p.filt = 'all'
      OR (p.filt = 'tasks' AND te.event_source = 'task')
      OR (p.filt = 'activities' AND te.event_source IN ('activity', 'deal_followup'))
      OR (p.filt = 'processes' AND te.event_source IN ('deal', 'deal_stage_history', 'deal_checklist_completion'))
      OR (p.filt = 'documents' AND te.event_source = 'customer_document')
      OR (p.filt = 'attachments' AND te.event_source = 'file_attachment')
      OR (p.filt = 'contracts' AND te.event_source = 'client_contract')
      OR (p.filt = 'services' AND te.event_source = 'service_engagement')
      OR (p.filt = 'notes' AND te.event_source = 'entity_note')
    )
  ORDER BY te.occurred_at DESC, te.event_id DESC
  LIMIT (SELECT page_limit FROM params)
  OFFSET (SELECT page_offset FROM params);
$$;

REVOKE ALL ON FUNCTION public.get_customer_workspace_timeline(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_workspace_timeline(uuid, text, integer, integer) TO authenticated;
