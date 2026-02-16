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
  const { codigo, versao } = parseCodigoVersao(codigoFonte);

  const produtoBase: ProjedataProduto = {
    codigo,
    descricao: product.name,
    empresa: DEFAULT_EMPRESA,
    unidade: product.unit || undefined,
    ncm: product.ncm || undefined,
    peso_liquido: product.weight ?? undefined,
  };

  const versaoProduto: ProjedataVersaoProduto = {
    codigo,
    versao,
    descricao: product.description || product.name,
    empresa: DEFAULT_EMPRESA,
    cor: product.color || undefined,
    material: product.material || undefined,
    unidade: product.unit || undefined,
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
