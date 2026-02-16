/**
 * Validação pré-envio para ERP Projedata
 * 
 * Previne erros Oracle comuns:
 * - ORA-06502: Character string buffer too small (campo excedeu tamanho)
 * - ORA-01722: Invalid number (campo numérico com caracteres inválidos)
 */

import type {
  ProjedataProduto,
  ProjedataValidationResult,
  ProjedataValidationError,
} from './types.ts';

/** Limites de tamanho conhecidos do ERP */
const FIELD_LIMITS: Record<string, number> = {
  codigo: 20,
  versao: 10,
  descricao: 200,
  unidade: 10,
  ncm: 15,
  observacao: 4000,
  cor: 50,
  material: 100,
  grupo: 10,
  subgrupo: 10,
  tipo_item: 10,
  tipo_ficha: 10,
  empresa: 5,
  usuario: 10,
  detalhes: 200,
  situacao: 10,
};

/** Campos que devem conter APENAS dígitos */
const NUMERIC_ONLY_FIELDS = [
  'codigo', 'versao', 'grupo', 'subgrupo',
  'tipo_item', 'tipo_ficha', 'empresa', 'usuario',
];

function checkField(
  field: string,
  value: unknown,
  errors: ProjedataValidationError[],
  prefix = '',
): void {
  if (value === undefined || value === null || value === '') return;

  const strValue = String(value);
  const fullField = prefix ? `${prefix}.${field}` : field;

  // Verificar tamanho máximo (ORA-06502)
  const limit = FIELD_LIMITS[field];
  if (limit && strValue.length > limit) {
    errors.push({
      field: fullField,
      message: `Campo "${fullField}" excede ${limit} caracteres (atual: ${strValue.length})`,
      oracleCode: 'ORA-06502',
    });
  }

  // Verificar se campo numérico contém apenas dígitos (ORA-01722)
  if (NUMERIC_ONLY_FIELDS.includes(field) && !/^\d+$/.test(strValue)) {
    errors.push({
      field: fullField,
      message: `Campo "${fullField}" deve conter apenas dígitos. Valor atual: "${strValue}"`,
      oracleCode: 'ORA-01722',
    });
  }
}

/**
 * Valida um produto completo (com versões) antes do envio ao ERP
 */
export function validateProduto(produto: ProjedataProduto): ProjedataValidationResult {
  const errors: ProjedataValidationError[] = [];

  // Campos obrigatórios
  if (!produto.codigo?.trim()) {
    errors.push({ field: 'codigo', message: 'Código é obrigatório' });
  }
  if (!produto.descricao?.trim()) {
    errors.push({ field: 'descricao', message: 'Descrição é obrigatória' });
  }
  if (!produto.empresa?.trim()) {
    errors.push({ field: 'empresa', message: 'Empresa é obrigatória' });
  }

  // Validar campos do produto
  checkField('codigo', produto.codigo, errors);
  checkField('descricao', produto.descricao, errors);
  checkField('empresa', produto.empresa, errors);
  checkField('grupo', produto.grupo, errors);
  checkField('subgrupo', produto.subgrupo, errors);
  checkField('tipo_item', produto.tipo_item, errors);
  checkField('tipo_ficha', produto.tipo_ficha, errors);
  checkField('unidade', produto.unidade, errors);
  checkField('ncm', produto.ncm, errors);
  checkField('usuario', produto.usuario, errors);

  // codigo não pode conter "/"
  if (produto.codigo?.includes('/')) {
    errors.push({
      field: 'codigo',
      message: 'Código não pode conter "/". Use parseCodigoVersao() para separar codigo e versao.',
      oracleCode: 'ORA-01722',
    });
  }

  // Validar versões
  if (!produto.versoes || produto.versoes.length === 0) {
    errors.push({ field: 'versoes', message: 'Pelo menos uma versão é obrigatória' });
  } else {
    produto.versoes.forEach((v, i) => {
      const prefix = `versoes[${i}]`;
      if (!v.versao?.trim()) {
        errors.push({ field: `${prefix}.versao`, message: 'Versão é obrigatória' });
      }
      checkField('versao', v.versao, errors, prefix);
      checkField('detalhes', v.detalhes, errors, prefix);
      checkField('situacao', v.situacao, errors, prefix);
    });
  }

  return { valid: errors.length === 0, errors };
}

// Alias for backward compatibility
export const validateVersaoProduto = validateProduto;
