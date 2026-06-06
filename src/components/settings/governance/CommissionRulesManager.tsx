import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useCommissionRules } from '@/hooks/useCommercialGovernance';
import { Badge } from '@/components/ui/badge';

interface Form {
  id?: string;
  name: string;
  is_active: boolean;
  priority: number;
  base: 'liquido' | 'bruto';
  default_pct: number;
  max_pct: number;
  sales_rep_id?: string | null;
  company_id?: string | null;
  product_id?: string | null;
}

const empty: Form = {
  name: '',
  is_active: true,
  priority: 0,
  base: 'liquido',
  default_pct: 0,
  max_pct: 0,
};

export function CommissionRulesManager() {
  const { rules, isLoading, upsert, remove } = useCommissionRules();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (r: any) => {
    setForm({
      id: r.id, name: r.name, is_active: r.is_active, priority: r.priority,
      base: r.base, default_pct: Number(r.default_pct), max_pct: Number(r.max_pct),
      sales_rep_id: r.sales_rep_id, company_id: r.company_id, product_id: r.product_id,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (form.max_pct < form.default_pct) return;
    await upsert.mutateAsync(form);
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Regras de Comissão</CardTitle>
          <CardDescription>
            Define `default_pct` (sugerido) e `max_pct` (teto) por hierarquia. Vendedor pode usar [0…max_pct] livre.
          </CardDescription>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova regra</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Default %</TableHead>
                <TableHead>Max %</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma regra cadastrada.</TableCell></TableRow>
              )}
              {rules.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.base}</TableCell>
                  <TableCell>{Number(r.default_pct).toFixed(2)}%</TableCell>
                  <TableCell>{Number(r.max_pct).toFixed(2)}%</TableCell>
                  <TableCell>{r.priority}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'Ativa' : 'Inativa'}</Badge>
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? 'Editar regra' : 'Nova regra de comissão'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Base</Label>
                <Select value={form.base} onValueChange={(v: any) => setForm({ ...form, base: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="liquido">Líquido (subtotal do item)</SelectItem>
                    <SelectItem value="bruto">Bruto (qtd × preço)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Default %</Label>
                <Input type="number" step="0.001" min="0" max="100" value={form.default_pct}
                  onChange={(e) => setForm({ ...form, default_pct: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Max %</Label>
                <Input type="number" step="0.001" min="0" max="100" value={form.max_pct}
                  onChange={(e) => setForm({ ...form, max_pct: Number(e.target.value) })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Escopo (vendedor/cliente/produto) pode ser refinado em fase futura via seletores; deixe vazio para regra geral do tenant.
            </p>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativa</Label>
            </div>
            {form.max_pct < form.default_pct && (
              <p className="text-sm text-destructive">Max % deve ser ≥ Default %.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || form.max_pct < form.default_pct}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
