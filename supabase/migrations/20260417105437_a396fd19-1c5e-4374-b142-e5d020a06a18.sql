-- 1. Adicionar coluna stage_status
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS stage_status TEXT NOT NULL DEFAULT 'open'
  CHECK (stage_status IN ('open', 'won', 'lost'));

-- 2. Tornar a coluna stage opcional (legado)
ALTER TABLE public.pipeline_stages
  ALTER COLUMN stage DROP NOT NULL;

-- 3. Migrar dados existentes
UPDATE public.pipeline_stages
SET stage_status = CASE
  WHEN stage = 'fechado_ganho' THEN 'won'
  WHEN stage = 'fechado_perdido' THEN 'lost'
  ELSE 'open'
END
WHERE stage_status = 'open';

-- 4. Índices únicos parciais: 1 won e 1 lost por pipeline
CREATE UNIQUE INDEX IF NOT EXISTS unique_won_stage_per_pipeline
  ON public.pipeline_stages (pipeline_id)
  WHERE stage_status = 'won';

CREATE UNIQUE INDEX IF NOT EXISTS unique_lost_stage_per_pipeline
  ON public.pipeline_stages (pipeline_id)
  WHERE stage_status = 'lost';

-- 5. Trigger de validação para mensagens claras (além dos índices)
CREATE OR REPLACE FUNCTION public.validate_pipeline_stage_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage_status = 'won' THEN
    IF EXISTS (
      SELECT 1 FROM public.pipeline_stages
      WHERE pipeline_id = NEW.pipeline_id
        AND stage_status = 'won'
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Já existe uma etapa marcada como Ganho neste pipeline. Apenas uma etapa pode ter o status Ganho por pipeline.'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  IF NEW.stage_status = 'lost' THEN
    IF EXISTS (
      SELECT 1 FROM public.pipeline_stages
      WHERE pipeline_id = NEW.pipeline_id
        AND stage_status = 'lost'
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Já existe uma etapa marcada como Perdido neste pipeline. Apenas uma etapa pode ter o status Perdido por pipeline.'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pipeline_stage_status ON public.pipeline_stages;
CREATE TRIGGER trg_validate_pipeline_stage_status
  BEFORE INSERT OR UPDATE OF stage_status, pipeline_id
  ON public.pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pipeline_stage_status();

-- 6. Função helper de leitura
CREATE OR REPLACE FUNCTION public.get_pipeline_stage_status(p_pipeline_id uuid)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'won_stage_id', (
      SELECT id FROM public.pipeline_stages
      WHERE pipeline_id = p_pipeline_id AND stage_status = 'won'
      LIMIT 1
    ),
    'lost_stage_id', (
      SELECT id FROM public.pipeline_stages
      WHERE pipeline_id = p_pipeline_id AND stage_status = 'lost'
      LIMIT 1
    ),
    'open_stage_ids', COALESCE((
      SELECT json_agg(id ORDER BY sort_order)
      FROM public.pipeline_stages
      WHERE pipeline_id = p_pipeline_id AND stage_status = 'open'
    ), '[]'::json)
  );
$$;