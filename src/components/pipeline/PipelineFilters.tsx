import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, CalendarIcon } from 'lucide-react';
import type { PipelineOwnershipViewMode } from '@/hooks/usePipelineData';

type DealStage = 'prospeccao' | 'qualificacao' | 'proposta' | 'negociacao' | 'fechado_ganho' | 'fechado_perdido';

const stageConfig: Record<DealStage, { label: string }> = {
  prospeccao: { label: 'Prospecção' },
  qualificacao: { label: 'Qualificação' },
  proposta: { label: 'Proposta' },
  negociacao: { label: 'Negociação' },
  fechado_ganho: { label: 'Fechado (Ganho)' },
  fechado_perdido: { label: 'Fechado (Perdido)' },
};

const stages: DealStage[] = ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho', 'fechado_perdido'];

interface PipelineFiltersProps {
  ownershipViewMode: PipelineOwnershipViewMode;
  setOwnershipViewMode: (value: PipelineOwnershipViewMode) => void;
  filterOwner: string;
  setFilterOwner: (value: string) => void;
  filterStage: string;
  setFilterStage: (value: string) => void;
  filterCompany: string;
  setFilterCompany: (value: string) => void;
  filterDateFrom: string;
  setFilterDateFrom: (value: string) => void;
  filterDateTo: string;
  setFilterDateTo: (value: string) => void;
  companies: { id: string; name: string }[] | undefined;
  hasActiveFilters: boolean;
  isAdmin?: boolean;
  sellers?: { id: string; user_id: string; full_name: string; sales_rep_ids: string[] }[] | null;
  onCompanySearchChange?: (search: string) => void;
}

const buildCompanyOptions = (companies: { id: string; name: string }[] | undefined): SearchableSelectOption[] => [
  { value: 'all', label: 'Todas empresas' },
  ...(companies || []).map(c => ({ value: c.id, label: c.name })),
];

const buildSellerOptions = (sellers: { id: string; user_id: string; full_name: string; sales_rep_ids: string[] }[] | null | undefined): SearchableSelectOption[] => [
  { value: 'mine', label: 'Meus negócios' },
  { value: 'all', label: 'Todos' },
  ...(sellers || []).map(s => ({ value: s.user_id, label: s.full_name })),
];

export function PipelineFilters({
  ownershipViewMode,
  setOwnershipViewMode,
  filterOwner,
  setFilterOwner,
  filterStage,
  setFilterStage,
  filterCompany,
  setFilterCompany,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  companies,
  hasActiveFilters,
  isAdmin = false,
  sellers,
  onCompanySearchChange,
}: PipelineFiltersProps) {
  const clearFilters = () => {
    setOwnershipViewMode('historical');
    setFilterOwner('mine');
    setFilterStage('all');
    setFilterCompany('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasDateFilter = filterDateFrom || filterDateTo;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtros:</span>

        <Select value={ownershipViewMode} onValueChange={(value: PipelineOwnershipViewMode) => setOwnershipViewMode(value)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Modo de visão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="historical">Meus negócios</SelectItem>
            <SelectItem value="commercial">Carteira</SelectItem>
          </SelectContent>
        </Select>
        
        {isAdmin ? (
          <div className="w-[200px]">
            <SearchableSelect
              options={buildSellerOptions(sellers)}
              value={filterOwner}
              onChange={(v) => setFilterOwner(v || 'mine')}
              placeholder="Responsável"
              searchPlaceholder="Buscar vendedor..."
              allowClear={false}
            />
          </div>
        ) : (
          <span className="text-sm font-medium px-3 py-1.5 rounded-md bg-muted">
            {ownershipViewMode === 'commercial' ? 'Minha carteira' : 'Meus negócios'}
          </span>
        )}

        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas etapas</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s} value={s}>{stageConfig[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-[200px]">
            <SearchableSelect
              options={buildCompanyOptions(companies)}
              value={filterCompany}
              onChange={(v) => setFilterCompany(v || 'all')}
              placeholder="Empresa"
              searchPlaceholder="Buscar empresa..."
              allowClear={false}
              onSearchChange={onCompanySearchChange}
            />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={hasDateFilter ? "secondary" : "outline"} 
              size="sm" 
              className="gap-2 h-9"
            >
              <CalendarIcon className="h-4 w-4" />
              Período
              {hasDateFilter && <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5">1</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date-from">Data inicial</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to">Data final</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="h-9"
                />
              </div>
              {hasDateFilter && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                  className="w-full"
                >
                  Limpar período
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-9">
          <X className="h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
}
