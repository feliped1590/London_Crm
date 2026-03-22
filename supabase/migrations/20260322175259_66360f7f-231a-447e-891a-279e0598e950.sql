ALTER TABLE public.companies
ADD CONSTRAINT companies_cnpj_root_format_check
CHECK (
  cnpj_root IS NULL
  OR cnpj_root ~ '^[0-9]{8}$'
) NOT VALID;

ALTER TABLE public.companies
VALIDATE CONSTRAINT companies_cnpj_root_format_check;