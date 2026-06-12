import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Users, Building2, Package, ShoppingCart, Target, CheckSquare, BarChart3,
  Settings, Plug, Mail, Warehouse, Truck, SearchCheck, CalendarCheck, Brain,
  User, FileText, Search,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_NAV = [
  { label: 'Meu Dia', to: '/today', icon: CalendarCheck },
  { label: 'Pipeline', to: '/pipeline', icon: Target },
  { label: 'Clientes', to: '/customers', icon: Users },
  { label: 'Produtos', to: '/products', icon: Package },
  { label: 'Pedidos', to: '/orders', icon: ShoppingCart },
  { label: 'Estoque', to: '/stock', icon: Warehouse },
  { label: 'Transportadoras', to: '/carriers', icon: Truck },
  { label: 'Tarefas', to: '/tasks', icon: CheckSquare },
  { label: 'Emails', to: '/emails', icon: Mail },
  { label: 'Prospecção', to: '/prospecting', icon: SearchCheck },
  { label: 'Dashboard', to: '/reports', icon: BarChart3 },
  { label: 'Central de BI', to: '/bi', icon: Brain },
  { label: 'Integrações', to: '/integrations', icon: Plug },
  { label: 'Configurações', to: '/settings', icon: Settings },
];

type Hit = {
  id: string;
  kind: 'company' | 'contact' | 'deal' | 'order' | 'product' | 'user';
  title: string;
  subtitle?: string;
  to: string;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 220);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const pattern = `%${q}%`;
    try {
      const [companies, contacts, deals, orders, products, profiles] = await Promise.all([
        supabase.from('companies').select('id, name, city, cnpj').or(`name.ilike.${pattern},cnpj.ilike.${pattern}`).limit(5),
        supabase.from('contacts').select('id, first_name, last_name, email, company:companies(name)').or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`).limit(5),
        supabase.from('deals').select('id, name, value, company:companies(name)').ilike('name', pattern).limit(5),
        supabase.from('orders').select('id, number, total_value, company:companies(name)').or(`number.ilike.${pattern}`).limit(5),
        supabase.from('products').select('id, name, sku').or(`name.ilike.${pattern},sku.ilike.${pattern}`).limit(5),
        supabase.from('profiles').select('user_id, full_name, email').or(`full_name.ilike.${pattern},email.ilike.${pattern}`).limit(5),
      ]);

      const next: Hit[] = [];
      (companies.data || []).forEach((c: any) => next.push({ id: c.id, kind: 'company', title: c.name, subtitle: c.city || c.cnpj || undefined, to: `/customers/${c.id}` }));
      (contacts.data || []).forEach((c: any) => next.push({ id: c.id, kind: 'contact', title: `${c.first_name} ${c.last_name || ''}`.trim(), subtitle: c.company?.name || c.email || undefined, to: `/contacts?search=${encodeURIComponent(c.first_name)}` }));
      (deals.data || []).forEach((d: any) => next.push({ id: d.id, kind: 'deal', title: d.name, subtitle: d.company?.name || (d.value ? `R$ ${Number(d.value).toLocaleString('pt-BR')}` : undefined), to: `/pipeline?deal=${d.id}` }));
      (orders.data || []).forEach((o: any) => next.push({ id: o.id, kind: 'order', title: `Pedido #${o.number ?? o.id.slice(0, 8)}`, subtitle: o.company?.name || (o.total_value ? `R$ ${Number(o.total_value).toLocaleString('pt-BR')}` : undefined), to: `/orders?id=${o.id}` }));
      (products.data || []).forEach((p: any) => next.push({ id: p.id, kind: 'product', title: p.name, subtitle: p.sku || undefined, to: `/products?id=${p.id}` }));
      (profiles.data || []).forEach((u: any) => next.push({ id: u.user_id, kind: 'user', title: u.full_name || u.email, subtitle: u.email || undefined, to: `/settings?user=${u.user_id}` }));

      setHits(next);
    } catch (e) {
      console.error('CommandPalette search error', e);
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch(debounced.trim());
  }, [debounced, runSearch]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHits([]);
    }
  }, [open]);

  const grouped = useMemo(() => {
    const groups: Record<Hit['kind'], Hit[]> = {
      company: [], contact: [], deal: [], order: [], product: [], user: [],
    };
    hits.forEach(h => groups[h.kind].push(h));
    return groups;
  }, [hits]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const iconFor = (k: Hit['kind']) => {
    switch (k) {
      case 'company': return Building2;
      case 'contact': return User;
      case 'deal': return Target;
      case 'order': return ShoppingCart;
      case 'product': return Package;
      case 'user': return User;
      default: return FileText;
    }
  };

  const labelFor = (k: Hit['kind']) => ({
    company: 'Clientes', contact: 'Contatos', deal: 'Oportunidades',
    order: 'Pedidos', product: 'Produtos', user: 'Usuários',
  })[k];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar clientes, pedidos, produtos, contatos…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
            <Search className="h-3 w-3 animate-pulse" /> Buscando…
          </div>
        )}

        {!loading && query.length >= 2 && hits.length === 0 && (
          <CommandEmpty>Nada encontrado para "{query}"</CommandEmpty>
        )}

        {(['company', 'contact', 'deal', 'order', 'product', 'user'] as Hit['kind'][]).map(kind => {
          const items = grouped[kind];
          if (!items.length) return null;
          const Icon = iconFor(kind);
          return (
            <CommandGroup key={kind} heading={labelFor(kind)}>
              {items.map(h => (
                <CommandItem key={`${kind}-${h.id}`} value={`${labelFor(kind)} ${h.title} ${h.subtitle ?? ''}`} onSelect={() => go(h.to)}>
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm">{h.title}</span>
                    {h.subtitle && <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        {hits.length > 0 && <CommandSeparator />}

        <CommandGroup heading="Navegação rápida">
          {QUICK_NAV.map(item => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.to} value={`nav ${item.label}`} onSelect={() => go(item.to)}>
                <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
