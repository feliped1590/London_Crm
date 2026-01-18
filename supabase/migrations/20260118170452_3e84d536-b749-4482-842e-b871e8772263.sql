-- Adicionar foreign keys na tabela proposals
ALTER TABLE public.proposals
ADD CONSTRAINT proposals_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.proposals
ADD CONSTRAINT proposals_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.proposals
ADD CONSTRAINT proposals_deal_id_fkey 
FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- Adicionar foreign keys na tabela orders
ALTER TABLE public.orders
ADD CONSTRAINT orders_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.orders
ADD CONSTRAINT orders_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;