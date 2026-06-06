/**
 * Mapeamento CRM → ERP Projedata para IMP_PEDIDO_ESPECIFICO
 *
 * Gera o JSON interno do envelope ASDCOMANDO.
 * Todos os tipos seguem o payload validado com o ERP.
 * NENHUM fallback — todos os campos são obrigatórios.
 */

import type {
  ProjedataOrder,
  ProjedataOrderItem,
  ProjedataOrderDelivery,
  ProjedataOrderPayment,
  ProjedataOrderFollowupItem,
} from './order-types.ts';
import { buildEnvelope, serializeEnvelope } from './serializer.ts';

// ─── Tipos de entrada (dados do CRM) ───────────────────────────

export interface CRMOrderFollowup {
  texto: string;
  erp_user_code: number;
}

export interface CRMOrderForSync {
  pedido_terceiro: number;
  order_date: string;           // ISO date
  observations?: string | null;
  total_discount?: number | null;
  freight_type: string;         // código ERP resolvido (obrigatório)
  delivery_date?: string | null;
  company_cnpj: string;         // com ou sem formatação
  erp_empresa: number;          // obrigatório
  erp_fluxo_venda: number;      // obrigatório
  erp_usuario: number;          // obrigatório
  erp_vendedor: number;         // obrigatório
  erp_transportador?: number | null;  // código ERP da transportadora (opcional)
  erp_redespacho?: number | null;     // código ERP do redespacho (opcional)
  items: CRMOrderItemForSync[];
  payment_conditions: CRMPaymentCondition[]; // obrigatório (não-vazio)
  followup?: CRMOrderFollowup | null;        // follow-up do pedido (opcional)
}

export interface CRMOrderItemForSync {
  seq: number;
  erp_product_code: string;
  erp_versao: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  tipo_venda: number;           // obrigatório
  commission_pct?: number;
  delivery_date?: string | null;   // ISO date
  observations?: string | null;
  observations_pcp?: string | null;
  ordem_compra?: string | null;
}

export interface CRMPaymentCondition {
  parcela: number;
  dias: number;
  forma_recebimento: number;    // obrigatório
  tipo?: string;                // 'V' ou 'P'
  fator?: number;               // valor (R$) ou percentual
}

// ─── Helpers ────────────────────────────────────────────────────

function normalizeCnpjCpf(value: string): string {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length >= 12 && digits.length <= 14) return digits.padStart(14, '0');
  if (digits.length >= 9 && digits.length <= 11) return digits.padStart(11, '0');
  throw new Error(`CNPJ/CPF inválido (esperado 11 ou 14 dígitos): "${value}"`);
}

