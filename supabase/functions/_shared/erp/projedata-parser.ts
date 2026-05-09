/**
 * Parser centralizado de retornos da API Projedata.
 *
 * O ERP devolve um campo `p_retorno` em formato string seguindo padrões
 * conhecidos. Esta camada normaliza a interpretação em um único contrato
 * (`ErpIntegrationResult`), elimina parsing manual nas edge functions e
 * garante validações cruzadas (ex: jamais persistir CNPJ como erpCode).
 */

import {
  buildIntegrationResult,
  isValidErpCode,
  type ErpIntegrationResult,
} from './integration-result.ts';

// ─── Tipos auxiliares ──────────────────────────────────────────────

export interface CustomerParseContext {
  /** CNPJ do cliente sendo enviado — usado para validação cruzada. */
  cnpj?: string | null;
  /** Para auditoria: timestamp e duração da chamada. */
  requestedAt?: string;
  durationMs?: number;
}

export interface ClienteRetornoV4 {
  cnpj_cpf: string;
  correntista: number;
}

export interface ProductParseContext {
  sku?: string | null;
  requestedAt?: string;
  durationMs?: number;
}

export interface OrderParseContext {
  /** pedido_terceiro enviado, para correlacionar. */
  pedidoTerceiro?: number | string | null;
  orderNumber?: string | null;
  requestedAt?: string;
  durationMs?: number;
}

interface PatternDef {
  id: string;
  re: RegExp;
  action: 'created' | 'updated' | 'error';
  /** Índice do grupo de captura que contém o erpCode (null = sem código). */
  codeIdx: number | null;
  /** Mapeia metadata adicional a partir de grupos de captura. */
  metaIdx?: Record<string, number>;
}

// ─── Padrões conhecidos ────────────────────────────────────────────

const CUSTOMER_PATTERNS: PatternDef[] = [
  // "Registro#9999#atualizado com sucesso!"
  {
    id: 'customer.updated.v1',
    re: /^Registro#(\d{1,10})#atualizado/i,
    action: 'updated',
    codeIdx: 1,
  },
  // "CLIENTE#CNPJ#9999#012568998984684"
  // grupo 1 = erpCode (1-10 dígitos); grupo 2 = CNPJ (qualquer sequência numérica que sobrar)
  {
    id: 'customer.created.v1',
    re: /^CLIENTE#CNPJ#(\d{1,10})#(\d+)/i,
    action: 'created',
    codeIdx: 1,
    metaIdx: { cnpj: 2 },
  },
  // Erro genérico — capturado por último
  {
    id: 'customer.error.v1',
    re: /#ERRO#([\s\S]*)$/i,
    action: 'error',
    codeIdx: null,
  },
];

const PRODUCT_PATTERNS: PatternDef[] = [
  // "Registro#800432#atualizado..."
  {
    id: 'product.updated.v1',
    re: /^Registro#(\d{1,10})#atualizado/i,
    action: 'updated',
    codeIdx: 1,
  },
  // "PRODUTO#800432" ou "ITEM#800432"
  {
    id: 'product.created.v1',
    re: /^(?:PRODUTO|ITEM)#(\d{1,10})/i,
    action: 'created',
    codeIdx: 1,
  },
  {
    id: 'product.error.v1',
    re: /#ERRO#([\s\S]*)$/i,
    action: 'error',
    codeIdx: null,
  },
];

