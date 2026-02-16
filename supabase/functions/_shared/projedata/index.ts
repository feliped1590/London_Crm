/**
 * Módulo de integração ERP Projedata
 * Ponto de entrada centralizado
 */

export type {
  ProjedataProduto,
  ProjedataVersaoProduto,
  ProjedataEnvelope,
  CodigoVersaoParsed,
  ProjedataValidationError,
  ProjedataValidationResult,
} from './types.ts';

export { parseCodigoVersao, formatCodigoVersao } from './parser.ts';
export { buildEnvelope, serializeEnvelope, buildAndSerialize } from './serializer.ts';
export { validateProduto, validateVersaoProduto } from './validator.ts';
export { mapCRMProductToProjedata, buildProductPayload } from './mapper.ts';
