-- Create enum for tipo_pessoa
CREATE TYPE public.tipo_pessoa AS ENUM ('PF', 'PJ');

-- Add Iniflex integration fields to contacts table
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS tipo_pessoa tipo_pessoa DEFAULT 'PF',
ADD COLUMN IF NOT EXISTS iniflex_id text,
ADD COLUMN IF NOT EXISTS iniflex_synced_at timestamp with time zone;

-- Add Iniflex integration fields to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS cnpj text,
ADD COLUMN IF NOT EXISTS inscricao_estadual text,
ADD COLUMN IF NOT EXISTS fantasia text,
ADD COLUMN IF NOT EXISTS iniflex_id text,
ADD COLUMN IF NOT EXISTS iniflex_synced_at timestamp with time zone;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_contacts_cpf ON public.contacts(cpf);
CREATE INDEX IF NOT EXISTS idx_contacts_iniflex_id ON public.contacts(iniflex_id);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_companies_iniflex_id ON public.companies(iniflex_id);