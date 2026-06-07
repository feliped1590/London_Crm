import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subDays } from 'date-fns';
import { Brain, Star, StarOff, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BIFiltersBar } from '@/components/reports/bi/BIFiltersBar';
import { ReportRenderer } from '@/components/bi/ReportRenderer';
import {
  useReportDefinitions,
  useBIReport,
  useBIFavorites,
  ReportCode,
  ReportDefinition,
  BIReportFilters,
} from '@/hooks/useBIReports';

const CATEGORY_LABELS: Record<string, string> = {
  executivo: 'Visão Executiva',
  comercial: 'Comercial',
  funil: 'Funil',
  metas: 'Metas',
  produtos: 'Produtos & Faturamento',
  rankings: 'Rankings',
  clientes: 'Clientes',
  forecast: 'Forecast',
  favoritos: 'Favoritos',
};

const CATEGORY_ORDER = ['favoritos', 'executivo', 'comercial', 'funil', 'metas', 'produtos', 'rankings', 'clientes', 'forecast'];

export default function BICenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: definitions, isLoading: loadingDefs } = useReportDefinitions();
  const { favorites, toggle: toggleFav } = useBIFavorites();
  const [search, setSearch] = useState('');

  const [filters, setFilters] = useState<BIReportFilters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });

  const activeCode = (searchParams.get('r') as ReportCode | null) || 'dashboard_executivo';
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
    // Inject favorites pseudo-category
    const favList = (definitions || []).filter((d) => favorites.has(d.id));
    if (favList.length > 0) map.set('favoritos', favList);
    return Array.from(map.entries()).sort(
      ([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
    );
  }, [definitions, favorites, search]);

  const report = useBIReport(active?.code ?? null, filters);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)]">
      {/* Sidebar */}
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
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : (
          <nav className="space-y-4">
            {grouped.map(([cat, reports]) => (
              <div key={cat}>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">
                  {CATEGORY_LABELS[cat] || cat}
                </div>
                <ul className="space-y-0.5">
                  {reports.map((r) => {
                    const isActive = r.code === activeCode;
                    const isFav = favorites.has(r.id);
                    return (
                      <li key={r.id}>
                        <button
                          onClick={() => setActive(r.code as ReportCode)}
                          className={cn(
                            'group w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors',
                            isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-foreground'
                          )}
                        >
                          <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform', isActive && 'rotate-90')} />
                          <span className="flex-1 truncate">{r.name}</span>
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); toggleFav(r.id); }}
                            className="opacity-0 group-hover:opacity-100 data-[fav=true]:opacity-100 text-muted-foreground hover:text-primary"
                            data-fav={isFav}
                          >
                            {isFav ? <Star className="h-3.5 w-3.5 fill-current" /> : <StarOff className="h-3.5 w-3.5" />}
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

      {/* Main */}
      <main className="flex-1 min-w-0 space-y-4">
        {active ? (
          <>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{active.name}</h2>
                  {active.description && (
                    <p className="text-sm text-muted-foreground">{active.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleFav(active.id)}
                  className="gap-2"
                >
                  {favorites.has(active.id) ? (
                    <><Star className="h-4 w-4 fill-current text-primary" /> Favoritado</>
                  ) : (
                    <><StarOff className="h-4 w-4" /> Favoritar</>
                  )}
                </Button>
              </div>
              <BIFiltersBar
                filters={{ startDate: filters.startDate!, endDate: filters.endDate! }}
                onFiltersChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
              />
            </Card>

            <ReportRenderer
              data={report.data}
              isLoading={report.isLoading}
              error={report.error}
            />
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
