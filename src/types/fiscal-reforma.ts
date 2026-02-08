// =============================================================================
// TIPOS PARA REFORMA TRIBUTÁRIA EC 132/2023 - IVA DUAL
// Modelo conceitual revisado conforme especificações técnicas
// =============================================================================

// -----------------------------------------------------------------------------
// ENUMs (espelhando os do banco de dados)
// -----------------------------------------------------------------------------

/**
 * Modelo tributário para determinação da fase de transição
 */
export type ModeloTributario = 
  | 'legado'           // Apenas ICMS/PIS/COFINS/IPI (até 2025)
  | 'dual_teste'       // 2026: Legado + CBS 0.9% + IBS 0.1%
  | 'dual_transicao'   // 2027-2032: Coexistência com redução gradual
  | 'novo';            // 2033+: Apenas CBS/IBS/IS

/**
 * Regime de incidência para CBS/IBS (substitui o conceito de CST)
 * Representa o tratamento tributário da operação
 */
export type RegimeIncidenciaCbsIbs = 
  | 'normal'           // Tributação normal com alíquota padrão
  | 'aliquota_zero'    // Alíquota zero (mantém direito a crédito)
  | 'monofasico'       // Incidência concentrada em fase anterior
  | 'isento'           // Isento (não gera crédito)
  | 'imune'            // Imunidade constitucional
  | 'suspensao'        // Suspensão temporária
  | 'diferimento'      // Diferimento para fase posterior
  | 'cashback'         // Operação com devolução ao consumidor
  | 'nao_incidencia';  // Fora do campo de incidência

/**
 * Tipo de geração de crédito para CBS/IBS
 */
export type TipoGeracaoCredito = 
  | 'integral'         // Crédito integral sobre a operação
  | 'parcial'          // Crédito proporcional (ex: uso misto)
  | 'vedado'           // Não gera crédito (ex: uso pessoal)
  | 'presumido';       // Crédito presumido calculado

/**
 * Classificação tributária NF-e (campo técnico cClassTrib)
 * Usado apenas para geração de NF-e, não é conceitual
 */
export type ClassificacaoTributariaNFe = 
  | '00'   // Tributação normal CBS/IBS
  | '10'   // Tributação monofásica
  | '20'   // Operação com ST
  | '30'   // Isento
  | '40'   // Não tributado
  | '50'   // Suspensão
  | '60'   // Diferimento
  | '70'   // Regime especial
  | '90';  // Outros

/**
 * Status operacional do Split Payment
 */
export type SplitPaymentStatus = 
  | 'estimado'         // Valor calculado, ainda não retido
  | 'retido'           // Valor retido pelo intermediador
  | 'liquidado'        // Valor repassado ao fisco
  | 'ajustado'         // Valor sofreu ajuste posterior
  | 'estornado';       // Retenção cancelada/devolvida

/**
 * Categoria do Imposto Seletivo (não depende apenas de NCM)
 */
export type CategoriaImpostoSeletivo = 
  | 'bebidas_alcoolicas'
  | 'bebidas_acucaradas'
  | 'tabaco'
  | 'veiculos'
  | 'embarcacoes_aeronaves'
  | 'extracao_mineral'
  | 'concursos_prognosticos'
  | 'nao_aplicavel';

// -----------------------------------------------------------------------------
// PARÂMETROS DE TRANSIÇÃO (TABELA VERSIONADA)
// -----------------------------------------------------------------------------

export interface TransicaoTributariaParametros {
  id: string;
  ano_referencia: number;
  modelo_tributario: ModeloTributario;
  
  // Percentuais de transição legado → novo
  percentual_icms_iss: number;      // Reduz gradualmente (100% → 0%)
  percentual_ibs: number;           // Aumenta gradualmente (0% → 100%)
  percentual_pis_cofins: number;    // 100% até 2026, 0% a partir de 2027
  percentual_cbs: number;           // 0% até 2026, 100% a partir de 2027
  
  // Alíquotas de referência do ano
  aliquota_cbs_referencia?: number;    // ~8.8% quando definido
  aliquota_ibs_referencia?: number;    // ~17.7% quando definido
  aliquota_ibs_estadual?: number;      // Parte estadual para repartição
  aliquota_ibs_municipal?: number;     // Parte municipal para repartição
  
  // Metadados
  descricao?: string;
  base_legal?: string;
  is_active: boolean;
  valid_from: string;
  valid_until?: string;
  
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// EXTENSÃO DE REGRAS DE TRIBUTAÇÃO
// -----------------------------------------------------------------------------

export interface RegraTributacaoReforma {
  // Identificação do modelo
  modelo_tributario: ModeloTributario;
  ano_vigencia_inicio?: number;
  ano_vigencia_fim?: number;
  
