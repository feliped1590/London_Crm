import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subDays } from 'date-fns';
import { Brain, Star, StarOff, ChevronRight, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BIFiltersBar } from '@/components/reports/bi/BIFiltersBar';
import { ReportRenderer } from '@/components/bi/ReportRenderer';
import { ForecastRenderer } from '@/components/bi/renderers/ForecastRenderer';
import { MetasRenderer } from '@/components/bi/renderers/MetasRenderer';
import { AbcRenderer } from '@/components/bi/renderers/AbcRenderer';
import { ConversaoRenderer } from '@/components/bi/renderers/ConversaoRenderer';
import { PipelineComercialRenderer } from '@/components/bi/renderers/PipelineComercialRenderer';
import { RankingsRenderer } from '@/components/bi/renderers/RankingsRenderer';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { CommercialExecutiveReport } from '@/components/bi/composite/CommercialExecutiveReport';
import { Seller360Report } from '@/components/bi/composite/Seller360Report';
import { ExecutiveExportButton } from '@/components/bi/composite/ExecutiveExportButton';
import {
  ExecutiveFiltersBar,
  ExecutiveFilters,
} from '@/components/bi/composite/ExecutiveFiltersBar';
import {
  useReportDefinitions,
  useBIReport,
  useBIFavorites,
  ReportCode,
  ReportDefinition,
  BIReportFilters,
  isCompositeReport,
} from '@/hooks/useBIReports';

const CATEGORY_LABELS: Record<string, string> = {
  executivo: 'Relatórios Executivos',
  comercial: 'Comercial',
  funil: 'Funil',
  metas: 'Metas',
  produtos: 'Produtos & Faturamento',
  rankings: 'Rankings',
  clientes: 'Clientes',
  forecast: 'Forecast',
  favoritos: 'Favoritos',
};

const CATEGORY_ORDER = [
  'favoritos',
  'executivo',
  'comercial',
  'funil',
  'metas',
  'produtos',
  'rankings',
  'clientes',
  'forecast',
];

export default function BICenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: definitions, isLoading: loadingDefs } = useReportDefinitions();
  const { favorites, toggle: toggleFav } = useBIFavorites();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<BIReportFilters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });

  const [execFilters, setExecFilters] = useState<ExecutiveFilters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    legalEntityId: undefined,
    sellerId: null,
  });

  // Status agregado dos relatórios executivos (alimenta botão "Exportar PDF")
  const [execStatus, setExecStatus] = useState<{ isLoading: boolean; isEmpty: boolean }>({
    isLoading: true,
    isEmpty: false,
  });

  const activeCode = (searchParams.get('r') as ReportCode | null) || 'dashboard_executivo';

  // Ao trocar de relatório composto, reseta status para "carregando" até o filho reportar.
  useEffect(() => {
    setExecStatus({ isLoading: true, isEmpty: false });
  }, [activeCode]);

  const setActive = (code: ReportCode) => {
    const sp = new URLSearchParams(searchParams);
    sp.set('r', code);
    setSearchParams(sp, { replace: true });
  };

  const active: ReportDefinition | undefined = useMemo(
    () => definitions?.find((d) => d.code === activeCode),
    [definitions, activeCode]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ReportDefinition[]>();
    (definitions || []).forEach((d) => {
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return;
      if (!map.has(d.category)) map.set(d.category, []);
      map.get(d.category)!.push(d);
    });
    const favList = (definitions || []).filter((d) => favorites.has(d.id));
    if (favList.length > 0) map.set('favoritos', favList);
    return Array.from(map.entries()).sort(
      ([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
    );
  }, [definitions, favorites, search]);

  const composite = isCompositeReport(activeCode);
  const report = useBIReport(active?.code ?? null, filters);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)]">
      <aside className="lg:w-72 lg:shrink-0 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Central de BI</h1>
        </div>
        <Input
          placeholder="Buscar relatório…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
        {loadingDefs ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <nav className="space-y-4">
            {grouped.map(([cat, reports]) => (
              <div key={cat}>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1 flex items-center gap-1">
                  {cat === 'executivo' && <Sparkles className="h-3 w-3 text-primary" />}
                  {CATEGORY_LABELS[cat] || cat}
                </div>
                <ul className="space-y-0.5">
                  {reports.map((r) => {
                    const isActive = r.code === activeCode;
                    const isFav = favorites.has(r.id);
                    const isComp = isCompositeReport(r.code as ReportCode);
                    return (
                      <li key={r.id}>
                        <button
                          onClick={() => setActive(r.code as ReportCode)}
                          className={cn(
                            'group w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors',
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'hover:bg-accent text-foreground'
                          )}
                        >
                          <ChevronRight
                            className={cn(
                              'h-3 w-3 shrink-0 transition-transform',
                              isActive && 'rotate-90'
                            )}
                          />
                          <span className="flex-1 truncate">{r.name}</span>
                          {isComp && (
                            <Badge variant="secondary" className="h-4 text-[9px] px-1">
                              360
                            </Badge>
                          )}
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFav(r.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 data-[fav=true]:opacity-100 text-muted-foreground hover:text-primary"
                            data-fav={isFav}
                          >
                            {isFav ? (
                              <Star className="h-3.5 w-3.5 fill-current" />
                            ) : (
                              <StarOff className="h-3.5 w-3.5" />
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </aside>

      <main className="flex-1 min-w-0 space-y-4">
        {active ? (
          <>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    {active.name}
                    {composite && (
                      <Badge variant="secondary" className="text-[10px]">
                        Executivo
                      </Badge>
                    )}
                  </h2>
                  {active.description && (
                    <p className="text-sm text-muted-foreground">{active.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2" data-export-hide="true">
                  {composite && (
                    <ExecutiveExportButton
                      reportCode={activeCode as 'executivo_comercial' | 'vendedor_360'}
                      reportName={active.name}
                      filters={execFilters}
                      isLoading={execStatus.isLoading}
                      isEmpty={
                        execStatus.isEmpty ||
                        (activeCode === 'vendedor_360' && !execFilters.sellerId)
                      }
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFav(active.id)}
                    className="gap-2"
                  >
                    {favorites.has(active.id) ? (
                      <>
                        <Star className="h-4 w-4 fill-current text-primary" /> Favoritado
                      </>
                    ) : (
                      <>
                        <StarOff className="h-4 w-4" /> Favoritar
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {composite ? (
                <ExecutiveFiltersBar
                  filters={execFilters}
                  onChange={setExecFilters}
                  showSellerSelector={activeCode === 'vendedor_360'}
                  requireSeller={activeCode === 'vendedor_360'}
                />
              ) : (
                <BIFiltersBar
                  filters={{ startDate: filters.startDate!, endDate: filters.endDate! }}
                  onFiltersChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
                />
              )}
            </Card>

            {composite ? (
              activeCode === 'executivo_comercial' ? (
                <CommercialExecutiveReport
                  filters={execFilters}
                  onStatusChange={setExecStatus}
                />
              ) : (
                <Seller360Report
                  filters={execFilters}
                  onStatusChange={setExecStatus}
                />
              )
            ) : (
              <ReportRenderer
                data={report.data}
                isLoading={report.isLoading}
                error={report.error}
                chartType={active.chart_type}
              />
            )}
          </>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            Selecione um relatório à esquerda.
          </Card>
        )}
      </main>
    </div>
  );
}
