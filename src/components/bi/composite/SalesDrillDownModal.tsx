import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, ExternalLink, AlertTriangle, Inbox } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DrillDownFilters } from '@/hooks/useSalesDrillDown';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MAX_ROWS = 500;

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(v || 0);
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v || 0);
const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
};

interface OrderRow {
  id: string;
  number: string | null;
  date: string | null;
  status: string | null;
  company: string | null;
  seller: string | null;
  entity: string | null;
  value: number;
}

interface DealRow {
  id: string;
  name: string;
  stage: string;
  value: number;
  created_at: string | null;
  closed_at: string | null;
  company: string | null;
  lost_reason: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  filters: DrillDownFilters | null;
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: any) => {
    const s = String(v ?? '');
    if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv =
    '\uFEFF' +
    [headers, ...rows].map((r) => r.map(escape).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SalesDrillDownModal({ open, onClose, title, subtitle, filters }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderRows, setOrderRows] = useState<OrderRow[]>([]);
  const [dealRows, setDealRows] = useState<DealRow[]>([]);
  const [truncated, setTruncated] = useState(false);

  const source = filters?.source ?? 'sales';

  useEffect(() => {
    if (!open || !filters) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOrderRows([]);
    setDealRows([]);
    setTruncated(false);

    (async () => {
      try {
        if (source === 'deals') {
          let q = supabase
            .from('deals')
            .select(
              `id, name, stage, value, created_at, closed_at, lost_reason, company_id, owner_id, legal_entity_id,
               companies(name)`
            )
            .gte('created_at', filters.startDate.toISOString())
            .lte('created_at', new Date(filters.endDate.getTime() + 86400000).toISOString())
            .order('created_at', { ascending: false })
            .limit(MAX_ROWS + 1);
          if (filters.legalEntityId) q = q.eq('legal_entity_id', filters.legalEntityId);
          if (filters.companyId) q = q.eq('company_id', filters.companyId);
          if (filters.stage) q = q.eq('stage', filters.stage);
          if (filters.lostReason) q = q.eq('lost_reason', filters.lostReason);
          if (filters.sellerId) {
            // owner_id is user_id; deals are owned by users — map sales_rep_id -> user_id
            const { data: link } = await supabase
              .from('user_sales_reps')
              .select('user_id')
              .eq('sales_rep_id', filters.sellerId);
            const uids = (link ?? []).map((r: any) => r.user_id);
            if (uids.length) q = q.in('owner_id', uids);
            else q = q.eq('owner_id', '00000000-0000-0000-0000-000000000000');
          }
          const { data, error: e } = await q;
          if (e) throw e;
          if (cancelled) return;
          const all = (data ?? []) as any[];
          const sliced = all.slice(0, MAX_ROWS);
          setDealRows(
            sliced.map((d) => ({
              id: d.id,
              name: d.name,
              stage: d.stage,
              value: Number(d.value || 0),
              created_at: d.created_at,
              closed_at: d.closed_at,
              company: d.companies?.trade_name || d.companies?.name || null,
              lost_reason: d.lost_reason,
            }))
          );
          setTruncated(all.length > MAX_ROWS);
        } else {
          let q = supabase
            .from('bi_sales_fact')
            .select('order_id, net_value, order_date, sales_rep_id, legal_entity_id, company_id, product_id, order_status')
            .gte('order_date', toISODate(filters.startDate))
            .lte('order_date', toISODate(filters.endDate))
            .neq('order_status', 'cancelled')
            .limit(MAX_ROWS * 10);
          if (filters.legalEntityId) q = q.eq('legal_entity_id', filters.legalEntityId);
          if (filters.sellerId) q = q.eq('sales_rep_id', filters.sellerId);
          if (filters.companyId) q = q.eq('company_id', filters.companyId);
          if (filters.productId) q = q.eq('product_id', filters.productId);

          const { data: factData, error: e } = await q;
          if (e) throw e;
          if (cancelled) return;

          // Aggregate net_value by order_id
          const totalsByOrder = new Map<string, number>();
          (factData ?? []).forEach((row: any) => {
            if (!row.order_id) return;
            totalsByOrder.set(row.order_id, (totalsByOrder.get(row.order_id) ?? 0) + Number(row.net_value || 0));
          });

          const orderIds = Array.from(totalsByOrder.keys());
          if (orderIds.length === 0) {
            setOrderRows([]);
            setTruncated(false);
          } else {
            const { data: ordersData, error: oe } = await supabase
              .from('orders')
              .select(`id, number, status, order_date, company_id, sales_rep_id, legal_entity_id,
                companies(name),
                sales_reps(name),
                legal_entities(name)`)
              .in('id', orderIds);
            if (oe) throw oe;
            if (cancelled) return;

            const list: OrderRow[] = (ordersData ?? []).map((o: any) => ({
              id: o.id,
              number: o.number,
              date: o.order_date,
              status: o.status,
              company: o.companies?.trade_name || o.companies?.name || null,
              seller: o.sales_reps?.name || null,
              entity: o.legal_entities?.name || null,
              value: totalsByOrder.get(o.id) ?? 0,
            })).sort((a, b) => {
              const da = a.date ? Date.parse(a.date) : 0;
              const db = b.date ? Date.parse(b.date) : 0;
              return db - da;
            });
            setOrderRows(list.slice(0, MAX_ROWS));
            setTruncated(list.length > MAX_ROWS);
          }

        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Falha ao carregar detalhes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, filters, source]);

  const totals = useMemo(() => {
    if (source === 'deals') {
      const total = dealRows.reduce((s, r) => s + r.value, 0);
      return { total, count: dealRows.length, ticket: dealRows.length ? total / dealRows.length : 0 };
    }
    const total = orderRows.reduce((s, r) => s + r.value, 0);
    return { total, count: orderRows.length, ticket: orderRows.length ? total / orderRows.length : 0 };
  }, [orderRows, dealRows, source]);

  const handleExport = () => {
    if (source === 'deals') {
      downloadCSV(
        `drilldown-negocios-${Date.now()}.csv`,
        ['ID', 'Negócio', 'Etapa', 'Empresa', 'Valor', 'Criado em', 'Fechado em', 'Motivo perda'],
        dealRows.map((r) => [
          r.id,
          r.name,
          r.stage,
          r.company ?? '',
          r.value.toFixed(2).replace('.', ','),
          fmtDate(r.created_at),
          fmtDate(r.closed_at),
          r.lost_reason ?? '',
        ])
      );
    } else {
      downloadCSV(
        `drilldown-pedidos-${Date.now()}.csv`,
        ['Nº Pedido', 'Data', 'Cliente', 'Vendedor', 'Entidade', 'Status', 'Valor'],
        orderRows.map((r) => [
          r.number ?? r.id,
          fmtDate(r.date),
          r.company ?? '',
          r.seller ?? '',
          r.entity ?? '',
          r.status ?? '',
          r.value.toFixed(2).replace('.', ','),
        ])
      );
    }
  };

  const openOrder = (id: string) => {
    window.open(`/orders?id=${id}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          {subtitle && <DialogDescription className="text-xs">{subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 border-y py-3">
          <div className="flex gap-6 text-sm">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Total</div>
              <div className="font-semibold tabular-nums">{fmtBRL(totals.total)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">{source === 'deals' ? 'Negócios' : 'Pedidos'}</div>
              <div className="font-semibold tabular-nums">{fmtNum(totals.count)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Ticket médio</div>
              <div className="font-semibold tabular-nums">{fmtBRL(totals.ticket)}</div>
            </div>
            {truncated && (
              <Badge variant="outline" className="self-center text-[10px]">
                Amostra: primeiros {MAX_ROWS} registros
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading || (source === 'deals' ? dealRows.length === 0 : orderRows.length === 0)}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar CSV
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <div className="text-sm">Não foi possível carregar os detalhes.</div>
              <div className="text-xs text-muted-foreground">{error}</div>
            </div>
          ) : (source === 'deals' ? dealRows.length === 0 : orderRows.length === 0) ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Inbox className="h-6 w-6" />
              <div className="text-sm">Nenhum registro encontrado para os filtros aplicados.</div>
            </div>
          ) : source === 'deals' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealRows.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => window.open(`/pipeline?dealId=${d.id}`, '_blank')}>
                    <TableCell className="font-medium text-xs">{d.name}</TableCell>
                    <TableCell className="text-xs">{d.company ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px]">{d.stage}</Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{fmtDate(d.created_at)}</TableCell>
                    <TableCell className="text-xs tabular-nums text-right font-semibold">{fmtBRL(d.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderRows.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => openOrder(o.id)}>
                    <TableCell className="font-medium tabular-nums text-xs">{o.number ?? '—'}</TableCell>
                    <TableCell className="text-xs tabular-nums">{fmtDate(o.date)}</TableCell>
                    <TableCell className="text-xs">{o.company ?? '—'}</TableCell>
                    <TableCell className="text-xs">{o.seller ?? '—'}</TableCell>
                    <TableCell className="text-xs">{o.entity ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px]">{o.status ?? '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-right font-semibold">{fmtBRL(o.value)}</TableCell>
                    <TableCell><ExternalLink className="h-3 w-3 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
