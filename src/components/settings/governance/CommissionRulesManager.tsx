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
import { Plus, Pencil, Trash2, UserPlus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useCommissionRules } from '@/hooks/useCommercialGovernance';
import { useActiveTenantId } from '@/hooks/useActiveTenantId';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ComboSelect } from './_ComboSelect';

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
  product_group_id?: string | null;
  product_subgroup_id?: string | null;
}

const empty: Form = {
  name: '', is_active: true, priority: 0, base: 'liquido',
  default_pct: 0, max_pct: 0,
  sales_rep_id: null, company_id: null, product_id: null,
  product_group_id: null, product_subgroup_id: null,
};

export function CommissionRulesManager() {
  const { rules, isLoading, upsert, remove } = useCommissionRules();
  const { data: tenantId } = useActiveTenantId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [coverageOpen, setCoverageOpen] = useState(false);

  const { data: salesReps = [] } = useQuery({
    queryKey: ['gov_sales_reps_all', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_reps')
        .select('id, name, active')
        .eq('tenant_id', tenantId!)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['gov_companies', tenantId],
    enabled: !!tenantId && open,
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

  const { data: products = [] } = useQuery({
    queryKey: ['gov_products', tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku')
        .order('name')
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['gov_product_groups', tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_groups')
        .select('id, label, value')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .order('label');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: subgroups = [] } = useQuery({
    queryKey: ['gov_product_subgroups', tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_subgroups')
        .select('id, label, value')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .order('label');
      if (error) throw error;
      return data || [];
    },
  });

  const repsWithoutDefault = useMemo(() => {
    const repsWithDefault = new Set(
      (rules as any[])
        .filter((r) => r.is_active && r.sales_rep_id && !r.company_id && !r.product_id && !r.product_group_id && !r.product_subgroup_id && !r.economic_group_id)
        .map((r) => r.sales_rep_id),
    );
    return (salesReps as any[]).filter((s) => s.active && !repsWithDefault.has(s.id));
  }, [rules, salesReps]);

  const openNew = () => { setForm(empty); setOpen(true); };

  const openDefaultForRep = (repId?: string) => {
    const rep = (salesReps as any[]).find((s) => s.id === repId);
    setForm({
      ...empty,
      name: rep ? `Padrão ${rep.name}` : '',
      priority: 10,
      sales_rep_id: repId ?? null,
    });
    setOpen(true);
  };

  const openEdit = (r: any) => {
    setForm({
      id: r.id, name: r.name, is_active: r.is_active, priority: r.priority,
      base: r.base, default_pct: Number(r.default_pct), max_pct: Number(r.max_pct),
      sales_rep_id: r.sales_rep_id, company_id: r.company_id, product_id: r.product_id,
      product_group_id: r.product_group_id, product_subgroup_id: r.product_subgroup_id,
    });
    setOpen(true);
  };

  // Detect potential duplicate level-5 active rule for same sales_rep
  const duplicateRepDefaultWarning = useMemo(() => {
    if (!form.sales_rep_id || form.company_id || form.product_id || form.product_group_id || form.product_subgroup_id) return null;
    if (!form.is_active) return null;
    const dup = (rules as any[]).find((r) =>
      r.is_active &&
      r.sales_rep_id === form.sales_rep_id &&
      !r.company_id && !r.product_id && !r.product_group_id && !r.product_subgroup_id && !r.economic_group_id &&
      r.id !== form.id,
    );
    return dup ? `Já existe uma regra padrão ativa para este vendedor ("${dup.name}").` : null;
  }, [form, rules]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (form.max_pct < form.default_pct) return;
    try {
      await upsert.mutateAsync(form);
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar regra');
    }
  };

  const scopeChips = (r: any) => {
    const chips: string[] = [];
    if (r.sales_rep_id) chips.push(`Vendedor: ${(salesReps as any[]).find((s) => s.id === r.sales_rep_id)?.name || '—'}`);
    if (r.company_id) chips.push('Cliente');
    if (r.product_id) chips.push('Produto');
    if (r.product_group_id) chips.push('Grupo');
    if (r.product_subgroup_id) chips.push('Subgrupo');
    if (chips.length === 0) return <Badge variant="secondary">Geral</Badge>;
    return (
      <div className="flex flex-wrap gap-1">
        {chips.map((c, i) => <Badge key={i} variant="outline" className="text-xs">{c}</Badge>)}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Regras de Comissão</CardTitle>
          <CardDescription>
            Define <code>default_pct</code> (sugerido) e <code>max_pct</code> (teto) por hierarquia. Vendedor pode usar [0…max_pct] livre. Mais específico vence.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openDefaultForRep()}>
            <UserPlus className="h-4 w-4 mr-2" />Padrão por vendedor
          </Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova regra</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {repsWithoutDefault.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-medium"
              onClick={() => setCoverageOpen((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {repsWithoutDefault.length} vendedor{repsWithoutDefault.length > 1 ? 'es' : ''} sem regra padrão ativa
              </span>
              {coverageOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {coverageOpen && (
              <div className="mt-3 flex flex-wrap gap-2">
                {repsWithoutDefault.map((s: any) => (
                  <Button
                    key={s.id}
                    size="sm"
                    variant="outline"
                    onClick={() => openDefaultForRep(s.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />{s.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Default %</TableHead>
                <TableHead>Max %</TableHead>
                <TableHead>Prio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma regra cadastrada.</TableCell></TableRow>
              )}
              {(rules as any[]).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{scopeChips(r)}</TableCell>
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
        <DialogContent className="max-w-2xl">
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

            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Escopo (todos opcionais — vazio = regra geral do tenant)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Vendedor</Label>
                  <ComboSelect
                    placeholder="Qualquer vendedor"
                    value={form.sales_rep_id}
                    onChange={(v) => setForm({ ...form, sales_rep_id: v })}
                    options={(salesReps as any[]).map((s) => ({ value: s.id, label: s.name }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cliente</Label>
                  <ComboSelect
                    placeholder="Qualquer cliente"
                    value={form.company_id}
                    onChange={(v) => setForm({ ...form, company_id: v })}
                    options={(companies as any[]).map((c) => ({ value: c.id, label: c.name, hint: c.cnpj || undefined }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Produto</Label>
                  <ComboSelect
                    placeholder="Qualquer produto"
                    value={form.product_id}
                    onChange={(v) => setForm({ ...form, product_id: v })}
                    options={(products as any[]).map((p) => ({ value: p.id, label: p.name, hint: p.sku || undefined }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Grupo de produto</Label>
                  <ComboSelect
                    placeholder="Qualquer grupo"
                    value={form.product_group_id}
                    onChange={(v) => setForm({ ...form, product_group_id: v })}
                    options={(groups as any[]).map((g) => ({ value: g.id, label: g.label }))}
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Subgrupo de produto</Label>
                  <ComboSelect
                    placeholder="Qualquer subgrupo"
                    value={form.product_subgroup_id}
                    onChange={(v) => setForm({ ...form, product_subgroup_id: v })}
                    options={(subgroups as any[]).map((g) => ({ value: g.id, label: g.label }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativa</Label>
            </div>
            {form.max_pct < form.default_pct && (
              <p className="text-sm text-destructive">Max % deve ser ≥ Default %.</p>
            )}
            {duplicateRepDefaultWarning && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                <span>{duplicateRepDefaultWarning}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || form.max_pct < form.default_pct || upsert.isPending}
            >
              {upsert.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
