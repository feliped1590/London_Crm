/**
 * Validação pré-envio de clientes para ERP Projedata (IMP_CLIENTE_V3)
 */

import type { CompanyValidationResult, CompanyValidationError } from './company-types.ts';

export interface CompanyToValidate {
  cnpj?: string | null;
  name?: string | null;
  tipo_pessoa?: string | null;
  cidade_codigo?: number | null;
  address?: string | null;
  zip_code?: string | null;
}

function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14 && digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

export function validateCompanyForSync(data: CompanyToValidate): CompanyValidationResult {
  const errors: CompanyValidationError[] = [];

  // CNPJ obrigatório e válido
  if (!data.cnpj) {
    errors.push({ field: 'cnpj', message: 'CNPJ/CPF é obrigatório' });
  } else if (!isValidCNPJ(data.cnpj)) {
    errors.push({ field: 'cnpj', message: 'CNPJ/CPF inválido' });
  }

  // Nome obrigatório
  if (!data.name?.trim()) {
    errors.push({ field: 'name', message: 'Nome/Razão Social é obrigatório' });
  }

  // Tipo pessoa obrigatório
  if (!data.tipo_pessoa) {
    errors.push({ field: 'tipo_pessoa', message: 'Tipo de pessoa (PF/PJ) é obrigatório' });
  }

  // Cidade mapeada obrigatória
  if (!data.cidade_codigo || data.cidade_codigo <= 0) {
    errors.push({ field: 'cidade_codigo', message: 'Cidade não mapeada no ERP. Cadastre a cidade em Settings → ERP Mappings → Cidades.' });
  }

  // Endereço mínimo
  if (!data.address?.trim()) {
    errors.push({ field: 'address', message: 'Endereço é obrigatório' });
  }

  return { valid: errors.length === 0, errors };
}
