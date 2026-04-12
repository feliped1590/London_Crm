
ALTER TABLE public.segmentos
ADD COLUMN erp_code integer NULL;

COMMENT ON COLUMN public.segmentos.erp_code IS 'Código do subsegmento no ERP Projedata (mapeamento: CRM Segmento = ERP Subsegmento)';
