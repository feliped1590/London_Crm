/**
 * Mapeamento CRM → ERP Projedata para Produtos e Versões
 * 
 * Transforma dados do CRM no formato JSON interno que será
 * serializado pelo serializer antes do envio.
 */

import type { ProjedataProduto, ProjedataVersaoProduto } from './types.ts';
import { parseCodigoVersao } from './parser.ts';
import { buildEnvelope, serializeEnvelope } from './serializer.ts';
import { validateProduto, validateVersaoProduto } from './validator.ts';

interface CRMProduct {
  sku?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  unit?: string | null;
  ncm?: string | null;
  weight?: number | null;
  color?: string | null;
  material?: string | null;
  erp_product_code?: string | null;
  // Campos ERP Projedata
  tipo_item?: string | null;
  tipo_ficha?: number | null;
  erp_grupo?: string | null;
  erp_subgrupo?: string | null;
  erp_empresa?: number | null;
  erp_versao?: string | null;
  erp_versao_detalhes?: string | null;
  erp_versao_roteiro?: number | null;
  erp_versao_situacao?: string | null;
}

const DEFAULT_EMPRESA = '1';

/**
 * Mapeia produto do CRM para ProjedataVersaoProduto (IMP_ITEM_VERSAO_V1)
 * 
 * Recebe SKU no formato "800432/1" e separa automaticamente.
 */
export function mapCRMProductToProjedata(product: CRMProduct): {
  produto: ProjedataProduto;
  versao: ProjedataVersaoProduto;
} {
  const codigoFonte = product.erp_product_code || product.sku || '';
  const { codigo, versao: versaoParsed } = parseCodigoVersao(codigoFonte);
  const versaoFinal = product.erp_versao || versaoParsed;
  const empresaFinal = String(product.erp_empresa || 1);

  const produtoBase: ProjedataProduto = {
    codigo,
    descricao: product.name,
    empresa: empresaFinal,
    grupo: product.erp_grupo || product.category || undefined,
    subgrupo: product.erp_subgrupo || product.subcategory || undefined,
    tipo_item: product.tipo_item || undefined,
    tipo_ficha: product.tipo_ficha != null ? String(product.tipo_ficha) : undefined,
    unidade: product.unit || undefined,
    ncm: product.ncm || undefined,
    peso_liquido: product.weight ?? undefined,
  };

  const versaoProduto: ProjedataVersaoProduto = {
    codigo,
    versao: versaoFinal,
    descricao: product.description || product.name,
    empresa: empresaFinal,
    cor: product.color || undefined,
    material: product.material || undefined,
    unidade: product.unit || undefined,
    extras: {
      ...(product.erp_versao_detalhes ? { detalhes: product.erp_versao_detalhes } : {}),
      ...(product.erp_versao_roteiro != null ? { roteiro: product.erp_versao_roteiro } : {}),
      ...(product.erp_versao_situacao ? { situacao: product.erp_versao_situacao } : {}),
    },
  };

  return { produto: produtoBase, versao: versaoProduto };
}

/**
 * Gera o payload final serializado para envio ao ERP.
 * Inclui validação pré-envio.
 * 
 * @returns String JSON em linha única, pronta para o body do fetch
 * @throws Error com detalhes de validação se houver campos inválidos
 */
export function buildProductPayload(versao: ProjedataVersaoProduto): string {
  // Validar antes de serializar
  const validation = validateVersaoProduto(versao);
  if (!validation.valid) {
    const details = validation.errors
      .map(e => `[${e.oracleCode || 'VALIDATION'}] ${e.field}: ${e.message}`)
      .join('; ');
    throw new Error(`Validação pré-envio falhou: ${details}`);
  }

  // Montar o JSON interno (sem campos undefined)
  const innerJson: Record<string, unknown> = {
    codigo: versao.codigo,
    descricao: versao.descricao,
    empresa: versao.empresa,
    versao: versao.versao,
  };

  if (versao.cor) innerJson.cor = versao.cor;
  if (versao.material) innerJson.material = versao.material;
  if (versao.unidade) innerJson.unidade = versao.unidade;
  if (versao.extras) Object.assign(innerJson, versao.extras);

  const envelope = buildEnvelope('IMP_ITEM_VERSAO_V1', innerJson);
  return serializeEnvelope(envelope);
}
