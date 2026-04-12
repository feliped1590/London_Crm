
ALTER TABLE public.company_erp_financial
ADD COLUMN banco_padrao_erp integer NOT NULL DEFAULT 999;

COMMENT ON COLUMN public.company_erp_financial.banco_padrao_erp IS 'Código do banco padrão no ERP Projedata. Default: 999 (CAIXA/CARTEIRA)';
