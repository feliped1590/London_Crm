// =============================================================================
// TIPOS ESTENDIDOS PARA O MÓDULO FISCAL / TRIBUTÁRIO CENTRALIZADO
// =============================================================================

// -----------------------------------------------------------------------------
// ENUMs (espelhando os do banco de dados)
// -----------------------------------------------------------------------------

export type TipoOperacaoFiscal = 
  | 'venda'
  | 'venda_interestadual'
  | 'devolucao_venda'
  | 'devolucao_compra'
  | 'remessa_demonstracao'
  | 'retorno_demonstracao'
  | 'remessa_conserto'
  | 'retorno_conserto'
  | 'transferencia'
  | 'bonificacao'
  | 'amostra_gratis'
  | 'importacao'
  | 'exportacao'
  | 'venda_consumidor_final';

export type TipoBeneficioFiscal = 
  | 'isencao'
  | 'reducao_base'
  | 'suspensao'
  | 'diferimento'
  | 'nao_tributado'
  | 'aliquota_zero'
  | 'credito_presumido';

export type TributoAfetado = 
  | 'icms'
  | 'icms_st'
  | 'ipi'
  | 'pis'
  | 'cofins'
  | 'iss'
  | 'cbs'    // Novo - Reforma Tributária
  | 'ibs'    // Novo - Reforma Tributária
  | 'is'     // Novo - Reforma Tributária
  | 'todos';

export type OrigemMercadoria = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

// -----------------------------------------------------------------------------
// ENTIDADES DO BANCO
// -----------------------------------------------------------------------------

export interface RegraTributacao {
  id: string;
  nome: string;
  descricao?: string;
  codigo_interno?: string;
  
  // Chaves de decisão
  tipo_operacao?: TipoOperacaoFiscal;
  uf_origem?: string;
  uf_destino?: string;
  regime_empresa?: string;
  regime_cliente?: string;
  ncm_code?: string;
  cfop?: string;
  
  // Resultados
  cfop_resultante: string;
  origem_mercadoria: OrigemMercadoria;
  
  // ICMS
  icms_cst?: string;
  icms_csosn?: string;
  icms_aliquota?: number;
  icms_reducao_base?: number;
  icms_mva?: number;
  icms_st_aliquota?: number;
  icms_st_reducao_base?: number;
  
  // IPI
  ipi_cst?: string;
  ipi_aliquota?: number;
  ipi_enquadramento?: string;
  
  // PIS/COFINS
  pis_cst?: string;
  pis_aliquota?: number;
  cofins_cst?: string;
  cofins_aliquota?: number;
  
  // Extensibilidade
  difal_aliquota_destino?: number;
  difal_aliquota_origem?: number;
  fcp_aliquota?: number;
  iss_aliquota?: number;
  
  // Metadados
  prioridade: number;
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  is_fallback: boolean;
  locked_at?: string;
  locked_by_document_id?: string;
  
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface BeneficioFiscal {
  id: string;
  nome: string;
  codigo?: string;
  tipo: TipoBeneficioFiscal;
  tributo: TributoAfetado;
  
  percentual_reducao?: number;
  aliquota_resultante?: number;
  
  // Documento legal
  numero_documento: string;
  orgao_emissor?: string;
  data_documento?: string;
  documento_url?: string;
  documento_nome?: string;
  
  ncms_aplicaveis?: string[];
  
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
  created_by?: string;
  notes?: string;
}

export interface ClienteBeneficioFiscal {
  id: string;
  company_id: string;
  beneficio_id: string;
  
  documento_cliente_url?: string;
  documento_cliente_nome?: string;
  numero_documento_cliente?: string;
  
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  
  created_at: string;
  created_by?: string;
  notes?: string;
  
  // Relacionamentos
  beneficio?: BeneficioFiscal;
}

export interface DocumentoFiscalSnapshot {
  id: string;
  documento_tipo: 'order' | 'proposal' | 'nfe';
  documento_id: string;
  item_id?: string;
  regra_id?: string;
  tributacao_aplicada: TributacaoAplicada;
  beneficios_aplicados?: BeneficioAplicado[];
  contexto_calculo: ContextoFiscal;
  created_at: string;
  hash_verificacao: string;
}

// -----------------------------------------------------------------------------
// TIPOS DO MOTOR FISCAL
// -----------------------------------------------------------------------------

export interface ContextoFiscal {
  empresa: {
    id: string;
    uf: string;
    regime: string;
    contribuinte_icms: boolean;
    contribuinte_ipi: boolean;
    suframa?: string;
  };
  cliente: {
    id: string;
    uf: string;
    regime?: string;
    contribuinte_icms: boolean;
    suframa?: string;
  };
  produto: {
    id: string;
    ncm: string;
    origem_mercadoria: OrigemMercadoria;
    tipo_produto?: string;
    descricao?: string;
  };
  operacao: {
    tipo: TipoOperacaoFiscal;
    cfop?: string;
    finalidade?: 'consumo' | 'revenda' | 'industrializacao';
  };
  valor_base: number;
}

export interface TributacaoICMS {
  cst: string;
  csosn?: string;
  base_calculo: number;
  aliquota: number;
  valor: number;
  reducao_base?: number;
}

export interface TributacaoICMSST {
  base_calculo: number;
  aliquota: number;
  mva: number;
  valor: number;
  reducao_base?: number;
}

export interface TributacaoIPI {
  cst: string;
  enquadramento?: string;
  base_calculo: number;
  aliquota: number;
  valor: number;
}

export interface TributacaoPISCOFINS {
  cst: string;
  base_calculo: number;
  aliquota: number;
  valor: number;
}

export interface TributacaoDIFAL {
  base_calculo: number;
  aliquota_destino: number;
  aliquota_origem: number;
  valor_destino: number;
  valor_origem: number;
}

export interface TributacaoAplicada {
  // CFOP resultante
  cfop: string;
  origem_mercadoria: OrigemMercadoria;
  
