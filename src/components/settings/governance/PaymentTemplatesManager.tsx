import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { usePaymentTemplates, usePaymentTemplateItems } from '@/hooks/useCommercialGovernance';

interface TplForm {
  id?: string;
  name: string;
  rank: number;
  is_active: boolean;
}

interface ItemRow {
  parcela: number;
  dias: number;
  payment_method_default?: string;
  tipo: 'V' | 'P';
  percentual?: number | null;
}

const emptyTpl: TplForm = { name: '', rank: 0, is_active: true };

export function PaymentTemplatesManager() {
  const { templates, isLoading, upsert, remove } = usePaymentTemplates();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TplForm>(emptyTpl);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const { items: dbItems, replaceAll } = usePaymentTemplateItems(editingId);

  useEffect(() => {
    if (dbItems.length) {
      setItems(dbItems.map((i: any, idx) => ({
        parcela: idx + 1, dias: i.dias, payment_method_default: i.payment_method_default || '',
        tipo: i.tipo, percentual: i.percentual,
      })));
    }
  }, [dbItems]);

  const openNew = () => { setForm(emptyTpl); setItems([]); setEditingId(null); setOpen(true); };
  const openEdit = (t: any) => {
    setForm({ id: t.id, name: t.name, rank: t.rank, is_active: t.is_active });
    setEditingId(t.id); setOpen(true);
  };

  const addItem = () => setItems([...items, { parcela: items.length + 1, dias: 0, tipo: 'P', percentual: null }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx).map((x, i) => ({ ...x, parcela: i + 1 })));
  const updateItem = (idx: number, patch: Partial<ItemRow>) =>
    setItems(items.map((x, i) => i === idx ? { ...x, ...patch } : x));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const saved: any = await upsert.mutateAsync(form);
    const id = form.id || saved?.id;
    // Após criar/editar template, persistir itens se já temos id (edit)
    if (editingId) {
      await replaceAll.mutateAsync(items);
    }
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Templates de Pagamento</CardTitle>
          <CardDescription>
            Cada template recebe um <code>rank</code> inteiro (admin define). Comparação é
            <code> escolhido.rank ≤ regra.max_template_rank</code>.
          </CardDescription>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo template</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum template.</TableCell></TableRow>
              )}
              {templates.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.rank}</TableCell>
                  <TableCell><Badge variant={t.is_active ? 'default' : 'secondary'}>{t.is_active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? 'Editar template' : 'Novo template'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: 28/35/42" />
              </div>
              <div className="space-y-1">
                <Label>Rank</Label>
                <Input type="number" min="0" value={form.rank} onChange={(e) => setForm({ ...form, rank: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativo</Label>
            </div>

            {editingId && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <Label>Parcelas</Label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
                </div>
                {items.length === 0 && <p className="text-sm text-muted-foreground">Sem parcelas. Adicione ao menos uma.</p>}
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-1 text-sm text-muted-foreground">#{it.parcela}</div>
                    <div className="col-span-3">
                      <Label className="text-xs">Dias</Label>
                      <Input type="number" min="0" value={it.dias} onChange={(e) => updateItem(idx, { dias: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Forma (default)</Label>
                      <Input value={it.payment_method_default || ''} onChange={(e) => updateItem(idx, { payment_method_default: e.target.value })} placeholder="Boleto" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={it.tipo} onValueChange={(v: any) => updateItem(idx, { tipo: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="P">% Percentual</SelectItem>
                          <SelectItem value="V">R$ Valor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">%</Label>
                      <Input type="number" step="0.001" disabled={it.tipo !== 'P'} value={it.percentual ?? ''}
                        onChange={(e) => updateItem(idx, { percentual: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <div className="col-span-1">
                      <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Tipo P sem % = rateio igual do saldo. Tipo V envia valor em R$ ao ERP.
                </p>
              </div>
            )}
            {!editingId && (
              <p className="text-xs text-muted-foreground border-t pt-3">
                Salve o template primeiro; em seguida reabra para configurar as parcelas.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
