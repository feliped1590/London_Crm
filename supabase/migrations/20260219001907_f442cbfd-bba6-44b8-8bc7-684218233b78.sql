
-- Corrigir FKs: trocar companies por legal_entities
ALTER TABLE public.product_stock DROP CONSTRAINT IF EXISTS product_stock_company_id_fkey;
ALTER TABLE public.product_stock ADD CONSTRAINT product_stock_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.legal_entities(id);

ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_company_id_fkey;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.legal_entities(id);
