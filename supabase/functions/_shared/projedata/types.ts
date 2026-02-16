/**
 * Tipos para integração ERP Projedata (CIGAM)
 * 
 * FORMATO DO PAYLOAD:
 * O campo "json" do envelope contém um produto com suas versões aninhadas.
 * {
 *   "tipoComando": "ASDCOMANDO",
 *   "grupoComando": "IMP_ITEM_VERSAO_V1",
 *   "#out#p_retorno": "T",
 *   "json": "{\"codigo\":\"...\",\"descricao\":\"...\",\"empresa\":\"1\",\"grupo\":\"...\",\"versoes\":[{\"versao\":\"1\",...}]}"
 * }
 */

// ─── Versão dentro do produto ───────────────────────────────────

export interface ProjedataVersao {
  /** Versão do produto (ex: "1") */
  versao: string;
  /** Detalhes da versão */
  detalhes?: string;
  /** Situação da versão (ex: "A" = ativo) */
  situacao?: string;
}

// ─── Produto completo (inclui versões) ──────────────────────────

export interface ProjedataProduto {
  /** Código numérico puro (ex: "800432") — NUNCA com barra */
  codigo: string;
  /** Descrição principal do produto */
  descricao: string;
  /** Empresa no ERP (inteiro como string) */
  empresa: string;
  /** Grupo (código string) */
  grupo?: string;
  /** Subgrupo (código string) */
  subgrupo?: string;
  /** Tipo de item (código string) */
  tipo_item?: string;
  /** Tipo de ficha (inteiro como string) */
  tipo_ficha?: string;
  /** Unidade de medida */
  unidade?: string;
  /** NCM */
  ncm?: string;
  /** Usuário ERP (inteiro como string) */
  usuario?: string;
  /** Versões do produto */
  versoes: ProjedataVersao[];
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

// ─── Legado (manter compatibilidade de exportação) ──────────────
export type ProjedataVersaoProduto = ProjedataProduto;