  // Tributos calculados
  icms: TributacaoICMS;
  icms_st?: TributacaoICMSST;
  ipi?: TributacaoIPI;
  pis: TributacaoPISCOFINS;
  cofins: TributacaoPISCOFINS;
  difal?: TributacaoDIFAL;
  
  // Totais
  total_tributos: number;
  carga_tributaria_percentual: number;
}

export interface BeneficioAplicado {
  id: string;
  nome: string;
  tipo: TipoBeneficioFiscal;
  tributo: TributoAfetado;
  numero_documento: string;
  efeito: string; // Descrição do efeito aplicado
}

export interface ResultadoCalculoFiscal {
  success: boolean;
  tributacao?: TributacaoAplicada;
  regra_utilizada?: {
    id: string;
    nome: string;
    codigo_interno?: string;
    is_fallback: boolean;
  };
  beneficios_aplicados?: BeneficioAplicado[];
  observacoes: string[];
  warnings: string[];
  error?: string;
}

// -----------------------------------------------------------------------------
// TIPOS PARA NF-e (PREPARAÇÃO FUTURA)
// -----------------------------------------------------------------------------

export interface TributacaoNFe {
  // Grupo ICMS (N01-N10)
  ICMS: {
    orig: OrigemMercadoria;
    CST?: string;
    CSOSN?: string;
    modBC?: string;
    vBC?: number;
    pICMS?: number;
    vICMS?: number;
    pRedBC?: number;
    modBCST?: string;
    pMVAST?: number;
    pRedBCST?: number;
    vBCST?: number;
    pICMSST?: number;
    vICMSST?: number;
  };
  
  // Grupo IPI (O01-O14)
  IPI?: {
    cEnq: string;
    CST: string;
    vBC?: number;
    pIPI?: number;
    vIPI?: number;
  };
  
  // Grupo PIS (Q01-Q10)
  PIS: {
    CST: string;
    vBC?: number;
    pPIS?: number;
    vPIS?: number;
  };
  
  // Grupo COFINS (S01-S10)
  COFINS: {
    CST: string;
    vBC?: number;
    pCOFINS?: number;
    vCOFINS?: number;
  };
  
  // NCM e CFOP
  NCM: string;
  CFOP: string;
}

// -----------------------------------------------------------------------------
// OPÇÕES DE UI
// -----------------------------------------------------------------------------

export const tipoOperacaoFiscalOptions = [
  { value: 'venda', label: 'Venda' },
  { value: 'venda_interestadual', label: 'Venda Interestadual' },
  { value: 'devolucao_venda', label: 'Devolução de Venda' },
  { value: 'devolucao_compra', label: 'Devolução de Compra' },
  { value: 'remessa_demonstracao', label: 'Remessa para Demonstração' },
  { value: 'retorno_demonstracao', label: 'Retorno de Demonstração' },
  { value: 'remessa_conserto', label: 'Remessa para Conserto' },
  { value: 'retorno_conserto', label: 'Retorno de Conserto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'bonificacao', label: 'Bonificação' },
  { value: 'amostra_gratis', label: 'Amostra Grátis' },
  { value: 'importacao', label: 'Importação' },
  { value: 'exportacao', label: 'Exportação' },
  { value: 'venda_consumidor_final', label: 'Venda Consumidor Final' },
];

export const tipoBeneficioFiscalOptions = [
  { value: 'isencao', label: 'Isenção' },
  { value: 'reducao_base', label: 'Redução de Base de Cálculo' },
  { value: 'suspensao', label: 'Suspensão' },
  { value: 'diferimento', label: 'Diferimento' },
  { value: 'nao_tributado', label: 'Não Tributado' },
  { value: 'aliquota_zero', label: 'Alíquota Zero' },
  { value: 'credito_presumido', label: 'Crédito Presumido' },
];

export const tributoAfetadoOptions = [
  { value: 'icms', label: 'ICMS' },
  { value: 'icms_st', label: 'ICMS-ST' },
  { value: 'ipi', label: 'IPI' },
  { value: 'pis', label: 'PIS' },
  { value: 'cofins', label: 'COFINS' },
  { value: 'iss', label: 'ISS' },
  { value: 'cbs', label: 'CBS (Reforma)' },
  { value: 'ibs', label: 'IBS (Reforma)' },
  { value: 'is', label: 'Imposto Seletivo' },
  { value: 'todos', label: 'Todos os Tributos' },
];

export const origemMercadoriaOptions = [
  { value: '0', label: '0 - Nacional' },
  { value: '1', label: '1 - Estrangeira (Importação direta)' },
  { value: '2', label: '2 - Estrangeira (Adquirida no mercado interno)' },
  { value: '3', label: '3 - Nacional (Conteúdo de Importação 40%-70%)' },
  { value: '4', label: '4 - Nacional (PPB)' },
  { value: '5', label: '5 - Nacional (Conteúdo de Importação ≤40%)' },
  { value: '6', label: '6 - Estrangeira (Importação direta, sem similar)' },
  { value: '7', label: '7 - Estrangeira (Mercado interno, sem similar)' },
  { value: '8', label: '8 - Nacional (Conteúdo de Importação >70%)' },
];
