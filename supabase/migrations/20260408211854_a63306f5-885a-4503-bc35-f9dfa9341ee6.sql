
-- ===== TABELA: company_sync_queue =====
CREATE TABLE public.company_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  payload jsonb,
  response jsonb,
  error_message text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_sync_status ON public.company_sync_queue(status);
CREATE INDEX idx_company_sync_company ON public.company_sync_queue(company_id);
CREATE INDEX idx_company_sync_pending ON public.company_sync_queue(status, next_retry_at) WHERE status IN ('pending', 'processing');

ALTER TABLE public.company_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and devs can view company sync queue"
  ON public.company_sync_queue FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor')
  );

CREATE POLICY "Admins and devs can insert company sync queue"
  ON public.company_sync_queue FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor')
  );

CREATE POLICY "Admins and devs can update company sync queue"
  ON public.company_sync_queue FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor')
  );

-- Service role access for edge functions
CREATE POLICY "Service role full access company sync queue"
  ON public.company_sync_queue FOR ALL
  USING (auth.role() = 'service_role');

-- ===== TABELA: erp_cities =====
CREATE TABLE public.erp_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  nome text NOT NULL,
  uf text NOT NULL,
  codigo_erp integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_erp_cities_tenant_nome_uf ON public.erp_cities(tenant_id, nome, uf);
CREATE INDEX idx_erp_cities_lookup ON public.erp_cities(nome, uf);

ALTER TABLE public.erp_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and devs can view erp cities"
  ON public.erp_cities FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor')
  );

CREATE POLICY "Admins and devs can manage erp cities"
  ON public.erp_cities FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor')
  );

CREATE POLICY "Service role full access erp cities"
  ON public.erp_cities FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger para updated_at
CREATE TRIGGER update_company_sync_queue_updated_at
  BEFORE UPDATE ON public.company_sync_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_erp_cities_updated_at
  BEFORE UPDATE ON public.erp_cities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
