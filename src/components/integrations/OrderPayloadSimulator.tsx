import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Loader2, Copy, Check, AlertTriangle, CheckCircle2, FileJson } from 'lucide-react';
import { toast } from 'sonner';

interface ResolutionStep {
  label: string;
  field: string;
  crmValue: string | number | null;
  erpValue: string | number | null;
  status: 'ok' | 'error' | 'warning';
  message?: string;
}

export function OrderPayloadSimulator() {
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [steps, setSteps] = useState<ResolutionStep[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Load orders for selector
  const { data: orders = [] } = useQuery({
    queryKey: ['orders-for-simulator'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, number, order_date, companies(name), order_type, freight_type, payment_method, payment_terms')
        .order('created_at', { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
  });

  const orderOptions = orders.map((o: any) => ({
    value: o.id,
    label: `${o.number} — ${o.companies?.name || 'Sem empresa'}`,
  }));

  const handleSimulate = async () => {
    if (!selectedOrderId) return;
    setIsSimulating(true);
    setPayload(null);
    setSteps([]);
    setErrors([]);

    const resolvedSteps: ResolutionStep[] = [];
    const errs: string[] = [];

    try {
      // 1. Load order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id, number, order_date, delivery_date, observations,
          total_discount, freight_type, pedido_terceiro, legal_entity_id,
          company_id, order_type, created_by, payment_terms, payment_method,
          sales_rep_id,
          companies!inner(id, erp_code, cnpj, name, sales_rep_id),
          legal_entities(id, name, erp_company_code)
        `)
        .eq('id', selectedOrderId)
        .single();

      if (orderError || !order) {
        errs.push('Pedido não encontrado');
        setErrors(errs);
        setIsSimulating(false);
        return;
      }

      const company = order.companies as any;
      const legalEntity = order.legal_entities as any;

      // 2. pedido_terceiro
      const pedidoTerceiroRaw = order.pedido_terceiro || parseInt((order.number || '').replace(/\D/g, ''), 10);
      resolvedSteps.push({
        label: 'Pedido Terceiro',
        field: 'pedido_terceiro',
        crmValue: order.number,
        erpValue: pedidoTerceiroRaw || null,
        status: pedidoTerceiroRaw ? 'ok' : 'error',
        message: pedidoTerceiroRaw ? undefined : 'Não foi possível extrair número',
      });

      // 3. Empresa
      const erpEmpresa = Number(legalEntity?.erp_company_code);
      resolvedSteps.push({
        label: 'Empresa Emissora',
        field: 'empresa',
        crmValue: legalEntity?.name || 'Não definida',
        erpValue: erpEmpresa || null,
        status: erpEmpresa && !isNaN(erpEmpresa) ? 'ok' : 'error',
        message: !erpEmpresa ? 'erp_company_code não definido' : undefined,
      });
      if (!erpEmpresa || isNaN(erpEmpresa)) errs.push('Empresa emissora sem código ERP');

      // 4. CNPJ
      resolvedSteps.push({
        label: 'CNPJ Cliente',
        field: 'cpf_cnpj_cliente',
        crmValue: company?.cnpj || 'Não definido',
        erpValue: company?.cnpj ? Number(company.cnpj.replace(/\D/g, '')) : null,
        status: company?.cnpj ? 'ok' : 'error',
      });
      if (!company?.cnpj) errs.push('Cliente sem CNPJ');

      // 5. Usuário ERP
      let erpUsuario = 0;
      let userName = 'N/A';
      if (order.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, erp_user_code')
          .eq('id', order.created_by)
          .maybeSingle();
        if (profile) {
          userName = profile.full_name || 'N/A';
          erpUsuario = Number(profile.erp_user_code);
        }
      }
      resolvedSteps.push({
        label: 'Usuário ERP',
        field: 'usuario',
        crmValue: userName,
        erpValue: erpUsuario || null,
        status: erpUsuario && !isNaN(erpUsuario) ? 'ok' : 'error',
        message: !erpUsuario ? 'erp_user_code não definido no perfil' : undefined,
      });
      if (!erpUsuario) errs.push('Usuário sem código ERP');

      // 6. Fluxo de venda
      const crmOrderType = order.order_type ?? 'producao';
      const { data: typeMapping } = await supabase
        .from('order_type_erp_mapping')
        .select('erp_flow_code, erp_flow_description')
        .eq('crm_order_type', crmOrderType)
        .eq('is_active', true)
        .maybeSingle();

      resolvedSteps.push({
        label: 'Fluxo de Venda',
        field: 'fluxo_venda',
        crmValue: crmOrderType,
        erpValue: typeMapping?.erp_flow_code ?? null,
        status: typeMapping?.erp_flow_code ? 'ok' : 'error',
        message: !typeMapping ? `Tipo "${crmOrderType}" não mapeado` : typeMapping.erp_flow_description || undefined,
      });
      if (!typeMapping?.erp_flow_code) errs.push(`Tipo de pedido "${crmOrderType}" sem mapeamento ERP`);

      // 7. Vendedor
      const salesRepId = order.sales_rep_id || company?.sales_rep_id;
      let erpVendedor = 0;
      let sellerName = 'N/A';
      if (salesRepId) {
        const { data: rep } = await supabase
          .from('sales_reps')
          .select('name, erp_vendor_code')
          .eq('id', salesRepId)
          .maybeSingle();
        if (rep) {
          sellerName = rep.name || 'N/A';
          erpVendedor = Number(rep.erp_vendor_code);
        }
      }
      resolvedSteps.push({
        label: 'Vendedor',
        field: 'vendedor',
        crmValue: sellerName,
        erpValue: erpVendedor || null,
        status: erpVendedor && !isNaN(erpVendedor) ? 'ok' : 'error',
        message: !erpVendedor ? 'erp_vendor_code não definido' : undefined,
      });
      if (!erpVendedor) errs.push('Vendedor sem código ERP');

      // 8. Frete
      const crmFreight = order.freight_type;
      let erpFreightCode: string | null = null;
      if (crmFreight) {
        const { data: fm } = await supabase
          .from('freight_type_erp_mapping')
          .select('erp_freight_code, erp_freight_description')
          .eq('crm_freight_type', crmFreight)
          .eq('is_active', true)
          .maybeSingle();
        erpFreightCode = fm?.erp_freight_code ?? null;
        resolvedSteps.push({
          label: 'Frete',
          field: 'frete',
          crmValue: crmFreight,
          erpValue: erpFreightCode,
          status: erpFreightCode !== null ? 'ok' : 'error',
          message: !fm ? `Frete "${crmFreight}" não mapeado` : fm.erp_freight_description || undefined,
        });
      } else {
        resolvedSteps.push({
          label: 'Frete',
          field: 'frete',
          crmValue: 'Não definido',
          erpValue: null,
          status: 'error',
        });
        errs.push('Frete não definido');
      }

      // 9. Pagamento
      const crmPayment = order.payment_method;
      let erpPaymentCode: number | null = null;
      if (crmPayment) {
        const { data: pm } = await supabase
          .from('payment_method_erp_mapping')
          .select('erp_payment_code, erp_payment_description')
          .eq('crm_payment_method', crmPayment)
          .eq('is_active', true)
          .maybeSingle();
        erpPaymentCode = pm?.erp_payment_code ?? null;
        resolvedSteps.push({
          label: 'Forma Pagamento',
          field: 'forma_recebimento',
          crmValue: crmPayment,
          erpValue: erpPaymentCode,
          status: erpPaymentCode !== null ? 'ok' : 'error',
          message: !pm ? `Pagamento "${crmPayment}" não mapeado` : pm.erp_payment_description || undefined,
        });
      } else {
        resolvedSteps.push({
          label: 'Forma Pagamento',
          field: 'forma_recebimento',
          crmValue: 'Não definido',
          erpValue: null,
          status: 'error',
        });
        errs.push('Forma de pagamento não definida');
      }

      // 10. Parcelas
      const paymentTermsStr = order.payment_terms;
      let parcelas: any[] = [];
      if (paymentTermsStr && erpPaymentCode !== null) {
        const dias = paymentTermsStr.split('/').map(Number).filter((d: number) => d > 0);
        parcelas = dias.map((d: number, i: number) => ({
          parcela: i + 1,
          dias: d,
          forma_recebimento: erpPaymentCode,
          tipo: 'P',
        }));
        resolvedSteps.push({
          label: 'Parcelas',
          field: 'pagto',
          crmValue: paymentTermsStr,
          erpValue: `${parcelas.length} parcela(s)`,
          status: parcelas.length > 0 ? 'ok' : 'error',
        });
      } else {
        resolvedSteps.push({
          label: 'Parcelas',
          field: 'pagto',
          crmValue: paymentTermsStr || 'Não definido',
          erpValue: null,
          status: 'error',
          message: 'Condições de pagamento ausentes',
        });
        if (!paymentTermsStr) errs.push('payment_terms não definido');
      }

      // 11. Itens
      const { data: items } = await supabase
        .from('order_items')
        .select(`
          id, quantity, unit_price, discount_percent, sort_order,
          delivery_date, description, sale_type,
          products!inner(id, erp_product_code, erp_versao, name)
        `)
        .eq('order_id', selectedOrderId)
        .order('sort_order', { ascending: true });

      if (!items || items.length === 0) {
        errs.push('Pedido sem itens');
      }

      // Sale type mappings
      const distinctSaleTypes = [...new Set((items || []).map((i: any) => i.sale_type || 'venda_tributada'))];
      const { data: stMappings } = await supabase
        .from('sale_type_erp_mapping')
        .select('crm_sale_type, erp_sale_type_code')
        .in('crm_sale_type', distinctSaleTypes)
        .eq('is_active', true);

      const saleTypeMap = new Map<string, number>();
      (stMappings || []).forEach((m: any) => saleTypeMap.set(m.crm_sale_type, m.erp_sale_type_code));

      for (const st of distinctSaleTypes) {
        if (!saleTypeMap.has(st)) errs.push(`Tipo de venda "${st}" não mapeado`);
      }

      // Format date helper
      const formatDateERP = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };

      // Build the full payload object (same as mapper)
      const orderDate = order.order_date || new Date().toISOString();
      const innerJson: Record<string, unknown> = {
        cpf_cnpj_cliente: company?.cnpj ? Number(company.cnpj.replace(/\D/g, '')) : null,
        data_pedido: formatDateERP(orderDate),
        empresa: erpEmpresa || null,
        fluxo_venda: typeMapping?.erp_flow_code ?? null,
        desconto_pedido: Number(order.total_discount) || 0,
        id_moeda: 1,
        observacao: order.observations || '',
        pedido_terceiro: pedidoTerceiroRaw || null,
        usuario: erpUsuario || null,
        vendedor: erpVendedor || null,
        frete: erpFreightCode ?? null,
        itens: (items || []).map((item: any, idx: number) => {
          const deliveryDate = item.delivery_date || order.delivery_date || orderDate;
          const itemSaleType = item.sale_type || 'venda_tributada';
          return {
            item: item.products?.erp_product_code || null,
            seq_item: idx + 1,
            tipo_venda: saleTypeMap.get(itemSaleType) ?? null,
            desconto_item: Number(item.discount_percent) || 0,
            unitario: Number(item.unit_price) || 0,
            versao: item.products?.erp_versao || null,
            entregas: [{
              ordem_compra: '0',
              observacao: item.description || '',
              observacao_pcp: '',
              previsao_entrega: formatDateERP(deliveryDate),
              previsao_ent_cliente: formatDateERP(deliveryDate),
              quantidade: Number(item.quantity) || 0,
            }],
          };
        }),
        pagto: parcelas,
      };

      // Envelope
      const envelope = {
        tipoComando: 'ASDCOMANDO',
        grupoComando: 'IMP_PEDIDO_V3',
        '#out#p_retorno': 'T',
        json: JSON.stringify(innerJson),
      };

      setPayload(envelope);
      setSteps(resolvedSteps);
      setErrors(errs);
    } catch (err: any) {
      setErrors([err.message || 'Erro inesperado na simulação']);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopy = () => {
    if (!payload) return;
    navigator.clipboard.writeText(JSON.stringify(payload));
    setCopied(true);
    toast.success('Payload copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInner = () => {
    if (!payload?.json) return;
    navigator.clipboard.writeText(payload.json);
    toast.success('JSON interno copiado');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileJson className="h-4 w-4" />
          Simulador de Payload ERP (IMP_PEDIDO_V3)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <SearchableSelect
              options={orderOptions}
              value={selectedOrderId}
              onChange={(val) => setSelectedOrderId(val || '')}
              placeholder="Selecione um pedido..."
            />
          </div>
          <Button
            onClick={handleSimulate}
            disabled={!selectedOrderId || isSimulating}
            className="gap-2"
          >
            {isSimulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
            Simular
          </Button>
        </div>

        {/* Resolution Steps */}
        {steps.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-3 py-2 text-sm font-medium">
              Mapeamento CRM → ERP
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-1.5 font-medium">Campo</th>
                  <th className="text-left px-3 py-1.5 font-medium">CRM</th>
                  <th className="text-left px-3 py-1.5 font-medium">ERP</th>
                  <th className="text-center px-3 py-1.5 font-medium w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-medium">{step.label}</td>
                    <td className="px-3 py-1.5 text-muted-foreground font-mono text-xs">
                      {String(step.crmValue ?? '—')}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">
                      {step.erpValue !== null ? String(step.erpValue) : '—'}
                      {step.message && step.status === 'ok' && (
                        <span className="ml-1 text-muted-foreground">({step.message})</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {step.status === 'ok' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {errors.length} erro(s) — envio seria bloqueado
            </div>
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-destructive/80 pl-6">• {e}</p>
            ))}
          </div>
        )}

        {/* Success message */}
        {payload && errors.length === 0 && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-sm font-medium text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Payload válido — pronto para envio ao ERP
            </p>
          </div>
        )}

        {/* Payload JSON */}
        {payload && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Payload Completo (Envelope)</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={handleCopyInner} className="text-xs gap-1">
                  <Copy className="h-3 w-3" />
                  JSON Interno
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs gap-1">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Envelope
                </Button>
              </div>
            </div>
            <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap break-all">
              {JSON.stringify(payload, null, 2)}
            </pre>

            <div className="space-y-1">
              <span className="text-sm font-medium">JSON Interno (campo "json" deserializado)</span>
              <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap break-all">
                {JSON.stringify(JSON.parse(payload.json), null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
