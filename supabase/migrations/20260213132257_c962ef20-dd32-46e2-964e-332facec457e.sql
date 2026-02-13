-- Unique index parcial para CNPJ (ignora NULLs e vazios)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_cnpj_unique 
  ON public.companies (cnpj) 
  WHERE cnpj IS NOT NULL AND cnpj != '';