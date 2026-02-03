-- Enum para status de resultado de prospecção
DO $$ BEGIN
    CREATE TYPE public.prospecting_result_status AS ENUM ('new', 'saved', 'discarded');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Tabela de buscas de prospecção
CREATE TABLE IF NOT EXISTS public.prospecting_searches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}',
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de resultados de prospecção
CREATE TABLE IF NOT EXISTS public.prospecting_results (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    search_id UUID NOT NULL REFERENCES public.prospecting_searches(id) ON DELETE CASCADE,
    cnpj TEXT NOT NULL,
    razao_social TEXT,
    nome_fantasia TEXT,
    cnae_principal TEXT,
    cnae_descricao TEXT,
    porte TEXT,
    estado TEXT,
    cidade TEXT,
    data_abertura DATE,
    situacao_cadastral TEXT,
    raw_data JSONB,
    status public.prospecting_result_status NOT NULL DEFAULT 'new',
    saved_as_company_id UUID,
    saved_at TIMESTAMPTZ,
    saved_by UUID,
    discarded_at TIMESTAMPTZ,
    discarded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_prospecting_searches_user ON public.prospecting_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_prospecting_searches_created ON public.prospecting_searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospecting_results_search ON public.prospecting_results(search_id);
CREATE INDEX IF NOT EXISTS idx_prospecting_results_cnpj ON public.prospecting_results(cnpj);
CREATE INDEX IF NOT EXISTS idx_prospecting_results_status ON public.prospecting_results(status);

-- Enable RLS
ALTER TABLE public.prospecting_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies para prospecting_searches
CREATE POLICY "Users can view their own searches"
ON public.prospecting_searches FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own searches"
ON public.prospecting_searches FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own searches"
ON public.prospecting_searches FOR DELETE
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies para prospecting_results
CREATE POLICY "Users can view results from their searches"
ON public.prospecting_results FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.prospecting_searches ps 
        WHERE ps.id = search_id 
        AND (ps.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
);

CREATE POLICY "Users can update results from their searches"
ON public.prospecting_results FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.prospecting_searches ps 
        WHERE ps.id = search_id 
        AND (ps.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
);

-- Adicionar campo de origem na companies para rastrear prospecção
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'manual';

-- Adicionar módulo de prospecção ao sistema
INSERT INTO public.system_modules (key, name, path, icon, is_active, sort_order)
VALUES ('prospecting', 'Prospecção', '/prospecting', 'Search', true, 25)
ON CONFLICT (key) DO UPDATE SET 
    name = EXCLUDED.name,
    path = EXCLUDED.path,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active;

-- Dar acesso ao módulo para admin e vendedor (usando valores corretos do enum)
INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'admin', id, true, 'total' FROM public.system_modules WHERE key = 'prospecting'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'vendedor', id, true, 'restrito' FROM public.system_modules WHERE key = 'prospecting'
ON CONFLICT DO NOTHING;