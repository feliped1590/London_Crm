CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_search_trgm
ON public.products
USING gin (name gin_trgm_ops, sku gin_trgm_ops);
