/**
 * Row shape after mapping an imported XLSX row to database field names.
 */
export interface ImportCompanyRow {
  name: string;
  cnpj: string;
  fantasia?: string;
  contact_name?: string;
  phone?: string;
  phone2?: string;
  fax?: string;
  email?: string;
  address?: string;
  address_number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  inscricao_estadual?: string;
  origin?: string;
  industry?: string;
  vendedor_nome?: string;
  [key: string]: string | undefined;
}
