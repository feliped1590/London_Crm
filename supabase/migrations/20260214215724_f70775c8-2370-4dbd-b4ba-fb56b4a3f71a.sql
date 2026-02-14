-- Add legal_entity_id to deals and companies tables
ALTER TABLE public.deals ADD COLUMN legal_entity_id uuid REFERENCES public.legal_entities(id);
ALTER TABLE public.companies ADD COLUMN legal_entity_id uuid REFERENCES public.legal_entities(id);