  // CBS (Federal) - Campos conceituais corretos
  cbs_regime_incidencia: RegimeIncidenciaCbsIbs;
  cbs_tipo_credito: TipoGeracaoCredito;
  cbs_aliquota?: number;
  cbs_reducao_base?: number;
  cbs_aliquota_efetiva?: number;  // Após reduções
  
  // IBS (Imposto único - repartição interna apenas)
  ibs_regime_incidencia: RegimeIncidenciaCbsIbs;
  ibs_tipo_credito: TipoGeracaoCredito;
  ibs_aliquota?: number;          // Alíquota única do IBS
  ibs_reducao_base?: number;
  ibs_aliquota_efetiva?: number;  // Após reduções
  ibs_reparticao_estadual: number; // % para estado (padrão 65%)
  ibs_reparticao_municipal: number; // % para município (padrão 35%)
  
  // Imposto Seletivo (não depende apenas de NCM)
  is_aplicavel: boolean;
  is_categoria: CategoriaImpostoSeletivo;
  is_aliquota?: number;
  is_excecao_legal?: string;       // Referência à exceção se houver
  is_produto_final: boolean;       // IS incide sobre produto final
  
  // Campo técnico NF-e (não conceitual)
  c_class_trib?: ClassificacaoTributariaNFe;
  cst_nfe?: string;  // CST apenas para campo técnico NF-e
}

// -----------------------------------------------------------------------------
// CRÉDITO PRESUMIDO (CONDICIONAL)
// -----------------------------------------------------------------------------

export interface CreditoPresumidoRegra {
  id: string;
  
  // Identificação
  codigo: string;
  nome: string;
  descricao?: string;
  
  // Tributo afetado
  tributo: 'cbs' | 'ibs' | 'ambos';
  
  // Condições de aplicação (não é atributo fixo do produto)
  aplica_por_adquirente: boolean;
  tipos_adquirente?: string[];  // Ex: ['simples_nacional', 'produtor_rural']
  aplica_por_operacao: boolean;
  tipos_operacao?: string[];    // Ex: ['exportacao', 'zona_franca']
  aplica_por_ncm: boolean;
  ncms_aplicaveis?: string[];
  aplica_por_regiao: boolean;
  ufs_aplicaveis?: string[];
  
  // Percentual do crédito
  percentual_credito: number;
  base_legal?: string;
  
  // Vigência
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// -----------------------------------------------------------------------------
// IMPOSTO SELETIVO (CADASTRO)
// -----------------------------------------------------------------------------

export interface CadastroImpostoSeletivo {
  id: string;
  
  // Identificação
  codigo: string;
  descricao: string;
  categoria: CategoriaImpostoSeletivo;
  
  // Alíquota
  aliquota_padrao: number;
  aliquota_maxima?: number;
  
  // Critérios de aplicação (não apenas NCM)
  ncms_aplicaveis?: string[];           // NCMs quando aplicável
  produtos_especificos?: string[];      // Descrições de produtos
  excecoes_legais?: string[];           // Produtos excluídos
  criterios_adicionais?: unknown;       // Outros critérios (Json)
  
  // Incidência
  incide_produto_final: boolean;
  incide_importacao: boolean;
  
  // Vigência e base legal
  base_legal?: string;
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
  created_by?: string;
}
// -----------------------------------------------------------------------------
// TRIBUTAÇÃO CBS
// -----------------------------------------------------------------------------

export interface TributacaoCBS {
  regime_incidencia: RegimeIncidenciaCbsIbs;
  tipo_credito: TipoGeracaoCredito;
  base_calculo: number;
  aliquota: number;
  aliquota_efetiva: number;  // Após reduções
  valor: number;
  reducao_base?: number;
  credito_presumido?: {
    codigo: string;
    nome: string;
    percentual: number;
    valor: number;
  };
}

// -----------------------------------------------------------------------------
// TRIBUTAÇÃO IBS (IMPOSTO ÚNICO COM REPARTIÇÃO INTERNA)
// -----------------------------------------------------------------------------

export interface TributacaoIBS {
  regime_incidencia: RegimeIncidenciaCbsIbs;
  tipo_credito: TipoGeracaoCredito;
  base_calculo: number;
  
  // Alíquota única do IBS (tratamento como imposto único)
  aliquota: number;
  aliquota_efetiva: number;  // Após reduções
  valor_total: number;
  
