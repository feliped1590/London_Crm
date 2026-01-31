/**
 * Validações básicas para integração ERP
 * Fundação v1 - Validação centralizada
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida formato de CNPJ (apenas quantidade de dígitos)
 */
function isValidCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  return clean.length === 14;
}

/**
 * Valida formato de CPF (apenas quantidade de dígitos)
 */
function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  return clean.length === 11;
}

/**
 * Valida formato básico de email
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Valida dados de empresa antes de enviar ao ERP
 */
export function validateCompany(company: {
  name?: string | null;
  cnpj?: string | null;
  email?: string | null;
}): ValidationResult {
  const errors: string[] = [];

  if (!company.name?.trim()) {
    errors.push('Razão social é obrigatória');
  }

  if (company.cnpj && !isValidCNPJ(company.cnpj)) {
    errors.push('CNPJ deve ter 14 dígitos');
  }

  if (company.email && !isValidEmail(company.email)) {
    errors.push('Email da empresa é inválido');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida dados de contato antes de enviar ao ERP
 */
export function validateContact(contact: {
  first_name?: string | null;
  cpf?: string | null;
  email?: string | null;
}): ValidationResult {
  const errors: string[] = [];

  if (!contact.first_name?.trim()) {
    errors.push('Nome é obrigatório');
  }

  if (contact.cpf && !isValidCPF(contact.cpf)) {
    errors.push('CPF deve ter 11 dígitos');
  }

  if (contact.email && !isValidEmail(contact.email)) {
    errors.push('Email do contato é inválido');
  }

  return { valid: errors.length === 0, errors };
}
