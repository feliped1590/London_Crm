-- ==========================================
-- CRM SUPABASE SCHEMA COMPLETO
-- Execute este script no SQL Editor do seu Supabase
-- ==========================================

-- ==========================================
-- PARTE 1: TIPOS E ENUMS
-- ==========================================

-- Enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'gerente', 'vendedor', 'atendente');

-- Enum para estágios do pipeline
CREATE TYPE public.deal_stage AS ENUM ('prospeccao', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho', 'fechado_perdido');

-- Enum para status de tarefas
CREATE TYPE public.task_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');

-- Enum para prioridade de tarefas
CREATE TYPE public.task_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- Enum para tipos de campos customizados
CREATE TYPE public.custom_field_type AS ENUM ('text', 'number', 'date', 'select', 'multiselect', 'checkbox', 'url', 'email', 'phone', 'currency');

-- Enum para entidades de campos customizados
CREATE TYPE public.custom_field_entity AS ENUM ('company', 'contact', 'deal');

-- Enum para tipo de pessoa (PF/PJ)
CREATE TYPE public.tipo_pessoa AS ENUM ('PF', 'PJ');

-- Enum para status de propostas
CREATE TYPE public.proposal_status AS ENUM ('rascunho', 'enviada', 'em_analise', 'aprovada', 'recusada', 'expirada');

-- Enum para status de pedidos
CREATE TYPE public.order_status AS ENUM ('pendente', 'em_producao', 'produzido', 'faturado', 'entregue', 'cancelado');

-- Enum para gatilhos de automação
CREATE TYPE public.automation_trigger AS ENUM ('stage_enter', 'stage_exit');

-- Enum para ações de automação
CREATE TYPE public.automation_action AS ENUM ('send_whatsapp', 'create_task', 'add_tag', 'send_email');

-- Enum para nível de acesso
CREATE TYPE public.access_level AS ENUM ('restrito', 'total');

-- ==========================================
-- PARTE 2: FUNÇÕES UTILITÁRIAS
-- ==========================================

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
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
$$;

-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
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

-- ==========================================
-- PARTE 3: TABELAS PRINCIPAIS
-- ==========================================

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de roles de usuário
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'vendedor',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Tabela de configurações de licença
CREATE TABLE public.license_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    max_users INTEGER NOT NULL DEFAULT 5,
    plan_name TEXT NOT NULL DEFAULT 'starter',
    valid_until TIMESTAMPTZ,
    features JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de empresas
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    industry TEXT,
    employee_count TEXT,
    annual_revenue TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'Brasil',
    notes TEXT,
    cnpj TEXT,
    inscricao_estadual TEXT,
    fantasia TEXT,
    iniflex_id TEXT,
    iniflex_synced_at TIMESTAMP WITH TIME ZONE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de contatos
CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    job_title TEXT,
    department TEXT,
    linkedin_url TEXT,
    notes TEXT,
    cpf TEXT,
    tipo_pessoa tipo_pessoa DEFAULT 'PF',
    iniflex_id TEXT,
    iniflex_synced_at TIMESTAMP WITH TIME ZONE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de negócios (deals)
CREATE TABLE public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    stage deal_stage NOT NULL DEFAULT 'prospeccao',
    value DECIMAL(15, 2) DEFAULT 0,
    probability INTEGER DEFAULT 10 CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    notes TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    lost_reason TEXT,
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de histórico de estágios
CREATE TABLE public.deal_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    from_stage deal_stage,
    to_stage deal_stage NOT NULL,
    changed_by UUID,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de tarefas
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'pendente',
    priority task_priority NOT NULL DEFAULT 'media',
    due_date TIMESTAMP WITH TIME ZONE,
    due_time TIME,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de lembretes de tarefas
CREATE TABLE public.task_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    reminder_type TEXT NOT NULL DEFAULT 'email_1h',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(task_id, user_id, reminder_type)
);