  // Repartição interna (apenas para fins de exibição e repasse)
  reparticao: {
    percentual_estadual: number;
    percentual_municipal: number;
    valor_estadual: number;
    valor_municipal: number;
  };
  
  reducao_base?: number;
  credito_presumido?: {
    codigo: string;
    nome: string;
    percentual: number;
    valor: number;
  };
}

// -----------------------------------------------------------------------------
// IMPOSTO SELETIVO
// -----------------------------------------------------------------------------

export interface TributacaoIS {
  aplicavel: boolean;
  categoria: CategoriaImpostoSeletivo;
  produto_final: boolean;
  base_calculo: number;
  aliquota: number;
  valor: number;
  excecao_legal?: string;
}

// -----------------------------------------------------------------------------
// SPLIT PAYMENT (ESTADO OPERACIONAL COMPLETO)
// -----------------------------------------------------------------------------

export interface SplitPaymentInfo {
  // Valor bruto da operação
  valor_operacao: number;
  
  // CBS
  cbs: {
    base_calculo: number;
    aliquota: number;
    valor: number;
    status: SplitPaymentStatus;
  };
  
  // IBS
  ibs: {
    base_calculo: number;
    aliquota: number;
    valor: number;
    valor_estadual: number;
    valor_municipal: number;
    status: SplitPaymentStatus;
  };
  
  // Imposto Seletivo
  is?: {
    base_calculo: number;
    aliquota: number;
    valor: number;
    status: SplitPaymentStatus;
  };
  
  // Totais
  valor_total_retido: number;
  valor_liquido_fornecedor: number;
  
  // Intermediador financeiro
  intermediador?: {
    id: string;
    nome: string;
    cnpj: string;
  };
  
  // Datas operacionais
  data_operacao: string;
  data_retencao?: string;
  data_liquidacao?: string;
  data_ajuste?: string;
}

// -----------------------------------------------------------------------------
// TRIBUTAÇÃO APLICADA (REFORMA)
// -----------------------------------------------------------------------------

export interface TributacaoAplicadaReforma {
  // Modelo tributário usado
  modelo_tributario: ModeloTributario;
  ano_referencia: number;
  
  // Percentual do legado aplicado (durante transição)
  percentual_legado_aplicado?: number;
  
  // Novos tributos
  cbs?: TributacaoCBS;
  ibs?: TributacaoIBS;
  is?: TributacaoIS;
  
  // Split Payment
  split_payment?: SplitPaymentInfo;
  
  // Campos NF-e obrigatórios (técnicos)
  nfe?: {
    c_class_trib: ClassificacaoTributariaNFe;
    cst_nfe?: string;
  };
  
  // Totais do novo sistema
  total_cbs_ibs_is: number;
  carga_tributaria_percentual_novo: number;
}

// -----------------------------------------------------------------------------
// CONTEXTO FISCAL ESTENDIDO
// -----------------------------------------------------------------------------

export interface ContextoFiscalReforma {
  // Data da operação (determina modelo tributário)
  data_operacao: Date;
  
  // Dados do adquirente (para crédito presumido)
  adquirente?: {
    tipo: string;  // 'simples_nacional', 'produtor_rural', etc.
    contribuinte: boolean;
    zona_franca?: boolean;
  };
  
  // Tipo de operação
  tipo_operacao?: string;  // 'venda', 'exportacao', 'zona_franca', etc.
  
  // NCM do produto
  ncm?: string;
  
  // UF de destino
  uf_destino?: string;
  
  // Indicador de produto final (para IS)
  produto_final?: boolean;
  
  // Categoria IS (quando aplicável)
  categoria_is?: CategoriaImpostoSeletivo;
}

// -----------------------------------------------------------------------------
// RESULTADO DO CÁLCULO FISCAL (REFORMA)
// -----------------------------------------------------------------------------

export interface ResultadoCalculoFiscalReforma {
  success: boolean;
  
  // Parâmetros de transição utilizados
  parametros_transicao?: TransicaoTributariaParametros;
  
  // Tributação calculada
  tributacao?: TributacaoAplicadaReforma;
  
  // Créditos presumidos aplicados
  creditos_presumidos?: {
    cbs?: CreditoPresumidoRegra;
    ibs?: CreditoPresumidoRegra;
  };
  
