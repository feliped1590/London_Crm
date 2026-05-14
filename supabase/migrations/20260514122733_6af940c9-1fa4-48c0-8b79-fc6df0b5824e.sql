
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ficha_tecnica jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.product_groups
  ADD COLUMN IF NOT EXISTS ficha_profile text NOT NULL DEFAULT 'none';

ALTER TABLE public.product_groups
  DROP CONSTRAINT IF EXISTS product_groups_ficha_profile_check;
ALTER TABLE public.product_groups
  ADD CONSTRAINT product_groups_ficha_profile_check
  CHECK (ficha_profile IN ('none','stand_up_liso','stand_up_impresso','saco_liso','saco_impresso','bobina_lisa','bobina_impressa'));

CREATE TABLE IF NOT EXISTS public.product_ficha_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_ficha_cylinders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_ficha_accessories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_ficha_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ficha_cylinders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ficha_accessories ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_pfm_updated_at ON public.product_ficha_machines;
CREATE TRIGGER trg_pfm_updated_at BEFORE UPDATE ON public.product_ficha_machines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_pfc_updated_at ON public.product_ficha_cylinders;
CREATE TRIGGER trg_pfc_updated_at BEFORE UPDATE ON public.product_ficha_cylinders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_pfa_updated_at ON public.product_ficha_accessories;
CREATE TRIGGER trg_pfa_updated_at BEFORE UPDATE ON public.product_ficha_accessories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['product_ficha_machines','product_ficha_cylinders','product_ficha_accessories']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Authenticated read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true)', t);

    EXECUTE format('DROP POLICY IF EXISTS "Admins insert %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Admins insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''admin''::app_role) OR public.has_role(auth.uid(), ''desenvolvedor''::app_role))', t);

    EXECUTE format('DROP POLICY IF EXISTS "Admins update %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Admins update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role) OR public.has_role(auth.uid(), ''desenvolvedor''::app_role))', t);

    EXECUTE format('DROP POLICY IF EXISTS "Admins delete %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Admins delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role) OR public.has_role(auth.uid(), ''desenvolvedor''::app_role))', t);
  END LOOP;
END$$;
