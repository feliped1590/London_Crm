/**
 * Validação pré-envio para ERP Projedata
 * 
 * Previne erros Oracle comuns:
 * - ORA-06502: Character string buffer too small (campo excedeu tamanho)
 * - ORA-01722: Invalid number (campo numérico com caracteres inválidos)
 */

import type {
  ProjedataProduto,
  ProjedataVersaoProduto,
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
};

/** Campos que devem conter APENAS dígitos */
const NUMERIC_ONLY_FIELDS = [
  'codigo', 'versao', 'grupo', 'subgrupo',
  'tipo_item', 'tipo_ficha', 'empresa',
];

function checkField(
  field: string,
  value: unknown,
  errors: ProjedataValidationError[],
): void {
  if (value === undefined || value === null || value === '') return;

  const strValue = String(value);

  // Verificar tamanho máximo (ORA-06502)
  const limit = FIELD_LIMITS[field];
  if (limit && strValue.length > limit) {
    errors.push({
      field,
      message: `Campo "${field}" excede ${limit} caracteres (atual: ${strValue.length})`,
      oracleCode: 'ORA-06502',
    });
  }

  // Verificar se campo numérico contém apenas dígitos (ORA-01722)
  if (NUMERIC_ONLY_FIELDS.includes(field) && !/^\d+$/.test(strValue)) {
    errors.push({
      field,
      message: `Campo "${field}" deve conter apenas dígitos. Valor atual: "${strValue}"`,
      oracleCode: 'ORA-01722',
    });
  }
}

/**
 * Valida um produto base antes do envio ao ERP
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

  // Validar cada campo
  for (const [field, value] of Object.entries(produto)) {
    if (field === 'peso_liquido' || field === 'peso_bruto') continue; // números decimais ok
    checkField(field, value, errors);
  }

  // codigo não pode conter "/"
  if (produto.codigo?.includes('/')) {
    errors.push({
      field: 'codigo',
      message: 'Código não pode conter "/". Use parseCodigoVersao() para separar codigo e versao.',
      oracleCode: 'ORA-01722',
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida uma versão de produto antes do envio ao ERP
 */
export function validateVersaoProduto(versao: ProjedataVersaoProduto): ProjedataValidationResult {
  const errors: ProjedataValidationError[] = [];

  // Campos obrigatórios
  if (!versao.codigo?.trim()) {
    errors.push({ field: 'codigo', message: 'Código é obrigatório' });
  }
  if (!versao.versao?.trim()) {
    errors.push({ field: 'versao', message: 'Versão é obrigatória' });
  }
  if (!versao.descricao?.trim()) {
    errors.push({ field: 'descricao', message: 'Descrição é obrigatória' });
  }
  if (!versao.empresa?.trim()) {
    errors.push({ field: 'empresa', message: 'Empresa é obrigatória' });
  }

  // Validar campos
  checkField('codigo', versao.codigo, errors);
  checkField('versao', versao.versao, errors);
  checkField('descricao', versao.descricao, errors);
  checkField('empresa', versao.empresa, errors);
  checkField('cor', versao.cor, errors);
  checkField('material', versao.material, errors);
  checkField('unidade', versao.unidade, errors);

  // codigo não pode conter "/"
  if (versao.codigo?.includes('/')) {
    errors.push({
      field: 'codigo',
      message: 'Código não pode conter "/". Use parseCodigoVersao() para separar.',
      oracleCode: 'ORA-01722',
    });
  }

  return { valid: errors.length === 0, errors };
}