-- Tabela de atividades
CREATE TABLE public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    subject TEXT,
    content TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de produtos
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit_measure TEXT DEFAULT 'un',
    unit_price NUMERIC(12,2) DEFAULT 0,
    material TEXT,
    color TEXT,
    width NUMERIC(10,2),
    length NUMERIC(10,2),
    thickness NUMERIC(10,3),
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de propostas
CREATE TABLE public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number TEXT NOT NULL UNIQUE,
    deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    status proposal_status NOT NULL DEFAULT 'rascunho',
    validity_date DATE,
    payment_terms TEXT,
    delivery_terms TEXT,
    observations TEXT,
    total_value NUMERIC(14,2) DEFAULT 0,
    approval_token UUID UNIQUE,
    approval_token_expires_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by_name TEXT,
    approved_by_ip TEXT,
    rejection_reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de itens de proposta
CREATE TABLE public.proposal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    description TEXT NOT NULL,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    width NUMERIC(10,2),
    length NUMERIC(10,2),
    thickness NUMERIC(10,3),
    discount_percent NUMERIC(5,2) DEFAULT 0,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de pedidos
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number TEXT NOT NULL UNIQUE,
    proposal_id UUID REFERENCES public.proposals(id),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    status order_status NOT NULL DEFAULT 'pendente',
    delivery_date DATE,
    total_value NUMERIC(14,2) DEFAULT 0,
    observations TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de itens de pedido
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    description TEXT NOT NULL,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    width NUMERIC(10,2),
    length NUMERIC(10,2),
    thickness NUMERIC(10,3),
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de templates de email
CREATE TABLE public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_shared BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de logs de email
CREATE TABLE public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    to_email TEXT NOT NULL,
    from_email TEXT,
    status TEXT DEFAULT 'sent',
    sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    opened_at TIMESTAMP WITH TIME ZONE,
    scheduled_for TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Tabela de campos customizados
CREATE TABLE public.custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity custom_field_entity NOT NULL,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type custom_field_type NOT NULL DEFAULT 'text',
    options JSONB,
    is_required BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (entity, name)
);

-- Tabela de estágios do pipeline
CREATE TABLE public.pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    stage deal_stage NOT NULL UNIQUE,
    color TEXT DEFAULT '#6366f1',
    probability INTEGER DEFAULT 10,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de automações do pipeline
CREATE TABLE public.pipeline_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    trigger_type automation_trigger NOT NULL,
    trigger_stage deal_stage NOT NULL,
    action_type automation_action NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de módulos do sistema
CREATE TABLE public.system_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    path TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de permissões por role
CREATE TABLE public.role_module_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role app_role NOT NULL,
    module_id UUID REFERENCES public.system_modules(id) ON DELETE CASCADE,
    can_access BOOLEAN DEFAULT true,
    access_type access_level DEFAULT 'restrito',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role, module_id)
);

-- ==========================================
-- PARTE 4: TABELAS WHATSAPP
-- ==========================================

-- Tabela de instâncias WhatsApp (Z-API)
CREATE TABLE public.whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    instance_id TEXT NOT NULL UNIQUE,
    instance_token TEXT NOT NULL,
    phone_number TEXT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    connected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de mensagens WhatsApp
CREATE TABLE public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT NOT NULL DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    zapi_message_id TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de contatos WhatsApp
CREATE TABLE public.whatsapp_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL UNIQUE,
    profile_name TEXT,
    profile_picture_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de resumos de conversas (IA)
CREATE TABLE public.whatsapp_conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    summary TEXT NOT NULL,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    customer_intent TEXT,
    next_steps TEXT[],
    message_count INT,
    analyzed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de objeções detectadas
CREATE TABLE public.whatsapp_objections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('price', 'timing', 'competition', 'authority', 'need', 'other')),
    description TEXT NOT NULL,
    message_excerpt TEXT,
    status TEXT DEFAULT 'raised' CHECK (status IN ('raised', 'addressed', 'resolved')),
    resolution TEXT,
    detected_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- PARTE 5: TABELAS BOT BUILDER
-- ==========================================

-- Tabela de fluxos de bot
CREATE TABLE public.bot_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    trigger_type TEXT NOT NULL DEFAULT 'new_conversation',
    trigger_config JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de nós do fluxo
