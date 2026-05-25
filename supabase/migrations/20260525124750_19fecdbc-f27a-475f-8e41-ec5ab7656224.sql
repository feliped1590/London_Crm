
-- 1. Products: remove anonymous public read policy
DROP POLICY IF EXISTS "Authenticated users can view active products" ON public.products;

-- 2. admin_intervention_log
DROP POLICY IF EXISTS "Authenticated users can insert interventions" ON public.admin_intervention_log;
CREATE POLICY "Admins can insert own interventions"
ON public.admin_intervention_log
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_user_id = auth.uid()
);

-- 3. bot_sessions: join bot_sessions.instance_id (uuid) = whatsapp_instances.id
DROP POLICY IF EXISTS "Authenticated users can view bot sessions" ON public.bot_sessions;
DROP POLICY IF EXISTS "Authenticated users can update bot sessions" ON public.bot_sessions;
DROP POLICY IF EXISTS "Authenticated users can create bot sessions" ON public.bot_sessions;

CREATE POLICY "Owners or admins can view bot sessions"
ON public.bot_sessions FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.whatsapp_instances wi WHERE wi.id = bot_sessions.instance_id AND wi.user_id = auth.uid())
);
CREATE POLICY "Owners or admins can update bot sessions"
ON public.bot_sessions FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.whatsapp_instances wi WHERE wi.id = bot_sessions.instance_id AND wi.user_id = auth.uid())
);
CREATE POLICY "Owners or admins can create bot sessions"
ON public.bot_sessions FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.whatsapp_instances wi WHERE wi.id = bot_sessions.instance_id AND wi.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can view session data" ON public.bot_session_data;
DROP POLICY IF EXISTS "Authenticated users can manage session data" ON public.bot_session_data;

CREATE POLICY "Owners or admins can view session data"
ON public.bot_session_data FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.bot_sessions bs
    JOIN public.whatsapp_instances wi ON wi.id = bs.instance_id
    WHERE bs.id = bot_session_data.session_id AND wi.user_id = auth.uid()
  )
);
CREATE POLICY "Owners or admins can manage session data"
ON public.bot_session_data FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.bot_sessions bs
    JOIN public.whatsapp_instances wi ON wi.id = bs.instance_id
    WHERE bs.id = bot_session_data.session_id AND wi.user_id = auth.uid()
  )
);

-- 4. bot_flow_nodes / bot_flow_edges
DROP POLICY IF EXISTS "Authenticated users can manage flow nodes" ON public.bot_flow_nodes;
DROP POLICY IF EXISTS "Authenticated users can update flow nodes" ON public.bot_flow_nodes;
DROP POLICY IF EXISTS "Authenticated users can delete flow nodes" ON public.bot_flow_nodes;

CREATE POLICY "Flow owners or admins can insert flow nodes"
ON public.bot_flow_nodes FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.bot_flows f WHERE f.id = bot_flow_nodes.flow_id AND f.created_by = auth.uid())
);
CREATE POLICY "Flow owners or admins can update flow nodes"
ON public.bot_flow_nodes FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.bot_flows f WHERE f.id = bot_flow_nodes.flow_id AND f.created_by = auth.uid())
);
CREATE POLICY "Flow owners or admins can delete flow nodes"
ON public.bot_flow_nodes FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.bot_flows f WHERE f.id = bot_flow_nodes.flow_id AND f.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can manage flow edges" ON public.bot_flow_edges;
DROP POLICY IF EXISTS "Authenticated users can update flow edges" ON public.bot_flow_edges;
DROP POLICY IF EXISTS "Authenticated users can delete flow edges" ON public.bot_flow_edges;

CREATE POLICY "Flow owners or admins can insert flow edges"
ON public.bot_flow_edges FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.bot_flows f WHERE f.id = bot_flow_edges.flow_id AND f.created_by = auth.uid())
);
CREATE POLICY "Flow owners or admins can update flow edges"
ON public.bot_flow_edges FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.bot_flows f WHERE f.id = bot_flow_edges.flow_id AND f.created_by = auth.uid())
);
CREATE POLICY "Flow owners or admins can delete flow edges"
ON public.bot_flow_edges FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.bot_flows f WHERE f.id = bot_flow_edges.flow_id AND f.created_by = auth.uid())
);

-- 5. WhatsApp insights: admin-only reads
DROP POLICY IF EXISTS "Authenticated users can view summaries" ON public.whatsapp_conversation_summaries;
CREATE POLICY "Admins can view summaries"
ON public.whatsapp_conversation_summaries FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view objections" ON public.whatsapp_objections;
CREATE POLICY "Admins can view objections"
ON public.whatsapp_objections FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
