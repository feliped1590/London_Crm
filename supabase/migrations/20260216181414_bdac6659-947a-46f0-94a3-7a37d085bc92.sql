
-- Adicionar campos ERP Projedata faltantes na tabela products
-- Mapeamento direto do comando IMP_ITEM_VERSAO_V1

-- tipo_item: tipo de item no ERP (ex: "MP", "PA", "PI")
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tipo_item text;

-- tipo_ficha: tipo de ficha técnica no ERP (integer)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tipo_ficha integer;

-- erp_grupo: código do grupo no ERP (pode diferir da category comercial)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS erp_grupo text;

-- erp_subgrupo: código do subgrupo no ERP
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS erp_subgrupo text;

-- erp_empresa: código da empresa no ERP (default 1)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS erp_empresa integer DEFAULT 1;

-- Campos da versão (versoes[])
-- erp_versao_detalhes: detalhes da versão
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS erp_versao_detalhes text;

-- erp_versao_roteiro: código do roteiro
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS erp_versao_roteiro integer;

-- erp_versao_situacao: situação da versão (ex: "A" = Ativo)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS erp_versao_situacao text DEFAULT 'A';

-- Atualizar a função de hash para incluir novos campos
CREATE OR REPLACE FUNCTION public.compute_product_erp_hash(p products)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    sha256(
      convert_to(
        coalesce(p.sku,'') || '|' ||
        coalesce(p.name,'') || '|' ||
        coalesce(p.description,'') || '|' ||
        coalesce(p.category,'') || '|' ||
        coalesce(p.subcategory,'') || '|' ||
        coalesce(p.unit_measure,'') || '|' ||
        coalesce(p.ncm_code,'') || '|' ||
        coalesce(p.material,'') || '|' ||
        coalesce(p.color,'') || '|' ||
        coalesce(p.weight::text,'') || '|' ||
        coalesce(p.erp_versao,'') || '|' ||
        coalesce(p.tipo_item,'') || '|' ||
        coalesce(p.tipo_ficha::text,'') || '|' ||
        coalesce(p.erp_grupo,'') || '|' ||
        coalesce(p.erp_subgrupo,'') || '|' ||
        coalesce(p.erp_empresa::text,'1') || '|' ||
        coalesce(p.erp_versao_detalhes,'') || '|' ||
        coalesce(p.erp_versao_roteiro::text,'') || '|' ||
        coalesce(p.erp_versao_situacao,''),
        'UTF8'
      )
    ),
    'hex'
  );
$$;