CREATE TABLE public.bot_flow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL,
    node_id TEXT NOT NULL,
    position_x NUMERIC NOT NULL DEFAULT 0,
    position_y NUMERIC NOT NULL DEFAULT 0,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de conexões do fluxo
CREATE TABLE public.bot_flow_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
    edge_id TEXT NOT NULL,
    source_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    source_handle TEXT,
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de sessões de bot
CREATE TABLE public.bot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.bot_flows(id),
    instance_id UUID REFERENCES public.whatsapp_instances(id),
    phone TEXT NOT NULL,
    current_node_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    contact_id UUID REFERENCES public.contacts(id),
    company_id UUID REFERENCES public.companies(id),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    transferred_to UUID,
    timeout_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de dados coletados pelo bot
CREATE TABLE public.bot_session_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.bot_sessions(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_value TEXT,
    collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- PARTE 6: TABELAS AUXILIARES
-- ==========================================

-- Tabela de configurações de dashboard do usuário
CREATE TABLE public.user_dashboard_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL DEFAULT 'Meu Dashboard',
    widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, name)
);

-- Tabela de conversas com IA
CREATE TABLE public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de logs de acesso a propostas
CREATE TABLE public.proposal_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
    ip_address TEXT NOT NULL,
    action TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    token_prefix TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- PARTE 7: SEQUENCES E FUNÇÕES ESPECIAIS
-- ==========================================

-- Sequência para números de proposta
CREATE SEQUENCE proposal_number_seq START 1;

-- Sequência para números de pedido
CREATE SEQUENCE order_number_seq START 1;

-- Função para gerar número de proposta
CREATE OR REPLACE FUNCTION public.generate_proposal_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := 'PROP-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('proposal_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Função para gerar número de pedido
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := 'PED-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

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

-- Função para obter tipo de acesso ao módulo
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

-- Função para verificar status da licença
CREATE OR REPLACE FUNCTION public.get_license_status()
RETURNS TABLE (
    current_users INTEGER,
    max_users INTEGER,
    plan_name TEXT,
    can_add_user BOOLEAN,
    usage_percentage NUMERIC,
    valid_until TIMESTAMPTZ
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

-- Função para criar perfil ao cadastrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Criar perfil
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
    
    -- Atribuir role padrão (vendedor)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'vendedor');
    
    RETURN NEW;
END;
$$;

-- ==========================================
-- PARTE 8: TRIGGERS
-- ==========================================

-- Trigger para criar perfil ao cadastrar usuário
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers de updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deals_updated_at
    BEFORE UPDATE ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_fields_updated_at
    BEFORE UPDATE ON public.custom_fields
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_proposals_updated_at
    BEFORE UPDATE ON public.proposals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_license_settings_updated_at
    BEFORE UPDATE ON public.license_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_instances_updated_at
    BEFORE UPDATE ON public.whatsapp_instances
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_contacts_updated_at
    BEFORE UPDATE ON public.whatsapp_contacts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bot_flows_updated_at
    BEFORE UPDATE ON public.bot_flows
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bot_flow_nodes_updated_at
    BEFORE UPDATE ON public.bot_flow_nodes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_dashboard_configs_updated_at
    BEFORE UPDATE ON public.user_dashboard_configs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_conversations_updated_at
    BEFORE UPDATE ON public.ai_conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_role_module_permissions_updated_at
    BEFORE UPDATE ON public.role_module_permissions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_summaries_updated_at
    BEFORE UPDATE ON public.whatsapp_conversation_summaries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_objections_updated_at
    BEFORE UPDATE ON public.whatsapp_objections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Triggers para geração automática de números
CREATE TRIGGER generate_proposal_number_trigger
    BEFORE INSERT ON public.proposals
    FOR EACH ROW EXECUTE FUNCTION public.generate_proposal_number();

CREATE TRIGGER generate_order_number_trigger
    BEFORE INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- ==========================================
-- PARTE 9: HABILITAR RLS EM TODAS AS TABELAS
-- ==========================================

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
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.user_dashboard_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_access_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PARTE 10: POLÍTICAS RLS
-- ==========================================

-- Profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User Roles
CREATE POLICY "Users can view all roles" ON public.user_roles
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert roles" ON public.user_roles
    FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles
    FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- License Settings
CREATE POLICY "Authenticated users can view license settings" ON public.license_settings
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can update license settings" ON public.license_settings
    FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Companies
CREATE POLICY "Authenticated users can view companies" ON public.companies
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert companies" ON public.companies
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update companies they own or are admin" ON public.companies
    FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete companies" ON public.companies
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Contacts
CREATE POLICY "Authenticated users can view contacts" ON public.contacts
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert contacts" ON public.contacts
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update contacts they own or are admin" ON public.contacts
    FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete contacts" ON public.contacts
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Deals
CREATE POLICY "Authenticated users can view deals" ON public.deals
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert deals" ON public.deals
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update deals they own or are admin" ON public.deals
    FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete deals" ON public.deals
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Deal Stage History
CREATE POLICY "Authenticated users can view stage history" ON public.deal_stage_history
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert stage history" ON public.deal_stage_history
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Tasks
CREATE POLICY "Authenticated users can view tasks" ON public.tasks
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tasks" ON public.tasks
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update tasks assigned to them or are admin" ON public.tasks
    FOR UPDATE TO authenticated USING (assigned_to = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete tasks they created or are admin" ON public.tasks
    FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Task Reminders
CREATE POLICY "Users can view their own reminders" ON public.task_reminders
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role can insert reminders" ON public.task_reminders
    FOR INSERT TO service_role WITH CHECK (true);

-- Activities
CREATE POLICY "Authenticated users can view activities" ON public.activities
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activities" ON public.activities
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update activities they created" ON public.activities
    FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Users can delete activities they created or are admin" ON public.activities
    FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Products
CREATE POLICY "Authenticated users can view active products" ON public.products
    FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert products" ON public.products
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update products" ON public.products
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete products" ON public.products
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Proposals
CREATE POLICY "Authenticated users can view proposals" ON public.proposals
    FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert proposals" ON public.proposals
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update proposals they created or are admin" ON public.proposals
    FOR UPDATE USING ((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete proposals" ON public.proposals
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Proposal Items
CREATE POLICY "Authenticated users can view proposal items" ON public.proposal_items
    FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert proposal items" ON public.proposal_items
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update proposal items" ON public.proposal_items
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete proposal items" ON public.proposal_items
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Orders
CREATE POLICY "Authenticated users can view orders" ON public.orders
    FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert orders" ON public.orders
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update orders they created or are admin" ON public.orders
    FOR UPDATE USING ((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete orders" ON public.orders
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Order Items
CREATE POLICY "Authenticated users can view order items" ON public.order_items
    FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert order items" ON public.order_items
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update order items" ON public.order_items
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete order items" ON public.order_items
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Email Templates
CREATE POLICY "Users can view shared templates or own templates" ON public.email_templates
    FOR SELECT TO authenticated USING (is_shared = true OR created_by = auth.uid());
CREATE POLICY "Authenticated users can insert email templates" ON public.email_templates
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own templates" ON public.email_templates
    FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Users can delete own templates" ON public.email_templates
    FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Email Logs
CREATE POLICY "Authenticated users can view email logs" ON public.email_logs
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert email logs" ON public.email_logs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete scheduled emails they sent" ON public.email_logs
    FOR DELETE USING (sent_by = auth.uid() AND status = 'scheduled');

-- Custom Fields
CREATE POLICY "Authenticated users can view custom fields" ON public.custom_fields
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert custom fields" ON public.custom_fields
    FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update custom fields" ON public.custom_fields
    FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete custom fields" ON public.custom_fields
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Pipeline Stages
CREATE POLICY "Authenticated users can view pipeline stages" ON public.pipeline_stages
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage pipeline stages" ON public.pipeline_stages
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Pipeline Automations
CREATE POLICY "Authenticated users can view automations" ON public.pipeline_automations
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage automations" ON public.pipeline_automations
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- System Modules
CREATE POLICY "Authenticated users can view modules" ON public.system_modules
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage modules" ON public.system_modules
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Role Module Permissions
CREATE POLICY "Authenticated users can view permissions" ON public.role_module_permissions
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage permissions" ON public.role_module_permissions
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- WhatsApp Instances
CREATE POLICY "Users can view own instances or admin" ON public.whatsapp_instances
    FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can insert instances" ON public.whatsapp_instances
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own instances or admin" ON public.whatsapp_instances
    FOR UPDATE USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own instances or admin" ON public.whatsapp_instances
    FOR DELETE USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- WhatsApp Messages
CREATE POLICY "Users can view messages from their instances or admins see all" ON public.whatsapp_messages
    FOR SELECT TO authenticated USING (
        public.has_role(auth.uid(), 'admin') 
        OR instance_id IN (SELECT id FROM public.whatsapp_instances WHERE user_id = auth.uid())
    );
CREATE POLICY "Authenticated users can insert messages" ON public.whatsapp_messages
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update messages from their instances or admins" ON public.whatsapp_messages
    FOR UPDATE TO authenticated USING (
        public.has_role(auth.uid(), 'admin') 
        OR instance_id IN (SELECT id FROM public.whatsapp_instances WHERE user_id = auth.uid())
    );

-- WhatsApp Contacts
CREATE POLICY "Authenticated users can view whatsapp contacts" ON public.whatsapp_contacts
    FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert whatsapp contacts" ON public.whatsapp_contacts
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update whatsapp contacts" ON public.whatsapp_contacts
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete whatsapp contacts" ON public.whatsapp_contacts
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- WhatsApp Conversation Summaries
CREATE POLICY "Authenticated users can view summaries" ON public.whatsapp_conversation_summaries
    FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert summaries" ON public.whatsapp_conversation_summaries
    FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update summaries" ON public.whatsapp_conversation_summaries
    FOR UPDATE USING (public.is_authenticated());

-- WhatsApp Objections
CREATE POLICY "Authenticated users can view objections" ON public.whatsapp_objections
    FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert objections" ON public.whatsapp_objections
    FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update objections" ON public.whatsapp_objections
    FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete objections" ON public.whatsapp_objections
    FOR DELETE USING (public.is_authenticated());

-- Bot Flows
CREATE POLICY "Authenticated users can view bot flows" ON public.bot_flows
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create bot flows" ON public.bot_flows
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own flows or admins" ON public.bot_flows
    FOR UPDATE USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete bot flows" ON public.bot_flows
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Bot Flow Nodes
CREATE POLICY "Authenticated users can view flow nodes" ON public.bot_flow_nodes
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage flow nodes" ON public.bot_flow_nodes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update flow nodes" ON public.bot_flow_nodes
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete flow nodes" ON public.bot_flow_nodes
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Bot Flow Edges
CREATE POLICY "Authenticated users can view flow edges" ON public.bot_flow_edges
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage flow edges" ON public.bot_flow_edges
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update flow edges" ON public.bot_flow_edges
    FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete flow edges" ON public.bot_flow_edges
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Bot Sessions
CREATE POLICY "Authenticated users can view bot sessions" ON public.bot_sessions
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create bot sessions" ON public.bot_sessions
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update bot sessions" ON public.bot_sessions
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Bot Session Data
CREATE POLICY "Authenticated users can view session data" ON public.bot_session_data
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage session data" ON public.bot_session_data
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- User Dashboard Configs
CREATE POLICY "Users can view their own dashboard configs" ON public.user_dashboard_configs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own dashboard configs" ON public.user_dashboard_configs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own dashboard configs" ON public.user_dashboard_configs
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own dashboard configs" ON public.user_dashboard_configs
    FOR DELETE USING (auth.uid() = user_id);

-- AI Conversations
CREATE POLICY "Users can view their own conversations" ON public.ai_conversations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own conversations" ON public.ai_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations" ON public.ai_conversations
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations" ON public.ai_conversations
    FOR DELETE USING (auth.uid() = user_id);

-- Proposal Access Logs
CREATE POLICY "Service role can insert access logs" ON public.proposal_access_logs
    FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Admins can view access logs" ON public.proposal_access_logs
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- PARTE 11: ÍNDICES
-- ==========================================

-- Companies
CREATE INDEX idx_companies_owner ON public.companies(owner_id);
CREATE INDEX idx_companies_created_by ON public.companies(created_by);
CREATE INDEX idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX idx_companies_iniflex_id ON public.companies(iniflex_id);

-- Contacts
CREATE INDEX idx_contacts_company ON public.contacts(company_id);
CREATE INDEX idx_contacts_owner ON public.contacts(owner_id);
CREATE INDEX idx_contacts_cpf ON public.contacts(cpf);
CREATE INDEX idx_contacts_iniflex_id ON public.contacts(iniflex_id);

-- Deals
CREATE INDEX idx_deals_company ON public.deals(company_id);
CREATE INDEX idx_deals_contact ON public.deals(contact_id);
CREATE INDEX idx_deals_owner ON public.deals(owner_id);
CREATE INDEX idx_deals_stage ON public.deals(stage);

-- Deal Stage History
CREATE INDEX idx_deal_stage_history_deal_id ON public.deal_stage_history(deal_id);
CREATE INDEX idx_deal_stage_history_changed_at ON public.deal_stage_history(changed_at DESC);

-- Tasks
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_deal ON public.tasks(deal_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);

-- Task Reminders
CREATE INDEX idx_task_reminders_task_id ON public.task_reminders(task_id);
CREATE INDEX idx_task_reminders_user_id ON public.task_reminders(user_id);
CREATE INDEX idx_task_reminders_type ON public.task_reminders(reminder_type);

-- Activities
CREATE INDEX idx_activities_company ON public.activities(company_id);
CREATE INDEX idx_activities_contact ON public.activities(contact_id);
CREATE INDEX idx_activities_deal ON public.activities(deal_id);

-- Products
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_active ON public.products(active);

-- Proposals
CREATE INDEX idx_proposals_deal_id ON public.proposals(deal_id);
CREATE INDEX idx_proposals_status ON public.proposals(status);
CREATE INDEX idx_proposals_company_id ON public.proposals(company_id);
CREATE INDEX idx_proposals_approval_token ON public.proposals(approval_token) WHERE approval_token IS NOT NULL;

-- Proposal Items
CREATE INDEX idx_proposal_items_proposal_id ON public.proposal_items(proposal_id);

-- Orders
CREATE INDEX idx_orders_proposal_id ON public.orders(proposal_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_company_id ON public.orders(company_id);

-- Order Items
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);

-- Pipeline Automations
CREATE INDEX idx_pipeline_automations_trigger ON public.pipeline_automations(trigger_type, trigger_stage) WHERE is_active = true;

-- WhatsApp Messages
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone);
CREATE INDEX idx_whatsapp_messages_instance_id ON public.whatsapp_messages(instance_id);
CREATE INDEX idx_whatsapp_messages_contact_id ON public.whatsapp_messages(contact_id);
CREATE INDEX idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);

-- WhatsApp Contacts
CREATE INDEX idx_whatsapp_contacts_phone ON public.whatsapp_contacts(phone_number);

-- WhatsApp Summaries
CREATE INDEX idx_summaries_phone ON public.whatsapp_conversation_summaries(phone);
CREATE INDEX idx_summaries_contact ON public.whatsapp_conversation_summaries(contact_id);

-- WhatsApp Objections
CREATE INDEX idx_objections_phone ON public.whatsapp_objections(phone);
CREATE INDEX idx_objections_contact ON public.whatsapp_objections(contact_id);
CREATE INDEX idx_objections_status ON public.whatsapp_objections(status);

-- Bot Flow
CREATE INDEX idx_bot_flow_nodes_flow_id ON public.bot_flow_nodes(flow_id);
CREATE INDEX idx_bot_flow_edges_flow_id ON public.bot_flow_edges(flow_id);
CREATE INDEX idx_bot_sessions_phone ON public.bot_sessions(phone);
CREATE INDEX idx_bot_sessions_status ON public.bot_sessions(status);
CREATE INDEX idx_bot_session_data_session_id ON public.bot_session_data(session_id);

-- AI Conversations
CREATE INDEX idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_updated_at ON public.ai_conversations(updated_at DESC);

-- Proposal Access Logs
CREATE INDEX idx_proposal_access_logs_ip_time ON public.proposal_access_logs(ip_address, created_at DESC);
CREATE INDEX idx_proposal_access_logs_created ON public.proposal_access_logs(created_at DESC);

-- ==========================================
-- PARTE 12: DADOS INICIAIS
-- ==========================================

-- Inserir estágios do pipeline
INSERT INTO public.pipeline_stages (name, stage, color, probability, sort_order) VALUES
    ('Prospecção', 'prospeccao', '#6366f1', 10, 1),
    ('Qualificação', 'qualificacao', '#8b5cf6', 25, 2),
    ('Proposta', 'proposta', '#f59e0b', 50, 3),
    ('Negociação', 'negociacao', '#3b82f6', 75, 4),
    ('Fechado Ganho', 'fechado_ganho', '#10b981', 100, 5),
    ('Fechado Perdido', 'fechado_perdido', '#ef4444', 0, 6);

-- Inserir configuração de licença inicial
INSERT INTO public.license_settings (max_users, plan_name) VALUES (5, 'starter');

-- Inserir módulos do sistema
INSERT INTO public.system_modules (key, name, icon, path, sort_order) VALUES
    ('dashboard', 'Dashboard', 'LayoutDashboard', '/', 1),
    ('companies', 'Empresas', 'Building2', '/companies', 2),
    ('contacts', 'Contatos', 'Users', '/contacts', 3),
    ('pipeline', 'Pipeline', 'Kanban', '/pipeline', 4),
    ('products', 'Produtos', 'Package', '/products', 5),
    ('orders', 'Pedidos', 'ShoppingCart', '/orders', 6),
    ('tasks', 'Tarefas', 'CheckSquare', '/tasks', 7),
    ('whatsapp', 'WhatsApp', 'MessageCircle', '/whatsapp', 8),
    ('emails', 'Emails', 'Mail', '/emails', 9),
    ('reports', 'Relatórios', 'BarChart3', '/reports', 10),
    ('iniflex', 'Iniflex', 'Database', '/iniflex', 11),
    ('insights', 'Insights', 'Lightbulb', '/insights', 12),
    ('settings', 'Configurações', 'Settings', '/settings', 13);

-- Inserir permissões padrão para vendedor
INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'vendedor', id, true, 'total' FROM public.system_modules WHERE key IN ('dashboard', 'companies', 'contacts', 'pipeline', 'orders', 'tasks', 'whatsapp', 'emails', 'insights');

INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'vendedor', id, true, 'restrito' FROM public.system_modules WHERE key IN ('products', 'reports');

INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'vendedor', id, false, 'restrito' FROM public.system_modules WHERE key IN ('iniflex', 'settings');

-- Inserir permissões padrão para atendente
INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'atendente', id, true, 'restrito' FROM public.system_modules WHERE key IN ('dashboard', 'contacts', 'whatsapp', 'tasks');

INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'atendente', id, false, 'restrito' FROM public.system_modules WHERE key NOT IN ('dashboard', 'contacts', 'whatsapp', 'tasks');

-- Inserir permissões padrão para gerente
INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'gerente', id, true, 'total' FROM public.system_modules WHERE key IN ('dashboard', 'companies', 'contacts', 'pipeline', 'products', 'orders', 'tasks', 'whatsapp', 'emails', 'reports', 'insights');

INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'gerente', id, false, 'restrito' FROM public.system_modules WHERE key IN ('iniflex', 'settings');

-- ==========================================
-- PARTE 13: REALTIME
-- ==========================================

-- Habilitar realtime para mensagens WhatsApp
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- ==========================================
-- SCHEMA COMPLETO FINALIZADO!
-- ==========================================
