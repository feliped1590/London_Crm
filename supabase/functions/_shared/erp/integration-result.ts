/**
 * DTO padronizado para retornos de integração ERP.
 *
 * Este contrato é independente do ERP de origem (Projedata hoje, outros no
 * futuro) e descreve de forma estruturada o resultado de uma chamada de
 * integração — usado por persistência, fallback, logs e auditoria.
 */

export type ErpAction = 'created' | 'updated' | 'error' | 'unknown';
export type ErpEntity = 'customer' | 'product' | 'order';
export type ErpErrorType = 'erp' | 'parse' | null;

export interface ErpIntegrationResult<TMeta = Record<string, unknown>> {
  // Identidade
  entity: ErpEntity;
  action: ErpAction;

  /**
   * isSuccess = action !== 'error' && !!erpCode (para entidades que exigem código).
   * Para `order`, success = action !== 'error' (erpCode pode ser opcional pelo ERP).
   */
  success: boolean;

  /** Indica se há código ERP confiável persistível. */
  erpCode: string | null;

  /** Bruto: o que o ERP devolveu (string p_retorno). */
  raw: string;

  /** Resposta JSON inteira (para auditoria). */
  rawResponse: unknown;

  /** Padrão reconhecido pelo parser, ex: "customer.created.v1". null = unknown. */
  matchedPattern: string | null;

  /** Mensagem amigável de erro (para usuários/log). */
  errorMessage: string | null;

  /** Tipo do erro: 'erp' (ERP devolveu #ERRO#) ou 'parse' (formato/validação). */
  errorType: ErpErrorType;

  /**
   * needsFallback = success && !erpCode.
   * Indica que o ERP aceitou a operação mas não devolveu código utilizável —
   * o chamador deve buscar o código por outra via (ex: EXP_CLIENTES_V2).
   */
  needsFallback: boolean;

  /** Erro transitório ou rede — pode tentar novamente. */
  isRetryable: boolean;

  /** Avisos não-fatais (ex: "erpCode igual ao CNPJ — descartado"). */
  warnings: string[];

  /** Contexto adicional específico da entidade (ex: { cnpj, sku, orderNumber }). */
  metadata: TMeta;
}

/**
 * Constrói um resultado base e calcula os campos derivados.
 * Use sempre esta função em vez de montar o objeto à mão.
 */
export function buildIntegrationResult<TMeta = Record<string, unknown>>(
  base: Omit<ErpIntegrationResult<TMeta>, 'success' | 'needsFallback'> & {
    /** Para `order`, erpCode é opcional — não bloqueia success. */
    requireCodeForSuccess?: boolean;
  },
): ErpIntegrationResult<TMeta> {
  const requireCode = base.requireCodeForSuccess ?? true;
  const noError = base.action !== 'error' && base.action !== 'unknown';
  const success = requireCode ? (noError && !!base.erpCode) : noError;
  const needsFallback = noError && !base.erpCode;

  // Não vazar a flag interna pra fora
  const { requireCodeForSuccess: _omit, ...rest } = base;
  return {
    ...rest,
    success,
    needsFallback,
  };
}

/**
 * Validação canônica de um erpCode.
 * Regras:
 *  - somente dígitos
 *  - 1 a 10 caracteres
 *  - nunca igual ao CNPJ (14 dígitos)
 */
export function isValidErpCode(
  candidate: string | null | undefined,
  contextCnpj?: string | null,
): boolean {
  if (!candidate) return false;
  if (!/^\d{1,10}$/.test(candidate)) return false;
  if (contextCnpj) {
    const cnpjDigits = contextCnpj.replace(/\D/g, '');
    if (cnpjDigits && candidate === cnpjDigits) return false;
  }
  return true;
}
