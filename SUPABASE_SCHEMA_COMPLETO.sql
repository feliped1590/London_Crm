-- =====================================================
-- SUPABASE SCHEMA COMPLETO - CRM INIFLEX
-- Versão corrigida com ordem de dependências correta
-- =====================================================

-- =====================================================
-- BLOCO 1: TIPOS E ENUMS (sem dependências)
-- =====================================================

-- Tipos de roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'atendente');

-- Estágios do pipeline de vendas
CREATE TYPE public.deal_stage AS ENUM (
    'prospeccao',
    'qualificacao', 
    'proposta',
    'negociacao',
    'fechado_ganho',
    'fechado_perdido'
);

-- Status de tarefas
CREATE TYPE public.task_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');

-- Prioridade de tarefas
CREATE TYPE public.task_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- Status de propostas
CREATE TYPE public.proposal_status AS ENUM (
    'rascunho',
    'enviada',
    'em_analise',
    'aprovada',
    'recusada',
    'expirada'
);

-- Status de pedidos
CREATE TYPE public.order_status AS ENUM (
    'pendente',
    'em_producao',
    'produzido',
    'faturado',
    'entregue',
    'cancelado'
);

-- Tipos de campos customizados
CREATE TYPE public.custom_field_type AS ENUM (
    'text',
    'number',
    'date',
    'select',
    'multiselect',
    'checkbox',
    'url',
    'email',
    'phone',
    'currency'
);

-- Entidades para campos customizados
CREATE TYPE public.custom_field_entity AS ENUM ('company', 'contact', 'deal');

-- Tipo de pessoa (PF/PJ)
CREATE TYPE public.tipo_pessoa AS ENUM ('PF', 'PJ');

-- Triggers de automação
CREATE TYPE public.automation_trigger AS ENUM ('stage_enter', 'stage_exit');

-- Ações de automação
CREATE TYPE public.automation_action AS ENUM (
    'send_whatsapp',
    'create_task',
    'add_tag',
    'send_email'
);

-- Níveis de acesso
CREATE TYPE public.access_level AS ENUM ('restrito', 'total');

-- =====================================================
-- BLOCO 2: SEQUENCES (para numeração automática)
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS public.proposal_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1;

-- =====================================================
-- BLOCO 3: FUNÇÕES BÁSICAS (sem dependências de tabelas)
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Função para verificar se usuário está autenticado
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
$$;

-- =====================================================
-- BLOCO 4: TODAS AS TABELAS
-- =====================================================

-- Profiles de usuários
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Roles de usuários (separado do profiles por segurança)
CREATE TABLE public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    role public.app_role NOT NULL DEFAULT 'vendedor',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Configurações de licença
CREATE TABLE public.license_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_name TEXT NOT NULL DEFAULT 'Free',
    max_users INTEGER NOT NULL DEFAULT 5,
    valid_until TIMESTAMP WITH TIME ZONE,
    features JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Empresas
CREATE TABLE public.companies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    fantasia TEXT,
    cnpj TEXT,
    inscricao_estadual TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    domain TEXT,
    industry TEXT,
    employee_count TEXT,
    annual_revenue TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'Brasil',
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    owner_id UUID,
    created_by UUID,
    iniflex_id TEXT,
    iniflex_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contatos
CREATE TABLE public.contacts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    cpf TEXT,
    tipo_pessoa public.tipo_pessoa,
    job_title TEXT,
    department TEXT,
    linkedin_url TEXT,
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    owner_id UUID,
    created_by UUID,
    iniflex_id TEXT,
    iniflex_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Deals/Oportunidades
CREATE TABLE public.deals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    value NUMERIC(15,2),
    stage public.deal_stage NOT NULL DEFAULT 'prospeccao',
    probability INTEGER DEFAULT 0,
    expected_close_date DATE,
    closed_at TIMESTAMP WITH TIME ZONE,
    lost_reason TEXT,
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    owner_id UUID,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Histórico de estágios do deal
CREATE TABLE public.deal_stage_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    from_stage public.deal_stage,
    to_stage public.deal_stage NOT NULL,
    changed_by UUID,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tarefas
CREATE TABLE public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status public.task_status NOT NULL DEFAULT 'pendente',
    priority public.task_priority NOT NULL DEFAULT 'media',
    due_date DATE,
    due_time TIME,
    completed_at TIMESTAMP WITH TIME ZONE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    assigned_to UUID,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lembretes de tarefas
