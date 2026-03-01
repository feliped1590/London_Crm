
-- Migrar contact_name de companies para registros reais na tabela contacts
-- Apenas para empresas que têm contact_name preenchido E ainda não possuem nenhum contato vinculado
INSERT INTO public.contacts (first_name, company_id, tenant_id, created_by, owner_id)
SELECT 
  TRIM(c.contact_name) AS first_name,
  c.id AS company_id,
  c.tenant_id,
  c.created_by,
  c.owner_id
FROM public.companies c
WHERE c.contact_name IS NOT NULL 
  AND TRIM(c.contact_name) != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.contacts ct WHERE ct.company_id = c.id
  );
