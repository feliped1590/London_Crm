/**
 * Tipos para integração ERP Projedata (CIGAM)
 * 
 * REGRAS DO ERP:
 * - O campo "json" do payload é um JSON SERIALIZADO como STRING
 * - codigo deve conter apenas números (sem "/")
 * - versao é obrigatória e separada do codigo
 * - grupo, subgrupo, tipo_item, tipo_ficha são códigos numéricos
 */

// ─── Produto Base ───────────────────────────────────────────────

export interface ProjedataProduto {
  /** Código numérico puro (ex: "800432") — NUNCA com barra */
  codigo: string;
  /** Descrição principal do produto */
  descricao: string;
  /** Empresa no ERP (numérico) */
  empresa: string;
  /** Grupo (código numérico) */
  grupo?: string;
  /** Subgrupo (código numérico) */
  subgrupo?: string;
  /** Tipo de item (código numérico) */
  tipo_item?: string;
  /** Tipo de ficha (código numérico) */
  tipo_ficha?: string;
  /** Unidade de medida */
  unidade?: string;
  /** NCM */
  ncm?: string;
  /** Peso líquido */
  peso_liquido?: number;
  /** Peso bruto */
  peso_bruto?: number;
  /** Observações */
  observacao?: string;
}

// ─── Versão de Produto ──────────────────────────────────────────

export interface ProjedataVersaoProduto {
  /** Código numérico puro do produto (ex: "800432") */
  codigo: string;
  /** Versão do produto (ex: "1") */
  versao: string;
  /** Descrição da versão */
  descricao: string;
  /** Empresa no ERP */
  empresa: string;
  /** Campos adicionais específicos da versão */
  cor?: string;
  material?: string;
  unidade?: string;
  /** Dados extras opcionais */
  extras?: Record<string, unknown>;
}

// ─── Resultado de parse codigo/versao ───────────────────────────

export interface CodigoVersaoParsed {
  codigo: string;
  versao: string;
}

// ─── Payload externo do ERP (envelope) ──────────────────────────

export interface ProjedataEnvelope {
  tipoComando: string;
  grupoComando: string;
  '#out#p_retorno': string;
  /** JSON serializado como string com aspas escapadas */
  json: string;
}

// ─── Erros de validação pré-envio ───────────────────────────────

export interface ProjedataValidationError {
  field: string;
  message: string;
  /** Código Oracle associado (ORA-06502, ORA-01722, etc.) */
  oracleCode?: string;
}

export interface ProjedataValidationResult {
  valid: boolean;
  errors: ProjedataValidationError[];
}