function formatDateERP(isoDate: string): string {
  const d = new Date(isoDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function generatePedidoTerceiro(orderNumber: string): number {
  const digits = orderNumber.replace(/\D/g, '');
  if (!digits) throw new Error(`Não foi possível extrair número de: ${orderNumber}`);
  return Number(digits);
}

export function parsePaymentTerms(
  terms: string,
  formaRecebimento: number
): CRMPaymentCondition[] {
  const dias = terms.split('/').map(Number).filter(d => d > 0);
  if (dias.length === 0) throw new Error(`payment_terms inválido: "${terms}"`);
  return dias.map((d, i) => ({
    parcela: i + 1,
    dias: d,
    forma_recebimento: formaRecebimento,
    tipo: 'P',
  }));
}

// ─── Mapper principal ───────────────────────────────────────────

export function mapCRMOrderToProjedata(order: CRMOrderForSync): ProjedataOrder {
  // Follow-up do pedido (único registro, replicado em cada item por exigência do ERP)
  const followupArray: ProjedataOrderFollowupItem[] | undefined = order.followup?.texto
    ? [{
        sequencia_followup: 1,
        tipo: 1,
        texto: order.followup.texto,
        usuario: order.followup.erp_user_code,
      }]
    : undefined;

  const itens: ProjedataOrderItem[] = order.items.map((item) => {
    const deliveryDate = item.delivery_date || order.delivery_date || order.order_date;
    const entregas: ProjedataOrderDelivery[] = [{
      ordem_compra: item.ordem_compra || '0',
      observacao: item.observations || '',
      observacao_pcp: item.observations_pcp || '',
      previsao_entrega: formatDateERP(deliveryDate),
      previsao_ent_cliente: formatDateERP(deliveryDate),
      quantidade: item.quantity,
    }];

    const mapped: ProjedataOrderItem = {
      item: item.erp_product_code,
      seq_item: item.seq,
      tipo_venda: item.tipo_venda,
      desconto_item: item.discount_percent ?? 0,
      comissao: item.commission_pct ?? 0,
      unitario: item.unit_price,
      versao: item.erp_versao,
      entregas,
    };
    if (followupArray) {
      mapped.followup_item = followupArray;
    }
    return mapped;
  });

  // Pagto: sempre enviar `fator`.
  // - tipo='V': valor em R$ da parcela.
  // - tipo='P': percentual. Se a parcela não trouxe percentual (=0/null), rateia 100% entre as N parcelas P,
  //            com ajuste de arredondamento na última para fechar exatamente em 100.
  const pParcels = order.payment_conditions.filter(p => (p.tipo ?? 'P') !== 'V');
  const nP = pParcels.length;
  const anyPercentInformed = pParcels.some(p => Number(p.fator ?? 0) > 0);
  let autoShare = 0;
  if (nP > 0 && !anyPercentInformed) {
    autoShare = Math.floor((100 / nP) * 100) / 100; // 2 casas decimais
  }
  let pSeen = 0;
  const pagto: ProjedataOrderPayment[] = order.payment_conditions.map(p => {
    const tipo = p.tipo ?? 'P';
    let fator: number;
    if (tipo === 'V') {
      fator = Number(p.fator ?? 0);
    } else {
      if (anyPercentInformed) {
        fator = Number(p.fator ?? 0);
      } else {
        pSeen++;
        // última parcela P recebe o ajuste de arredondamento
        fator = (pSeen === nP) ? Number((100 - autoShare * (nP - 1)).toFixed(2)) : autoShare;
      }
    }
    return {
      dias: p.dias,
      forma_recebimento: p.forma_recebimento,
      parcela: p.parcela,
      tipo,
      fator,
    };
  });

  const result: ProjedataOrder = {
    cpf_cnpj_cliente: normalizeCnpjCpf(order.company_cnpj),
    data_pedido: formatDateERP(order.order_date),
    empresa: order.erp_empresa,
    fluxo_venda: order.erp_fluxo_venda,
    desconto_pedido: order.total_discount ?? 0,
    id_moeda: 1,
    observacao: order.observations || '',
    pedido_terceiro: order.pedido_terceiro,
    usuario: order.erp_usuario,
    vendedor: order.erp_vendedor,
    frete: order.freight_type,
    itens,
    pagto,
  };

  if (order.erp_transportador != null) {
    result.transportador = order.erp_transportador;
  }
  if (order.erp_redespacho != null) {
    result.redespacho = order.erp_redespacho;
  }

  return result;
}

// ─── Serialização final ─────────────────────────────────────────

/**
 * Gera o payload completo serializado para envio ao ERP.
 * Retorna string JSON em linha única pronta para body do fetch.
 */
export function buildOrderPayload(order: ProjedataOrder): string {
  const innerJson: Record<string, unknown> = {
    cpf_cnpj_cliente: order.cpf_cnpj_cliente,
    data_pedido: order.data_pedido,
    empresa: order.empresa,
    fluxo_venda: order.fluxo_venda,
    desconto_pedido: order.desconto_pedido,
    id_moeda: order.id_moeda,
    observacao: order.observacao,
    pedido_terceiro: order.pedido_terceiro,
    usuario: order.usuario,
    vendedor: order.vendedor,
    frete: order.frete,
  };

  if (order.transportador != null) innerJson.transportador = order.transportador;
  if (order.redespacho != null) innerJson.redespacho = order.redespacho;

  innerJson.itens = order.itens;
  innerJson.pagto = order.pagto;

  const envelope = buildEnvelope('IMP_PEDIDO_ESPECIFICO', innerJson);
  return serializeEnvelope(envelope);
}
