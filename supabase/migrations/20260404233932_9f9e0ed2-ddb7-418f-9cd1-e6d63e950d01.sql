
-- ══════════════════════════════════════════════════════════════
-- Tabela de controle de sequências ERP
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.erp_sequences (
  sequence_name TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.erp_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sequences"
  ON public.erp_sequences FOR SELECT TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- Tabela de auditoria de geração de códigos
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.erp_sequence_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_name TEXT NOT NULL,
  generated_value INTEGER NOT NULL,
  product_id UUID NULL,
  generated_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.erp_sequence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sequence logs"
  ON public.erp_sequence_logs FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_erp_sequence_logs_sequence ON public.erp_sequence_logs(sequence_name);
CREATE INDEX idx_erp_sequence_logs_created ON public.erp_sequence_logs(created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- Inicializar sequência de produtos com maior código existente
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.erp_sequences (sequence_name, last_value)
VALUES (
  'product_code',
  COALESCE(
    (SELECT MAX(erp_product_code::integer) 
     FROM public.products 
     WHERE erp_product_code ~ '^\d+$'),
    0
  )
);

-- ══════════════════════════════════════════════════════════════
-- Função: next_erp_sequence (incremento atômico)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.next_erp_sequence(p_sequence_name TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  -- Garante existência da sequência
  INSERT INTO erp_sequences (sequence_name, last_value)
  VALUES (p_sequence_name, 0)
  ON CONFLICT (sequence_name) DO NOTHING;

  -- Incremento atômico com lock implícito
  UPDATE erp_sequences
  SET last_value = last_value + 1,
      updated_at = NOW()
  WHERE sequence_name = p_sequence_name
  RETURNING last_value INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Sequência "%" não encontrada', p_sequence_name;
  END IF;

  RETURN v_next;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- Função: sync_erp_sequence_if_higher (sincronização pós-import)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_erp_sequence_if_higher(
  p_sequence_name TEXT, 
  p_value INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garante existência
  INSERT INTO erp_sequences (sequence_name, last_value)
  VALUES (p_sequence_name, 0)
  ON CONFLICT (sequence_name) DO NOTHING;

  -- Atualiza apenas se valor importado for maior
  UPDATE erp_sequences
  SET last_value = GREATEST(last_value, p_value),
      updated_at = NOW()
  WHERE sequence_name = p_sequence_name;
END;
$$;
