
-- Tabela de Categorias de Produto
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de Materiais
CREATE TABLE public.product_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de Cores
CREATE TABLE public.product_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de Unidades de Medida
CREATE TABLE public.product_unit_measures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_unit_measures ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can read
CREATE POLICY "Authenticated users can read product_categories" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read product_materials" ON public.product_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read product_colors" ON public.product_colors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read product_unit_measures" ON public.product_unit_measures FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: only admin and developer
CREATE POLICY "Admins can insert product_categories" ON public.product_categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can update product_categories" ON public.product_categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can delete product_categories" ON public.product_categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Admins can insert product_materials" ON public.product_materials FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can update product_materials" ON public.product_materials FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can delete product_materials" ON public.product_materials FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Admins can insert product_colors" ON public.product_colors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can update product_colors" ON public.product_colors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can delete product_colors" ON public.product_colors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Admins can insert product_unit_measures" ON public.product_unit_measures FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can update product_unit_measures" ON public.product_unit_measures FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));
CREATE POLICY "Admins can delete product_unit_measures" ON public.product_unit_measures FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'));

-- Seed initial data from existing hardcoded options
INSERT INTO public.product_categories (value, label, sort_order) VALUES
  ('bobina', 'Bobina', 1),
  ('sacola', 'Sacola', 2),
  ('filme', 'Filme', 3),
  ('saco', 'Saco', 4),
  ('fita', 'Fita', 5),
  ('outros', 'Outros', 6);

INSERT INTO public.product_materials (value, label, sort_order) VALUES
  ('PEBD', 'PEBD (Polietileno de Baixa Densidade)', 1),
  ('PEAD', 'PEAD (Polietileno de Alta Densidade)', 2),
  ('PP', 'PP (Polipropileno)', 3),
  ('BOPP', 'BOPP (Polipropileno Biorientado)', 4),
  ('PET', 'PET (Polietileno Tereftalato)', 5),
  ('PVC', 'PVC (Policloreto de Vinila)', 6),
  ('outros', 'Outros', 7);

INSERT INTO public.product_colors (value, label, sort_order) VALUES
  ('transparente', 'Transparente', 1),
  ('branco', 'Branco', 2),
  ('preto', 'Preto', 3),
  ('colorido', 'Colorido', 4),
  ('impresso', 'Impresso', 5);

INSERT INTO public.product_unit_measures (value, label, sort_order) VALUES
  ('un', 'Unidade (un)', 1),
  ('kg', 'Quilograma (kg)', 2),
  ('m', 'Metro (m)', 3),
  ('m2', 'Metro² (m²)', 4),
  ('pc', 'Peça (pc)', 5),
  ('rl', 'Rolo (rl)', 6);
