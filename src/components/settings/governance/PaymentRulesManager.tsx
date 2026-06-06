import { useState } from 'react';
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
import { usePaymentRules, usePaymentTemplates } from '@/hooks/useCommercialGovernance';

interface Form {
  id?: string;
  name: string;
  level: 1 | 2 | 3 | 4;
  priority: number;
  is_active: boolean;
  amount_min: number;
  amount_max: number | null;
  company_id?: string | null;
  economic_group_id?: string | null;
  sales_rep_id?: string | null;
  default_template_id: string;
  max_template_rank: number;
}

const empty: Form = {
  name: '', level: 4, priority: 0, is_active: true,
  amount_min: 0, amount_max: null,
  default_template_id: '', max_template_rank: 0,
};

const LEVEL_LABEL: Record<number, string> = {
  1: '1 — Cliente + Faixa',
  2: '2 — Grupo Econômico + Faixa',
  3: '3 — Vendedor + Faixa',
  4: '4 — Geral + Faixa',
};

export function PaymentRulesManager() {
  const { rules, isLoading, upsert, remove } = usePaymentRules();
  const { templates } = usePaymentTemplates();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (r: any) => {
    setForm({
      id: r.id, name: r.name, level: r.level, priority: r.priority, is_active: r.is_active,
      amount_min: Number(r.amount_min), amount_max: r.amount_max != null ? Number(r.amount_max) : null,
      company_id: r.company_id, economic_group_id: r.economic_group_id, sales_rep_id: r.sales_rep_id,
      default_template_id: r.default_template_id, max_template_rank: r.max_template_rank,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.default_template_id) return;
    const payload = { ...form, amount_max: form.amount_max ?? null };
    await upsert.mutateAsync(payload);
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Regras de Condição de Pagamento</CardTitle>
          <CardDescription>
            Hierarquia: 1=Cliente, 2=Grupo Econômico, 3=Vendedor, 4=Geral. Sempre combinada com faixa de valor.
          </CardDescription>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova regra</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nível</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Faixa</TableHead>
                <TableHead>Template Default</TableHead>
                <TableHead>Max Rank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma regra.</TableCell></TableRow>
              )}
              {rules.map((r: any) => {
                const tpl = templates.find((t: any) => t.id === r.default_template_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{LEVEL_LABEL[r.level]}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      R$ {Number(r.amount_min).toLocaleString('pt-BR')} – {r.amount_max ? `R$ ${Number(r.amount_max).toLocaleString('pt-BR')}` : '∞'}
                    </TableCell>
                    <TableCell>{tpl?.name || '—'}</TableCell>
                    <TableCell>{r.max_template_rank}</TableCell>
                    <TableCell><Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? 'Editar regra' : 'Nova regra de pagamento'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nível</Label>
                <Select value={String(form.level)} onValueChange={(v) => setForm({ ...form, level: Number(v) as 1|2|3|4 })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4].map(l => <SelectItem key={l} value={String(l)}>{LEVEL_LABEL[l]}</SelectItem>)}
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
                <Label>Valor mínimo (R$)</Label>
                <Input type="number" step="0.01" value={form.amount_min} onChange={(e) => setForm({ ...form, amount_min: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Valor máximo (R$)</Label>
                <Input type="number" step="0.01" value={form.amount_max ?? ''}
                  onChange={(e) => setForm({ ...form, amount_max: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="∞" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Template Default</Label>
                <Select value={form.default_template_id} onValueChange={(v) => setForm({ ...form, default_template_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {templates.filter((t: any) => t.is_active).map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} (rank {t.rank})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Max Template Rank</Label>
                <Input type="number" min="0" value={form.max_template_rank}
                  onChange={(e) => setForm({ ...form, max_template_rank: Number(e.target.value) })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Para níveis 1/2/3 preencha respectivamente cliente / grupo econômico / vendedor (seletores serão habilitados em fase futura).
            </p>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || !form.default_template_id}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
