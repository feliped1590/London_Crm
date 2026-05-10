-- 1. Adicionar coluna nullable
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES public.legal_entities(id);

-- 2. Backfill: desabilitar triggers de validação só durante o UPDATE
ALTER TABLE public.products DISABLE TRIGGER trg_validate_nome_impresso;
ALTER TABLE public.products DISABLE TRIGGER trg_protect_product_structure;
ALTER TABLE public.products DISABLE TRIGGER trg_product_sync_before;
ALTER TABLE public.products DISABLE TRIGGER trg_product_sync_after;
ALTER TABLE public.products DISABLE TRIGGER trg_audit_product_ncm;
ALTER TABLE public.products DISABLE TRIGGER a_auto_erp_versao;
ALTER TABLE public.products DISABLE TRIGGER trg_compute_structure_hash;
ALTER TABLE public.products DISABLE TRIGGER trg_generate_sku_unique;

UPDATE public.products
SET legal_entity_id = '0379445a-811b-4842-8d1c-d0b326fed307'::uuid
WHERE legal_entity_id IS NULL;

ALTER TABLE public.products ENABLE TRIGGER trg_validate_nome_impresso;
ALTER TABLE public.products ENABLE TRIGGER trg_protect_product_structure;
ALTER TABLE public.products ENABLE TRIGGER trg_product_sync_before;
ALTER TABLE public.products ENABLE TRIGGER trg_product_sync_after;
ALTER TABLE public.products ENABLE TRIGGER trg_audit_product_ncm;
ALTER TABLE public.products ENABLE TRIGGER a_auto_erp_versao;
ALTER TABLE public.products ENABLE TRIGGER trg_compute_structure_hash;
ALTER TABLE public.products ENABLE TRIGGER trg_generate_sku_unique;

-- 3. Garantir que não sobrou NULL
DO $$
DECLARE
  v_remaining int;
BEGIN
  SELECT COUNT(*) INTO v_remaining FROM public.products WHERE legal_entity_id IS NULL;
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % produtos sem legal_entity_id', v_remaining;
  END IF;
END $$;

-- 4. NOT NULL
ALTER TABLE public.products
  ALTER COLUMN legal_entity_id SET NOT NULL;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_products_tenant_legal_entity
  ON public.products (tenant_id, legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_products_legal_entity
  ON public.products (legal_entity_id);