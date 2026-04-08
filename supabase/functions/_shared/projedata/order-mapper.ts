/**
 * Mapeamento CRM → ERP Projedata para IMP_PEDIDO_V3
 *
 * Gera o JSON interno do envelope ASDCOMANDO.
 * Todos os tipos seguem o payload validado com o ERP.
 */

import type { ProjedataOrder, ProjedataOrderItem, ProjedataOrderDelivery, ProjedataOrderPayment } from './order-types.ts';
import { buildEnvelope, serializeEnvelope } from './serializer.ts';

// ─── Tipos de entrada (dados do CRM) ───────────────────────────

export interface CRMOrderForSync {
  pedido_terceiro: number;
  order_date: string;           // ISO date
  observations?: string | null;
  total_discount?: number | null;
  freight_type?: string | null;
  delivery_date?: string | null;
  company_cnpj: string;         // com ou sem formatação
  erp_empresa?: number;
  erp_fluxo_venda?: number;
  erp_usuario?: number;
  erp_vendedor?: number;
  items: CRMOrderItemForSync[];
  payment_conditions?: CRMPaymentCondition[];
}

export interface CRMOrderItemForSync {
  seq: number;
  erp_product_code: string;
  erp_versao: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  tipo_venda?: number;
  delivery_date?: string | null;   // ISO date
  observations?: string | null;
  observations_pcp?: string | null;
  ordem_compra?: string | null;
}

export interface CRMPaymentCondition {
  parcela: number;
  dias: number;
  forma_recebimento?: number;
  tipo?: string;
}

// ─── Helpers ────────────────────────────────────────────────────

/** Remove formatação do CNPJ e converte para número */
function cnpjToNumber(cnpj: string): number {
  const digits = cnpj.replace(/\D/g, '');
  return Number(digits);
}

/** Converte ISO date para DD/MM/YYYY HH:mm:ss */
function formatDateERP(isoDate: string): string {
  const d = new Date(isoDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Gera pedido_terceiro a partir do código do pedido */
export function generatePedidoTerceiro(orderNumber: string): number {
  const digits = orderNumber.replace(/\D/g, '');
  if (!digits) throw new Error(`Não foi possível extrair número de: ${orderNumber}`);
  return Number(digits);
}

// ─── Mapper principal ───────────────────────────────────────────

export function mapCRMOrderToProjedata(order: CRMOrderForSync): ProjedataOrder {
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

    return {
      item: item.erp_product_code,
      seq_item: item.seq,
      tipo_venda: item.tipo_venda ?? 1,
      desconto_item: item.discount_percent ?? 0,
      unitario: item.unit_price,
      versao: item.erp_versao,
      entregas,
    };
  });

  // Pagamento padrão se não informado
  const pagto: ProjedataOrderPayment[] = order.payment_conditions && order.payment_conditions.length > 0
    ? order.payment_conditions.map(p => ({
        dias: p.dias,
        forma_recebimento: p.forma_recebimento ?? 1,
        parcela: p.parcela,
        tipo: p.tipo ?? 'P',
      }))
    : [{ dias: 30, forma_recebimento: 1, parcela: 1, tipo: 'P' }];

  return {
    cpf_cnpj_cliente: cnpjToNumber(order.company_cnpj),
    data_pedido: formatDateERP(order.order_date),
    empresa: order.erp_empresa ?? 1,
    fluxo_venda: order.erp_fluxo_venda ?? 10,
    desconto_pedido: order.total_discount ?? 0,
    id_moeda: 1,
    observacao: order.observations || '',
    pedido_terceiro: order.pedido_terceiro,
    usuario: order.erp_usuario ?? 0,
    vendedor: order.erp_vendedor ?? 0,
    frete: order.freight_type || '1',
    itens,
    pagto,
  };
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
    itens: order.itens,
    pagto: order.pagto,
  };

  const envelope = buildEnvelope('IMP_PEDIDO_V3', innerJson);
  return serializeEnvelope(envelope);
}
