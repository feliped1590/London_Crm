import { Target, CheckCircle2, Hourglass, TrendingUp, Percent } from 'lucide-react';

interface Props {
  data: unknown;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickFirstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    if (k in obj) {
      const n = asNumber(obj[k]);
      if (n !== null) return n;
    }
  }
  return null;
}

const PCT_KEYS = ['pct_meta', 'percent_meta', 'percentual_meta', 'percentMeta', 'pctMeta'];

/**
 * Apresenta o retorno da RPC `forecast_vendas` quando o payload é um objeto único
 * (formato sumarizado: meta / fechado / aberto / forecast / % meta).
 * Nunca exibe JSON cru: campos ausentes mostram "não disponível".
 */
export function ForecastSummaryCard({ data }: Props) {
  if (!data || typeof data !== 'object') {
    return (
      <p className="text-sm text-[#64748B] py-4 text-center">
        Formato de forecast não reconhecido para apresentação.
      </p>
    );
  }
  const obj = data as Record<string, unknown>;

  const meta = pickFirstNumber(obj, ['meta', 'meta_total', 'metaTotal']);
  const fechado = pickFirstNumber(obj, ['fechado', 'realizado', 'valor_fechado']);
  const aberto = pickFirstNumber(obj, ['aberto', 'valor_aberto', 'em_aberto']);
  const forecast = pickFirstNumber(obj, ['forecast', 'valor_forecast', 'previsto']);
  const pct = pickFirstNumber(obj, PCT_KEYS);

  const items = [
    { label: 'Meta', value: meta, fmt: 'brl' as const, icon: Target, tone: 'text-[#2563EB]', chip: 'bg-[#2563EB]/10' },
    { label: 'Fechado', value: fechado, fmt: 'brl' as const, icon: CheckCircle2, tone: 'text-[#16A34A]', chip: 'bg-[#16A34A]/10' },
    { label: 'Aberto', value: aberto, fmt: 'brl' as const, icon: Hourglass, tone: 'text-[#F59E0B]', chip: 'bg-[#F59E0B]/15' },
    { label: 'Forecast', value: forecast, fmt: 'brl' as const, icon: TrendingUp, tone: 'text-[#4F46E5]', chip: 'bg-[#4F46E5]/10' },
    { label: '% da meta', value: pct, fmt: 'pct' as const, icon: Percent, tone: 'text-[#0F172A]', chip: 'bg-[#EFF4FB]' },
  ];

  const allNull = items.every((it) => it.value === null);
  if (allNull) {
    return (
      <p className="text-sm text-[#64748B] py-4 text-center">
        Forecast indisponível para os filtros atuais.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        const display =
          it.value === null
            ? 'não disponível'
            : it.fmt === 'brl'
            ? fmtBRL(it.value)
            : `${it.value.toFixed(1)}%`;
        return (
          <div
            key={it.label}
            className="border border-[#E2E8F0] rounded-[10px] p-3 bg-white"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-wide text-[#64748B] font-semibold">
                {it.label}
              </div>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${it.chip}`}>
                <Icon className={`h-3.5 w-3.5 ${it.tone}`} />
              </span>
            </div>
            <div
              className={`mt-1 text-[18px] font-bold tabular-nums leading-tight ${
                it.value === null ? 'text-[#94A3B8] text-sm font-normal italic' : 'text-[#0F172A]'
              }`}
            >
              {display}
            </div>
          </div>
        );
      })}
    </div>
  );
}
