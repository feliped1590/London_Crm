import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExportPDFButton } from '@/components/reports/ExportPDFButton';
import { ExecutiveFilters } from './ExecutiveFiltersBar';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useSalesReps } from '@/hooks/useSalesReps';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  reportCode: 'executivo_comercial' | 'vendedor_360';
  reportName: string;
  filters: ExecutiveFilters;
  /** True enquanto qualquer bloco principal do relatório ainda está carregando. */
  isLoading?: boolean;
  /** True quando o relatório não tem nenhum dado principal renderizado. */
  isEmpty?: boolean;
}

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ExecutiveExportButton({
  reportCode,
  reportName,
  filters,
  isLoading,
  isEmpty,
}: Props) {
  const { accessibleEntities, activeLegalEntityId } = useLegalEntities();
  const { salesReps } = useSalesReps();
  const { user } = useAuth();

  const effectiveLeId = filters.legalEntityId ?? activeLegalEntityId ?? null;
  const entityName =
    accessibleEntities.find((e) => e.id === effectiveLeId)?.name ?? 'Todas acessíveis';
  const sellerName =
    reportCode === 'vendedor_360'
      ? (salesReps ?? []).find((s) => s.id === filters.sellerId)?.name ?? '—'
      : null;

  const periodo = `${format(filters.startDate, 'dd/MM/yyyy', { locale: ptBR })} – ${format(
    filters.endDate,
    'dd/MM/yyyy',
    { locale: ptBR }
  )}`;

  const userLabel = user?.user_metadata?.full_name || user?.email || '—';
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const headerExtraHtml = [
    `<div><strong>Entidade jurídica:</strong> ${esc(entityName)}</div>`,
    sellerName ? `<div><strong>Vendedor:</strong> ${esc(sellerName)}</div>` : '',
    `<div><strong>Período:</strong> ${esc(periodo)}</div>`,
    `<div><strong>Gerado por:</strong> ${esc(String(userLabel))}</div>`,
    `<div><strong>Gerado em:</strong> ${esc(geradoEm)}</div>`,
  ]
    .filter(Boolean)
    .join('');

  const titleSuffix =
    reportCode === 'vendedor_360' && sellerName && sellerName !== '—'
      ? ` — ${sellerName}`
      : entityName !== 'Todas acessíveis'
      ? ` — ${entityName}`
      : '';

  const disabled = !!isLoading || !!isEmpty;
  const disabledReason = isLoading
    ? 'Aguarde o carregamento completo para exportar'
    : isEmpty
    ? 'Sem dados para exportar neste filtro'
    : undefined;

  return (
    <ExportPDFButton
      containerId={`bi-export-${reportCode}`}
      title={`${reportName}${titleSuffix}`}
      headerExtraHtml={headerExtraHtml}
      disabled={disabled}
      disabledReason={disabledReason}
    />
  );
}
