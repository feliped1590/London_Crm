// Tipos para NCM e Fiscal Intelligence

export type RegimeTributario = 
  | 'simples_nacional'
  | 'lucro_presumido' 
  | 'lucro_real'
  | 'mei';

export type TipoProdutoFiscal = 
  | 'revenda'
  | 'consumo'
  | 'industrializacao'
  | 'ativo_imobilizado';

export type NCMStatus = 'ativo' | 'inativo' | 'obsoleto';

export type SemanticRiskLevel = 'low' | 'medium' | 'high';

export interface NCMCode {
  id: string;
  codigo: string;
  descricao: string;
  data_vigencia: string;
  data_fim_vigencia?: string;
  status: NCMStatus;
  ex_tipi?: string[];
  aliquota_ipi_oficial?: number;
  unidade_tributaria?: string;
  created_at: string;
  updated_at: string;
}

export interface NCMFiscalRule {
  id: string;
  ncm_id: string;
  uf_origem?: string;
  uf_destino?: string;
  regime_tributario: RegimeTributario;
  cst_icms?: string;
  csosn?: string;
  aliquota_icms?: number;
  tem_icms_st?: boolean;
  aliquota_ipi?: number;
  cst_pis_cofins?: string;
  aliquota_pis?: number;
  aliquota_cofins?: number;
  tipo_produto?: TipoProdutoFiscal;
  is_active?: boolean;
  valid_from?: string;
  valid_until?: string;
  created_at: string;
  updated_at: string;
}

export interface NCMSemanticValidation {
  /** Se a descrição do produto é compatível com o NCM */
  compatible: boolean;
  /** Nível de confiança da análise (0.0 a 1.0) */
  confidence: number;
  /** Classificação de risco para o usuário */
  risk_level: SemanticRiskLevel;
  /** Resumo explicativo para exibir na interface */
  summary: string;
  /** Palavras-chave detectadas no produto */
  product_keywords?: string[];
  /** Palavras-chave esperadas pelo NCM */
  expected_keywords?: string[];
}

export interface ProductFiscalData {
  ncm_code?: string;
  ncm_id?: string;
  cst_icms?: string;
  csosn?: string;
  aliquota_icms?: number;
  tem_icms_st?: boolean;
  aliquota_ipi?: number;
  cst_pis_cofins?: string;
  aliquota_pis?: number;
  aliquota_cofins?: number;
  tipo_produto_fiscal?: TipoProdutoFiscal;
  ncm_validated_at?: string;
}

export interface ProductNCMAudit {
  id: string;
  product_id: string;
  old_ncm?: string;
  new_ncm?: string;
  old_fiscal_state?: Record<string, unknown>;
  new_fiscal_state?: Record<string, unknown>;
  reason?: string;
  changed_by?: string;
  changed_at: string;
  has_billing_history?: boolean;
}

// Mapeamento visual para risk_level
export const riskLevelConfig: Record<SemanticRiskLevel, { 
  color: string; 
  bgColor: string;
  borderColor: string;
  icon: 'check' | 'alert' | 'x';
  label: string;
}> = {
  low: {
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: 'check',
    label: 'Compatível',
  },
  medium: {
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: 'alert',
    label: 'Revisar',
  },
  high: {
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'x',
    label: 'Divergente',
  },
};

// Opções de regime tributário
export const regimeTributarioOptions = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'mei', label: 'MEI' },
];

// Opções de tipo de produto fiscal
export const tipoProdutoFiscalOptions = [
  { value: 'revenda', label: 'Revenda' },
  { value: 'consumo', label: 'Consumo' },
  { value: 'industrializacao', label: 'Industrialização' },
  { value: 'ativo_imobilizado', label: 'Ativo Imobilizado' },
];

// Lista de UFs brasileiras
export const ufOptions = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];