CREATE TABLE public.task_reminders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    reminder_type TEXT NOT NULL DEFAULT 'email',
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Atividades/Histórico
CREATE TABLE public.activities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL,
    subject TEXT,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Produtos
CREATE TABLE public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    material TEXT,
    color TEXT,
    thickness NUMERIC(10,3),
    width NUMERIC(10,3),
    length NUMERIC(10,3),
    unit_measure TEXT DEFAULT 'un',
    unit_price NUMERIC(15,2),
    active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Propostas
CREATE TABLE public.proposals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    status public.proposal_status NOT NULL DEFAULT 'rascunho',
    total_value NUMERIC(15,2),
    validity_date DATE,
    payment_terms TEXT,
    delivery_terms TEXT,
    observations TEXT,
    approval_token TEXT,
    approval_token_expires_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by_name TEXT,
    approved_by_ip TEXT,
    rejection_reason TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Itens de propostas
CREATE TABLE public.proposal_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(15,3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_percent NUMERIC(5,2) DEFAULT 0,
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
    thickness NUMERIC(10,3),
    width NUMERIC(10,3),
    length NUMERIC(10,3),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Logs de acesso a propostas
CREATE TABLE public.proposal_access_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    token_prefix TEXT,
    success BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pedidos
CREATE TABLE public.orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    status public.order_status NOT NULL DEFAULT 'pendente',
    total_value NUMERIC(15,2),
    delivery_date DATE,
    observations TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Itens de pedidos
CREATE TABLE public.order_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(15,3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
    thickness NUMERIC(10,3),
    width NUMERIC(10,3),
    length NUMERIC(10,3),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Templates de email
CREATE TABLE public.email_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    is_shared BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Logs de emails
CREATE TABLE public.email_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    to_email TEXT NOT NULL,
    from_email TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    sent_by UUID
);

-- Instâncias WhatsApp
CREATE TABLE public.whatsapp_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    instance_token TEXT NOT NULL,
    phone_number TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected',
    connected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Mensagens WhatsApp
CREATE TABLE public.whatsapp_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
    zapi_message_id TEXT,
    phone TEXT NOT NULL,
    content TEXT,
    message_type TEXT NOT NULL DEFAULT 'text',
    media_url TEXT,
    direction TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    is_read BOOLEAN DEFAULT false,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contatos WhatsApp
CREATE TABLE public.whatsapp_contacts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number TEXT NOT NULL UNIQUE,
    profile_name TEXT,
    profile_picture_url TEXT,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Resumos de conversas WhatsApp (IA)
CREATE TABLE public.whatsapp_conversation_summaries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    summary TEXT NOT NULL,
    sentiment TEXT,
    customer_intent TEXT,
    next_steps TEXT[],
    message_count INTEGER DEFAULT 0,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Objeções detectadas em conversas WhatsApp (IA)
CREATE TABLE public.whatsapp_objections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    message_excerpt TEXT,
    status TEXT DEFAULT 'pending',
    resolution TEXT,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Fluxos de bot
CREATE TABLE public.bot_flows (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'message',
    trigger_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Nós dos fluxos de bot
CREATE TABLE public.bot_flow_nodes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    node_type TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    position_x NUMERIC NOT NULL DEFAULT 0,
    position_y NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Edges dos fluxos de bot
CREATE TABLE public.bot_flow_edges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
    edge_id TEXT NOT NULL,
    source_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    source_handle TEXT,
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sessões de bot
CREATE TABLE public.bot_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
    instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    current_node_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    timeout_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    transferred_to UUID
);

-- Dados coletados em sessões de bot
CREATE TABLE public.bot_session_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.bot_sessions(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_value TEXT,
    collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Estágios do pipeline (configuração)
CREATE TABLE public.pipeline_stages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    stage public.deal_stage NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color TEXT,
    probability INTEGER DEFAULT 0,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Automações do pipeline
CREATE TABLE public.pipeline_automations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_type public.automation_trigger NOT NULL,
    trigger_stage public.deal_stage NOT NULL,
    action_type public.automation_action NOT NULL,
    action_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Campos customizados
CREATE TABLE public.custom_fields (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity public.custom_field_entity NOT NULL,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type public.custom_field_type NOT NULL DEFAULT 'text',
    options JSONB,
    is_required BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Módulos do sistema
CREATE TABLE public.system_modules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    icon TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Permissões por role/módulo
CREATE TABLE public.role_module_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    role public.app_role NOT NULL,
    module_id UUID REFERENCES public.system_modules(id) ON DELETE CASCADE,
    can_access BOOLEAN DEFAULT false,
    access_type public.access_level DEFAULT 'restrito',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(role, module_id)
);

-- Conversas com IA
CREATE TABLE public.ai_conversations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    messages JSONB DEFAULT '[]',
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Configurações de dashboard por usuário
CREATE TABLE public.user_dashboard_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL DEFAULT 'Meu Dashboard',
    widgets JSONB DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- BLOCO 5: FUNÇÕES QUE DEPENDEM DE TABELAS
-- =====================================================

-- Função para verificar se usuário tem uma role específica
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Função para verificar acesso a módulo
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_module_permissions rmp
    JOIN public.system_modules sm ON sm.id = rmp.module_id
    JOIN public.user_roles ur ON ur.role = rmp.role
    WHERE ur.user_id = _user_id
      AND sm.key = _module_key
      AND rmp.can_access = true
      AND sm.is_active = true
  )
  OR public.has_role(_user_id, 'admin')
$$;

-- Função para obter tipo de acesso a módulo
CREATE OR REPLACE FUNCTION public.get_module_access_type(_user_id uuid, _module_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN public.has_role(_user_id, 'admin') THEN 'total'
    ELSE COALESCE(
      (SELECT rmp.access_type::text
       FROM public.role_module_permissions rmp
       JOIN public.system_modules sm ON sm.id = rmp.module_id
       JOIN public.user_roles ur ON ur.role = rmp.role
       WHERE ur.user_id = _user_id
         AND sm.key = _module_key
         AND rmp.can_access = true
         AND sm.is_active = true
       ORDER BY 
         CASE rmp.access_type WHEN 'total' THEN 1 ELSE 2 END
       LIMIT 1),
      'none'
    )
  END
$$;

-- Função para obter módulos do usuário
CREATE OR REPLACE FUNCTION public.get_user_modules(_user_id uuid)
RETURNS TABLE(module_key text, module_name text, module_path text, module_icon text, access_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    sm.key,
    sm.name,
    sm.path,
    sm.icon,
    CASE 
      WHEN public.has_role(_user_id, 'admin') THEN 'total'
      ELSE rmp.access_type::text
    END as access_type
  FROM public.system_modules sm
  LEFT JOIN public.role_module_permissions rmp ON rmp.module_id = sm.id
  LEFT JOIN public.user_roles ur ON ur.role = rmp.role AND ur.user_id = _user_id
  WHERE sm.is_active = true
    AND (public.has_role(_user_id, 'admin') OR (rmp.can_access = true AND ur.user_id IS NOT NULL))
  ORDER BY sm.key
$$;

-- Função para obter status da licença
CREATE OR REPLACE FUNCTION public.get_license_status()
RETURNS TABLE(
    current_users integer, 
    max_users integer, 
    plan_name text, 
    can_add_user boolean, 
    usage_percentage numeric, 
    valid_until timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM auth.users) as current_users,
        ls.max_users,
        ls.plan_name,
        (SELECT COUNT(*) FROM auth.users) < ls.max_users as can_add_user,
        ROUND((SELECT COUNT(*) FROM auth.users)::NUMERIC / ls.max_users * 100, 1) as usage_percentage,
        ls.valid_until
    FROM license_settings ls
    LIMIT 1;
$$;

-- Função para lidar com novo usuário (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
    
    -- Assign default role (vendedor)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'vendedor');
    
    RETURN NEW;
END;
$$;

-- Função para gerar número de proposta
CREATE OR REPLACE FUNCTION public.generate_proposal_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := 'PROP-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('proposal_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- Função para gerar número de pedido
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := 'PED-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- =====================================================
-- BLOCO 6: TRIGGERS
-- =====================================================

-- Triggers de updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_license_settings_updated_at BEFORE UPDATE ON public.license_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_instances_updated_at BEFORE UPDATE ON public.whatsapp_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_contacts_updated_at BEFORE UPDATE ON public.whatsapp_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_conversation_summaries_updated_at BEFORE UPDATE ON public.whatsapp_conversation_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_objections_updated_at BEFORE UPDATE ON public.whatsapp_objections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bot_flows_updated_at BEFORE UPDATE ON public.bot_flows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bot_flow_nodes_updated_at BEFORE UPDATE ON public.bot_flow_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipeline_automations_updated_at BEFORE UPDATE ON public.pipeline_automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_fields_updated_at BEFORE UPDATE ON public.custom_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_role_module_permissions_updated_at BEFORE UPDATE ON public.role_module_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_dashboard_configs_updated_at BEFORE UPDATE ON public.user_dashboard_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para criar profile/role quando novo usuário é criado
CREATE TRIGGER on_auth_user_created 
    AFTER INSERT ON auth.users 
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers para gerar números automáticos
CREATE TRIGGER generate_proposal_number_trigger 
    BEFORE INSERT ON public.proposals 
    FOR EACH ROW EXECUTE FUNCTION generate_proposal_number();

CREATE TRIGGER generate_order_number_trigger 
    BEFORE INSERT ON public.orders 
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- =====================================================
-- BLOCO 7: ROW LEVEL SECURITY
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_session_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dashboard_configs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES DE ACESSO
-- =====================================================

-- Profiles: usuários podem ver todos, mas editar apenas o seu
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User Roles: apenas admin pode gerenciar
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- License Settings: apenas admin pode gerenciar
CREATE POLICY "license_settings_select" ON public.license_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "license_settings_admin" ON public.license_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Companies: autenticados podem ver e gerenciar
CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_insert" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "companies_update" ON public.companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "companies_delete" ON public.companies FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Contacts: autenticados podem ver e gerenciar
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Deals: autenticados podem ver e gerenciar
CREATE POLICY "deals_select" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "deals_insert" ON public.deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "deals_update" ON public.deals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "deals_delete" ON public.deals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Deal Stage History: autenticados podem ver e gerenciar
CREATE POLICY "deal_stage_history_select" ON public.deal_stage_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "deal_stage_history_insert" ON public.deal_stage_history FOR INSERT TO authenticated WITH CHECK (true);

-- Tasks: autenticados podem ver e gerenciar
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated USING (true);

-- Task Reminders: autenticados podem gerenciar
CREATE POLICY "task_reminders_all" ON public.task_reminders FOR ALL TO authenticated USING (true);

-- Activities: autenticados podem ver e gerenciar
CREATE POLICY "activities_select" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "activities_insert" ON public.activities FOR INSERT TO authenticated WITH CHECK (true);

-- Products: autenticados podem ver, admin pode gerenciar
CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "products_update" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "products_delete" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Proposals: autenticados podem ver e gerenciar
CREATE POLICY "proposals_select" ON public.proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "proposals_insert" ON public.proposals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "proposals_update" ON public.proposals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "proposals_delete" ON public.proposals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Proposal Items: autenticados podem gerenciar
CREATE POLICY "proposal_items_all" ON public.proposal_items FOR ALL TO authenticated USING (true);

-- Proposal Access Logs: inserção pública (para visitantes), leitura autenticada
CREATE POLICY "proposal_access_logs_insert" ON public.proposal_access_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "proposal_access_logs_select" ON public.proposal_access_logs FOR SELECT TO authenticated USING (true);

-- Orders: autenticados podem ver e gerenciar
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Order Items: autenticados podem gerenciar
CREATE POLICY "order_items_all" ON public.order_items FOR ALL TO authenticated USING (true);

-- Email Templates: autenticados podem gerenciar
CREATE POLICY "email_templates_all" ON public.email_templates FOR ALL TO authenticated USING (true);

-- Email Logs: autenticados podem gerenciar
CREATE POLICY "email_logs_all" ON public.email_logs FOR ALL TO authenticated USING (true);

-- WhatsApp Instances: autenticados podem gerenciar
CREATE POLICY "whatsapp_instances_all" ON public.whatsapp_instances FOR ALL TO authenticated USING (true);

-- WhatsApp Messages: autenticados podem gerenciar
CREATE POLICY "whatsapp_messages_all" ON public.whatsapp_messages FOR ALL TO authenticated USING (true);

-- WhatsApp Contacts: autenticados podem gerenciar
CREATE POLICY "whatsapp_contacts_all" ON public.whatsapp_contacts FOR ALL TO authenticated USING (true);

-- WhatsApp Conversation Summaries: autenticados podem gerenciar
CREATE POLICY "whatsapp_conversation_summaries_all" ON public.whatsapp_conversation_summaries FOR ALL TO authenticated USING (true);

-- WhatsApp Objections: autenticados podem gerenciar
CREATE POLICY "whatsapp_objections_all" ON public.whatsapp_objections FOR ALL TO authenticated USING (true);

-- Bot Flows: autenticados podem gerenciar
CREATE POLICY "bot_flows_all" ON public.bot_flows FOR ALL TO authenticated USING (true);

-- Bot Flow Nodes: autenticados podem gerenciar
CREATE POLICY "bot_flow_nodes_all" ON public.bot_flow_nodes FOR ALL TO authenticated USING (true);

-- Bot Flow Edges: autenticados podem gerenciar
CREATE POLICY "bot_flow_edges_all" ON public.bot_flow_edges FOR ALL TO authenticated USING (true);

-- Bot Sessions: autenticados podem gerenciar
CREATE POLICY "bot_sessions_all" ON public.bot_sessions FOR ALL TO authenticated USING (true);

-- Bot Session Data: autenticados podem gerenciar
CREATE POLICY "bot_session_data_all" ON public.bot_session_data FOR ALL TO authenticated USING (true);

-- Pipeline Stages: leitura para todos, escrita para admin
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "pipeline_stages_admin" ON public.pipeline_stages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Pipeline Automations: leitura para todos, escrita para admin
CREATE POLICY "pipeline_automations_select" ON public.pipeline_automations FOR SELECT TO authenticated USING (true);
CREATE POLICY "pipeline_automations_admin" ON public.pipeline_automations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Custom Fields: leitura para todos, escrita para admin
CREATE POLICY "custom_fields_select" ON public.custom_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_fields_admin" ON public.custom_fields FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- System Modules: leitura para todos, escrita para admin
CREATE POLICY "system_modules_select" ON public.system_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_modules_admin" ON public.system_modules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Role Module Permissions: leitura para todos, escrita para admin
CREATE POLICY "role_module_permissions_select" ON public.role_module_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_module_permissions_admin" ON public.role_module_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- AI Conversations: usuários veem apenas as suas
CREATE POLICY "ai_conversations_select" ON public.ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conversations_update" ON public.ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- User Dashboard Configs: usuários veem apenas as suas
CREATE POLICY "user_dashboard_configs_select" ON public.user_dashboard_configs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_dashboard_configs_insert" ON public.user_dashboard_configs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_dashboard_configs_update" ON public.user_dashboard_configs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_dashboard_configs_delete" ON public.user_dashboard_configs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================================================
-- BLOCO 8: DADOS INICIAIS
-- =====================================================

-- Configurações de licença padrão
INSERT INTO public.license_settings (plan_name, max_users) VALUES ('Free', 5);

-- Estágios do pipeline padrão
INSERT INTO public.pipeline_stages (stage, name, color, probability, sort_order) VALUES
('prospeccao', 'Prospecção', '#6366f1', 10, 1),
('qualificacao', 'Qualificação', '#8b5cf6', 25, 2),
('proposta', 'Proposta', '#f59e0b', 50, 3),
('negociacao', 'Negociação', '#3b82f6', 75, 4),
('fechado_ganho', 'Fechado Ganho', '#10b981', 100, 5),
('fechado_perdido', 'Fechado Perdido', '#ef4444', 0, 6);

-- Módulos do sistema
INSERT INTO public.system_modules (key, name, path, icon, sort_order) VALUES
('dashboard', 'Dashboard', '/', 'LayoutDashboard', 1),
('companies', 'Empresas', '/companies', 'Building2', 2),
('contacts', 'Contatos', '/contacts', 'Users', 3),
('pipeline', 'Pipeline', '/pipeline', 'GitBranch', 4),
('products', 'Produtos', '/products', 'Package', 5),
('orders', 'Pedidos', '/orders', 'ShoppingCart', 6),
('tasks', 'Tarefas', '/tasks', 'CheckSquare', 7),
('whatsapp', 'WhatsApp', '/whatsapp', 'MessageCircle', 8),
('bots', 'Bots', '/bots', 'Bot', 9),
('emails', 'Emails', '/emails', 'Mail', 10),
('reports', 'Relatórios', '/reports', 'BarChart3', 11),
('insights', 'Insights', '/insights', 'Lightbulb', 12),
('settings', 'Configurações', '/settings', 'Settings', 13),
('iniflex', 'Iniflex', '/iniflex', 'RefreshCw', 14);

-- Permissões por role/módulo
INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'admin', id, true, 'total' FROM public.system_modules;

INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'vendedor', id, true, 'restrito' FROM public.system_modules WHERE key IN ('dashboard', 'companies', 'contacts', 'pipeline', 'products', 'tasks', 'whatsapp', 'emails');

INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'atendente', id, true, 'restrito' FROM public.system_modules WHERE key IN ('dashboard', 'whatsapp', 'tasks', 'contacts');

-- =====================================================
-- BLOCO 9: REALTIME
-- =====================================================

-- Habilitar realtime para mensagens WhatsApp
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================
