
-- ============================================================
-- ETAPA 1: Criar tabelas de referência hierárquicas
-- ============================================================

-- Backup da classificação atual de companies
CREATE TABLE IF NOT EXISTS public.companies_classification_backup AS
SELECT id, name, industry, custom_fields->>'segmento' as segmento_legado, created_at
FROM public.companies;

-- Tabela: SETORES (Nível Macro)
CREATE TABLE public.setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: SEGMENTOS (Nível Meso)
CREATE TABLE public.segmentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id UUID NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: ATIVIDADES (Nível Micro)
CREATE TABLE public.atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segmento_id UUID NOT NULL REFERENCES public.segmentos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  nome_legado TEXT, -- para mapeamento na migração
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_segmentos_setor_id ON public.segmentos(setor_id);
CREATE INDEX idx_atividades_segmento_id ON public.atividades(segmento_id);
CREATE INDEX idx_atividades_nome_legado ON public.atividades(nome_legado);

-- RLS
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segmentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública setores" ON public.setores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia setores" ON public.setores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Leitura pública segmentos" ON public.segmentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia segmentos" ON public.segmentos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Leitura pública atividades" ON public.atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia atividades" ON public.atividades FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- ETAPA 3: Adicionar FKs na tabela companies
-- ============================================================
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS setor_id UUID REFERENCES public.setores(id);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS segmento_id UUID REFERENCES public.segmentos(id);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS atividade_id UUID REFERENCES public.atividades(id);

CREATE INDEX idx_companies_setor_id ON public.companies(setor_id);
CREATE INDEX idx_companies_segmento_id ON public.companies(segmento_id);
CREATE INDEX idx_companies_atividade_id ON public.companies(atividade_id);
