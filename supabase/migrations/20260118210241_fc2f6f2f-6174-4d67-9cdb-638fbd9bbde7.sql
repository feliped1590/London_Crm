-- Create bot_flows table
CREATE TABLE public.bot_flows (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    trigger_type TEXT NOT NULL DEFAULT 'new_conversation', -- new_conversation, keyword, manual
    trigger_config JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bot_flow_nodes table
CREATE TABLE public.bot_flow_nodes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL, -- trigger, message, condition, action, delay, transfer, end
    node_id TEXT NOT NULL, -- unique identifier within the flow (for React Flow)
    position_x NUMERIC NOT NULL DEFAULT 0,
    position_y NUMERIC NOT NULL DEFAULT 0,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bot_flow_edges table (connections between nodes)
CREATE TABLE public.bot_flow_edges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
    edge_id TEXT NOT NULL, -- unique identifier within the flow
    source_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    source_handle TEXT, -- for conditional outputs
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bot_sessions table
CREATE TABLE public.bot_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    flow_id UUID NOT NULL REFERENCES public.bot_flows(id),
    instance_id UUID REFERENCES public.whatsapp_instances(id),
    phone TEXT NOT NULL,
    current_node_id TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- active, waiting_response, completed, transferred, timeout
    contact_id UUID REFERENCES public.contacts(id),
    company_id UUID REFERENCES public.companies(id),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    transferred_to UUID,
    timeout_at TIMESTAMP WITH TIME ZONE
);

-- Create bot_session_data table
CREATE TABLE public.bot_session_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.bot_sessions(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_value TEXT,
    collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_session_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bot_flows
CREATE POLICY "Authenticated users can view bot flows"
ON public.bot_flows FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create bot flows"
ON public.bot_flows FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own flows or admins"
ON public.bot_flows FOR UPDATE
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bot flows"
ON public.bot_flows FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for bot_flow_nodes
CREATE POLICY "Authenticated users can view flow nodes"
ON public.bot_flow_nodes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage flow nodes"
ON public.bot_flow_nodes FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update flow nodes"
ON public.bot_flow_nodes FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete flow nodes"
ON public.bot_flow_nodes FOR DELETE
USING (auth.uid() IS NOT NULL);

-- RLS Policies for bot_flow_edges
CREATE POLICY "Authenticated users can view flow edges"
ON public.bot_flow_edges FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage flow edges"
ON public.bot_flow_edges FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update flow edges"
ON public.bot_flow_edges FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete flow edges"
ON public.bot_flow_edges FOR DELETE
USING (auth.uid() IS NOT NULL);

-- RLS Policies for bot_sessions
CREATE POLICY "Authenticated users can view bot sessions"
ON public.bot_sessions FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create bot sessions"
ON public.bot_sessions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update bot sessions"
ON public.bot_sessions FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- RLS Policies for bot_session_data
CREATE POLICY "Authenticated users can view session data"
ON public.bot_session_data FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage session data"
ON public.bot_session_data FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_bot_flow_nodes_flow_id ON public.bot_flow_nodes(flow_id);
CREATE INDEX idx_bot_flow_edges_flow_id ON public.bot_flow_edges(flow_id);
CREATE INDEX idx_bot_sessions_phone ON public.bot_sessions(phone);
CREATE INDEX idx_bot_sessions_status ON public.bot_sessions(status);
CREATE INDEX idx_bot_session_data_session_id ON public.bot_session_data(session_id);

-- Trigger for updated_at
CREATE TRIGGER update_bot_flows_updated_at
BEFORE UPDATE ON public.bot_flows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bot_flow_nodes_updated_at
BEFORE UPDATE ON public.bot_flow_nodes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();