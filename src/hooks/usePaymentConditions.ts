import { supabase } from '@/integrations/supabase/client';
import type { PaymentConditionDraft } from '@/components/orders/PaymentConditionsEditor';

type Scope = 'order' | 'proposal';

const tableFor = (scope: Scope) => scope === 'order' ? 'order_payment_conditions' : 'proposal_payment_conditions';
const fkFor = (scope: Scope) => scope === 'order' ? 'order_id' : 'proposal_id';

export async function loadPaymentConditions(scope: Scope, parentId: string): Promise<PaymentConditionDraft[]> {
  const { data, error } = await supabase
    .from(tableFor(scope) as any)
    .select('id, parcela, dias, payment_method, tipo, valor, percentual')
    .eq(fkFor(scope), parentId)
    .order('parcela', { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    parcela: r.parcela,
    dias: r.dias,
    payment_method: r.payment_method ?? '',
    tipo: r.tipo,
    valor: r.valor,
    percentual: r.percentual,
  }));
}

export async function persistPaymentConditions(
  scope: Scope,
  parentId: string,
  rows: PaymentConditionDraft[],
  tenantIdOverride?: string
) {
  // Resolve tenant a partir do registro pai quando não vier
  let tenantId = tenantIdOverride;
  if (!tenantId) {
    const parentTable = scope === 'order' ? 'orders' : 'proposals';
    const { data: parent } = await supabase
      .from(parentTable as any)
      .select('tenant_id')
      .eq('id', parentId)
      .maybeSingle();
    tenantId = (parent as any)?.tenant_id;
    if (!tenantId) throw new Error(`Não foi possível resolver tenant do ${scope} ${parentId}`);
  }
  const table = tableFor(scope) as any;
  const fk = fkFor(scope);
  // Estratégia simples: apaga e reinsere (mesmo padrão usado em order_items).
  const { error: delError } = await supabase.from(table).delete().eq(fk, parentId);
  if (delError) throw delError;
  if (rows.length === 0) return;
  const payload = rows.map((r, idx) => ({
    [fk]: parentId,
    tenant_id: tenantId,
    parcela: idx + 1,
    dias: r.dias,
    payment_method: r.payment_method,
    tipo: r.tipo,
    valor: r.tipo === 'V' ? r.valor ?? null : null,
    percentual: r.tipo === 'P' ? r.percentual ?? null : null,
  }));
  const { error: insError } = await supabase.from(table).insert(payload);
  if (insError) throw insError;
}
