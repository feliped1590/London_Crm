/**
 * Validação pré-envio de clientes para ERP Projedata (IMP_CLIENTE_V4_TESTE)
 * Retorna erros estruturados com hint de correção e rota navegável.
 */

export type ValidationField =
  | 'cnpj'
  | 'company_name'
  | 'address'
  | 'zip_code'
  | 'bank'
  | 'segment'
  | 'city_mapping'
  | 'sales_rep'
  | 'erp_user';

export interface CompanyValidationError {
  field: ValidationField;
  message: string;
  fixHint: string;
  fixRoute?: string;
}

export interface CompanyValidationResult {
  valid: boolean;
  errors: CompanyValidationError[];
  fields: ValidationField[]; // lista plana de campos com erro (para validation_fields TEXT[])
}

export interface CompanyToValidate {
  cnpj?: string | null;
  name?: string | null;
  tipo_pessoa?: string | null;
  cidade_codigo?: number | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  zip_code?: string | null;
  banco_padrao?: number | null;
  segmento_mercado?: number | null;
  subsegmento_mercado?: number | null;
  sales_rep_name?: string | null;
  sales_rep_erp_code?: number | null;
  erp_user_name?: string | null;
  erp_user_code?: number | null;
  has_sales_rep?: boolean;
  has_erp_user?: boolean;
}

function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14 && digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const calc = (base: string, factors: number[]) => {
    const sum = factors.reduce((acc, factor, i) => acc + Number(base[i]) * factor, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  if (digits.length === 11) {
    const d1 = calc(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = calc(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d1 === Number(digits[9]) && d2 === Number(digits[10]);
  }
  const d1 = calc(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(digits[12]) && d2 === Number(digits[13]);
}

export function validateCompanyForSync(data: CompanyToValidate): CompanyValidationResult {
  const errors: CompanyValidationError[] = [];

  // CNPJ
  if (!data.cnpj) {
    errors.push({
      field: 'cnpj',
      message: 'CNPJ/CPF é obrigatório',
      fixHint: 'Cadastre o CNPJ ou CPF no perfil do cliente.',
    });
  } else if (!isValidCNPJ(data.cnpj)) {
    errors.push({
      field: 'cnpj',
      message: 'CNPJ/CPF inválido (precisa ter 11 ou 14 dígitos)',
      fixHint: 'Corrija o documento no perfil do cliente.',
    });
  }

  // Nome
  if (!data.name?.trim()) {
    errors.push({
      field: 'company_name',
      message: 'Nome / Razão Social é obrigatório',
      fixHint: 'Preencha o nome no perfil do cliente.',
    });
  }

  // Endereço
  if (!data.address?.trim()) {
    errors.push({
      field: 'address',
      message: 'Endereço é obrigatório',
      fixHint: 'Preencha o endereço no perfil do cliente.',
    });
  }

  if (!data.zip_code || data.zip_code.replace(/\D/g, '').length !== 8) {
    errors.push({
      field: 'zip_code',
      message: 'CEP é obrigatório e deve conter 8 dígitos',
      fixHint: 'Corrija o CEP no perfil do cliente.',
    });
  }

  if (!data.banco_padrao || data.banco_padrao <= 0) {
    errors.push({
      field: 'bank',
      message: 'Banco padrão ERP não configurado para o cliente',
      fixHint: 'Configure o banco padrão financeiro do cliente antes do envio.',
    });
  }

  if (!data.segmento_mercado || data.segmento_mercado <= 0 || !data.subsegmento_mercado || data.subsegmento_mercado <= 0) {
    errors.push({
      field: 'segment',
      message: 'Segmento ou subsegmento ERP não configurado',
      fixHint: 'Configure setor/segmento do cliente com mapeamento ERP válido.',
    });
  }

  // Cidade mapeada
  if (!data.cidade_codigo || data.cidade_codigo <= 0) {
    const cidade = data.city && data.state ? `${data.city}/${data.state}` : 'do cliente';
    errors.push({
      field: 'city_mapping',
      message: `Cidade ${cidade} não mapeada no ERP`,
      fixHint: 'Cadastre a cidade em Settings → ERP → Cidades.',
      fixRoute: '/settings?tab=erp-mappings',
    });
  }

  // Vendedor com código ERP
  if (data.has_sales_rep === false) {
    errors.push({
      field: 'sales_rep',
      message: 'Cliente sem vendedor comercial atribuído',
      fixHint: 'Defina o vendedor responsável no perfil do cliente.',
    });
  } else if (data.has_sales_rep && (!data.sales_rep_erp_code || data.sales_rep_erp_code <= 0)) {
    const nome = data.sales_rep_name ? `"${data.sales_rep_name}"` : 'do cliente';
    errors.push({
      field: 'sales_rep',
      message: `Vendedor ${nome} não possui código ERP`,
      fixHint: 'Configure o código ERP do vendedor em Settings → Vendedores.',
      fixRoute: '/settings?tab=sales-reps',
    });
  }

  // Usuário ERP
  if (data.has_erp_user === false) {
    errors.push({
      field: 'erp_user',
      message: 'Nenhum usuário do CRM vinculado ao vendedor',
      fixHint: 'Vincule um usuário do sistema ao vendedor em Settings → Vendedores.',
      fixRoute: '/settings?tab=sales-reps',
    });
  } else if (data.has_erp_user && (!data.erp_user_code || data.erp_user_code <= 0)) {
    const nome = data.erp_user_name ? `"${data.erp_user_name}"` : 'vinculado';
    errors.push({
      field: 'erp_user',
      message: `Usuário ${nome} não possui código ERP`,
      fixHint: 'Configure o código ERP do usuário em Settings → Permissões.',
      fixRoute: '/settings?tab=permissions',
    });
  }

  const fields = errors.map((e) => e.field);
  return { valid: errors.length === 0, errors, fields };
}
