import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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
  filterOwner: string;
  setFilterOwner: (value: string) => void;
  filterStage: string;
  setFilterStage: (value: string) => void;
  filterCompany: string;
  setFilterCompany: (value: string) => void;
  companies: { id: string; name: string }[] | undefined;
  hasActiveFilters: boolean;
}

export function PipelineFilters({
  filterOwner,
  setFilterOwner,
  filterStage,
  setFilterStage,
  filterCompany,
  setFilterCompany,
  companies,
  hasActiveFilters,
}: PipelineFiltersProps) {
  const clearFilters = () => {
    setFilterOwner('all');
    setFilterStage('all');
    setFilterCompany('all');
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtros:</span>
        
        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="mine">Meus negócios</SelectItem>
          </SelectContent>
        </Select>

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

        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            {companies?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