  // Observações e warnings
  observacoes: string[];
  warnings: string[];
  error?: string;
}

// -----------------------------------------------------------------------------
// OPÇÕES DE UI
// -----------------------------------------------------------------------------

export const modeloTributarioOptions = [
  { value: 'legado', label: 'Legado (ICMS/PIS/COFINS)' },
  { value: 'dual_teste', label: 'Dual Teste (2026)' },
  { value: 'dual_transicao', label: 'Dual Transição (2027-2032)' },
  { value: 'novo', label: 'Novo (CBS/IBS - 2033+)' },
];

export const regimeIncidenciaOptions = [
  { value: 'normal', label: 'Tributação Normal' },
  { value: 'aliquota_zero', label: 'Alíquota Zero' },
  { value: 'monofasico', label: 'Monofásico' },
  { value: 'isento', label: 'Isento' },
  { value: 'imune', label: 'Imune' },
  { value: 'suspensao', label: 'Suspensão' },
  { value: 'diferimento', label: 'Diferimento' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'nao_incidencia', label: 'Não Incidência' },
];

export const tipoGeracaoCreditoOptions = [
  { value: 'integral', label: 'Crédito Integral' },
  { value: 'parcial', label: 'Crédito Parcial' },
  { value: 'vedado', label: 'Crédito Vedado' },
  { value: 'presumido', label: 'Crédito Presumido' },
];

export const categoriaImpostoSeletivoOptions = [
  { value: 'bebidas_alcoolicas', label: 'Bebidas Alcoólicas' },
  { value: 'bebidas_acucaradas', label: 'Bebidas Açucaradas' },
  { value: 'tabaco', label: 'Tabaco' },
  { value: 'veiculos', label: 'Veículos' },
  { value: 'embarcacoes_aeronaves', label: 'Embarcações e Aeronaves' },
  { value: 'extracao_mineral', label: 'Extração Mineral' },
  { value: 'concursos_prognosticos', label: 'Concursos de Prognósticos' },
  { value: 'nao_aplicavel', label: 'Não Aplicável' },
];

export const splitPaymentStatusOptions = [
  { value: 'estimado', label: 'Estimado' },
  { value: 'retido', label: 'Retido' },
  { value: 'liquidado', label: 'Liquidado' },
  { value: 'ajustado', label: 'Ajustado' },
  { value: 'estornado', label: 'Estornado' },
];

export const classificacaoTributariaNFeOptions = [
  { value: '00', label: '00 - Tributação Normal' },
  { value: '10', label: '10 - Tributação Monofásica' },
  { value: '20', label: '20 - Operação com ST' },
  { value: '30', label: '30 - Isento' },
  { value: '40', label: '40 - Não Tributado' },
  { value: '50', label: '50 - Suspensão' },
  { value: '60', label: '60 - Diferimento' },
  { value: '70', label: '70 - Regime Especial' },
  { value: '90', label: '90 - Outros' },
];

// -----------------------------------------------------------------------------
// CRONOGRAMA OFICIAL DE TRANSIÇÃO (REFERÊNCIA)
// -----------------------------------------------------------------------------

export const cronogramaTransicao = {
  2025: { modelo: 'legado', icms: 100, ibs: 0, pis_cofins: 100, cbs: 0 },
  2026: { modelo: 'dual_teste', icms: 100, ibs: 0, pis_cofins: 100, cbs: 0, cbs_teste: 0.9, ibs_teste: 0.1 },
  2027: { modelo: 'dual_transicao', icms: 100, ibs: 0, pis_cofins: 0, cbs: 100 },
  2028: { modelo: 'dual_transicao', icms: 100, ibs: 0, pis_cofins: 0, cbs: 100 },
  2029: { modelo: 'dual_transicao', icms: 90, ibs: 10, pis_cofins: 0, cbs: 100 },
  2030: { modelo: 'dual_transicao', icms: 80, ibs: 20, pis_cofins: 0, cbs: 100 },
  2031: { modelo: 'dual_transicao', icms: 70, ibs: 30, pis_cofins: 0, cbs: 100 },
  2032: { modelo: 'dual_transicao', icms: 60, ibs: 40, pis_cofins: 0, cbs: 100 },
  2033: { modelo: 'novo', icms: 0, ibs: 100, pis_cofins: 0, cbs: 100 },
} as const;

// Alíquotas de referência (podem ser ajustadas pela regulamentação)
export const aliquotasReferencia = {
  CBS_PADRAO: 8.8,      // ~8.8% federal
  IBS_PADRAO: 17.7,     // ~17.7% estadual + municipal
  IBS_ESTADUAL: 11.5,   // Parte estadual (~65%)
  IBS_MUNICIPAL: 6.2,   // Parte municipal (~35%)
  IVA_TOTAL: 26.5,      // CBS + IBS total
} as const;
