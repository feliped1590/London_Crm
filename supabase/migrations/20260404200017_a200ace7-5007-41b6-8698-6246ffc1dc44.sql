
-- 1. Backup table for dedup safety
CREATE TABLE IF NOT EXISTS public.products_dedup_backup (
  backup_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  original_id uuid NOT NULL,
  tenant_id uuid,
  sku text,
  name text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  full_row jsonb NOT NULL
);

-- 2. Backup all records that will be deactivated
INSERT INTO public.products_dedup_backup (original_id, tenant_id, sku, name, active, created_at, updated_at, full_row)
SELECT
  p.id,
  p.tenant_id,
  p.sku,
  p.name,
  p.active,
  p.created_at,
  p.updated_at,
  to_jsonb(p)
FROM products p
WHERE p.id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY
          tenant_id,
          COALESCE(tipo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
          COALESCE(grupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
          COALESCE(subgrupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
          COALESCE(family_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
          COALESCE(class_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
          COALESCE(width, -1),
          COALESCE(length, -1),
          COALESCE(thickness, -1)
        ORDER BY updated_at DESC
      ) AS rn
    FROM products
    WHERE active = true
  ) ranked
  WHERE rn > 1
);

-- 3. Deactivate duplicates (keep most recent)
UPDATE products SET active = false
WHERE id IN (
  SELECT original_id FROM products_dedup_backup
);

-- 4. Unique functional index (partial, active only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_technical_uniqueness
ON products (
  tenant_id,
  COALESCE(tipo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid),
  COALESCE(grupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid),
  COALESCE(subgrupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid),
  COALESCE(family_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid),
  COALESCE(class_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid),
  COALESCE(width, -1),
  COALESCE(length, -1),
  COALESCE(thickness, -1)
)
WHERE active = true;

-- 5. Performance index for dimension searches
CREATE INDEX IF NOT EXISTS idx_products_dimensions
ON products (tenant_id, width, length, thickness)
WHERE active = true;
