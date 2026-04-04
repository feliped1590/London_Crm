/**
 * Mapeamento CRM → ERP Projedata para IMP_ITEM_VERSAO_V1
 * 
 * Formato final do JSON interno:
 * {
 *   "codigo": "<string>",
 *   "descricao": "<string>",
 *   "empresa": "<integer>",
 *   "grupo": "<string>",
 *   "ncm": "<string>",
 *   "subgrupo": "<string>",
 *   "tipo_ficha": "<integer>",
 *   "tipo_item": "<string>",
 *   "unidade": "<string>",
 *   "usuario": "<integer>",
 *   "versoes": [{ "detalhes": "<string>", "situacao": "<string>", "versao": "<string>" }]
 * }
 */

import type { ProjedataProduto, ProjedataVersao } from './types.ts';
import { parseCodigoVersao } from './parser.ts';
import { buildEnvelope, serializeEnvelope } from './serializer.ts';
import { validateProduto } from './validator.ts';

export interface CRMProduct {
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
  erp_usuario?: number | null;
}

/**
 * Mapeia produto do CRM para ProjedataProduto (IMP_ITEM_VERSAO_V1)
 * 
 * Campos CRM → ERP:
 * - sku / erp_product_code → codigo (parte numérica) + versao (após "/")
 * - name → descricao
 * - erp_empresa → empresa
 * - erp_grupo / category → grupo
 * - erp_subgrupo / subcategory → subgrupo
 * - ncm → ncm
 * - tipo_item → tipo_item
 * - tipo_ficha → tipo_ficha
 * - unit → unidade
 * - erp_usuario → usuario
 * - erp_versao → versoes[].versao
 * - erp_versao_detalhes → versoes[].detalhes
 * - erp_versao_situacao → versoes[].situacao
 */
export function mapCRMProductToProjedata(product: CRMProduct): ProjedataProduto {
  const codigoFonte = product.erp_product_code || product.sku || '';
  const { codigo, versao: versaoParsed } = parseCodigoVersao(codigoFonte);
  // erp_versao (ex: "100x150x0,120") é a fonte principal; fallback para parsed, nunca vazio
  const versaoFinal = product.erp_versao || versaoParsed || '1';
  const empresaFinal = String(product.erp_empresa || 1);

  // Montar versão
  const versaoObj: ProjedataVersao = {
    versao: versaoFinal,
  };
  if (product.erp_versao_detalhes) versaoObj.detalhes = product.erp_versao_detalhes;
  if (product.erp_versao_situacao) versaoObj.situacao = product.erp_versao_situacao;

  const produto: ProjedataProduto = {
    codigo,
    descricao: product.name,
    empresa: empresaFinal,
    grupo: product.erp_grupo || product.category || undefined,
    subgrupo: product.erp_subgrupo || product.subcategory || undefined,
    tipo_item: product.tipo_item || undefined,
    tipo_ficha: product.tipo_ficha != null ? String(product.tipo_ficha) : undefined,
    unidade: product.unit || undefined,
    ncm: product.ncm || undefined,
    usuario: product.erp_usuario != null ? String(product.erp_usuario) : undefined,
    versoes: [versaoObj],
  };

  return produto;
}

/**
 * Gera o payload final serializado para envio ao ERP.
 * Inclui validação pré-envio.
 * 
 * @returns String JSON em linha única, pronta para o body do fetch
 * @throws Error com detalhes de validação se houver campos inválidos
 */
export function buildProductPayload(produto: ProjedataProduto): string {
  // Validar antes de serializar
  const validation = validateProduto(produto);
  if (!validation.valid) {
    const details = validation.errors
      .map(e => `[${e.oracleCode || 'VALIDATION'}] ${e.field}: ${e.message}`)
      .join('; ');
    throw new Error(`Validação pré-envio falhou: ${details}`);
  }

  // Montar o JSON interno (sem campos undefined)
  const innerJson: Record<string, unknown> = {
    codigo: produto.codigo,
    descricao: produto.descricao,
    empresa: produto.empresa,
  };

  if (produto.grupo) innerJson.grupo = produto.grupo;
  if (produto.subgrupo) innerJson.subgrupo = produto.subgrupo;
  if (produto.ncm) innerJson.ncm = produto.ncm;
  if (produto.tipo_item) innerJson.tipo_item = produto.tipo_item;
  if (produto.tipo_ficha) innerJson.tipo_ficha = produto.tipo_ficha;
  if (produto.unidade) innerJson.unidade = produto.unidade;
  if (produto.usuario) innerJson.usuario = produto.usuario;

  // Versões (array de objetos)
  if (produto.versoes && produto.versoes.length > 0) {
    innerJson.versoes = produto.versoes.map(v => {
      const obj: Record<string, string> = { versao: v.versao };
      if (v.detalhes) obj.detalhes = v.detalhes;
      if (v.situacao) obj.situacao = v.situacao;
      return obj;
    });
  }

  const envelope = buildEnvelope('IMP_ITEM_VERSAO_V1', innerJson);
  return serializeEnvelope(envelope);
}
