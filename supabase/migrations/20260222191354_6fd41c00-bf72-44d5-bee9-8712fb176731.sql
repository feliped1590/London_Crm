
-- Tabela de logs de importação
CREATE TABLE public.import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  imported_by UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES public.tenants(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de erros de importação
CREATE TABLE public.import_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_log_id UUID NOT NULL REFERENCES public.import_logs(id) ON DELETE CASCADE,
  row_number INTEGER,
  error_message TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view import logs" ON public.import_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert import logs" ON public.import_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view import errors" ON public.import_errors FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert import errors" ON public.import_errors FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Unique constraint on companies for upsert (tenant_id + cnpj)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_tenant_cnpj ON public.companies (tenant_id, cnpj) WHERE cnpj IS NOT NULL AND cnpj != '';
