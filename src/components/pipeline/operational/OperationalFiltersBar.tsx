import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Search, X, Flame, UserX, Lock, AlertTriangle } from 'lucide-react';
import { OPERATIONAL_PRIORITIES, PRIORITY_LABEL } from '@/lib/operationalConstants';
import type { OperationalFilters } from '@/hooks/useOperationalFilters';
import type { OperationalStage } from '@/hooks/useOperationalPipelines';
import { useTenantUsers } from '@/hooks/useTenantUsers';

interface Props {
  filters: OperationalFilters;
  update: <K extends keyof OperationalFilters>(k: K, v: OperationalFilters[K]) => void;
  reset: () => void;
  stages: OperationalStage[];
}

export function OperationalFiltersBar({ filters, update, reset, stages }: Props) {
  const { data: users = [] } = useTenantUsers();

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg border">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          placeholder="Buscar pedido, cliente, responsável…"
          className="h-8 pl-7 text-xs"
        />
      </div>

      <Select value={filters.ownerId ?? 'all'} onValueChange={(v) => update('ownerId', v === 'all' ? null : v)}>
        <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos responsáveis</SelectItem>
          {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.priority ?? 'all'} onValueChange={(v) => update('priority', v === 'all' ? null : v)}>
        <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas prioridades</SelectItem>
          {OPERATIONAL_PRIORITIES.map(p => (
            <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.stageId ?? 'all'} onValueChange={(v) => update('stageId', v === 'all' ? null : v)}>
        <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Etapa" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas etapas</SelectItem>
          {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Toggle
        pressed={filters.overdueOnly}
        onPressedChange={(v) => update('overdueOnly', v)}
        size="sm"
        className="h-8 text-xs gap-1"
      >
        <AlertTriangle className="h-3 w-3" /> Atrasados
      </Toggle>
      <Toggle
        pressed={filters.urgentOnly}
        onPressedChange={(v) => update('urgentOnly', v)}
        size="sm"
        className="h-8 text-xs gap-1"
      >
        <Flame className="h-3 w-3" /> Urgentes
      </Toggle>
      <Toggle
        pressed={filters.blockedOnly}
        onPressedChange={(v) => update('blockedOnly', v)}
        size="sm"
        className="h-8 text-xs gap-1"
      >
        <Lock className="h-3 w-3" /> Bloqueados
      </Toggle>
      <Toggle
        pressed={filters.withoutOwner}
        onPressedChange={(v) => update('withoutOwner', v)}
        size="sm"
        className="h-8 text-xs gap-1"
      >
        <UserX className="h-3 w-3" /> Sem responsável
      </Toggle>

      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={reset}>
        <X className="h-3 w-3 mr-1" /> Limpar
      </Button>
    </div>
  );
}
