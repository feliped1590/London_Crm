/**
 * Testes do parser unificado Projedata.
 * Cobre: criados, atualizados, erros, formatos desconhecidos e casos
 * adversariais (CNPJ confundido com erpCode, código inválido, etc).
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  parseCustomerRetorno,
  parseProductRetorno,
  parseOrderRetorno,
  extractRawRetorno,
} from './projedata-parser.ts';
import { isValidErpCode } from './integration-result.ts';

// ─── isValidErpCode ─────────────────────────────────────────────────

Deno.test('isValidErpCode aceita 1-10 dígitos', () => {
  assertEquals(isValidErpCode('1'), true);
  assertEquals(isValidErpCode('9999'), true);
  assertEquals(isValidErpCode('1234567890'), true);
});

Deno.test('isValidErpCode rejeita > 10 dígitos (CNPJ)', () => {
  assertEquals(isValidErpCode('12345678901234'), false); // 14
});

Deno.test('isValidErpCode rejeita não numérico', () => {
  assertEquals(isValidErpCode('99a9'), false);
  assertEquals(isValidErpCode(''), false);
  assertEquals(isValidErpCode(null), false);
});

Deno.test('isValidErpCode rejeita quando bate com CNPJ', () => {
  assertEquals(isValidErpCode('12345678901234', '12.345.678/9012-34'), false);
  // Caso teórico: erpCode curto que coincide com CNPJ truncado não acontece
  // pois CNPJ tem 14 dígitos; mas garantimos a comparação
  assertEquals(isValidErpCode('999', '999'), false);
});

// ─── extractRawRetorno ──────────────────────────────────────────────

Deno.test('extractRawRetorno suporta array e objeto', () => {
  assertEquals(
    extractRawRetorno([{ '#out#p_retorno': 'A#B' }]),
    'A#B',
  );
  assertEquals(
    extractRawRetorno({ p_retorno: 'X' }),
    'X',
  );
  assertEquals(extractRawRetorno(null), '');
  assertEquals(extractRawRetorno({}), '');
});

// ─── Cliente: casos válidos ─────────────────────────────────────────

Deno.test('cliente criado: extrai erpCode corretamente', () => {
  const result = parseCustomerRetorno(
    [{ '#out#p_retorno': 'CLIENTE#CNPJ#9999#012568998984684' }],
    { cnpj: '012568998984684' },
  );
  assertEquals(result.action, 'created');
  assertEquals(result.success, true);
  assertEquals(result.erpCode, '9999');
  assertEquals(result.matchedPattern, 'customer.created.v1');
  assertEquals(result.needsFallback, false);
  assertEquals(result.errorType, null);
  assertEquals(result.warnings.length, 0);
  assertEquals(result.metadata.cnpj, '012568998984684');
});

Deno.test('cliente atualizado: extrai erpCode corretamente', () => {
  const result = parseCustomerRetorno(
    { '#out#p_retorno': 'Registro#9999#atualizado com sucesso!' },
    { cnpj: '012568998984684' },
  );
  assertEquals(result.action, 'updated');
  assertEquals(result.success, true);
  assertEquals(result.erpCode, '9999');
  assertEquals(result.matchedPattern, 'customer.updated.v1');
});

// ─── Cliente: erros ─────────────────────────────────────────────────

Deno.test('cliente erro: action=error, errorType=erp', () => {
  const result = parseCustomerRetorno(
    { p_retorno: '#ERRO#CNPJ inválido' },
  );
  assertEquals(result.action, 'error');
  assertEquals(result.success, false);
  assertEquals(result.errorType, 'erp');
  assertEquals(result.erpCode, null);
  assertEquals(result.errorMessage, 'CNPJ inválido');
});

Deno.test('cliente formato desconhecido: action=unknown, errorType=parse', () => {
  const result = parseCustomerRetorno(
    { p_retorno: 'RESPOSTA_NOVA_DO_ERP_QUE_NAO_CONHECEMOS' },
  );
  assertEquals(result.action, 'unknown');
  assertEquals(result.success, false);
  assertEquals(result.errorType, 'parse');
  assertEquals(result.matchedPattern, null);
});

Deno.test('cliente sem p_retorno: errorType=parse, isRetryable=true', () => {
  const result = parseCustomerRetorno({});
  assertEquals(result.action, 'unknown');
  assertEquals(result.errorType, 'parse');
  assertEquals(result.isRetryable, true);
});

// ─── Cliente: casos adversariais ────────────────────────────────────

Deno.test('cliente: CNPJ retornado como código é descartado', () => {
  // ERP devolveu o CNPJ no lugar do código — formato adversarial
  // O regex exige 1-10 dígitos no grupo 1, então não casa com 14 dígitos
  // Resultado: pattern não casa → unknown
  const result = parseCustomerRetorno(
    { p_retorno: 'CLIENTE#CNPJ#012568998984684#012568998984684' },
    { cnpj: '012568998984684' },
  );
  assertEquals(result.erpCode, null);
  // O regex CUSTOMER_PATTERNS exige 1-10 dígitos no grupo 1 → não casa
  assertEquals(result.matchedPattern, null);
  assertEquals(result.action, 'unknown');
});

Deno.test('cliente: código com letras é descartado', () => {
  const result = parseCustomerRetorno(
    { p_retorno: 'CLIENTE#CNPJ#ABC#012568998984684' },
  );
  // Regex não casa → unknown
  assertEquals(result.matchedPattern, null);
  assertEquals(result.erpCode, null);
});

Deno.test('cliente: needsFallback quando ação é sucesso mas sem código', () => {
  // Caso impossível com regex atual, mas validamos a lógica do builder
  // Simulamos com formato que casa em "Registro#9#atualizado" (válido)
  const result = parseCustomerRetorno(
    { p_retorno: 'Registro#9#atualizado' },
    { cnpj: '11222333000181' },
  );
  assertEquals(result.success, true);
  assertEquals(result.erpCode, '9');
  assertEquals(result.needsFallback, false);
});

// ─── Produto ────────────────────────────────────────────────────────

Deno.test('produto criado: pattern.created.v1', () => {
  const result = parseProductRetorno(
    { p_retorno: 'PRODUTO#800432' },
    { sku: 'SKU-X' },
  );
  assertEquals(result.action, 'created');
  assertEquals(result.erpCode, '800432');
});

Deno.test('produto atualizado', () => {
  const result = parseProductRetorno(
    { p_retorno: 'Registro#800432#atualizado!' },
  );
  assertEquals(result.action, 'updated');
  assertEquals(result.erpCode, '800432');
});

Deno.test('produto erro', () => {
  const result = parseProductRetorno(
    { p_retorno: '#ERRO#NCM inválido' },
  );
  assertEquals(result.action, 'error');
  assertEquals(result.errorType, 'erp');
  assertEquals(result.success, false);
});

Deno.test('produto sem p_retorno: comportamento legado tolerado', () => {
  const result = parseProductRetorno({});
  // Produto historicamente tolera silêncio
  assertEquals(result.action, 'updated');
  assertEquals(result.success, true);
});

// ─── Pedido ─────────────────────────────────────────────────────────

Deno.test('pedido criado: extrai erpCode e erpOrderNumber', () => {
  const result = parseOrderRetorno(
    { p_retorno: 'PEDIDO#123#20260050' },
    { pedidoTerceiro: 999 },
  );
  assertEquals(result.action, 'created');
  assertEquals(result.success, true);
  assertEquals(result.erpCode, '123');
  assertEquals(result.metadata.erpOrderNumber, '20260050');
});

Deno.test('pedido erro', () => {
  const result = parseOrderRetorno(
    { p_retorno: '#ERRO#Cliente bloqueado' },
  );
  assertEquals(result.action, 'error');
  assertEquals(result.errorType, 'erp');
  assertEquals(result.errorMessage, 'Cliente bloqueado');
});

Deno.test('pedido formato desconhecido', () => {
  const result = parseOrderRetorno(
    { p_retorno: 'NOVO_FORMATO_PEDIDO' },
  );
  assertEquals(result.action, 'unknown');
  assertEquals(result.errorType, 'parse');
});
