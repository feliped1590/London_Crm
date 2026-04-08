
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS erp_versao_codigo TEXT DEFAULT '1';

UPDATE products SET erp_versao_codigo = '1' WHERE erp_versao_codigo IS NULL;

COMMENT ON COLUMN products.erp_versao_codigo IS 
  'Código da versão no ERP (ex: 1, 2). Usado no payload de pedidos (IMP_PEDIDO_V3).';
