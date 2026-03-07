import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';
import { ReallocationFilters as FiltersType } from '@/hooks/usePortfolioReallocation';

interface ReallocationFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  onClear: () => void;
  availableStates: string[];
  availableRegions: string[];
  sellers: { id: string; name: string; role: string }[];
}

export function ReallocationFilters({
  filters,
  onFiltersChange,
  onClear,
  availableStates,
  availableRegions,
  sellers
}: ReallocationFiltersProps) {
  const hasFilters = Object.keys(filters).some(k => {
    const val = filters[k as keyof FiltersType];
    if (Array.isArray(val)) return val.length > 0;
    return val !== undefined && val !== null && val !== '';
  });

  const updateFilter = (key: keyof FiltersType, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Filtros de Seleção</h3>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Busca por nome/CNPJ */}
        <div className="space-y-2">
          <Label>Buscar cliente</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou CNPJ..."
              value={filters.search || ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Filtro por UF */}
        <div className="space-y-2">
          <Label>Estado (UF)</Label>
          <Select
            value={filters.states?.[0] || 'all'}
            onValueChange={(value) => updateFilter('states', value === 'all' ? [] : [value])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {availableStates?.map(state => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por Região */}
        <div className="space-y-2">
          <Label>Região Comercial</Label>
          <Select
            value={filters.regions?.[0] || 'all'}
            onValueChange={(value) => updateFilter('regions', value === 'all' ? [] : [value])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as regiões" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regiões</SelectItem>
              {availableRegions?.map(region => (
                <SelectItem key={region} value={region}>{region}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por Vendedor Atual */}
        <div className="space-y-2">
          <Label>Vendedor Atual</Label>
          <Select
            value={filters.noOwner ? '__none__' : (filters.salesRepId || 'all')}
            onValueChange={(value) => {
              if (value === '__none__') {
                onFiltersChange({ ...filters, noOwner: true, salesRepId: undefined, ownerId: undefined });
              } else if (value === 'all') {
                onFiltersChange({ ...filters, noOwner: undefined, salesRepId: undefined, ownerId: undefined });
              } else {
                onFiltersChange({ ...filters, noOwner: undefined, salesRepId: value, ownerId: undefined });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              <SelectItem value="__none__" className="text-warning font-medium">
                Sem vendedor (não atribuído)
              </SelectItem>
              {sellers?.map(seller => (
                <SelectItem key={seller.id} value={seller.id}>
                  {seller.name} ({seller.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dias sem atendimento */}
        <div className="space-y-2">
          <Label>Dias sem atendimento (mín.)</Label>
          <Input
            type="number"
            placeholder="Ex: 30"
            min={0}
            value={filters.minDaysNoInteraction || ''}
            onChange={(e) => updateFilter('minDaysNoInteraction', e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>

        {/* Dias sem venda */}
        <div className="space-y-2">
          <Label>Dias sem venda (mín.)</Label>
          <Input
            type="number"
            placeholder="Ex: 90"
            min={0}
            value={filters.minDaysNoOrder || ''}
            onChange={(e) => updateFilter('minDaysNoOrder', e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>
      </div>

      {hasFilters && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
          <span>Filtros ativos:</span>
          {filters.states?.length ? (
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
              UF: {filters.states.join(', ')}
            </span>
          ) : null}
          {filters.regions?.length ? (
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
              Região: {filters.regions.join(', ')}
            </span>
          ) : null}
          {filters.noOwner ? (
            <span className="bg-warning/10 text-warning px-2 py-0.5 rounded">
              Sem vendedor
            </span>
          ) : filters.salesRepId ? (
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
              Vendedor: {sellers?.find(s => s.id === filters.salesRepId)?.name}
            </span>
          ) : null}
          {filters.minDaysNoInteraction ? (
            <span className="bg-warning/10 text-warning px-2 py-0.5 rounded">
              Sem atendimento: ≥{filters.minDaysNoInteraction} dias
            </span>
          ) : null}
          {filters.minDaysNoOrder ? (
            <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded">
              Sem venda: ≥{filters.minDaysNoOrder} dias
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
