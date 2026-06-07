import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, Pencil, Trash2, Check, ChevronsUpDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePaymentRules, usePaymentTemplates } from '@/hooks/useCommercialGovernance';
import { useActiveTenantId } from '@/hooks/useActiveTenantId';
import { toast } from 'sonner';

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
  company_id: null, economic_group_id: null, sales_rep_id: null,
  default_template_id: '', max_template_rank: 0,
};

const LEVEL_LABEL: Record<number, string> = {
  1: '1 — Cliente + Faixa',
  2: '2 — Grupo Econômico + Faixa',
  3: '3 — Vendedor + Faixa',
  4: '4 — Geral + Faixa',
};

interface Option { value: string; label: string; hint?: string }

function ComboSelect({
  options, value, onChange, placeholder, emptyText, disabled,
}: {
  options: Option[];
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ''}`}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span>{o.label}</span>
                    {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PaymentRulesManager() {
  const { rules, isLoading, upsert, remove } = usePaymentRules();
  const { templates } = usePaymentTemplates();
  const { data: tenantId } = useActiveTenantId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const { data: companies = [] } = useQuery({
    queryKey: ['gov_companies', tenantId],
    enabled: !!tenantId && open && form.level === 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, cnpj')
        .eq('tenant_id', tenantId!)
        .order('name')
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ecoGroups = [] } = useQuery({
    queryKey: ['gov_eco_groups', tenantId],
    enabled: !!tenantId && open && form.level === 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('economic_groups')
        .select('id, name, cnpj_root')
        .eq('tenant_id', tenantId!)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: salesReps = [] } = useQuery({
    queryKey: ['gov_sales_reps', tenantId],
    enabled: !!tenantId && open && form.level === 3,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_reps')
        .select('id, name')
        .eq('tenant_id', tenantId!)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

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

  // Reset target IDs when level changes
  useEffect(() => {
    setForm((f) => ({
      ...f,
      company_id: f.level === 1 ? f.company_id : null,
      economic_group_id: f.level === 2 ? f.economic_group_id : null,
      sales_rep_id: f.level === 3 ? f.sales_rep_id : null,
    }));
  }, [form.level]);

  const targetError = useMemo(() => {
    if (form.level === 1 && !form.company_id) return 'Selecione o cliente.';
    if (form.level === 2 && !form.economic_group_id) return 'Selecione o grupo econômico.';
    if (form.level === 3 && !form.sales_rep_id) return 'Selecione o vendedor.';
    return null;
  }, [form]);

  const canSave = !!form.name.trim() && !!form.default_template_id && !targetError;

  const handleSave = async () => {
    if (!canSave) {
      if (targetError) toast.error(targetError);
      return;
    }
    const payload = { ...form, amount_max: form.amount_max ?? null };
    try {
      await upsert.mutateAsync(payload);
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar regra');
    }
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

            {form.level === 1 && (
              <div className="space-y-1">
                <Label>Cliente *</Label>
                <ComboSelect
                  placeholder="Selecione o cliente"
                  emptyText="Nenhum cliente encontrado"
                  value={form.company_id}
                  onChange={(v) => setForm({ ...form, company_id: v })}
                  options={companies.map((c: any) => ({ value: c.id, label: c.name, hint: c.cnpj || undefined }))}
                />
              </div>
            )}
            {form.level === 2 && (
              <div className="space-y-1">
                <Label>Grupo Econômico *</Label>
                <ComboSelect
                  placeholder="Selecione o grupo"
                  emptyText="Nenhum grupo encontrado"
                  value={form.economic_group_id}
                  onChange={(v) => setForm({ ...form, economic_group_id: v })}
                  options={ecoGroups.map((g: any) => ({ value: g.id, label: g.name, hint: g.cnpj_root || undefined }))}
                />
              </div>
            )}
            {form.level === 3 && (
              <div className="space-y-1">
                <Label>Vendedor *</Label>
                <ComboSelect
                  placeholder="Selecione o vendedor"
                  emptyText="Nenhum vendedor encontrado"
                  value={form.sales_rep_id}
                  onChange={(v) => setForm({ ...form, sales_rep_id: v })}
                  options={salesReps.map((s: any) => ({ value: s.id, label: s.name }))}
                />
              </div>
            )}

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

            {targetError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {targetError}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!canSave || upsert.isPending}>
              {upsert.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