const ORDER_PATTERNS: PatternDef[] = [
  // "PEDIDO#123#20260050"
  {
    id: 'order.created.v1',
    re: /^PEDIDO#(\d{1,10})(?:#(\d+))?/i,
    action: 'created',
    codeIdx: 1,
    metaIdx: { erpOrderNumber: 2 },
  },
  {
    id: 'order.updated.v1',
    re: /^Registro#(\d{1,10})#atualizado/i,
    action: 'updated',
    codeIdx: 1,
  },
  {
    id: 'order.error.v1',
    re: /#ERRO#([\s\S]*)$/i,
    action: 'error',
    codeIdx: null,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────

/** Extrai o `p_retorno` de uma resposta (que pode ser array ou objeto). */
export function extractRawRetorno(rawResponse: unknown): string {
  if (!rawResponse) return '';
  const obj = Array.isArray(rawResponse) ? rawResponse[0] : rawResponse;
  if (!obj || typeof obj !== 'object') return '';
  const r =
    (obj as Record<string, unknown>)['#out#p_retorno'] ??
    (obj as Record<string, unknown>)['p_retorno'] ??
    (obj as Record<string, unknown>)['P_RETORNO'];
  return typeof r === 'string' ? r.trim() : '';
}

function tryMatch(
  raw: string,
  patterns: PatternDef[],
): { def: PatternDef; match: RegExpMatchArray } | null {
  for (const def of patterns) {
    const m = raw.match(def.re);
    if (m) return { def, match: m };
  }
  return null;
}

function buildMetadataFromMatch(
  match: RegExpMatchArray,
  metaIdx: Record<string, number> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!metaIdx) return out;
  for (const [key, idx] of Object.entries(metaIdx)) {
    const val = match[idx];
    if (val !== undefined && val !== '') out[key] = val;
  }
  return out;
}

// ─── Parsers públicos ──────────────────────────────────────────────

export function parseCustomerRetorno(
  rawResponse: unknown,
  ctx: CustomerParseContext = {},
): ErpIntegrationResult<{ cnpj?: string; requestedAt?: string; durationMs?: number }> {
  const raw = extractRawRetorno(rawResponse);
  const baseMeta = {
    cnpj: ctx.cnpj ?? undefined,
    requestedAt: ctx.requestedAt,
    durationMs: ctx.durationMs,
  };

  if (!raw) {
    return buildIntegrationResult({
      entity: 'customer',
      action: 'unknown',
      erpCode: null,
      raw: '',
      rawResponse,
      matchedPattern: null,
      errorMessage: 'Resposta do ERP sem campo p_retorno',
      errorType: 'parse',
      isRetryable: true,
      warnings: ['Resposta do ERP vazia ou sem p_retorno — investigar conectividade'],
      metadata: baseMeta,
    });
  }

  const found = tryMatch(raw, CUSTOMER_PATTERNS);

  if (!found) {
    return buildIntegrationResult({
      entity: 'customer',
      action: 'unknown',
      erpCode: null,
      raw,
      rawResponse,
      matchedPattern: null,
      errorMessage: `Formato de retorno desconhecido: "${raw}"`,
      errorType: 'parse',
      isRetryable: false,
      warnings: ['Padrão não reconhecido — adicionar suporte em projedata-parser.ts'],
      metadata: baseMeta,
    });
  }

  const { def, match } = found;
  const warnings: string[] = [];
  let erpCode: string | null = null;

  if (def.action === 'error') {
    return buildIntegrationResult({
      entity: 'customer',
      action: 'error',
      erpCode: null,
      raw,
      rawResponse,
      matchedPattern: def.id,
      errorMessage: match[1]?.trim() || raw,
      errorType: 'erp',
      isRetryable: false,
      warnings,
      metadata: baseMeta,
    });
  }

  if (def.codeIdx !== null) {
    const candidate = match[def.codeIdx];
    if (isValidErpCode(candidate, ctx.cnpj)) {
      erpCode = candidate;
    } else if (candidate) {
      warnings.push(
        candidate.length === 14
          ? `erpCode "${candidate}" tem 14 dígitos (formato CNPJ) — descartado`
          : `erpCode "${candidate}" inválido (esperado 1-10 dígitos) — descartado`,
      );
      if (ctx.cnpj && candidate === ctx.cnpj.replace(/\D/g, '')) {
        warnings.push('erpCode igual ao CNPJ — descartado');
      }
    }
  }

  const meta = { ...baseMeta, ...buildMetadataFromMatch(match, def.metaIdx) };

  return buildIntegrationResult({
    entity: 'customer',
    action: def.action,
    erpCode,
    raw,
    rawResponse,
    matchedPattern: def.id,
    errorMessage: null,
    errorType: null,
    isRetryable: false,
    warnings,
    metadata: meta,
  });
}

export function parseClienteRetorno(rawResponse: unknown, ctx: CustomerParseContext = {}): ClienteRetornoV4 {
  const raw = extractRawRetorno(rawResponse);
  if (!raw) {
    throw new Error('Resposta técnica inválida: campo p_retorno ausente');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Resposta técnica inválida: p_retorno não é JSON válido (${raw})`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Resposta técnica inválida: p_retorno deve ser um objeto JSON');
  }

  const obj = parsed as Record<string, unknown>;
  const erro = typeof obj.erro === 'string' ? obj.erro.trim() : '';
  if (erro) {
    throw new Error(`ERP retornou erro: ${erro}`);
  }

  const cnpjCpf = String(obj.cnpj_cpf ?? '').replace(/\D/g, '');
  const expected = String(ctx.cnpj ?? '').replace(/\D/g, '');
  if (!cnpjCpf) {
    throw new Error('Resposta técnica inválida: cnpj_cpf ausente no p_retorno');
  }
  if (expected && cnpjCpf !== expected) {
    throw new Error(`Resposta técnica inválida: CNPJ retornado (${cnpjCpf}) difere do enviado (${expected})`);
  }

  const correntista = Number(obj.correntista);
  if (!Number.isFinite(correntista) || correntista <= 0) {
    throw new Error('Resposta técnica inválida: correntista ausente ou inválido');
  }

  return { cnpj_cpf: cnpjCpf, correntista };
}

export function parseProductRetorno(
  rawResponse: unknown,
  ctx: ProductParseContext = {},
): ErpIntegrationResult<{ sku?: string; requestedAt?: string; durationMs?: number }> {
  const raw = extractRawRetorno(rawResponse);
  const baseMeta = {
    sku: ctx.sku ?? undefined,
    requestedAt: ctx.requestedAt,
    durationMs: ctx.durationMs,
  };

  if (!raw) {
    // Para produto, ausência de p_retorno historicamente é tolerada (sucesso silencioso)
    return buildIntegrationResult({
      entity: 'product',
      action: 'updated',
      erpCode: null,
      raw: '',
      rawResponse,
      matchedPattern: null,
      errorMessage: null,
      errorType: null,
      isRetryable: false,
      warnings: ['Resposta sem p_retorno — assumindo sucesso (comportamento legado)'],
      metadata: baseMeta,
      requireCodeForSuccess: false,
    });
  }

  // Novo formato JSON: {"codigo_produto":"123","erro":""} ou {"codigo_produto":"","erro":"..."}
  const jsonShape = tryParseJsonShape(raw);
  if (jsonShape) {
    const { codigo_produto, erro } = jsonShape;
    if (erro && erro.trim() !== '') {
      return buildIntegrationResult({
        entity: 'product',
        action: 'error',
        erpCode: null,
        raw,
        rawResponse,
        matchedPattern: 'product.error.json.v1',
        errorMessage: erro.trim(),
        errorType: 'erp',
        isRetryable: false,
        warnings: [],
        metadata: baseMeta,
      });
    }
    if (codigo_produto && isValidErpCode(codigo_produto)) {
      return buildIntegrationResult({
        entity: 'product',
        action: 'created',
        erpCode: codigo_produto,
        raw,
        rawResponse,
        matchedPattern: 'product.created.json.v1',
        errorMessage: null,
        errorType: null,
        isRetryable: false,
        warnings: [],
        metadata: baseMeta,
        requireCodeForSuccess: false,
      });
    }
  }

  const found = tryMatch(raw, PRODUCT_PATTERNS);

  if (!found) {
    // Comportamento legado: produto não exige p_retorno estruturado
    return buildIntegrationResult({
      entity: 'product',
      action: 'unknown',
      erpCode: null,
      raw,
      rawResponse,
      matchedPattern: null,
      errorMessage: `Formato de retorno desconhecido: "${raw}"`,
      errorType: 'parse',
      isRetryable: false,
      warnings: [`Formato de retorno desconhecido: "${raw}"`],
      metadata: baseMeta,
      requireCodeForSuccess: false,
    });
  }

  const { def, match } = found;
  const warnings: string[] = [];
  let erpCode: string | null = null;

  if (def.action === 'error') {
    return buildIntegrationResult({
      entity: 'product',
      action: 'error',
      erpCode: null,
      raw,
      rawResponse,
      matchedPattern: def.id,
      errorMessage: match[1]?.trim() || raw,
      errorType: 'erp',
      isRetryable: false,
      warnings,
      metadata: baseMeta,
    });
  }

  if (def.codeIdx !== null) {
    const candidate = match[def.codeIdx];
    if (isValidErpCode(candidate)) {
      erpCode = candidate;
    } else if (candidate) {
      warnings.push(`erpCode "${candidate}" inválido — descartado`);
    }
  }

  return buildIntegrationResult({
    entity: 'product',
    action: def.action,
    erpCode,
    raw,
    rawResponse,
    matchedPattern: def.id,
    errorMessage: null,
    errorType: null,
    isRetryable: false,
    warnings,
    metadata: baseMeta,
    // Produto: success não exige erpCode (já é gerado antes do envio)
    requireCodeForSuccess: false,
  });
}

export function parseOrderRetorno(
  rawResponse: unknown,
  ctx: OrderParseContext = {},
): ErpIntegrationResult<{
  pedidoTerceiro?: string | number;
  orderNumber?: string;
  erpOrderNumber?: string;
  requestedAt?: string;
  durationMs?: number;
}> {
  const raw = extractRawRetorno(rawResponse);
  const baseMeta = {
    pedidoTerceiro: ctx.pedidoTerceiro ?? undefined,
    orderNumber: ctx.orderNumber ?? undefined,
    requestedAt: ctx.requestedAt,
    durationMs: ctx.durationMs,
  };

  if (!raw) {
    return buildIntegrationResult({
      entity: 'order',
      action: 'unknown',
      erpCode: null,
      raw: '',
      rawResponse,
      matchedPattern: null,
      errorMessage: 'Resposta do ERP sem p_retorno para pedido',
      errorType: 'parse',
      isRetryable: true,
      warnings: ['p_retorno vazio — investigar'],
      metadata: baseMeta,
      requireCodeForSuccess: false,
    });
  }

  const found = tryMatch(raw, ORDER_PATTERNS);

  if (!found) {
    return buildIntegrationResult({
      entity: 'order',
      action: 'unknown',
      erpCode: null,
      raw,
      rawResponse,
      matchedPattern: null,
      errorMessage: `Formato de retorno de pedido desconhecido: "${raw}"`,
      errorType: 'parse',
      isRetryable: false,
      warnings: ['Padrão não reconhecido em parser de pedido'],
      metadata: baseMeta,
      requireCodeForSuccess: false,
    });
  }

  const { def, match } = found;
  const warnings: string[] = [];
  let erpCode: string | null = null;

  if (def.action === 'error') {
    return buildIntegrationResult({
      entity: 'order',
      action: 'error',
      erpCode: null,
      raw,
      rawResponse,
      matchedPattern: def.id,
      errorMessage: match[1]?.trim() || raw,
      errorType: 'erp',
      isRetryable: false,
      warnings,
      metadata: baseMeta,
      requireCodeForSuccess: false,
    });
  }

  if (def.codeIdx !== null) {
    const candidate = match[def.codeIdx];
    if (isValidErpCode(candidate)) {
      erpCode = candidate;
    } else if (candidate) {
      warnings.push(`erpCode de pedido "${candidate}" inválido — descartado`);
    }
  }

  const meta = { ...baseMeta, ...buildMetadataFromMatch(match, def.metaIdx) };

  return buildIntegrationResult({
    entity: 'order',
    action: def.action,
    erpCode,
    raw,
    rawResponse,
    matchedPattern: def.id,
    errorMessage: null,
    errorType: null,
    isRetryable: false,
    warnings,
    metadata: meta,
    // Pedido: ERP pode não devolver código sempre — não bloqueia success
    requireCodeForSuccess: false,
  });
}

/**
 * Helper para serializar um resultado em payload de log.
 * Usado consistentemente em erp_sync_logs.response_payload.parsed.
 */
export function toLogPayload(result: ErpIntegrationResult): Record<string, unknown> {
  return {
    raw: result.raw,
    rawResponse: result.rawResponse,
    parsed: {
      entity: result.entity,
      action: result.action,
      success: result.success,
      erpCode: result.erpCode,
      matchedPattern: result.matchedPattern,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
      needsFallback: result.needsFallback,
      isRetryable: result.isRetryable,
      warnings: result.warnings,
      metadata: result.metadata,
    },
  };
}
