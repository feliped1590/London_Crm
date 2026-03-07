
-- 1. Create sales_reps table
CREATE TABLE public.sales_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'interno',
  phone TEXT,
  email TEXT,
  active BOOLEAN DEFAULT true,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sales_reps_tenant ON public.sales_reps(tenant_id);

ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales reps" ON public.sales_reps
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_tenants WHERE user_id = auth.uid() AND tenant_id = sales_reps.tenant_id)
  );

CREATE POLICY "Admins can manage sales reps" ON public.sales_reps
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );

-- 2. Create user_sales_reps table
CREATE TABLE public.user_sales_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sales_rep_id UUID NOT NULL REFERENCES public.sales_reps(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, sales_rep_id)
);

CREATE INDEX idx_user_sales_reps_user ON public.user_sales_reps(user_id);

ALTER TABLE public.user_sales_reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sales rep links" ON public.user_sales_reps
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage user sales rep links" ON public.user_sales_reps
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );

-- 3. Add sales_rep_id to companies
ALTER TABLE public.companies ADD COLUMN sales_rep_id UUID REFERENCES public.sales_reps(id);
CREATE INDEX idx_companies_sales_rep ON public.companies(sales_rep_id);

-- 4. Trigger to auto-set sales_rep_id on company insert
CREATE OR REPLACE FUNCTION public.set_default_sales_rep()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_default_rep UUID;
BEGIN
  IF NEW.sales_rep_id IS NULL THEN
    SELECT usr.sales_rep_id INTO v_default_rep
    FROM public.user_sales_reps usr
    WHERE usr.user_id = auth.uid()
      AND usr.is_default = true
    LIMIT 1;

    IF v_default_rep IS NOT NULL THEN
      NEW.sales_rep_id := v_default_rep;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_default_sales_rep
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_sales_rep();

-- 5. Function to ensure only one default per user
CREATE OR REPLACE FUNCTION public.ensure_single_default_sales_rep()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.user_sales_reps
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_single_default_sales_rep
  BEFORE INSERT OR UPDATE ON public.user_sales_reps
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_sales_rep();
