import { useState } from 'react';
import { Warehouse, History, PackagePlus, Filter } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  useStockList,
  useStockHistory,
  useMoveStock,
  useLegalEntitiesForStock,
  useProductsForStock,
  type StockFilters,
  type HistoryFilters,
} from '@/hooks/useStock';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

// ── Status helpers ─────────────────────────────────────────────────────
function getStockStatus(qtd: number, min: number | null) {
  if (qtd === 0) return 'zerado';
  if (min != null && qtd <= min) return 'baixo';
  return 'normal';
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    normal: { label: 'Normal', variant: 'default' },
    baixo: { label: 'Baixo', variant: 'secondary' },
    zerado: { label: 'Zerado', variant: 'destructive' },
  };
  const cfg = map[status] || map.normal;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function TipoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    entrada: { label: 'Entrada', variant: 'default' },
    saida: { label: 'Saída', variant: 'destructive' },
    ajuste: { label: 'Ajuste', variant: 'secondary' },
  };
  const cfg = map[tipo] || { label: tipo, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ── Tab: Estoque Atual ─────────────────────────────────────────────────
function StockCurrentTab() {
  const [filters, setFilters] = useState<StockFilters>({ status: 'all' });
  const { data: companies } = useLegalEntitiesForStock();
  const { data: stock, isLoading } = useStockList(filters);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-48">
          <Label className="text-xs">Empresa</Label>
          <SearchableSelect
            options={[
              { value: 'all', label: 'Todas' },
              ...(companies || []).map(c => ({ value: c.id, label: c.name })),
            ]}
            value={filters.company_id || 'all'}
            onChange={(v) => setFilters((f) => ({ ...f, company_id: v === 'all' || !v ? undefined : v }))}
            placeholder="Todas"
            searchPlaceholder="Buscar empresa..."
            allowClear={false}
          />
        </div>
        <div className="w-48">
          <Label className="text-xs">Produto</Label>
          <Input placeholder="Buscar..." value={filters.product_search || ''} onChange={(e) => setFilters((f) => ({ ...f, product_search: e.target.value }))} />
        </div>
        <div className="w-40">
          <Label className="text-xs">Status</Label>
          <Select value={filters.status || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as any }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="baixo">Baixo</SelectItem>
              <SelectItem value="zerado">Zerado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !stock?.length ? (
        <p className="text-center py-12 text-muted-foreground">Nenhum registro de estoque encontrado.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Qtd Atual</TableHead>
                <TableHead className="text-right">Mín</TableHead>
                <TableHead className="text-right">Máx</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.product_name}</div>
                    {s.product_sku && <span className="text-xs text-muted-foreground">{s.product_sku}</span>}
                  </TableCell>
                  <TableCell>{s.company_name}</TableCell>
                  <TableCell className="text-right font-mono">{Number(s.quantidade_atual).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{s.estoque_minimo != null ? Number(s.estoque_minimo).toLocaleString('pt-BR') : '-'}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{s.estoque_maximo != null ? Number(s.estoque_maximo).toLocaleString('pt-BR') : '-'}</TableCell>
                  <TableCell><StatusBadge status={getStockStatus(Number(s.quantidade_atual), s.estoque_minimo ? Number(s.estoque_minimo) : null)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Movimentar ────────────────────────────────────────────────────
function StockMoveTab() {
  const { data: companies } = useLegalEntitiesForStock();
  const { data: products } = useProductsForStock();
  const moveStock = useMoveStock();

  const [companyId, setCompanyId] = useState('');
  const [productId, setProductId] = useState('');
  const [tipo, setTipo] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');

  const handleSubmit = () => {
    if (!companyId || !productId || !quantidade || !motivo) return;
    moveStock.mutate(
      { product_id: productId, company_id: companyId, tipo, quantidade: parseFloat(quantidade), motivo },
      {
        onSuccess: () => {
          setQuantidade('');
          setMotivo('');
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Nova Movimentação</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div>
          <Label>Empresa *</Label>
          <SearchableSelect
            options={(companies || []).map(c => ({ value: c.id, label: c.name }))}
            value={companyId || null}
            onChange={(v) => setCompanyId(v || '')}
            placeholder="Selecione..."
            searchPlaceholder="Buscar empresa..."
            allowClear={false}
          />
        </div>
        <div>
          <Label>Produto *</Label>
          <SearchableSelect
            options={(products || []).map(p => ({ value: p.id, label: `${p.sku ? `${p.sku} - ` : ''}${p.name}` }))}
            value={productId || null}
            onChange={(v) => setProductId(v || '')}
            placeholder="Selecione..."
            searchPlaceholder="Buscar produto..."
            allowClear={false}
          />
        </div>
        <div>
          <Label>Tipo *</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="ajuste">Ajuste (definir saldo)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Quantidade *</Label>
          <Input type="number" min="0.0001" step="0.0001" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <Label>Motivo *</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo da movimentação..." />
        </div>
        <Button onClick={handleSubmit} disabled={moveStock.isPending || !companyId || !productId || !quantidade || !motivo}>
          {moveStock.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackagePlus className="h-4 w-4 mr-2" />}
          Registrar Movimentação
        </Button>
      </CardContent>
    </Card>
  );
}



// ── Tab: Histórico ─────────────────────────────────────────────────────
function StockHistoryTab() {
  const [filters, setFilters] = useState<HistoryFilters>({});
  const { data: companies } = useLegalEntitiesForStock();
  const { data: products } = useProductsForStock();
  const { data: history, isLoading } = useStockHistory(filters);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-44">
          <Label className="text-xs">Empresa</Label>
          <SearchableSelect
            options={[
              { value: 'all', label: 'Todas' },
              ...(companies || []).map(c => ({ value: c.id, label: c.name })),
            ]}
            value={filters.company_id || 'all'}
            onChange={(v) => setFilters((f) => ({ ...f, company_id: v === 'all' || !v ? undefined : v }))}
            placeholder="Todas"
            searchPlaceholder="Buscar empresa..."
            allowClear={false}
          />
        </div>
        <div className="w-44">
          <Label className="text-xs">Produto</Label>
          <SearchableSelect
            options={[
              { value: 'all', label: 'Todos' },
              ...(products || []).map(p => ({ value: p.id, label: p.name })),
            ]}
            value={filters.product_id || 'all'}
            onChange={(v) => setFilters((f) => ({ ...f, product_id: v === 'all' || !v ? undefined : v }))}
            placeholder="Todos"
            searchPlaceholder="Buscar produto..."
            allowClear={false}
          />
        </div>
        <div className="w-36">
          <Label className="text-xs">Tipo</Label>
          <Select value={filters.tipo || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, tipo: v === 'all' ? undefined : v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="ajuste">Ajuste</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Label className="text-xs">De</Label>
          <Input type="date" value={filters.date_from || ''} onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value || undefined }))} />
        </div>
        <div className="w-40">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={filters.date_to || ''} onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value || undefined }))} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !history?.length ? (
        <p className="text-center py-12 text-muted-foreground">Nenhuma movimentação encontrada.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Usuário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-sm">{format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>
                    <div className="font-medium">{m.product_name}</div>
                    {m.product_sku && <span className="text-xs text-muted-foreground">{m.product_sku}</span>}
                  </TableCell>
                  <TableCell>{m.company_name}</TableCell>
                  <TableCell>
                    <TipoBadge tipo={m.tipo} />
                    {m.referencia_tipo === 'transferencia' && (
                      <span className="ml-1 text-xs text-muted-foreground">(transf.)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">{Number(m.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">{m.motivo || '-'}</TableCell>
                  <TableCell className="text-sm">{m.usuario_name || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────
export default function Stock() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Warehouse className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
          <p className="text-sm text-muted-foreground">Controle de saldo por produto e empresa</p>
        </div>
      </div>

      <Tabs defaultValue="atual" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="atual">Estoque Atual</TabsTrigger>
          <TabsTrigger value="movimentar">Movimentar</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="atual"><StockCurrentTab /></TabsContent>
        <TabsContent value="movimentar"><StockMoveTab /></TabsContent>
        <TabsContent value="historico"><StockHistoryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
